import test from 'node:test';
import assert from 'node:assert/strict';
import {act} from '../server/actions';
import {id,newCampaign} from '../server/state';
import {campaignSchema,memberSchema} from '../server/save-schema';
import {trees,treeProgressSchema,referenceTreeCount} from '../shared/trees';
import {customTreeMeta} from '../shared/customTreeMeta';
import {customTreeData} from '../client/customTreeData';
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
 assert.equal(referenceTreeCount,42);assert.equal(trees.length,42+customTreeMeta.length);
 for(const p of [{treeId:'unknown',completed:[]},{treeId:trees[0].id,completed:[0,0]},{treeId:trees[0].id,completed:[99]}])assert.equal(treeProgressSchema.safeParse([p]).success,false);
});

test('custom sheet trees save, validate and export like reference trees',()=>{
 const gm=id(),player=id(),c=newCampaign('Custom',gm,'GM');c.members.push({userId:player,name:'Player',color:'#ffffff',role:'player',art:[]});
 const spec=customTreeMeta.find(t=>t.kind==='specialization')!,career=customTreeMeta.find(t=>t.kind==='career')!;
 assert.equal(new Set(trees.map(t=>t.id)).size,trees.length);
 for(const t of customTreeMeta){const d=customTreeData[t.id];assert.ok(d,t.id);if(t.kind==='specialization'){assert.equal(d.cells?.length,t.nodes);assert.equal(t.nodes,20);}else{assert.equal(d.sig?.length,2);assert.ok(d.sig!.every(a=>a.u.length===8));assert.equal(t.nodes,18);}}
 act(c,player,'profile:tree',{treeId:spec.id,operation:'add'});act(c,player,'profile:tree',{treeId:career.id,operation:'add'});
 act(c,player,'profile:tree',{treeId:spec.id,operation:'mark',node:19,completed:true});act(c,player,'profile:tree',{treeId:career.id,operation:'mark',node:17,completed:true});
 assert.throws(()=>act(c,player,'profile:tree',{treeId:spec.id,operation:'mark',node:20,completed:true}));
 assert.throws(()=>act(c,player,'profile:tree',{treeId:career.id,operation:'mark',node:18,completed:true}));
 const saved=JSON.parse(JSON.stringify(c.members[1].trees));
 assert.deepEqual(saved,[{treeId:spec.id,completed:[19]},{treeId:career.id,completed:[17]}]);
 assert.deepEqual(memberSchema.parse(c.members[1]).trees,saved);
 assert.equal(treeProgressSchema.safeParse([{treeId:career.id,completed:[18]}]).success,false);
});
