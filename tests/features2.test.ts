import test from 'node:test';
import assert from 'node:assert/strict';
import {act} from '../server/actions';
import {id,newCampaign,viewFor} from '../server/state';
import {campaignSchema} from '../server/save-schema';
import {emptyCharacter} from '../shared/character';
import type {Asset} from '../shared/types';
const setup=()=>{const gm=id(),p=id(),c=newCampaign('T',gm,'GM');c.members.push({userId:p,name:'P',color:'#ffffff',role:'player',art:[]});return {gm,p,c};};
const img=(owner:string):Asset=>({id:id(),ownerId:owner,kind:'token',name:'x.png',width:10,height:10});

test('a player can remove their character sheet and import another',()=>{
 const {p,c}=setup();const a=emptyCharacter();a.name='First';const nm=()=>c.members[1].character?.name;
 act(c,p,'profile:update',{character:a});assert.equal(nm(),'First');
 act(c,p,'profile:update',{character:null});assert.equal(c.members[1].character,undefined);
 const b=emptyCharacter();b.name='Second';act(c,p,'profile:update',{character:b});assert.equal(nm(),'Second');
 act(c,p,'profile:update',{name:'Renamed'});assert.equal(nm(),'Second'); // other edits keep the sheet
});
test('token image zoom/position are validated and a back image can be set, flipped and cleared',()=>{
 const {p,c}=setup();const f=img(p),b=img(p);c.assets.push(f,b);act(c,p,'token:create',{name:'T',assetId:f.id});const t=c.tokens[0];
 const look={background:'#112233',textColor:'#ffffff',outlineColor:'#ffffff',outlineWidth:2,shape:'circle',imageFit:'cover'};
 act(c,p,'token:update',{id:t.id,backAssetId:b.id,appearance:{...look,imageScale:1.5,imageX:-.25,imageY:.5,backImageScale:2,backImageX:.1,backImageY:0}});
 assert.equal(t.backAssetId,b.id);assert.equal(t.appearance?.imageScale,1.5);assert.equal(t.appearance?.backImageScale,2);
 assert.throws(()=>act(c,p,'token:update',{id:t.id,appearance:{...look,imageScale:9}}));
 assert.throws(()=>act(c,p,'token:update',{id:t.id,appearance:{...look,imageX:2}}));
 assert.equal(t.flipped,undefined);act(c,p,'token:flip',{id:t.id});assert.equal(t.flipped,true);act(c,p,'token:flip',{id:t.id});assert.equal(t.flipped,false);
 act(c,p,'token:update',{id:t.id,backAssetId:null});assert.equal(t.backAssetId,undefined);
 assert.ok(campaignSchema.shape.tokens.parse([{...t,backAssetId:b.id}])); // survives export validation
});
test('only the owner or GM can flip; other players never receive the back image until it is flipped',()=>{
 const {gm,p,c}=setup();const q=id();c.members.push({userId:q,name:'Q',color:'#ffffff',role:'player',art:[]});
 const f=img(gm),b=img(gm);c.assets.push(f,b);act(c,gm,'token:create',{name:'Monster',assetId:f.id});const t=c.tokens[0];
 act(c,gm,'token:update',{id:t.id,backAssetId:b.id});
 assert.throws(()=>act(c,p,'token:flip',{id:t.id}),/permission/);
 const seen=(u:string)=>viewFor(c,u).tokens[0];
 assert.equal(seen(p).backAssetId,undefined);assert.ok(!viewFor(c,p).assets.some(a=>a.id===b.id));assert.equal(seen(gm).backAssetId,b.id);
 act(c,gm,'token:flip',{id:t.id});
 assert.equal(seen(p).backAssetId,b.id);assert.equal(seen(q).flipped,true);
 act(c,gm,'asset:delete',{assetId:b.id});assert.equal(t.backAssetId,undefined);
});
test('rolls keep a label, and GM secret rolls are invisible to players',()=>{
 const {gm,p,c}=setup();
 act(c,p,'dice:roll',{ability:2});assert.equal(c.messages[0].text,'rolled a dice pool'); // legacy bare pool still works
 act(c,p,'dice:roll',{pool:{ability:2,proficiency:1},label:'Stealth'});assert.equal(c.messages[1].label,'Stealth');assert.equal(c.messages[1].secret,undefined);
 assert.throws(()=>act(c,p,'dice:roll',{pool:{ability:1},secret:true}),/GM permission/);
 act(c,gm,'dice:roll',{pool:{difficulty:3},secret:true,label:'Ambush'});
 const secret=c.messages[2];assert.equal(secret.secret,true);
 assert.ok(viewFor(c,gm).messages.some(m=>m.id===secret.id));
 assert.ok(!viewFor(c,p).messages.some(m=>m.id===secret.id));
 act(c,gm,'dice:roll',{pool:{difficulty:1}});assert.ok(viewFor(c,p).messages.some(m=>m.id===c.messages[3].id));
});
test('initiative slots can name a token, be hidden from players, edited and removed by the GM only',()=>{
 const {gm,p,c}=setup();act(c,gm,'token:create',{name:'Stormtrooper'});const t=c.tokens[0];
 act(c,gm,'initiative:add',{type:'NPC',success:3,advantage:1,tokenId:t.id,name:'Trooper',hidden:true});
 act(c,gm,'initiative:add',{type:'PC',success:2,advantage:0,name:'Rey'});
 assert.throws(()=>act(c,gm,'initiative:add',{type:'NPC',success:0,advantage:0,tokenId:id()}),/Unknown token/);
 assert.throws(()=>act(c,p,'initiative:update',{id:c.initiative.slots[0].id,hidden:false}),/GM permission/);
 const gmSlots=viewFor(c,gm).initiative.slots,pSlots=viewFor(c,p).initiative.slots;
 assert.equal(gmSlots[0].name,'Trooper');assert.equal(gmSlots[0].tokenId,t.id);
 assert.deepEqual(pSlots[0],{id:gmSlots[0].id,type:'NPC',success:0,advantage:0,used:false,hidden:true}); // masked: no name, token or numbers
 assert.equal(pSlots[1].name,'Rey');
 act(c,gm,'initiative:update',{id:gmSlots[0].id,hidden:false});assert.equal(viewFor(c,p).initiative.slots[0].name,'Trooper');
 act(c,gm,'initiative:update',{id:gmSlots[0].id,name:''});assert.equal(c.initiative.slots[0].name,undefined);
 t.hidden=true;assert.equal(viewFor(c,p).initiative.slots[0].hidden,true); // a token the GM hid on the map is masked here too
 act(c,gm,'initiative:remove',{id:gmSlots[0].id});assert.equal(c.initiative.slots.length,1);
});
