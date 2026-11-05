import {z} from "zod";
import {customTreeMeta,type CustomTreeMeta} from "./customTreeMeta.js";

// Every tree is a custom-sheet tree: talent text, costs and connectors live in client/customTreeData.ts.
// Node numbering: specializations use 0-19 (row-major, 4 columns x 5 rows); careers use 0-17
// (signature ability 1 = node 0, its upgrades 1-8; signature ability 2 = node 9, its upgrades 10-17).
export type TreeMeta=CustomTreeMeta;
export const trees:readonly TreeMeta[]=customTreeMeta;

// The reference-image trees were retired. Their Edge of the Empire equivalents use identical node numbering,
// so progress saved under an old id carries over unchanged to the id it maps to here.
export const legacyTreeIds:Readonly<Record<string,string>>={
  "bounty-hunter-career": "eoe-bounty-hunter-career",
  "colonist-career": "eoe-colonist-career",
  "explorer-career": "eoe-explorer-career",
  "hired-gun-career": "eoe-hired-gun-career",
  "smuggler-career": "eoe-smuggler-career",
  "technician-career": "eoe-technician-career",
  "bounty-hunter-assassin": "eoe-assassin",
  "bounty-hunter-gadgeteer": "eoe-gadgeteer",
  "bounty-hunter-martial-artist": "eoe-martial-artist",
  "bounty-hunter-operator": "eoe-operator",
  "bounty-hunter-skip-tracer": "eoe-skip-tracer",
  "bounty-hunter-survivalist": "eoe-survivalist",
  "colonist-doctor": "eoe-doctor",
  "colonist-entrepreneur": "eoe-entrepreneur",
  "colonist-marshal": "eoe-marshal",
  "colonist-performer": "eoe-performer",
  "colonist-politico": "eoe-politico",
  "colonist-scholar": "eoe-scholar",
  "explorer-archaeologist": "eoe-archaeologist",
  "explorer-big-game-hunter": "eoe-big-game-hunter",
  "explorer-driver": "eoe-driver",
  "explorer-fringer": "eoe-fringer",
  "explorer-scout": "eoe-scout",
  "explorer-trader": "eoe-trader",
  "hired-gun-bodyguard": "eoe-bodyguard",
  "hired-gun-demolitionist": "eoe-demolitionist",
  "hired-gun-enforcer": "eoe-enforcer",
  "hired-gun-heavy": "eoe-heavy",
  "hired-gun-marauder": "eoe-marauder",
  "hired-gun-mercenary-soldier": "eoe-mercenary-soldier",
  "smuggler-charmer": "eoe-charmer",
  "smuggler-gambler": "eoe-gambler",
  "smuggler-gunslinger": "eoe-gunslinger",
  "smuggler-pilot": "eoe-pilot",
  "smuggler-scoundrel": "eoe-scoundrel",
  "smuggler-thief": "eoe-thief",
  "technician-cyber-tech": "eoe-cyber-tech",
  "technician-droid-tech": "eoe-droid-tech",
  "technician-mechanic": "eoe-mechanic",
  "technician-modder": "eoe-modder",
  "technician-outlaw-tech": "eoe-outlaw-tech",
  "technician-slicer": "eoe-slicer",
};

/** Remap legacy reference-image tree ids to their current ids, merging with any progress already saved there. */
export function migrateTreeProgress(input:unknown):unknown{
 if(!Array.isArray(input))return input;
 const out:Record<string,unknown>[]=[],seen=new Map<string,{index:number;migrated:boolean}>();
 for(const item of input){
  if(!item||typeof item!=='object'||typeof (item as {treeId?:unknown}).treeId!=='string'){out.push(item as Record<string,unknown>);continue;}
  const rec=item as Record<string,unknown>,id=rec.treeId as string,legacy=Object.hasOwn(legacyTreeIds,id)?legacyTreeIds[id]:undefined,treeId=legacy??id,prior=seen.get(treeId);
  const a=prior&&out[prior.index].completed,b=rec.completed;
  if(prior&&(prior.migrated||legacy!==undefined)&&Array.isArray(a)&&Array.isArray(b)){
   out[prior.index]={...out[prior.index],completed:[...new Set([...a,...b])].sort((x,y)=>(x as number)-(y as number))};
   prior.migrated=true;continue;
  }
  if(!prior)seen.set(treeId,{index:out.length,migrated:legacy!==undefined});
  out.push(legacy===undefined?rec:{...rec,treeId});
 }
 return out;
}

export const treeProgressSchema=z.preprocess(migrateTreeProgress,z.array(z.object({treeId:z.string(),completed:z.array(z.number().int().min(0)).max(20)}).superRefine((p,ctx)=>{
 const tree=trees.find(t=>t.id===p.treeId);
 if(!tree||p.completed.some(n=>n>=tree.nodes)||new Set(p.completed).size!==p.completed.length)ctx.addIssue({code:'custom',message:'Invalid tree or talent'});
})).max(trees.length).refine(a=>new Set(a.map(t=>t.treeId)).size===a.length,'Duplicate trees'));
export type TreeProgress=z.infer<typeof treeProgressSchema>;
