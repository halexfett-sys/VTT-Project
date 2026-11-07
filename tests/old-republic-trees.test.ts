import test from 'node:test';
import assert from 'node:assert/strict';
import {trees,treeProgressSchema} from '../shared/trees';
import {customTreeData} from '../client/customTreeData';
import {groupTrees,treeXp,isReachable} from '../client/treeIndex';

const added={
 'uni-cartel-dealer':'Cartel Dealer','uni-gladiator':'Gladiator','uni-imperial-loyalist':'Imperial Loyalist','uni-mandalorian-crusader':'Mandalorian Crusader',
 'tor-sith-acolyte':'Acolyte','tor-sith-blademaster':'Blademaster','tor-sith-lord':'Lord','tor-sith-sorcerer':'Sorcerer'};

test('the four Universal and four Sith trees are listed with the right game and career',()=>{
 for(const [id,name] of Object.entries(added)){
  const t=trees.find(x=>x.id===id)!;assert.ok(t,id);assert.equal(t.name,name);assert.equal(t.kind,'specialization');assert.equal(t.nodes,20);
  assert.equal(t.game,id.startsWith('uni-')?'Universal':'The Old Republic');assert.equal(t.career,id.startsWith('uni-')?'Universal':'Sith');
 }
 const sith=groupTrees().find(g=>g.name==='The Old Republic')!.careers;
 assert.deepEqual(sith.map(c=>c.name),['Sith']);assert.deepEqual(sith[0].specs.map(s=>s.name),['Acolyte','Blademaster','Lord','Sorcerer']);
 assert.equal(sith[0].career,undefined); // the Sith career has no signature-ability sheet
});
test('every new tree has 20 talents with costs, text and connectors that make sense',()=>{
 for(const id of Object.keys(added)){
  const d=customTreeData[id];assert.equal(d.skills.length,4,id);assert.equal(d.cells!.length,20,id);
  d.cells!.forEach((c,i)=>{
   const r=Math.floor(i/4),col=i%4;
   assert.ok(c.n.length>2&&c.d.length>8,`${id} ${i}`);assert.ok([5,10,15,20,25].includes(c.c),`${id} ${i} cost ${c.c}`);
   assert.ok(!/[|{}]\s*$/.test(c.n),`${id} ${i}`);
   for(const sym of c.d.match(/\{(\w+)\}/g)??[]) assert.ok(/^\{(setback|boost|difficulty|success|advantage|triumph|despair|threat|failure|forcedie|forcepoint_r|lightpip|darkpip)\}$/.test(sym),`${id} ${i} ${sym}`);
   if(col===3)assert.equal(c.rt,0,`${id} ${i} rt on last column`);
   if(r===4)assert.equal(c.dn,0,`${id} ${i} dn on last row`);
   if(r>0){const cells=d.cells!;const touches=cells[i-4].dn||c.dn||c.rt||(col>0&&cells[i-1].rt);assert.ok(touches,`${id} ${i} ${c.n} is not connected`);}
  });
 }
});
test('Force talents are flagged only on the Sith trees and spot checks match the sheets',()=>{
 for(const id of ['uni-cartel-dealer','uni-gladiator','uni-imperial-loyalist','uni-mandalorian-crusader'])assert.ok(customTreeData[id].cells!.every(c=>!c.f),id);
 const ac=customTreeData['tor-sith-acolyte'].cells!;
 assert.equal(ac.filter(c=>c.f).length,12);assert.equal(ac[4].n,'Reflect');assert.equal(ac[4].f,1);assert.equal(ac[4].a,1);assert.equal(ac[1].f,undefined);
 const lord=customTreeData['tor-sith-lord'].cells!;assert.equal(lord[1].c,5);assert.equal(lord[19].n,'Master of the Order');assert.equal(lord[19].c,25);
 const cd=customTreeData['uni-cartel-dealer'].cells!; // this sheet has uneven costs
 assert.deepEqual(cd.map(c=>c.c),[5,5,5,5,10,5,5,10,5,15,10,15,15,20,20,20,15,25,5,5]);
 const sorc=customTreeData['tor-sith-sorcerer'].cells!;assert.equal(sorc[18].n,'Channel Agony');assert.equal(sorc[18].c,15);
});
test('progress can be saved on the new trees and XP is counted',()=>{
 const ok=treeProgressSchema.parse([{treeId:'tor-sith-acolyte',completed:[0,1,4]},{treeId:'uni-gladiator',completed:[2]}]);assert.equal(ok.length,2);
 assert.equal(treeXp(customTreeData['tor-sith-acolyte'],new Set([0,1,4])),5+5+10);
 assert.equal(treeXp(customTreeData['uni-cartel-dealer'],new Set([5,9])),5+15);
 const cells=customTreeData['tor-sith-acolyte'].cells!;assert.ok(isReachable(cells,new Set(),0)&&!isReachable(cells,new Set(),19));
});
