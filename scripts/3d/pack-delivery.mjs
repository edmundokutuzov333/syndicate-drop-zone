#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createReadStream,existsSync,mkdirSync,readdirSync,statSync,writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join,relative } from "node:path";
import { pathToFileURL } from "node:url";
export const REQUIRED=["art/xoyens-studio.blend","art/xoyens-studio.report.json","art/out/xoyens-studio.raw.glb","art/out/xoyens-studio.colliders.glb","art/out/phase07-surfaces.json","art/xoyens-studio.phase07.report.json","art/textures/materials.manifest.json","public/models/camping/xoyens-studio.glb","public/models/camping/xoyens-studio.model.json"];
export const sha256=(file)=>new Promise((resolve,reject)=>{const h=createHash("sha256");createReadStream(file).on("data",(chunk)=>h.update(chunk)).on("end",()=>resolve(h.digest("hex"))).on("error",reject);});
const walk=(dir)=>existsSync(dir)?readdirSync(dir,{withFileTypes:true}).flatMap((e)=>e.isDirectory()?walk(join(dir,e.name)):[join(dir,e.name)]):[];
const git=(args)=>{try{return execFileSync("git",args,{encoding:"utf8"}).trim();}catch{return "unknown";}};
export async function buildManifest(root="."){
 const materialImages=walk(join(root,"art/textures/materials")).filter((p)=>/\.png$/i.test(p)).map((f)=>relative(root,f));
 const paths=[...REQUIRED,...materialImages,...walk(join(root,"art/_delivery/logs")).map((f)=>relative(root,f)),"art/_delivery/environment.txt","art/_delivery/exit-codes.txt"].filter((p)=>existsSync(join(root,p)));
 const files=[];for(const path of [...new Set(paths)].sort()){const full=join(root,path);files.push({path,bytes:statSync(full).size,sha256:await sha256(full)});}
 return{generated_at:new Date().toISOString(),commit:git(["rev-parse","HEAD"]),branch:git(["rev-parse","--abbrev-ref","HEAD"]),working_tree_dirty:git(["status","--porcelain"])!=="",required:REQUIRED,missing:REQUIRED.filter((p)=>!existsSync(join(root,p))),files};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const root=process.cwd();mkdirSync(join(root,"art/_delivery"),{recursive:true});const m=await buildManifest(root);
 const mp=join(root,"art/_delivery/manifest.json");writeFileSync(mp,JSON.stringify(m,null,2)+"\n");
 if(process.argv.includes("--manifest-only")){console.log(`manifest: ${relative(root,mp)}\nmissing required: ${m.missing.join(", ")||"none"}`);process.exit(m.missing.length?3:0);}
 const stamp=m.generated_at.replace(/[-:]/g,"").replace(/\.\d+Z$/,"Z").slice(0,15);
 const zip=join(root,`art/_delivery/phase04-delivery-${m.commit.slice(0,7)}-${stamp}.zip`);
 const entries=[...m.files.map((f)=>f.path),"art/_delivery/manifest.json"];let archive=zip;
 try{execFileSync("zip",["-q","-9",zip,...entries],{cwd:root,stdio:"inherit"});}catch{archive=zip.replace(/\.zip$/,".tar.gz");execFileSync("tar",["-czf",archive,...entries],{cwd:root,stdio:"inherit"});}
 const digest=await sha256(archive);writeFileSync(archive+".sha256",`${digest}  ${relative(root,archive)}\n`);
 console.log(`manifest: ${relative(root,mp)}\narchive: ${relative(root,archive)}\nSHA-256: ${digest}\nfiles: ${m.files.length}\nmissing required: ${m.missing.join(", ")||"none"}`);
 process.exit(m.missing.length?3:0);
}
