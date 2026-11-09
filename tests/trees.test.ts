import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {act} from '../server/actions';
import {id,newCampaign} from '../server/state';
import {campaignSchema,memberSchema} from '../server/save-schema';
import {trees,treeProgressSchema,talentPosition,legacyTreeIds,retiredTreeIds,migrateTreeProgress} from '../shared/trees';

test('tree progress is actor-owned, idempotent and survives saves',()=>{
 const gm=id(),player=id(),c=newCampaign('Trees',gm,'GM');c.members.push({userId:player,name:'Player',color:'#ffffff',role:'player',art:[]});
 const treeId=trees[0].id;
 act(c,player,'profile:tree',{treeId,operation:'add',userId:gm});
 for(let i=0;i<2;i++)act(c,player,'profile:tree',{treeId,operation:'mark',node:0,completed:true});
 assert.equal(c.members[0].trees,undefined);assert.deepEqual(c.members[1].trees,[{treeId,completed:[0]}]);
 assert.deepEqual(campaignSchema.parse(JSON.parse(JSON.stringify(c))).members[1].trees,c.members[1].trees);
 assert.deepEqual(memberSchema.parse(c.members[1]).trees,c.members[1].trees);
 assert.throws(()=>act(c,player,'profile:tree',{treeId,operation:'mark',node:99,completed:true}));
 act(c,player,'profile:tree',{treeId,operation:'mark',node:0,completed:false});assert.deepEqual(c.members[1].trees?.[0].completed,[]);
 act(c,player,'profile:tree',{treeId,operation:'remove'});assert.deepEqual(c.members[1].trees,[]);
});

test('tree save validation rejects unknown trees, duplicate nodes and invalid indices',()=>{
 for(const p of [{treeId:'unknown',completed:[]},{treeId:trees[0].id,completed:[0,0]},{treeId:trees[0].id,completed:[99]}])assert.equal(treeProgressSchema.safeParse([p]).success,false);
});

test('the catalog lists one reference image per tree, and every image exists in public/',()=>{
 assert.equal(trees.length,134);
 assert.equal(new Set(trees.map(t=>t.id)).size,trees.length);
 assert.equal(new Set(trees.map(t=>t.image)).size,trees.length);
 const perGame:Record<string,number>={};
 for(const t of trees){
  perGame[t.game]=(perGame[t.game]??0)+1;
  assert.equal(t.nodes,t.kind==='career'?18:20,t.id);
  assert.ok(/^\/Spec (EoE|FaD|AoR|ToR)\//.test(t.image),t.id);
  assert.ok(existsSync(join('public',t.image)),`missing image for ${t.id}: ${t.image}`);
 }
 assert.deepEqual(perGame,{'Edge of the Empire':42,'Force and Destiny':42,'Age of Rebellion':42,'Universal':4,'The Old Republic':4});
 for(const g of ['Edge of the Empire','Force and Destiny','Age of Rebellion'])assert.equal(trees.filter(t=>t.game===g&&t.kind==='career').length,6,g);
});

test('talent checkboxes sit inside the image and never overlap',()=>{
 for(const t of trees){
  const pts=Array.from({length:t.nodes},(_,n)=>talentPosition(t,n));
  for(const p of pts){assert.ok(p.x>0&&p.x<100&&p.y>0&&p.y<100,t.id);}
  assert.equal(new Set(pts.map(p=>`${p.x.toFixed(2)},${p.y.toFixed(2)}`)).size,pts.length,t.id);
 }
});

test('progress saved under older tree ids carries over, and retired trees are dropped',()=>{
 for(const [oldId,newId] of Object.entries(legacyTreeIds))assert.ok(trees.some(t=>t.id===newId),`${oldId} -> ${newId}`);
 for(const r of retiredTreeIds)assert.ok(!trees.some(t=>t.id===r),r);
 const parsed=treeProgressSchema.parse([{treeId:'bounty-hunter-assassin',completed:[1,2]},{treeId:'eoe-assassin',completed:[2,3]},{treeId:'uni-pirate',completed:[0]},{treeId:'uni-gladiator',completed:[4]}]);
 assert.deepEqual(parsed,[{treeId:'eoe-assassin',completed:[1,2,3]},{treeId:'uni-gladiator',completed:[4]}]);
 assert.deepEqual(migrateTreeProgress([{treeId:'uni-recruit',completed:[0]}]),[]);
});
