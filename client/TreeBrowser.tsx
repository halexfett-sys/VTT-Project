import {useEffect,useRef,useState} from 'react';
import {trees,talentPosition,migrateTreeProgress,type TreeMeta,type TreeProgress} from '../shared/trees';
import type {Member} from '../shared/types';
const label=(t:TreeMeta)=>`${t.game}: ${t.name}`;
// Image paths contain spaces (e.g. "/Spec EoE/Assassin.png"), so they are encoded before use as a URL.
const src=(t:TreeMeta)=>encodeURI(t.image);
const games=[...new Set(trees.map(t=>t.game))];
export default function TreeBrowser({member,send}:{member:Member;send:(e:string,p:unknown,cb?:(ok:boolean)=>void)=>void}){
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[game,setGame]=useState(''),[career,setCareer]=useState(''),[mine,setMine]=useState(false),[selected,setSelected]=useState<string>(trees[0].id),[zoom,setZoom]=useState(100),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const nav=useRef<HTMLElement>(null);
 // Progress saved under retired tree ids is shown under the current ids.
 const savedAll=migrateTreeProgress(member.trees??[]) as TreeProgress;
 const tree=trees.find(t=>t.id===selected)!;
 const saved=savedAll.find(t=>t.treeId===selected);
 const addedIds=new Set(savedAll.map(p=>p.treeId));
 const update=(operation:string,node?:number,completed?:boolean)=>{setBusy(true);setError('');send('profile:tree',{treeId:selected,operation,node,completed},ok=>{setBusy(false);if(!ok)setError('Could not save tree progress. Please try again.');});};
 const pool=trees.filter(t=>!game||t.game===game);
 const careers=[...new Set(pool.map(t=>t.career))];
 const list=pool.filter(t=>(!career||t.career===career)&&(!mine||addedIds.has(t.id))&&`${t.name} ${t.career} ${t.game}`.toLowerCase().includes(query.toLowerCase()));
 const show=(id?:string)=>{if(id){setSelected(id);setZoom(100);}setQuery('');setGame('');setCareer('');setMine(false);setOpen(true);};
 // Bring the selected tree into view in the list when the dialog opens.
 useEffect(()=>{if(open)nav.current?.querySelector('[aria-pressed=true]')?.scrollIntoView({block:'nearest'});},[open]);
 return <section className="tree-launch"><h3>Career & specialization trees</h3><p>{savedAll.length} {savedAll.length===1?'tree':'trees'} saved to your profile.</p><button className="full" onClick={()=>show()}>Browse trees</button>
 {savedAll.map(p=>{const t=trees.find(t=>t.id===p.treeId);return t&&<button className="full" key={t.id} onClick={()=>show(t.id)}>{label(t)} · {p.completed.length}/{t.nodes}</button>;})}
 {open&&<div className="tree-backdrop" onKeyDown={e=>{if(e.key==='Escape')setOpen(false);}}><section role="dialog" aria-modal="true" aria-label="Career and specialization trees" className="tree-dialog"><header><h2>Career & specialization trees</h2><button autoFocus onClick={()=>setOpen(false)}>Close</button></header><div className="tree-layout"><aside>
 <label>Search trees<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Name, career or game"/></label>
 <label>Game<select value={game} onChange={e=>{setGame(e.target.value);setCareer('');}}><option value="">All games</option>{games.map(g=><option key={g}>{g}</option>)}</select></label>
 <label>Career<select value={career} onChange={e=>setCareer(e.target.value)}><option value="">All careers</option>{careers.map(c=><option key={c}>{c}</option>)}</select></label>
 <label><input type="checkbox" checked={mine} onChange={e=>setMine(e.target.checked)}/> My trees only</label>
 <nav aria-label="Tree library" ref={nav}>{list.length?list.map(t=><button key={t.id} aria-pressed={selected===t.id} onClick={()=>{setSelected(t.id);setZoom(100);setError('');}}><strong>{t.name}</strong><small>{t.game} · {t.career} · {t.kind==='career'?'Signature abilities':'Specialization'}{addedIds.has(t.id)?' · Added':''}</small></button>):<p>No matching trees.</p>}</nav></aside>
 <main><div className="tree-controls"><strong>{tree.game} / {tree.career} / {tree.name}</strong>{saved?<><span>{saved.completed.length}/{tree.nodes} completed</span><button disabled={busy} onClick={()=>{if(window.confirm('Remove this tree and its talent checkmarks from your profile?'))update('remove');}}>Remove tree</button></>:<button disabled={busy} onClick={()=>update('add')}>Add to my profile</button>}<label>Zoom <select value={zoom} onChange={e=>setZoom(Number(e.target.value))}>{[75,100,125,150,200].map(n=><option key={n} value={n}>{n}%</option>)}</select></label></div>
 <p>{saved?'Click a checkbox to mark or unmark a completed talent. Changes save automatically.':'Add this tree to your profile to mark completed talents.'} Progress is included in player and game exports.</p>{error&&<p role="alert">{error}</p>}
 <div className="tree-scroll"><div className="tree-sheet" style={{width:`${zoom}%`}}><img key={tree.id} src={src(tree)} alt={`${tree.game}, ${tree.career}: ${tree.name} reference tree`} draggable={false}/>{Array.from({length:tree.nodes},(_,n)=>{const pos=talentPosition(tree,n),checked=saved?.completed.includes(n)||false;return <button key={n} className={`talent-mark ${checked?'completed':''}`} style={{left:`${pos.x}%`,top:`${pos.y}%`}} disabled={!saved||busy} aria-label={`Talent ${n+1}${tree.kind==='specialization'?`, row ${Math.floor(n/4)+1}, column ${n%4+1}`:''}`} aria-pressed={checked} title={`Talent ${n+1}: ${checked?'completed':'not completed'}`} onClick={()=>update('mark',n,!checked)}>{checked?'✓':''}</button>;})}</div></div>
 </main></div></section></div>}
 </section>;
}
