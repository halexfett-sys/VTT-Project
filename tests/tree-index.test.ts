import test from 'node:test';
import assert from 'node:assert/strict';
import {trees,legacyTreeIds,migrateTreeProgress,treeProgressSchema} from '../shared/trees';
import {customTreeData} from '../client/customTreeData';
import {buildSummary,groupTrees,isReachable,searchTrees,sigNode,toProgress,totals,treeXp} from '../client/treeIndex';

const groups=groupTrees();
const find=(id:string)=>trees.find(t=>t.id===id)!;

test('retired reference-image tree ids map onto existing custom trees',()=>{
  assert.equal(Object.keys(legacyTreeIds).length,42);
  const ids=new Set(trees.map(t=>t.id));
  for(const [old,now] of Object.entries(legacyTreeIds)){
    assert.ok(ids.has(now),now);assert.ok(!ids.has(old),`${old} must not also be a current id`);
    // The mapped tree has the node layout the image tree had: 18 for careers, 20 for specializations.
    assert.equal(find(now).nodes,old.endsWith('-career')?18:20);
  }
  assert.equal(new Set(Object.values(legacyTreeIds)).size,42);
});

test('legacy progress migrates, merges with existing progress and still validates',()=>{
  const out=migrateTreeProgress([{treeId:'bounty-hunter-assassin',completed:[0,5]},{treeId:'eoe-assassin',completed:[5,9]},{treeId:'eoe-smuggler-career',completed:[1]}]);
  assert.deepEqual(out,[{treeId:'eoe-assassin',completed:[0,5,9]},{treeId:'eoe-smuggler-career',completed:[1]}]);
  assert.deepEqual(treeProgressSchema.parse([{treeId:'smuggler-career',completed:[17]}]),[{treeId:'eoe-smuggler-career',completed:[17]}]);
  // Migration must not hide real problems: unknown ids, out-of-range nodes and plain duplicates still fail.
  assert.equal(treeProgressSchema.safeParse([{treeId:'nope',completed:[]}]).success,false);
  assert.equal(treeProgressSchema.safeParse([{treeId:'smuggler-career',completed:[18]}]).success,false);
  assert.equal(treeProgressSchema.safeParse([{treeId:'eoe-assassin',completed:[]},{treeId:'eoe-assassin',completed:[]}]).success,false);
  assert.equal(migrateTreeProgress(undefined),undefined);
});

test('trees group into games, careers, one signature tree and specializations',()=>{
  assert.deepEqual(groups.map(g=>g.name),['Age of Rebellion','Edge of the Empire','Force and Destiny','Universal','The Old Republic']);
  assert.deepEqual(groups.map(g=>g.careers.length),[6,6,6,1,1]);
  for(const g of groups.slice(0,3))for(const c of g.careers){assert.ok(c.career,c.name);assert.equal(c.specs.length,6);}
  assert.equal(groups[3].careers[0].career,undefined);assert.equal(groups[3].careers[0].specs.length,13);
  assert.equal(groups[4].careers[0].career,undefined);assert.equal(groups[4].careers[0].specs.length,4);
  assert.equal(groups.flatMap(g=>g.careers).reduce((n,c)=>n+c.specs.length+(c.career?1:0),0),trees.length);
});

test('talent reachability follows connectors and always allows the top row',()=>{
  const cells=customTreeData['eoe-assassin'].cells!;
  for(let i=0;i<4;i++)assert.equal(isReachable(cells,new Set(),i),true);
  assert.equal(isReachable(cells,new Set(),4),false);
  const down=cells.findIndex((c,i)=>i<16&&c.dn===1);
  assert.equal(isReachable(cells,new Set([down]),down+4),true);
  assert.equal(isReachable(cells,new Set(),down+4),false);
});

test('xp and totals count signature abilities, upgrades and specialization talents',()=>{
  const career=find('eoe-smuggler-career'),spec=find('eoe-pilot'),sig=customTreeData[career.id].sig!;
  assert.equal(treeXp(customTreeData[career.id],[sigNode(0)]),sig[0].c);
  assert.equal(treeXp(customTreeData[career.id],[sigNode(1,2)]),sig[1].u[2].c);
  const cells=customTreeData[spec.id].cells!;
  assert.equal(treeXp(customTreeData[spec.id],[0,1,2]),cells[0].c+cells[1].c+cells[2].c);
  const progress=toProgress([{treeId:career.id,completed:[sigNode(0)]},{treeId:spec.id,completed:[0,1]},{treeId:'gone',completed:[0]}]);
  assert.deepEqual(totals(customTreeData,progress),{xp:sig[0].c+cells[0].c+cells[1].c,count:3});
});

test('build summary lists upgrades without a base ability and counts repeated talents',()=>{
  const career=find('eoe-smuggler-career'),spec=find('eoe-pilot'),cells=customTreeData[spec.id].cells!;
  const dup=cells.map((c,i)=>[c.n,i] as const).filter(([n],_,a)=>a.filter(([m])=>m===n).length>1);
  const progress=toProgress([{treeId:career.id,completed:[sigNode(0,1),sigNode(1)]},{treeId:spec.id,completed:dup.length?dup.map(([,i])=>i):[0]}]);
  const sections=buildSummary(groups,customTreeData,progress);
  assert.equal(sections.length,1);assert.equal(sections[0].career,'Smuggler');
  const [a,b,c]=sections[0].items;
  assert.deepEqual(a,{kind:'signature',name:customTreeData[career.id].sig![0].n,base:false,upgrades:[customTreeData[career.id].sig![0].u[1].n]});
  assert.equal(b.kind==='signature'&&b.base,true);
  assert.equal(c.kind,'specialization');
  if(c.kind==='specialization'&&dup.length)assert.ok(c.talents.some(t=>t.count>1));
  assert.deepEqual(buildSummary(groups,customTreeData,toProgress([])),[]);
});

test('search finds talents and signature abilities, dedupes per specialization and needs 2 characters',()=>{
  assert.deepEqual(searchTrees(groups,customTreeData,'a'),[]);
  const hits=searchTrees(groups,customTreeData,'grit');
  assert.ok(hits.length>0&&hits.length<=40);
  for(const h of hits){assert.ok(find(h.treeId));assert.ok(h.node>=0&&h.node<find(h.treeId).nodes);}
  assert.equal(new Set(hits.map(h=>`${h.treeId}:${h.name}`)).size,hits.length);
  const sigName=customTreeData['eoe-smuggler-career'].sig![0].n;
  const sig=searchTrees(groups,customTreeData,sigName.toUpperCase()).find(h=>h.treeId==='eoe-smuggler-career');
  assert.ok(sig);assert.equal(sig.node,sigNode(0));assert.match(sig.where,/^Signature ability/);
  assert.equal(searchTrees(groups,customTreeData,'e',5).length,0);assert.equal(searchTrees(groups,customTreeData,'the',5).length,5);
});
