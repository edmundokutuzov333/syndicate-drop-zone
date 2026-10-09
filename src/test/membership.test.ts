import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase-public",()=>({
 getPublicSupabaseConfig:()=>({url:"https://hhipwyixtbleiulfnvvm.supabase.co",key:"sb_publishable_test"}),
 publicSupabaseHeaders:(key:string,init?:HeadersInit)=>{const h=new Headers(init);h.set("apikey",key);if(h.get("Authorization")==="Bearer "+key)h.delete("Authorization");return h;}
}));
import { joinUnion } from "@/lib/membership";
afterEach(()=>vi.unstubAllGlobals());
const input={alias:"TESTE CI",contactType:"whatsapp" as const,contactValue:"+258 840000000",referredBy:null,signaturePresent:true};
describe("joinUnion PostgREST response",()=>{
 it("normalizes RETURNS TABLE array response",async()=>{
  const f=vi.fn().mockResolvedValue(new Response(JSON.stringify([{code:"A1B2C3",member_number:42,alias:"TESTE CI",since:"2026-10-09T06:00:00.000Z",already_member:false}]),{status:200,headers:{"Content-Type":"application/json"}}));
  vi.stubGlobal("fetch",f);
  await expect(joinUnion(input)).resolves.toEqual({alreadyMember:false,code:"A1B2C3",memberNumber:42,alias:"TESTE CI",since:"2026-10-09T06:00:00.000Z"});
  const request=f.mock.calls[0] as unknown as [RequestInfo|URL,RequestInit];
  expect(new Headers(request[1].headers).get("Authorization")).toBeNull();
 });
 it("handles already-member response",async()=>{
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(JSON.stringify([{code:null,member_number:null,alias:null,since:null,already_member:true}]),{status:200,headers:{"Content-Type":"application/json"}})));
  await expect(joinUnion(input)).resolves.toMatchObject({alreadyMember:true});
 });
});
