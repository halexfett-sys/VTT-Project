type Done = (ok: boolean) => void;
type Job = {event:string;payload:any;key?:string;callbacks:Done[]};
/** Bound cloud writes to one outstanding action. Only replace absolute setters. */
export class ActionQueue {
  private pending:Job[]=[];
  private running=false;
  private closed=false;
  constructor(private submit:(event:string,payload:unknown,done:Done)=>void) {}
  push(event:string,payload:any,done:Done=()=>{}) {
    if(this.closed){done(false);return;}
    const key=event==='token:move'?`${event}:${payload.id}`:event==='map:grid'?event:undefined;
    // Do not coalesce across a different action (e.g. a scene switch).
    const last=this.pending.at(-1);
    if(key&&last?.key===key){last.payload=payload;last.callbacks.push(done);}
    else this.pending.push({event,payload,key,callbacks:[done]});
    this.drain();
  }
  close(){this.closed=true;for(const j of this.pending)j.callbacks.forEach(cb=>cb(false));this.pending=[];}
  private drain(){
    if(this.closed||this.running)return;
    const job=this.pending.shift();if(!job)return;
    this.running=true;
    this.submit(job.event,job.payload,ok=>{this.running=false;job.callbacks.forEach(cb=>cb(ok));this.drain();});
  }
}
