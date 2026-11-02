import test from 'node:test';
import assert from 'node:assert/strict';
import {readApiResponse} from '../client/response';
test('hosting pages produce actionable errors instead of JSON syntax errors',async()=>{
 for(const status of [200,404,502]) await assert.rejects(
   readApiResponse(new Response('The page could not be found',{status,headers:{'content-type':'text/html'}})),
   new RegExp(`backend returned a page instead of JSON \\(HTTP ${status}`));
});
test('API responses preserve data and validation errors',async()=>{
 assert.deepEqual(await readApiResponse(Response.json({id:'test'})),{id:'test'});
 assert.equal(await readApiResponse(Response.json(null)),null);
 await assert.rejects(readApiResponse(Response.json({error:'Invite not found'},{status:400})),/Invite not found/);
 await assert.rejects(readApiResponse(new Response('broken',{headers:{'content-type':'application/json'}})),/invalid JSON/);
});
test('plain text rate and size limits have readable messages',async()=>{
 await assert.rejects(readApiResponse(new Response('Too many requests',{status:429})),/Wait a minute/);
 await assert.rejects(readApiResponse(new Response('Too large',{status:413})),/too large/);
});
