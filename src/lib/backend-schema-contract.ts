import { getPublicSupabaseConfig, publicSupabaseHeaders } from "@/lib/supabase-public";

export type ProbeStatus = "present" | "missing" | "restricted" | "error";
export type ProbeArea = "ARTISTAS" | "MÚSICA" | "CAMPING" | "MEDIA" | "MERCH" | "RÁDIO" | "CONTROL ROOM" | "MEMBROS" | "ANÁLISE";
export type ProbeResult = { name: string; area: ProbeArea; kind: "table" | "view" | "rpc"; status: ProbeStatus; httpStatus?: number; code?: string; checkedAt: string };

export const BACKEND_TABLES: readonly { name: string; area: ProbeArea; access: "public" | "authenticated" }[] = [
  {name:"artists",area:"ARTISTAS",access:"public"},{name:"artist_releases",area:"ARTISTAS",access:"public"},{name:"artist_socials",area:"ARTISTAS",access:"public"},
  {name:"artist_status",area:"CAMPING",access:"public"},{name:"tapes",area:"MÚSICA",access:"public"},{name:"releases",area:"MÚSICA",access:"public"},
  {name:"camping_events",area:"CAMPING",access:"public"},{name:"camping_sessions",area:"CAMPING",access:"public"},{name:"site_flags",area:"CAMPING",access:"public"},{name:"live_notifications",area:"CAMPING",access:"authenticated"},
  {name:"gallery_items",area:"MEDIA",access:"public"},{name:"revelation_media",area:"MEDIA",access:"public"},{name:"media_assets",area:"MEDIA",access:"authenticated"},
  {name:"merch_products",area:"MERCH",access:"public"},{name:"merch_variants",area:"MERCH",access:"public"},{name:"inventory_movements",area:"MERCH",access:"authenticated"},{name:"reservations",area:"MERCH",access:"authenticated"},
  {name:"radio_tracks",area:"RÁDIO",access:"public"},{name:"radio_station",area:"RÁDIO",access:"public"},{name:"radio_blocks",area:"RÁDIO",access:"public"},
  {name:"frequency_station",area:"RÁDIO",access:"authenticated"},{name:"frequency_listeners",area:"RÁDIO",access:"authenticated"},{name:"frequency_badges",area:"RÁDIO",access:"authenticated"},
  {name:"site_settings",area:"CONTROL ROOM",access:"public"},{name:"site_sections",area:"CONTROL ROOM",access:"public"},{name:"drop_campaigns",area:"CONTROL ROOM",access:"public"},
  {name:"admin_profiles",area:"CONTROL ROOM",access:"authenticated"},{name:"audit_logs",area:"CONTROL ROOM",access:"authenticated"},
  {name:"events",area:"ANÁLISE",access:"authenticated"},{name:"members",area:"MEMBROS",access:"authenticated"},{name:"fan_memberships",area:"MEMBROS",access:"authenticated"},
  {name:"partnership_requests",area:"MEMBROS",access:"authenticated"},{name:"partnership_public",area:"MEMBROS",access:"public"}
] as const;

/** Only known read-only RPCs are checked. No editorial, reservation or membership write is called. */
export const READ_ONLY_RPCS: readonly {name:string;area:ProbeArea}[] = [
  {name:"frequency_clock",area:"RÁDIO"},{name:"frequency_radio_catalog",area:"RÁDIO"},{name:"frequency_radio_station",area:"RÁDIO"},
  {name:"frequency_radio_blocks",area:"RÁDIO"},{name:"member_count",area:"MEMBROS"},{name:"delegados",area:"MEMBROS"}
] as const;

export function classifyProbe(httpStatus:number, code?:string|null):ProbeStatus {
  const value=String(code??"").toUpperCase();
  if(httpStatus>=200&&httpStatus<300)return "present";
  if(["PGRST205","PGRST202","42P01","42883"].includes(value)||httpStatus===404)return "missing";
  if(httpStatus===401||httpStatus===403||value==="42501")return "restricted";
  return "error";
}

export function summarizeProbes(results:readonly ProbeResult[]) {
  return {
    present:results.filter(x=>x.status==="present").length,
    missing:results.filter(x=>x.status==="missing").length,
    restricted:results.filter(x=>x.status==="restricted").length,
    errors:results.filter(x=>x.status==="error").length,
    certified:results.every(x=>x.status==="present")
  };
}

type AuditOptions={accessToken?:string|null;fetcher?:typeof fetch};
async function readErrorCode(response:Response):Promise<string|undefined>{
  try{const value=await response.clone().json() as {code?:unknown};return typeof value.code==="string"?value.code:undefined;}catch{return undefined;}
}
async function limitedMap<T,R>(items:readonly T[],limit:number,fn:(item:T)=>Promise<R>):Promise<R[]>{
  const out=new Array<R>(items.length);let next=0;
  await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(true){const i=next++;if(i>=items.length)return;out[i]=await fn(items[i]);}}));
  return out;
}
export async function auditBackendSchema(options:AuditOptions={}){
  const cfg=getPublicSupabaseConfig();const request=options.fetcher??fetch;
  const checkedAt=()=>new Date().toISOString();
  const tableHeaders=publicSupabaseHeaders(cfg.key,options.accessToken?{Authorization:"Bearer "+options.accessToken}:undefined);
  const tables=await limitedMap(BACKEND_TABLES,4,async item=>{
    const at=checkedAt();
    try{
      const response=await request(cfg.url+"/rest/v1/"+encodeURIComponent(item.name)+"?select=*&limit=0",{method:"GET",headers:tableHeaders});
      const code=await readErrorCode(response);
      return {name:item.name,area:item.area,kind:(item.name==="partnership_public"?"view":"table") as "view"|"table",status:classifyProbe(response.status,code),httpStatus:response.status,code,checkedAt:at};
    }catch{return {name:item.name,area:item.area,kind:(item.name==="partnership_public"?"view":"table") as "view"|"table",status:"error" as ProbeStatus,checkedAt:at};}
  });
  const rpcs=await limitedMap(READ_ONLY_RPCS,3,async item=>{
    const at=checkedAt();
    try{
      const headers=publicSupabaseHeaders(cfg.key,{"Content-Type":"application/json",...(options.accessToken?{Authorization:"Bearer "+options.accessToken}:{})});
      const response=await request(cfg.url+"/rest/v1/rpc/"+encodeURIComponent(item.name),{method:"POST",headers,body:"{}"});
      const code=await readErrorCode(response);
      return {name:item.name,area:item.area,kind:"rpc" as const,status:classifyProbe(response.status,code),httpStatus:response.status,code,checkedAt:at};
    }catch{return {name:item.name,area:item.area,kind:"rpc" as const,status:"error" as ProbeStatus,checkedAt:at};}
  });
  return {tables,rpcs,startedAt:checkedAt(),finishedAt:checkedAt()};
}
