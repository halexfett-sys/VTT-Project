import sharp from 'sharp';
import {placeholder} from './placeholder';
import type {MapScene} from '../shared/types';
import type {Storage} from './storage';
export async function renderMap(map:MapScene,storage:Storage,masked:boolean){
 const base=map.assetId?await storage.get(`${map.assetId}.webp`):await sharp(placeholder).resize(map.width,map.height).webp().toBuffer();
 if(!masked||!map.fog.length)return base;
 const paths=map.fog.map(s=>`<path d="M ${s.points.map(p=>`${p.x} ${p.y}`).join(' L ')} l 0.01 0" fill="none" stroke="${s.erase?'black':'white'}" stroke-width="${s.size}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
 const svg=Buffer.from(`<svg width="${map.width}" height="${map.height}" xmlns="http://www.w3.org/2000/svg"><defs><mask id="fog"><rect width="100%" height="100%" fill="black"/>${paths}</mask></defs><rect width="100%" height="100%" fill="#080c12" mask="url(#fog)"/></svg>`);
 return sharp(base).composite([{input:svg}]).webp().toBuffer();
}
