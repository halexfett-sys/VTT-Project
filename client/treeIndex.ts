import {trees,type TreeMeta} from '../shared/trees';
import type {Cell,CustomTreeData} from './customTreeData';

// Pure helpers behind the tree dialog (ported from the standalone Specialization & Career Tracker).
// Progress is a map of tree id -> purchased node numbers; node numbering is documented in shared/trees.ts.
export type Data=Readonly<Record<string,CustomTreeData>>;
export type Progress=ReadonlyMap<string,ReadonlySet<number>>;
export type CareerGroup={name:string;career?:TreeMeta;specs:TreeMeta[]};
export type GameGroup={name:string;careers:CareerGroup[]};

/** Games > careers > trees, in the order the sheets list them. A career without a signature tree (Universal) has none. */
export function groupTrees(list:readonly TreeMeta[]=trees):GameGroup[]{
  const games:GameGroup[]=[];
  for(const t of list){
    let g=games.find(x=>x.name===t.game);if(!g)games.push(g={name:t.game,careers:[]});
    let c=g.careers.find(x=>x.name===t.career);if(!c)g.careers.push(c={name:t.career,specs:[]});
    if(t.kind==='career')c.career=t;else c.specs.push(t);
  }
  return games;
}

/** Progress lookup from the saved list ({treeId,completed}[]). */
export const toProgress=(saved:readonly {treeId:string;completed:readonly number[]}[]):Progress=>new Map(saved.map(p=>[p.treeId,new Set(p.completed)]));

/** A talent can be checked freely, but it is "reachable" when a purchased neighbour has a connector into it. */
export function isReachable(cells:readonly Cell[],done:ReadonlySet<number>,i:number):boolean{
  const r=Math.floor(i/4),c=i%4;
  return r===0||(cells[i-4].dn===1&&done.has(i-4))||(c>0&&cells[i-1].rt===1&&done.has(i-1))||(c<3&&cells[i].rt===1&&done.has(i+1))||(r<4&&cells[i].dn===1&&done.has(i+4));
}

/** Signature trees: node ability*9 is the ability, ability*9+1+u its upgrades. */
export const sigNode=(ability:number,upgrade?:number)=>ability*9+(upgrade===undefined?0:upgrade+1);

/** XP spent in one tree. */
export function treeXp(d:CustomTreeData|undefined,done:ReadonlySet<number>|readonly number[]):number{
  if(!d)return 0;
  let xp=0;
  for(const n of done){
    if(d.cells)xp+=d.cells[n]?.c||0;
    else{const sig=d.sig?.[Math.floor(n/9)];if(sig)xp+=n%9===0?sig.c:sig.u[n%9-1]?.c||0;}
  }
  return xp;
}

/** Total XP and number of purchases across every tree. */
export function totals(data:Data,progress:Progress):{xp:number;count:number}{
  let xp=0,count=0;
  for(const [id,done] of progress){if(!data[id])continue;xp+=treeXp(data[id],done);count+=done.size;}
  return {xp,count};
}

export type BuildItem=
  |{kind:'signature';name:string;base:boolean;upgrades:string[]}
  |{kind:'specialization';name:string;owned:number;talents:{name:string;count:number}[]};
export type BuildSection={game:string;career:string;items:BuildItem[]};

/** Everything purchased, grouped by game and career (the tracker's "My Build" view). */
export function buildSummary(groups:readonly GameGroup[],data:Data,progress:Progress):BuildSection[]{
  const out:BuildSection[]=[];
  for(const g of groups)for(const c of g.careers){
    const items:BuildItem[]=[];
    const sigData=c.career&&data[c.career.id]?.sig,sigDone=c.career&&progress.get(c.career.id);
    sigData?.forEach((a,ai)=>{
      const base=!!sigDone?.has(sigNode(ai)),upgrades=a.u.filter((_,ui)=>sigDone?.has(sigNode(ai,ui))).map(u=>u.n);
      if(base||upgrades.length)items.push({kind:'signature',name:a.n,base,upgrades});
    });
    for(const sp of c.specs){
      const done=progress.get(sp.id),cells=data[sp.id]?.cells;
      if(!done||!cells)continue;
      const counts=new Map<string,number>();
      cells.forEach((cell,i)=>{if(done.has(i))counts.set(cell.n,(counts.get(cell.n)||0)+1);});
      if(counts.size)items.push({kind:'specialization',name:sp.name,owned:done.size,talents:[...counts].map(([name,count])=>({name,count}))});
    }
    if(items.length)out.push({game:g.name,career:c.name,items});
  }
  return out;
}

export type SearchHit={treeId:string;node:number;name:string;where:string};
const plain=(s:string)=>s.replace(/\{\w+\}/g,'');

/** Search talent names and text (signature abilities too, not their upgrades). Needs 2+ characters. */
export function searchTrees(groups:readonly GameGroup[],data:Data,query:string,limit=40):SearchHit[]{
  const q=query.trim().toLowerCase(),out:SearchHit[]=[];
  if(q.length<2)return out;
  const match=(n:string,d:string)=>n.toLowerCase().includes(q)||plain(d).toLowerCase().includes(q);
  for(const g of groups)for(const c of g.careers){
    for(const sp of c.specs){
      const cells=data[sp.id]?.cells,seen=new Set<string>();
      cells?.forEach((cell,i)=>{
        if(out.length<limit&&!seen.has(cell.n)&&match(cell.n,cell.d)){seen.add(cell.n);out.push({treeId:sp.id,node:i,name:cell.n,where:`${sp.name} · ${c.name} · ${cell.c} XP`});}
      });
    }
    if(c.career)data[c.career.id]?.sig?.forEach((a,ai)=>{
      if(out.length<limit&&match(a.n,a.d))out.push({treeId:c.career!.id,node:sigNode(ai),name:a.n,where:`Signature ability · ${c.name}`});
    });
  }
  return out;
}
