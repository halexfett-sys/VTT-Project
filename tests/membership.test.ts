import test from 'node:test';
import assert from 'node:assert/strict';
import {act} from '../server/actions';
import {id,newCampaign} from '../server/state';
import type {Asset} from '../shared/types';
const setup=()=>{const gm=id(),p=id(),q=id(),c=newCampaign('T',gm,'GM');
 for(const [u,n] of [[p,'P'],[q,'Q']] as const)c.members.push({userId:u,name:n,color:'#ffffff',role:'player',art:[]});
 return {gm,p,q,c};};
const asset=(owner:string,kind:Asset['kind']):Asset=>({id:id(),ownerId:owner,kind,name:'x.png',width:10,height:10});
test('a player can leave; their tokens pass to the GM; the GM cannot leave',()=>{
 const {gm,p,c}=setup();act(c,p,'token:create',{name:'Mine'});
 act(c,p,'member:leave',{});
 assert.ok(!c.members.some(m=>m.userId===p));assert.equal(c.tokens[0].ownerId,gm);
 assert.throws(()=>act(c,p,'chat:send',{text:'hi'}),/Join this campaign/);
 assert.throws(()=>act(c,gm,'member:leave',{}),/GM cannot leave/);
});
test('only the GM can remove players, and never another GM',()=>{
 const {gm,p,q,c}=setup();act(c,q,'token:create',{name:'Q token'});
 assert.throws(()=>act(c,p,'member:remove',{userId:q}),/GM permission/);
 assert.throws(()=>act(c,gm,'member:remove',{userId:gm}),/GM cannot be removed/);
 assert.throws(()=>act(c,gm,'member:remove',{userId:id()}),/not at this table/);
 act(c,gm,'member:remove',{userId:q});
 assert.deepEqual(c.members.map(m=>m.userId),[gm,p]);assert.equal(c.tokens[0].ownerId,gm);
});
test('token and character images can be deleted from the library by their owner or the GM',()=>{
 const {gm,p,q,c}=setup();const tok=asset(p,'token'),art=asset(p,'art'),map=asset(gm,'map');c.assets.push(tok,art,map);
 act(c,p,'token:create',{name:'T',assetId:tok.id});act(c,p,'profile:update',{portrait:art.id,art:[art.id]});
 assert.throws(()=>act(c,q,'asset:delete',{assetId:tok.id}),/permission/);
 assert.throws(()=>act(c,gm,'asset:delete',{assetId:map.id}),/Only token and character/);
 act(c,p,'asset:delete',{assetId:tok.id});
 assert.ok(!c.assets.some(a=>a.id===tok.id));assert.equal(c.tokens[0].assetId,undefined);assert.equal(c.tokens.length,1);
 act(c,gm,'asset:delete',{assetId:art.id});
 const m=c.members.find(m=>m.userId===p)!;assert.equal(m.portrait,undefined);assert.deepEqual(m.art,[]);
});
test('tokens can be created at a chosen size and the size is validated',()=>{
 const {p,c}=setup();
 act(c,p,'token:create',{name:'Big',size:3});act(c,p,'token:create',{name:'Normal'});
 assert.equal(c.tokens[0].size,3);assert.equal(c.tokens[1].size,1);
 assert.throws(()=>act(c,p,'token:create',{name:'Huge',size:50}));assert.throws(()=>act(c,p,'token:create',{name:'Tiny',size:0}));
});
