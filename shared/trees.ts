import {z} from "zod";
import {customTreeMeta} from "./customTreeMeta.js";
const baseTrees = [
  {
    "id": "bounty-hunter-career",
    "name": "Bounty Hunter Career",
    "career": "Bounty Hunter",
    "kind": "career",
    "image": "/trees/bounty-hunter-career.png",
    "nodes": 18
  },
  {
    "id": "colonist-career",
    "name": "Colonist Career",
    "career": "Colonist",
    "kind": "career",
    "image": "/trees/colonist-career.png",
    "nodes": 18
  },
  {
    "id": "explorer-career",
    "name": "Explorer Career",
    "career": "Explorer",
    "kind": "career",
    "image": "/trees/explorer-career.png",
    "nodes": 18
  },
  {
    "id": "hired-gun-career",
    "name": "Hired Gun Career",
    "career": "Hired Gun",
    "kind": "career",
    "image": "/trees/hired-gun-career.png",
    "nodes": 18
  },
  {
    "id": "smuggler-career",
    "name": "Smuggler Career",
    "career": "Smuggler",
    "kind": "career",
    "image": "/trees/smuggler-career.png",
    "nodes": 18
  },
  {
    "id": "technician-career",
    "name": "Technician Career",
    "career": "Technician",
    "kind": "career",
    "image": "/trees/technician-career.png",
    "nodes": 18
  },
  {
    "id": "bounty-hunter-assassin",
    "name": "Assassin",
    "career": "Bounty Hunter",
    "kind": "specialization",
    "image": "/trees/bounty-hunter-assassin.png",
    "nodes": 20
  },
  {
    "id": "bounty-hunter-gadgeteer",
    "name": "Gadgeteer",
    "career": "Bounty Hunter",
    "kind": "specialization",
    "image": "/trees/bounty-hunter-gadgeteer.png",
    "nodes": 20
  },
  {
    "id": "bounty-hunter-martial-artist",
    "name": "Martial Artist",
    "career": "Bounty Hunter",
    "kind": "specialization",
    "image": "/trees/bounty-hunter-martial-artist.png",
    "nodes": 20
  },
  {
    "id": "bounty-hunter-operator",
    "name": "Operator",
    "career": "Bounty Hunter",
    "kind": "specialization",
    "image": "/trees/bounty-hunter-operator.png",
    "nodes": 20
  },
  {
    "id": "bounty-hunter-skip-tracer",
    "name": "Skip Tracer",
    "career": "Bounty Hunter",
    "kind": "specialization",
    "image": "/trees/bounty-hunter-skip-tracer.png",
    "nodes": 20
  },
  {
    "id": "bounty-hunter-survivalist",
    "name": "Survivalist",
    "career": "Bounty Hunter",
    "kind": "specialization",
    "image": "/trees/bounty-hunter-survivalist.png",
    "nodes": 20
  },
  {
    "id": "colonist-doctor",
    "name": "Doctor",
    "career": "Colonist",
    "kind": "specialization",
    "image": "/trees/colonist-doctor.png",
    "nodes": 20
  },
  {
    "id": "colonist-entrepreneur",
    "name": "Entrepreneur",
    "career": "Colonist",
    "kind": "specialization",
    "image": "/trees/colonist-entrepreneur.png",
    "nodes": 20
  },
  {
    "id": "colonist-marshal",
    "name": "Marshal",
    "career": "Colonist",
    "kind": "specialization",
    "image": "/trees/colonist-marshal.png",
    "nodes": 20
  },
  {
    "id": "colonist-performer",
    "name": "Performer",
    "career": "Colonist",
    "kind": "specialization",
    "image": "/trees/colonist-performer.png",
    "nodes": 20
  },
  {
    "id": "colonist-politico",
    "name": "Politico",
    "career": "Colonist",
    "kind": "specialization",
    "image": "/trees/colonist-politico.png",
    "nodes": 20
  },
  {
    "id": "colonist-scholar",
    "name": "Scholar",
    "career": "Colonist",
    "kind": "specialization",
    "image": "/trees/colonist-scholar.png",
    "nodes": 20
  },
  {
    "id": "explorer-archaeologist",
    "name": "Archaeologist",
    "career": "Explorer",
    "kind": "specialization",
    "image": "/trees/explorer-archaeologist.png",
    "nodes": 20
  },
  {
    "id": "explorer-big-game-hunter",
    "name": "Big-Game Hunter",
    "career": "Explorer",
    "kind": "specialization",
    "image": "/trees/explorer-big-game-hunter.png",
    "nodes": 20
  },
  {
    "id": "explorer-driver",
    "name": "Driver",
    "career": "Explorer",
    "kind": "specialization",
    "image": "/trees/explorer-driver.png",
    "nodes": 20
  },
  {
    "id": "explorer-fringer",
    "name": "Fringer",
    "career": "Explorer",
    "kind": "specialization",
    "image": "/trees/explorer-fringer.png",
    "nodes": 20
  },
  {
    "id": "explorer-scout",
    "name": "Scout",
    "career": "Explorer",
    "kind": "specialization",
    "image": "/trees/explorer-scout.png",
    "nodes": 20
  },
  {
    "id": "explorer-trader",
    "name": "Trader",
    "career": "Explorer",
    "kind": "specialization",
    "image": "/trees/explorer-trader.png",
    "nodes": 20
  },
  {
    "id": "hired-gun-bodyguard",
    "name": "Bodyguard",
    "career": "Hired Gun",
    "kind": "specialization",
    "image": "/trees/hired-gun-bodyguard.png",
    "nodes": 20
  },
  {
    "id": "hired-gun-demolitionist",
    "name": "Demolitionist",
    "career": "Hired Gun",
    "kind": "specialization",
    "image": "/trees/hired-gun-demolitionist.png",
    "nodes": 20
  },
  {
    "id": "hired-gun-enforcer",
    "name": "Enforcer",
    "career": "Hired Gun",
    "kind": "specialization",
    "image": "/trees/hired-gun-enforcer.png",
    "nodes": 20
  },
  {
    "id": "hired-gun-heavy",
    "name": "Heavy",
    "career": "Hired Gun",
    "kind": "specialization",
    "image": "/trees/hired-gun-heavy.png",
    "nodes": 20
  },
  {
    "id": "hired-gun-marauder",
    "name": "Marauder",
    "career": "Hired Gun",
    "kind": "specialization",
    "image": "/trees/hired-gun-marauder.png",
    "nodes": 20
  },
  {
    "id": "hired-gun-mercenary-soldier",
    "name": "Mercenary Soldier",
    "career": "Hired Gun",
    "kind": "specialization",
    "image": "/trees/hired-gun-mercenary-soldier.png",
    "nodes": 20
  },
  {
    "id": "smuggler-charmer",
    "name": "Charmer",
    "career": "Smuggler",
    "kind": "specialization",
    "image": "/trees/smuggler-charmer.png",
    "nodes": 20
  },
  {
    "id": "smuggler-gambler",
    "name": "Gambler",
    "career": "Smuggler",
    "kind": "specialization",
    "image": "/trees/smuggler-gambler.png",
    "nodes": 20
  },
  {
    "id": "smuggler-gunslinger",
    "name": "Gunslinger",
    "career": "Smuggler",
    "kind": "specialization",
    "image": "/trees/smuggler-gunslinger.png",
    "nodes": 20
  },
  {
    "id": "smuggler-pilot",
    "name": "Pilot",
    "career": "Smuggler",
    "kind": "specialization",
    "image": "/trees/smuggler-pilot.png",
    "nodes": 20
  },
  {
    "id": "smuggler-scoundrel",
    "name": "Scoundrel",
    "career": "Smuggler",
    "kind": "specialization",
    "image": "/trees/smuggler-scoundrel.png",
    "nodes": 20
  },
  {
    "id": "smuggler-thief",
    "name": "Thief",
    "career": "Smuggler",
    "kind": "specialization",
    "image": "/trees/smuggler-thief.png",
    "nodes": 20
  },
  {
    "id": "technician-cyber-tech",
    "name": "Cyber Tech",
    "career": "Technician",
    "kind": "specialization",
    "image": "/trees/technician-cyber-tech.png",
    "nodes": 20
  },
  {
    "id": "technician-droid-tech",
    "name": "Droid Tech",
    "career": "Technician",
    "kind": "specialization",
    "image": "/trees/technician-droid-tech.png",
    "nodes": 20
  },
  {
    "id": "technician-mechanic",
    "name": "Mechanic",
    "career": "Technician",
    "kind": "specialization",
    "image": "/trees/technician-mechanic.png",
    "nodes": 20
  },
  {
    "id": "technician-modder",
    "name": "Modder",
    "career": "Technician",
    "kind": "specialization",
    "image": "/trees/technician-modder.png",
    "nodes": 20
  },
  {
    "id": "technician-outlaw-tech",
    "name": "Outlaw Tech",
    "career": "Technician",
    "kind": "specialization",
    "image": "/trees/technician-outlaw-tech.png",
    "nodes": 20
  },
  {
    "id": "technician-slicer",
    "name": "Slicer",
    "career": "Technician",
    "kind": "specialization",
    "image": "/trees/technician-slicer.png",
    "nodes": 20
  }
] as const;
// Reference-image trees come first; custom sheet trees (shared/customTreeMeta.ts) follow. Both use the same progress format.
export type TreeMeta={id:string;name:string;career:string;kind:'career'|'specialization';nodes:number;image?:string;game?:string;custom?:boolean};
export const trees:readonly TreeMeta[]=[...baseTrees,...customTreeMeta];
export const referenceTreeCount=baseTrees.length;
export const treeProgressSchema=z.array(z.object({treeId:z.string(),completed:z.array(z.number().int().min(0)).max(20)}).superRefine((p,ctx)=>{
 const tree=trees.find(t=>t.id===p.treeId);
 if(!tree||p.completed.some(n=>n>=tree.nodes)||new Set(p.completed).size!==p.completed.length)ctx.addIssue({code:'custom',message:'Invalid tree or talent'});
})).max(trees.length).refine(a=>new Set(a.map(t=>t.treeId)).size===a.length,'Duplicate trees');
export type TreeProgress=z.infer<typeof treeProgressSchema>;
// Normalized checkbox positions keep marks aligned while the reference image scales.
export function talentPosition(kind:string,index:number){
 const xs=[118,515,910,1305];
 if(kind==='specialization')return {x:xs[index%4]/1675*100,y:[303,649,996,1343,1690][Math.floor(index/4)]/2175*100};
 const n=index%9,base=index<9?0:952;
 return {x:xs[n===0?0:(n-1)%4]/1675*100,y:(base+(n===0?454:n<=4?729:1003))/2175*100};
}
