import test from 'node:test';
import assert from 'node:assert/strict';
import {act} from '../server/actions';
import {id,newCampaign} from '../server/state';
import {memberSchema} from '../server/save-schema';
import {applySkillToPool,charCodes,emptyCharacter,findSkill,skillDefs,skillDice,withAllSkills} from '../shared/character';
import {importOggDude,parseXml} from '../shared/oggdude';

const xml=`<?xml version="1.0" encoding="utf-8"?>
<Character>
  <Description><CharName>Jax &amp; Co</CharName><PlayerName>Alex</PlayerName></Description>
  <Species><SpeciesKey>TWILEK</SpeciesKey></Species>
  <Career><CareerKey>BOUNTYHUNTER</CareerKey>
    <CareerSkills><Key>ATHL</Key><Key>BRAWL</Key></CareerSkills>
    <Specializations><CharSpecialization><Key>ASSASSIN</Key></CharSpecialization></Specializations>
  </Career>
  <Credits>750</Credits>
  <Characteristics>
    <CharCharacteristic><Key>BR</Key><Rank><StartingRanks>3</StartingRanks><PurchasedRanks>0</PurchasedRanks></Rank></CharCharacteristic>
    <CharCharacteristic><Key>AG</Key><Rank><StartingRanks>2</StartingRanks><PurchasedRanks>1</PurchasedRanks><TotalRanks>3</TotalRanks></Rank></CharCharacteristic>
    <CharCharacteristic><Key>INT</Key><Rank><StartingRanks>2</StartingRanks></Rank></CharCharacteristic>
    <CharCharacteristic><Key>CUN</Key><Rank><StartingRanks>2</StartingRanks></Rank></CharCharacteristic>
    <CharCharacteristic><Key>WIL</Key><Rank><StartingRanks>2</StartingRanks></Rank></CharCharacteristic>
    <CharCharacteristic><Key>PR</Key><Rank><StartingRanks>1</StartingRanks></Rank></CharCharacteristic>
  </Characteristics>
  <Skills>
    <CharSkill><Key>ATHL</Key><Rank><CareerRanks>1</CareerRanks><PurchasedRanks>1</PurchasedRanks></Rank></CharSkill>
    <CharSkill><Key>RANGHVY</Key><Rank><PurchasedRanks>2</PurchasedRanks></Rank><IsCareer>true</IsCareer></CharSkill>
    <CharSkill><Key>WEIRD</Key><Rank><PurchasedRanks>1</PurchasedRanks></Rank></CharSkill>
  </Skills>
</Character>`;

test('OggDude XML import reads identity, characteristics and skills',()=>{
 const {character:c,warnings}=importOggDude(xml);
 assert.equal(c.name,'Jax & Co');assert.equal(c.species,'Twilek');assert.equal(c.career,'Bountyhunter');
 assert.deepEqual(c.specializations,['Assassin']);assert.equal(c.credits,750);
 assert.deepEqual(c.characteristics,{brawn:3,agility:3,intellect:2,cunning:2,willpower:2,presence:1});
 const sk=(k:string)=>c.skills.find(s=>s.key===k)!;
 assert.equal(sk('ATHL').rank,2);assert.equal(sk('ATHL').career,true);
 assert.equal(sk('RANGHVY').rank,2);assert.equal(sk('RANGHVY').career,true);assert.equal(sk('RANGHVY').characteristic,'agility');
 assert.equal(sk('WEIRD').rank,1);
 assert.ok(warnings.some(w=>w.includes('WEIRD')));
 assert.equal(c.soak,3); // falls back to Brawn when the file has no soak value
});
test('importer rejects non-character files and survives hostile input',()=>{
 assert.throws(()=>importOggDude('<Foo/>'),/OggDude/);
 assert.throws(()=>importOggDude('not xml at all'),/XML/);
 assert.equal(parseXml('<a><b>&#x41;&lt;</b></a>').kids[0].text,'A<');
 assert.doesNotThrow(()=>importOggDude('<Character><Skills><CharSkill><Key>ATHL</Key><Rank>99999</Rank></CharSkill></Skills></Character>'));
});
test('skill dice use characteristic and rank, and replace only ability/proficiency',()=>{
 const c=emptyCharacter();c.characteristics.agility=3;
 const s={key:'STEAL',name:'Stealth',characteristic:'agility' as const,rank:2,career:true};
 assert.deepEqual(skillDice(c,s),{proficiency:2,ability:1});
 assert.deepEqual(skillDice(c,{...s,rank:0}),{proficiency:0,ability:3});
 assert.deepEqual(skillDice(c,{...s,rank:5}),{proficiency:3,ability:2});
 assert.deepEqual(applySkillToPool({ability:4,proficiency:4,difficulty:2,boost:1},c,s),{difficulty:2,boost:1,proficiency:2,ability:1});
 assert.equal(findSkill('Ranged (Light)')!.key,'RANGLT');assert.equal(findSkill('deceit')!.key,'DECEP');
 assert.ok(withAllSkills(c).length>=35);assert.equal(findSkill('Streetwise')!.characteristic,'cunning');
});
test('character data is saved by the owner only and validated',()=>{
 const gm=id(),p=id(),c=newCampaign('T',gm,'GM');c.members.push({userId:p,name:'P',color:'#ffffff',role:'player',art:[]});
 const ch=emptyCharacter();ch.name='Rey';ch.characteristics.willpower=4;
 act(c,p,'profile:update',{character:ch});
 assert.equal(c.members[1].character?.name,'Rey');assert.equal(c.members[0].character,undefined);
 assert.throws(()=>act(c,p,'profile:update',{character:{...ch,characteristics:{...ch.characteristics,brawn:99}}}));
 assert.ok(memberSchema.parse(c.members[1]).character);
});
test('import is one-to-one: every characteristic and every skill keeps its rank, characteristic and career flag',()=>{
 const codes=Object.keys(charCodes),chars=codes.map((k,i)=>`<CharCharacteristic><Key>${k}</Key><Rank><StartingRanks>${(i%3)+1}</StartingRanks><PurchasedRanks>${i%2}</PurchasedRanks></Rank></CharCharacteristic>`).join('');
 const rankOf=(i:number)=>(i%5)+1;
 const skills=skillDefs.map((d,i)=>`<CharSkill><Key>${d.key}</Key><Rank><CareerRanks>${rankOf(i)>1?1:0}</CareerRanks><PurchasedRanks>${rankOf(i)-(rankOf(i)>1?1:0)}</PurchasedRanks></Rank><IsCareer>${i%2?'true':'false'}</IsCareer></CharSkill>`).join('');
 const {character:c,warnings}=importOggDude(`<Character><Characteristics>${chars}</Characteristics><Skills>${skills}</Skills></Character>`);
 codes.forEach((k,i)=>assert.equal(c.characteristics[charCodes[k]],(i%3)+1+(i%2),k));
 assert.equal(c.skills.length,skillDefs.length);
 skillDefs.forEach((d,i)=>{
  const s=c.skills.find(x=>x.key===d.key);assert.ok(s,d.key);
  assert.equal(s.rank,rankOf(i),d.key);assert.equal(s.characteristic,d.characteristic,d.key);assert.equal(s.name,d.name,d.key);assert.equal(s.career,i%2===1,d.key);
 });
 assert.equal(new Set(c.skills.map(s=>s.key)).size,skillDefs.length);
 assert.deepEqual(warnings.filter(w=>/Unrecognised|characteristics were not found/.test(w)),[]);
 // The same skills are found when the file uses the skill's display name or an alias instead of the key.
 for(const d of skillDefs){for(const k of [d.name,...(d.aliases??[])]){
  const r=importOggDude(`<Character><Skills><CharSkill><Key>${k}</Key><Rank>2</Rank></CharSkill></Skills></Character>`).character.skills[0];
  assert.equal(r.key,d.key,k);assert.equal(r.characteristic,d.characteristic,k);
 }}
});
