import test from 'node:test';
import assert from 'node:assert/strict';
import {act} from '../server/actions';
import {id,newCampaign} from '../server/state';
import {memberSchema} from '../server/save-schema';
import {applySkillToPool,emptyCharacter,findSkill,skillDice,withAllSkills} from '../shared/character';
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
 assert.ok(withAllSkills(c).length>=33);
});
test('character data is saved by the owner only and validated',()=>{
 const gm=id(),p=id(),c=newCampaign('T',gm,'GM');c.members.push({userId:p,name:'P',color:'#ffffff',role:'player',art:[]});
 const ch=emptyCharacter();ch.name='Rey';ch.characteristics.willpower=4;
 act(c,p,'profile:update',{character:ch});
 assert.equal(c.members[1].character?.name,'Rey');assert.equal(c.members[0].character,undefined);
 assert.throws(()=>act(c,p,'profile:update',{character:{...ch,characteristics:{...ch.characteristics,brawn:99}}}));
 assert.ok(memberSchema.parse(c.members[1]).character);
});

test('OggDude ranks: NonCareerRanks is not added again, and Streetwise (SW) and Warfare (WARF) are recognised',()=>{
 const x=`<Character><Characteristics>
  <CharCharacteristic><Key>WIL</Key><Rank><SpeciesRanks>2</SpeciesRanks><PurchasedRanks>1</PurchasedRanks></Rank></CharCharacteristic>
  <CharCharacteristic><Key>CUN</Key><Rank><SpeciesRanks>2</SpeciesRanks><PurchasedRanks>1</PurchasedRanks></Rank></CharCharacteristic></Characteristics>
  <Skills>
  <CharSkill><Key>COERC</Key><Rank><PurchasedRanks>3</PurchasedRanks><NonCareerRanks>3</NonCareerRanks></Rank><isCareer>true</isCareer></CharSkill>
  <CharSkill><Key>CHARM</Key><Rank><SpeciesRanks>1</SpeciesRanks><CareerRanks>1</CareerRanks><PurchasedRanks>2</PurchasedRanks></Rank></CharSkill>
  <CharSkill><Key>SW</Key><Rank><CareerRanks>1</CareerRanks><PurchasedRanks>2</PurchasedRanks></Rank></CharSkill>
  <CharSkill><Key>WARF</Key><Rank><PurchasedRanks>1</PurchasedRanks></Rank></CharSkill></Skills></Character>`;
 const {character:c,warnings}=importOggDude(x);
 const sk=(k:string)=>c.skills.find(s=>s.key===k)!,dice=(k:string)=>skillDice(c,sk(k));
 assert.equal(sk('COERC').rank,3);assert.deepEqual(dice('COERC'),{proficiency:3,ability:0}); // Willpower 3, Coercion 3 = PPP
 assert.equal(sk('CHARM').rank,4);
 assert.equal(sk('SW').characteristic,'cunning');assert.equal(sk('SW').rank,3);assert.deepEqual(dice('SW'),{proficiency:3,ability:0});
 assert.equal(sk('WARF').name,'Warfare');assert.equal(sk('WARF').characteristic,'intellect');
 assert.ok(!warnings.some(w=>/Unrecognised/.test(w)));
 // a sheet saved before Streetwise was known gets the right characteristic back
 const old={...c,skills:[{key:'SW',name:'Sw',characteristic:'intellect' as const,rank:3,career:true}]};
 assert.equal(withAllSkills(old).find(s=>s.key==='SW')!.characteristic,'cunning');
});
