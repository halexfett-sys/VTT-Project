import sharp from 'sharp';
import {placeholder} from './placeholder.js';
import type {MapScene} from '../shared/types.js';
import type {Storage} from './storage.js';
export async function renderMap(map:MapScene,storage:Storage,masked:boolean){
 const base=map.assetId?await storage.get(`${map.assetId}.webp`):await sharp(placeholder).resize(map.width,map.height).webp().toBuffer();
 if(!masked||!map.fog.length)return base;
 // Fog is stored in map units, and the table stretches the picture to the map's size. Do the same here so a brush stroke covers
 // exactly the same area for players, even if the stored picture's pixel size differs from the map's.
 const meta=await sharp(base).metadata(),w=meta.width||map.width,h=meta.height||map.height,sx=w/map.width,sy=h/map.height,sz=(sx+sy)/2;
 const r=(n:number)=>Math.round(n*100)/100;
 const paths=map.fog.map(s=>`<path d="M ${s.points.map(p=>`${r(p.x*sx)} ${r(p.y*sy)}`).join(' L ')} l 0.01 0" fill="none" stroke="${s.erase?'black':'white'}" stroke-width="${r(s.size*sz)}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
 const svg=Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><defs><mask id="fog" maskUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="black"/>${paths}</mask></defs><rect width="${w}" height="${h}" fill="#080c12" mask="url(#fog)"/></svg>`);
 return sharp(base).composite([{input:svg}]).webp().toBuffer();
}
