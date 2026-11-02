import test from 'node:test';
import assert from 'node:assert/strict';
import {ActionQueue} from '../client/action-queue';
test('rapid grid changes keep latest pending value without queuing every edit',()=>{
 const sent:any[]=[];const q=new ActionQueue((event,payload,done)=>sent.push({event,payload,done}));
 q.push('map:grid',{size:10});q.push('map:grid',{size:100});q.push('map:grid',{size:120});
 assert.equal(sent.length,1);sent[0].done(true);assert.equal(sent.length,2);assert.equal(sent[1].payload.size,120);
});
test('scene changes and rolls remain ordered and are never merged',()=>{
 const sent:any[]=[];const q=new ActionQueue((event,payload,done)=>sent.push({event,payload,done}));
 for(const event of ['map:grid','map:activate','map:grid','dice:roll','dice:roll'])q.push(event,{});
 for(let i=0;i<5;i++){assert.equal(sent.length,i+1);sent[i].done(true);}
 assert.deepEqual(sent.map(s=>s.event),['map:grid','map:activate','map:grid','dice:roll','dice:roll']);
});
test('disconnect discards pending actions instead of replaying into another session',()=>{
 const sent:any[]=[];const q=new ActionQueue((event,payload,done)=>sent.push({event,payload,done}));
 let result=true;q.push('map:grid',{});q.push('dice:roll',{},ok=>result=ok);q.close();sent[0].done(true);assert.equal(result,false);assert.equal(sent.length,1);
});
