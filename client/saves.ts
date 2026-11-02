export async function importSave(path: string, file: File, fields: Record<string,string> = {}) {
  if (file.size > 128*1024*1024) throw new Error('Save must be 128 MB or smaller');
  const body = new FormData(); body.set('file',file);
  Object.entries(fields).forEach(([key,value])=>body.set(key,value));
  const response = await fetch(`/api${path}`,{method:'POST',body});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Import failed');
  return data;
}
export async function downloadSave(room: string, kind: 'player'|'table') {
  const response = await fetch(`/api/rooms/${room}/export/${kind}`);
  if (!response.ok) throw new Error((await response.json()).error || 'Export failed');
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a'); link.href=url;
  link.download=`outer-rim-${kind}-${new Date().toISOString().slice(0,10)}.json`;
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
