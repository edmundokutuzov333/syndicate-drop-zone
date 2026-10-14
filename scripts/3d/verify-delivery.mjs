#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync,readFileSync,statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
export function parseGlb(b){
 if(b.length<20||b.toString("ascii",0,4)!=="glTF")throw new Error("not a GLB");
 if(b.readUInt32LE(8)!==b.length)throw new Error("GLB total length mismatch");
 let o=12,json=null;while(o+8<=b.length){const len=b.readUInt32LE(o),type=b.readUInt32LE(o+4),start=o+8;if(start+len>b.length)throw new Error("GLB chunk exceeds file");if(type===0x4e4f534a)json=JSON.parse(b.subarray(start,start+len).toString("utf8").replace(/\0+$/g,"").trim());o=start+len;}if(!json)throw new Error("GLB has no JSON chunk");return json;
}
export function blendKind(b){if(b.toString("ascii",0,7)==="BLENDER")return"blend";if(b.length>=4&&b.readUInt32LE(0)===0xfd2fb528)return"blend-zstd";if(b.length>=2&&b[0]===0x1f&&b[1]===0x8b)return"blend-gzip";if(b.toString("ascii",0,24).startsWith("version https://git-lfs"))return"LFS-POINTER-FALSO";return"unknown";}
export function glbContract(j,bible){
 const out=[],check=(name,pass,detail="")=>out.push({name,pass,detail}),nodes=j.nodes??[],extras=nodes.map(n=>n.extras??{}),names=new Set(nodes.map(n=>n.name??""));
 const wanted=[...new Set((bible.elements??[]).map(e=>e.interactionId).filter(Boolean))];
 for(const id of wanted)check(`interactionId ${id}`,extras.some(x=>x.interactionId===id)||names.has(id));
 const slot=n=>`${n.name??""} ${n.extras?.interactionId??""}`.match(/studio\.artist-slot-(\d{3})/)?.[1];
 const slots=new Set(nodes.map(slot).filter(Boolean));check("17 artist slots",slots.size===17,`${slots.size} found`);check("no slot 018",!slots.has("018"));
 const primitives=(j.meshes??[]).flatMap(m=>m.primitives??[]);check("meshes present",primitives.length>0,String(primitives.length));
 check("material on every primitive",primitives.length>0&&primitives.every(p=>p.material!==undefined));
 check("UV0 on every primitive",primitives.length>0&&primitives.every(p=>p.attributes?.TEXCOORD_0!==undefined));
 const uv1=primitives.filter(p=>p.attributes?.TEXCOORD_1!==undefined).length;check("UV1 on at least 80% primitives",primitives.length>0&&uv1>=primitives.length*.8,`${uv1}/${primitives.length}`);
 check("at least 10 materials",(j.materials??[]).length>=10,String((j.materials??[]).length));
 check("extras zone and lmGroup",extras.some(x=>x.zone)&&extras.some(x=>x.lmGroup));return out;
}
const parseCodes=s=>new Map(s.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.lastIndexOf("=");return i>0?[x.slice(0,i),x.slice(i+1)]:[x,""];}));
export async function verify(dir,biblePath,{checkExitCodes=false}={}){
 const out=[],add=(name,pass,detail="")=>out.push({name,pass,detail}),mp=[join(dir,"art/_delivery/manifest.json"),join(dir,"manifest.json")].find(existsSync),manifest=mp?JSON.parse(readFileSync(mp,"utf8")):null;
 add("manifest present",Boolean(manifest));
 if(manifest){add("all required files in manifest",(manifest.missing??[]).length===0,(manifest.missing??[]).join(", "));add("commit recorded",Boolean(manifest.commit&&manifest.commit!=="unknown"),manifest.commit??"");for(const f of manifest.files??[]){const p=join(dir,f.path);if(!existsSync(p)){add(`checksum ${f.path}`,false,"missing");continue;}const bytes=statSync(p).size,digest=createHash("sha256").update(readFileSync(p)).digest("hex");add(`checksum ${f.path}`,bytes===f.bytes&&digest===f.sha256,`${bytes} bytes`);}}
 const blend=join(dir,"art/xoyens-studio.blend");
 if(existsSync(blend)){const kind=blendKind(readFileSync(blend).subarray(0,64));add("real Blender file, not LFS pointer",kind==="blend"||kind==="blend-zstd",kind);add(".blend below 200 MiB",statSync(blend).size<200*1048576,`${(statSync(blend).size/1048576).toFixed(1)} MiB`);}else add(".blend present",false,"missing");
 const reportPath=join(dir,"art/xoyens-studio.report.json");
 if(existsSync(reportPath)){const r=JSON.parse(readFileSync(reportPath,"utf8")),v=String(r.blender_version??r.blenderVersion??r.blender?.version??"");add("Blender 4.5.x",/^4\.5\./.test(v),v||"?");add("duration_seconds",Number.isFinite(r.duration_seconds)&&r.duration_seconds>=0);add("objects",Number.isInteger(r.objects)&&r.objects>0);add("vertices",Number.isInteger(r.vertices)&&r.vertices>0);add("triangles_estimate",Number.isInteger(r.triangles_estimate)&&r.triangles_estimate>0);add("seven collections",Array.isArray(r.collections)&&r.collections.length>=7,JSON.stringify(r.collections??[]));add("blend_bytes matches file",Number.isInteger(r.blend_bytes)&&existsSync(blend)&&r.blend_bytes===statSync(blend).size);}else add("report present",false,"missing");
 const glb=join(dir,"art/out/xoyens-studio.raw.glb");
 if(existsSync(glb)&&biblePath&&existsSync(biblePath)){try{for(const c of glbContract(parseGlb(readFileSync(glb)),JSON.parse(readFileSync(biblePath,"utf8"))))add(`GLB: ${c.name}`,c.pass,c.detail);}catch(e){add("GLB readable",false,e instanceof Error?e.message:String(e));}}else add("GLB and Scene Bible accessible",false,"missing");
 if(checkExitCodes){const p=join(dir,"art/_delivery/exit-codes.txt");if(!existsSync(p))add("exit-codes present",false,"missing");else{const m=parseCodes(readFileSync(p,"utf8"));for(const k of ["validate","blend","blend-check","verify"])add(`exit-code ${k}=0`,m.get(k)==="0",m.get(k)??"missing");}}
 return out;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [dir,...args]=process.argv.slice(2),bible=args.find(x=>!x.startsWith("--"))??"docs/camping-v3/scene-bible.json",checkExitCodes=args.includes("--check-exit-codes");
 if(!dir){console.error("Usage: node scripts/3d/verify-delivery.mjs <delivery> [scene-bible.json] [--check-exit-codes]");process.exit(2);}
 try{const checks=await verify(dir,bible,{checkExitCodes});let failures=0;for(const c of checks){if(!c.pass)failures++;console.log(`${c.pass?"PASS":"FAIL"}  ${c.name}${c.detail?" · "+c.detail:""}`);}if(failures){console.log(`\n${failures} checks failed. Phase 04 is NOT certified.`);process.exit(1);}console.log("\nFase 04 certificável");}
 catch(e){console.error("Verifier error:",e instanceof Error?e.message:String(e));process.exit(1);}
}
