import {useState} from 'react';
import {downloadSave,importSave} from './saves';
export default function SaveTools({room,gm,close,restored}:{room:string;gm:boolean;close:()=>void;restored:()=>void}) {
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[file,setFile]=useState<File|null>(null);
 const run=async(fn:()=>Promise<void>)=>{setBusy(true);setError('');try{await fn();}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 return <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="saves-title">
 <button className="close" aria-label="Close saves" disabled={busy} onClick={close}>×</button>
 <h2 id="saves-title">Portable saves</h2>
 <p>Save files include images. Download a fresh copy after each session and before clearing browser data.</p>
 <button className="primary full" disabled={busy} onClick={()=>run(()=>downloadSave(room,'table'))}>{gm?'Export full campaign':'Export visible table'}</button>
 <p>{gm?'Includes every scene, member, token, sheet, chat message, and GM secret. Restore it from the lobby as a new campaign.':'Includes the active scene and table information you can see. Hidden areas remain covered and GM secrets are excluded.'}</p>
 <button className="full" disabled={busy} onClick={()=>run(()=>downloadSave(room,'player'))}>Export my player</button>
 <p>Your profile, portraits, art library, owned tokens, appearance, and sheets. Keep this file private: it can restore your player identity. Players should export before the GM exports the campaign so recovery keys are included.</p>
 <hr/><h3>Restore my player</h3><p>This replaces your profile and owned tokens at this table. Tokens return to matching scenes, or the active scene when joining a different table. Export first to keep your current version.</p>
 <input aria-label="Player save to restore" type="file" accept=".json,application/json" disabled={busy} onChange={e=>setFile(e.target.files?.[0]||null)}/>
 <button className="full" disabled={busy||!file} onClick={()=>run(async()=>{await importSave('/join-save',file!,{roomId:room});restored();})}>{busy?'Working…':'Restore player save'}</button>
 {error&&<p role="alert">{error}</p>}
 </section></div>;
}
