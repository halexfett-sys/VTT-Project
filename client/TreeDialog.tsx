import {useEffect,useMemo,useRef,useState} from 'react';
import {trees,type TreeProgress} from '../shared/trees';
import {customTreeData} from './customTreeData';
import CustomTree from './CustomTree';
import {buildSummary,groupTrees,searchTrees,toProgress,totals,type Progress} from './treeIndex';

// The career & specialization tracker: browse by game and career, tick talents, see XP and your whole build.
// Progress is saved per player through the server's profile:tree action (add / mark / remove).
type Send=(event:string,payload:unknown,done?:(ok:boolean)=>void)=>void;
type Props={saved:TreeProgress;send:Send;initialTreeId?:string;onClose:()=>void};
type Sel={game:string;career:string;tab:string};
const sameSet=(a:ReadonlySet<number>,b:readonly number[])=>a.size===b.length&&b.every(n=>a.has(n));
const groups=groupTrees();
const findTree=(id?:string)=>trees.find(t=>t.id===id);
// The tab shown first for a career: its signature abilities when it has any, else its first specialization.
const firstTab=(g:string,c:string)=>{const cg=groups.find(x=>x.name===g)?.careers.find(x=>x.name===c);return cg?.career?.id??cg?.specs[0]?.id??'';};
const startSel=(id?:string):Sel=>{
  const t=findTree(id);
  if(t)return {game:t.game,career:t.career,tab:t.id};
  const g=groups[0],c=g.careers[0];return {game:g.name,career:c.name,tab:firstTab(g.name,c.name)};
};

export default function TreeDialog({saved,send,initialTreeId,onClose}:Props){
  const [sel,setSel]=useState<Sel>(()=>startSel(initialTreeId)),[build,setBuild]=useState(false),[query,setQuery]=useState(''),[showHits,setShowHits]=useState(false),[error,setError]=useState('');
  const [focus,setFocus]=useState<{treeId:string;node:number;nonce:number}|null>(null);
  // Optimistic overlay so ticking feels instant; an entry is dropped once the server snapshot agrees (null = tree removed).
  const [over,setOver]=useState<Record<string,number[]|null>>({});
  const added=useRef(new Set<string>());
  const live=useRef<Progress>(new Map());   // always the newest progress, so back-to-back clicks never read a stale render
  const serverMap=useMemo(()=>toProgress(saved),[saved]);
  const progress=useMemo(()=>{
    const m=new Map(serverMap);
    for(const [id,v] of Object.entries(over)){if(v===null)m.delete(id);else m.set(id,new Set(v));}
    return m;
  },[serverMap,over]);
  live.current=progress;
  useEffect(()=>setOver(o=>{
    let changed=false;const n={...o};
    for(const [id,v] of Object.entries(o)){const s=serverMap.get(id);if(v===null?s===undefined:s!==undefined&&sameSet(s,v)){delete n[id];changed=true;}}
    return changed?n:o;
  }),[serverMap]);

  const fail=(id:string)=>{setError('Could not save tree progress. Please try again.');added.current.delete(id);setOver(o=>{const {[id]:_,...rest}=o;return rest;});};
  const toggle=(treeId:string,node:number,value:boolean)=>{
    setError('');
    const have=live.current.get(treeId),next=new Set(have??[]);
    if(value)next.add(node);else next.delete(node);
    live.current=new Map(live.current).set(treeId,next);
    setOver(o=>({...o,[treeId]:[...next].sort((a,b)=>a-b)}));
    // A tree joins the player's profile the first time one of its talents is ticked.
    if(!have&&!added.current.has(treeId)){added.current.add(treeId);send('profile:tree',{treeId,operation:'add'});}
    send('profile:tree',{treeId,operation:'mark',node,completed:value},ok=>{if(!ok)fail(treeId);});
  };
  const clearTrees=(ids:string[])=>{
    setError('');
    setOver(o=>({...o,...Object.fromEntries(ids.map(id=>[id,null]))}));
    for(const id of ids){added.current.delete(id);send('profile:tree',{treeId:id,operation:'remove'},ok=>{if(!ok)fail(id);});}
  };

  const stats=useMemo(()=>totals(customTreeData,progress),[progress]);
  const hits=useMemo(()=>searchTrees(groups,customTreeData,query),[query]);
  const summary=useMemo(()=>buildSummary(groups,customTreeData,progress),[progress]);
  const game=groups.find(g=>g.name===sel.game)!,cg=game.careers.find(c=>c.name===sel.career)!;
  const tabs=[...(cg.career?[cg.career]:[]),...cg.specs],tree=tabs.find(t=>t.id===sel.tab)??tabs[0];
  const done=(id:string)=>progress.get(id)?.size??0;
  const careerCount=(c:typeof cg)=>c.specs.reduce((n,s)=>n+done(s.id),0);
  const pick=(g:string,c:string)=>{setSel({game:g,career:c,tab:firstTab(g,c)});setBuild(false);setFocus(null);};
  const jump=(h:{treeId:string;node:number})=>{
    const t=findTree(h.treeId)!;
    setSel({game:t.game,career:t.career,tab:t.id});setBuild(false);setShowHits(false);setFocus({treeId:h.treeId,node:h.node,nonce:Date.now()});
  };
  const close=()=>{if(showHits&&query.length>=2)setShowHits(false);else onClose();};
  const title=cg.name===game.name?`${cg.name} specializations`:cg.name;

  return <div className="tree-backdrop" onKeyDown={e=>{if(e.key==='Escape')close();}}><section role="dialog" aria-modal="true" aria-label="Career and specialization trees" className="tree-dialog">
    <header><h2>Career <span>&amp;</span> specialization trees</h2>
      <span className="tree-xp" aria-live="polite">{stats.xp} XP</span>
      <div className="tree-search" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setShowHits(false);}}>
        <input type="search" value={query} placeholder="Search talents & abilities…" aria-label="Search talents and abilities" onChange={e=>{setQuery(e.target.value);setShowHits(true);}} onFocus={()=>setShowHits(true)}/>
        {showHits&&query.trim().length>=2&&(hits.length?<ul className="tree-results">{hits.map(h=><li key={`${h.treeId}:${h.node}`}><button type="button" onClick={()=>jump(h)}>{h.name}<small>{h.where}</small></button></li>)}</ul>:<p className="tree-results">No matches</p>)}
      </div>
      <button aria-pressed={build} onClick={()=>setBuild(b=>!b)}>My Build</button>
      <button disabled={!stats.count} onClick={()=>{if(window.confirm('Clear every checked talent and ability?'))clearTrees([...progress.keys()]);}}>Reset</button>
      <button autoFocus onClick={onClose}>Close</button></header>
    <div className="tree-layout"><aside><nav aria-label="Careers">{groups.map(g=><div key={g.name}><h3>{g.name}</h3>{g.careers.map(c=><button type="button" key={c.name} aria-pressed={!build&&sel.game===g.name&&sel.career===c.name} onClick={()=>pick(g.name,c.name)}><span>{c.name}</span><em>{careerCount(c)}</em></button>)}</div>)}</nav></aside>
    <main>{error&&<p role="alert">{error}</p>}
      {build?<div className="tree-scroll"><div className="tree-build"><h2>My Build</h2><p className="tree-sub">Everything you’ve checked off, across all trees.</p>
        <p className="tree-big">{stats.xp} XP <span className="tree-sub">· {stats.count} purchases</span></p>
        {summary.length?summary.map(s=><section key={`${s.game}:${s.career}`}><h3>{s.game} — {s.career}</h3><ul>{s.items.map(it=>it.kind==='signature'
          ?<li key={it.name}><b>{it.name}</b> (signature){!it.base&&<i> — upgrades without base ability</i>}{it.upgrades.length>0&&`: ${it.upgrades.join(', ')}`}</li>
          :<li key={it.name}><b>{it.name}</b> ({it.owned}/20): {it.talents.map(t=>t.count>1?`${t.name} ×${t.count}`:t.name).join(', ')}</li>)}</ul></section>)
          :<p className="tree-sub">Nothing checked yet. Pick a career on the left and click talents to add them.</p>}
      </div></div>
      :<>
        <div className="tree-title"><h2>{title}</h2><span className="tree-sub">{game.name}</span>
          {tree&&done(tree.id)>0&&<button className="tree-clear" onClick={()=>{if(window.confirm(`Clear the checkmarks on ${tree.name}?`))clearTrees([tree.id]);}}>Clear this tree</button>}</div>
        <div className="tree-tabs" role="group" aria-label="Trees in this career">{tabs.map(t=><button type="button" key={t.id} aria-pressed={t.id===tree?.id} onClick={()=>{setSel({...sel,tab:t.id});setFocus(null);}}>{t.kind==='career'?'Signature Abilities':t.name}{t.kind==='specialization'&&<em> {done(t.id)}/{t.nodes}</em>}</button>)}</div>
        {tree&&<>{tree.kind==='specialization'&&<h3 className="tree-spec">{tree.name}</h3>}<CustomTree key={tree.id} tree={tree} completed={[...(progress.get(tree.id)??[])]} onToggle={(n,v)=>toggle(tree.id,n,v)} focus={focus?.treeId===tree.id?focus:null}/></>}
      </>}
    </main></div></section></div>;
}
