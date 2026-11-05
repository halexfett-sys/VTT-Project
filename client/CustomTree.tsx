import {useEffect,useRef,useState} from 'react';
import {customTreeData,type Cell} from './customTreeData';
import type {TreeMeta} from '../shared/trees';
import {isReachable,sigNode,treeXp} from './treeIndex';

// {symbol} markers in generated descriptions map to the dice images in public/dice.
const SYMBOLS:Record<string,string>={ability:'ability',advantage:'advantage',boost:'boost',challenge:'challenge',darkpip:'dark',despair:'despair',difficulty:'difficulty',failure:'failure',forcedie:'force',lightpip:'light',proficiency:'proficiency',setback:'setback',success:'success',threat:'threat',triumph:'triumph',forcepoint_r:'forcepoint-r',forcepoint_l:'forcepoint-l'};
function Text({s}:{s:string}){
  return <>{s.split(/\{(\w+)\}/g).map((part,i)=>i%2?(SYMBOLS[part]?<img key={i} className="ct-sym" src={`/dice/${SYMBOLS[part]}.png`} alt={part} title={part}/>:`{${part}}`):part)}</>;
}
// XP spent in one custom tree; used for the summary line.
export function xpSpent(treeId:string,completed:readonly number[]){return treeXp(customTreeData[treeId],completed);}
type Props={tree:TreeMeta;completed:readonly number[];editable?:boolean;onToggle:(node:number,value:boolean)=>void;focus?:{node:number;nonce:number}|null};
export default function CustomTree({tree,completed,editable=true,onToggle,focus}:Props){
  const data=customTreeData[tree.id],wrap=useRef<HTMLDivElement>(null),[pulse,setPulse]=useState<number|null>(null);
  // A search hit scrolls its talent into view and pulses it briefly.
  useEffect(()=>{
    if(!focus)return;
    setPulse(focus.node);
    wrap.current?.querySelector(`[data-node="${focus.node}"]`)?.scrollIntoView({block:'center',inline:'center',behavior:'smooth'});
    const timer=setTimeout(()=>setPulse(null),1700);
    return ()=>clearTimeout(timer);
  },[focus]);
  if(!data)return <p role="alert">Tree data is missing for {tree.name}.</p>;
  const done=new Set(completed);
  const card=(key:number,name:string,desc:string,cost:number,cls:string,locked:boolean,label:string,ranked=false)=>{
    const on=done.has(key);
    return <button type="button" key={key} role="checkbox" aria-checked={on} aria-label={`${name}, ${cost} XP${label}`} data-node={key} disabled={!editable}
      className={`ct-cell ${cls} ${on?'done':''} ${locked&&!on?'locked':''} ${pulse===key?'pulse':''}`} onClick={()=>onToggle(key,!on)}>
      <span className="ct-head"><span className="ct-box">{on?'✓':''}</span><span className="ct-name">{name}</span></span>
      <span className="ct-desc"><Text s={desc}/></span>{ranked&&<span className="ct-rank" title="Ranked talent">▦</span>}<span className="ct-cost">{cost}</span>
    </button>;
  };
  let body;
  if(data.cells){
    const cells:Cell[]=data.cells;
    body=<div className="ct-grid">{cells.map((c,i)=>card(i,c.n,c.d,c.c,`${c.a?'active':''} ${c.dn?'dn':''} ${c.rt?'rt':''}`,!isReachable(cells,done,i),`, row ${Math.floor(i/4)+1} column ${i%4+1}`,!!c.k))}</div>;
  }else{
    body=<>{(data.sig||[]).map((a,ai)=><div className="ct-sig" key={ai}>
      <div className="ct-sig-main">{card(sigNode(ai),a.n,a.d,a.c,'active wide',false,', signature ability')}</div>
      <div className="ct-grid">{a.u.map((u,ui)=>card(sigNode(ai,ui),u.n,u.d,u.c,`${ui<4?'dn':''} ${ui%4<3?'rt':''}`,!done.has(sigNode(ai)),`, upgrade ${ui+1}`))}</div>
    </div>)}</>;
  }
  const kind=tree.kind==='career'?'Signature abilities (30 XP each, upgrades 10 / 15 XP)':`${tree.career} specialization`;
  return <div className="ct-wrap" ref={wrap}><div className="ct-meta"><span>{kind} · <b>{completed.length}</b> / {tree.nodes} purchased · <b>{xpSpent(tree.id,completed)}</b> XP spent</span></div>
    {data.skills.length>0&&<div className="ct-chips" aria-label="Career skills">{data.skills.map(s=><span key={s}>{s}</span>)}</div>}
    <p className="ct-hint">Click a talent to mark it purchased. Dimmed talents aren’t yet reachable through a connector from a purchased talent. Dark headers are active talents; ▦ marks ranked talents.</p>
    <div className="tree-scroll"><div className="ct-body">{body}</div></div></div>;
}
