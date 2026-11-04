import {customTreeData,type Cell} from './customTreeData';
import type {TreeMeta} from '../shared/trees';

// {symbol} markers in generated descriptions map to the dice images in public/dice.
const SYMBOLS:Record<string,string>={ability:'ability',advantage:'advantage',boost:'boost',challenge:'challenge',darkpip:'dark',despair:'despair',difficulty:'difficulty',failure:'failure',forcedie:'force',lightpip:'light',proficiency:'proficiency',setback:'setback',success:'success',threat:'threat',triumph:'triumph',forcepoint_r:'forcepoint-r',forcepoint_l:'forcepoint-l'};
function Text({s}:{s:string}){
  return <>{s.split(/\{(\w+)\}/g).map((part,i)=>i%2?(SYMBOLS[part]?<img key={i} className="ct-sym" src={`/dice/${SYMBOLS[part]}.png`} alt={part} title={part}/>:`{${part}}`):part)}</>;
}
// XP spent in one custom tree; used for the summary line.
export function xpSpent(treeId:string,completed:number[]){
  const d=customTreeData[treeId];if(!d)return 0;
  return completed.reduce((sum,n)=>{
    if(d.cells)return sum+(d.cells[n]?.c||0);
    const a=Math.floor(n/9),sig=d.sig?.[a];if(!sig)return sum;
    return sum+(n%9===0?sig.c:sig.u[n%9-1]?.c||0);
  },0);
}
type Props={tree:TreeMeta;completed:number[];editable:boolean;busy:boolean;onToggle:(node:number,value:boolean)=>void};
export default function CustomTree({tree,completed,editable,busy,onToggle}:Props){
  const data=customTreeData[tree.id];
  if(!data)return <p role="alert">Tree data is missing for {tree.name}.</p>;
  const done=new Set(completed);
  const toggle=(n:number)=>onToggle(n,!done.has(n));
  const card=(key:number,name:string,desc:string,cost:number,cls:string,locked:boolean,label:string,ranked=false)=>{
    const on=done.has(key);
    return <button type="button" key={key} role="checkbox" aria-checked={on} aria-label={`${name}, ${cost} XP${label}`} disabled={!editable||busy}
      className={`ct-cell ${cls} ${on?'done':''} ${locked&&!on?'locked':''}`} onClick={()=>toggle(key)}>
      <span className="ct-head"><span className="ct-box">{on?'✓':''}</span><span className="ct-name">{name}</span></span>
      <span className="ct-desc"><Text s={desc}/></span>{ranked&&<span className="ct-rank" title="Ranked talent">▦</span>}<span className="ct-cost">{cost}</span>
    </button>;
  };
  let body;
  if(data.cells){
    const cells:Cell[]=data.cells;
    const open=(i:number)=>{const r=Math.floor(i/4),c=i%4;return r===0||(cells[i-4].dn&&done.has(i-4))||(c>0&&cells[i-1].rt&&done.has(i-1))||(c<3&&cells[i].rt&&done.has(i+1))||(r<4&&cells[i].dn&&done.has(i+4));};
    body=<div className="ct-grid">{cells.map((c,i)=>card(i,c.n,c.d,c.c,`${c.a?'active':''} ${c.dn?'dn':''} ${c.rt?'rt':''}`,!open(i),`, row ${Math.floor(i/4)+1} column ${i%4+1}`,!!c.k))}</div>;
  }else{
    body=<>{(data.sig||[]).map((a,ai)=><div className="ct-sig" key={ai}>
      <div className="ct-sig-main">{card(ai*9,a.n,a.d,a.c,'active wide',false,', signature ability')}</div>
      <div className="ct-grid">{a.u.map((u,ui)=>card(ai*9+1+ui,u.n,u.d,u.c,'',!done.has(ai*9),`, upgrade ${ui+1}`))}</div>
    </div>)}</>;
  }
  return <div className="ct-wrap"><div className="ct-meta">{data.skills.length>0&&<span>Career skills: {data.skills.join(', ')}</span>}<span>{completed.length}/{tree.nodes} purchased · {xpSpent(tree.id,completed)} XP spent</span></div>
    <p className="ct-hint">Dimmed talents are not yet reachable through a connector from a purchased talent; you can still check them. Dark headers are active talents.</p>
    <div className="tree-scroll"><div className="ct-body">{body}</div></div></div>;
}
