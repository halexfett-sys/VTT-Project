import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const entry=new URL('../.tools/server-build/api/server.js',import.meta.url).href;
const compile=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','-p','tsconfig.server.json'],{stdio:'inherit'});
if(compile.status!==0)process.exit(compile.status||1);
// Plain Node loads the emitted backend, without tsx/Vite import resolution.
const check=spawnSync(process.execPath,['--input-type=module','-e',`
 const {default:server}=await import(${JSON.stringify(entry)});
 if(typeof server.listen!=='function')throw new Error('Expected HTTP server export');
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try {
  const r=await fetch('http://127.0.0.1:'+server.address().port+'/api/config');
  const c=await r.json();
  if(r.status!==200||c.cloud!==true)throw new Error('Cloud startup failed: '+JSON.stringify(c));
  console.log('Compiled backend startup passed (plain Node, no cloud credentials used).');
 } finally {server.closeAllConnections();await new Promise(r=>server.close(r));}
`],{stdio:'inherit',env:{...process.env,SUPABASE_URL:'https://test.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_startup_test',STORAGE_BUCKET:'vtt-assets'}});
process.exit(check.status||0);
