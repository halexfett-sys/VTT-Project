import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {createApp} from '../server/app';
import {act} from '../server/actions';
import {saveSchema} from '../server/save-schema';
test('portable guest saves preserve images and sheets, filter secrets, and securely reclaim players',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'vtt-saves-')),server=createApp(dir);
 await new Promise<void>(r=>server.http.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${(server.http.address() as any).port}`;
 const request=async(route:string,cookie='',body?:any)=>{const r=await fetch(base+'/api'+route,{method:body?'POST':'GET',headers:{cookie,...(body instanceof FormData?{}:{'Content-Type':'application/json'})},body:body instanceof FormData?body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]||cookie};};
 const importFile=async(route:string,cookie:string,data:any,fields:Record<string,string>={})=>{const f=new FormData();f.set('file',new Blob([JSON.stringify(data)]),'save.json');Object.entries(fields).forEach(([k,v])=>f.set(k,v));return request(route,cookie,f);};
 try{
 const gm=await request('/guest','',{name:'GM'}),p=await request('/guest','',{name:'Pilot'});
 const room=(await request('/rooms',gm.cookie,{name:'Portable campaign'})).data.id;
 await request('/join',p.cookie,{code:server.store.get(room).invite,name:'Pilot',color:'#abcdef'});
 const image=await sharp({create:{width:32,height:32,channels:3,background:'#ff0000'}}).png().toBuffer(),f=new FormData();f.set('kind','art');f.set('file',new Blob([new Uint8Array(image)],{type: 'image/png'}),'portrait.png');
 const asset=(await request(`/rooms/${room}/assets`,p.cookie,f)).data;
 let c=server.store.get(room);act(c,p.data.id,'profile:update',{portrait:asset.id,art:[asset.id]});act(c,p.data.id,'token:create',{name:'Pilot token',assetId:asset.id});c.tokens[0].sheet.notes='Personal notes';c.tokens[0].sheet.credits=1234;
 act(c,gm.data.id,'token:create',{name:'Secret enemy'});c.tokens[1].hidden=true;act(c,gm.data.id,'dice:roll',{ability:2});server.store.save(c);
 const player=(await request(`/rooms/${room}/export/player`,p.cookie)).data;
 assert.equal(saveSchema.safeParse(player).success,true);assert.equal(player.files.length,1);assert.equal(player.tokens[0].sheet.credits,1234);
 const full=(await request(`/rooms/${room}/export/table`,gm.cookie)).data;
 assert.equal(saveSchema.safeParse(full).success,true);assert.equal(full.kind,'campaign');assert.equal(full.claims.length,1);
 const visible=(await request(`/rooms/${room}/export/table`,p.cookie)).data;
 assert.equal(visible.kind,'table');assert.equal(visible.campaign.tokens.length,1);assert.equal(visible.campaign.invite,'');assert.equal(visible.campaign.maps[0].fog.length,0);assert.equal(visible.files.length,2);
 const newGM=await request('/guest','',{name:'New GM'}),restored=await importFile('/restore',newGM.cookie,full);assert.equal(restored.status,200,JSON.stringify(restored.data));
 let copy=server.store.get(restored.data.id);assert.equal(copy.tokens.length,2);assert.equal(copy.members.find(m=>m.userId===newGM.data.id)?.role,'gm');assert.notEqual(copy.assets[0].id,asset.id);
 const newPlayer=await request('/guest','',{name:'New Pilot'}),joined=await importFile('/join-save',newPlayer.cookie,player,{code:copy.invite});assert.equal(joined.status,200,JSON.stringify(joined.data));
 copy=server.store.get(copy.id);assert.equal(copy.members.length,2);assert.equal(copy.members.find(m=>m.userId===newPlayer.data.id)?.name,'Pilot');assert.equal(copy.tokens.find(t=>t.ownerId===newPlayer.data.id)?.sheet.notes,'Personal notes');assert.equal(copy.tokens.length,2);
 const portrait=copy.members.find(m=>m.userId===newPlayer.data.id)!.portrait;assert.equal((await fetch(`${base}/api/rooms/${copy.id}/assets/${portrait}`,{headers:{cookie:newPlayer.cookie}})).status,200);
 // Edited IDs and role fields cannot claim the GM; only a matching secret can reclaim a player.
 const stranger=await request('/guest','',{name:'Stranger'}),tampered=structuredClone(player);tampered.profile.userId=newGM.data.id;tampered.profile.role='gm';tampered.tokens.forEach((t:any)=>t.ownerId=newGM.data.id);tampered.resumeKey='0'.repeat(64);
 const forged=await importFile('/join-save',stranger.cookie,tampered,{code:copy.invite});assert.equal(forged.status,200);copy=server.store.get(copy.id);assert.equal(copy.members.find(m=>m.userId===stranger.data.id)?.role,'player');assert.equal(copy.members.find(m=>m.userId===newGM.data.id)?.role,'gm');
 const bad=structuredClone(player);bad.files[0].data='bm90LWFuLWltYWdl';const before=copy.revision;assert.equal((await importFile('/join-save',stranger.cookie,bad,{roomId:copy.id})).status,400);assert.equal(server.store.get(copy.id).revision,before);
 }finally{await new Promise<void>(r=>server.io.close(()=>r()));server.store.db.close();await rm(dir,{recursive:true,force:true});}
});

