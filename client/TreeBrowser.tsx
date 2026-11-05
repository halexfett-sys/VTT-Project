import {lazy,Suspense,useState} from 'react';
import {trees,migrateTreeProgress,type TreeMeta,type TreeProgress} from '../shared/trees';
import type {Member} from '../shared/types';
// The dialog carries ~450 KB of talent text, so it is loaded on demand.
const TreeDialog=lazy(()=>import('./TreeDialog'));
const label=(t:TreeMeta)=>`${t.game}: ${t.name}`;
export default function TreeBrowser({member,send}:{member:Member;send:(e:string,p:unknown,cb?:(ok:boolean)=>void)=>void}){
 const [open,setOpen]=useState(false),[focusId,setFocusId]=useState<string>();
 // Progress saved under the retired reference-image tree ids is shown under their current ids.
 const saved=migrateTreeProgress(member.trees??[]) as TreeProgress;
 const active=saved.flatMap(p=>{const t=trees.find(t=>t.id===p.treeId);return t&&p.completed.length?[{t,count:p.completed.length}]:[];});
 const show=(id?:string)=>{setFocusId(id);setOpen(true);};
 return <section className="tree-launch"><h3>Career & specialization trees</h3><p>{active.length} {active.length===1?'tree':'trees'} with purchased talents.</p><button className="full" onClick={()=>show()}>Browse trees</button>
  {active.map(({t,count})=><button className="full" key={t.id} onClick={()=>show(t.id)}>{label(t)} · {count}/{t.nodes}</button>)}
  {open&&<Suspense fallback={<div className="tree-backdrop"><p>Loading trees…</p></div>}><TreeDialog saved={saved} send={send} initialTreeId={focusId} onClose={()=>setOpen(false)}/></Suspense>}
 </section>;
}
