#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { statfsSync } from "node:fs";
import { arch as osArch,homedir,platform as osPlatform } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
export const BLENDER_VERSION=process.env.BLENDER_VERSION??"4.5.14";
export function blenderTarget(platform,arch,version=BLENDER_VERSION){
 const series=version.split(".").slice(0,2).join("."),base=`https://download.blender.org/release/Blender${series}`;
 const map={"linux-x64":{file:`blender-${version}-linux-x64.tar.xz`,kind:"tar.xz"},"darwin-arm64":{file:`blender-${version}-macos-arm64.dmg`,kind:"dmg"},"darwin-x64":{file:`blender-${version}-macos-x64.dmg`,kind:"dmg"}};
 const t=map[`${platform}-${arch}`];return t?{...t,supported:true,url:`${base}/${t.file}`,sha256Url:`${base}/blender-${version}.sha256`}:{supported:false,note:`Unsupported auto-install target: ${platform}-${arch}; use Linux x64, macOS, WSL2, or Docker.`};
}
export function candidates(){const h=homedir();return [process.env.BLENDER_BIN,join(h,"tools",`blender-${BLENDER_VERSION}`,"blender"),join(h,`tools/blender-${BLENDER_VERSION}-linux-x64`,"blender"),join(h,"tools",`blender-${BLENDER_VERSION}`,"Blender.app","Contents","MacOS","Blender"),"/Applications/Blender.app/Contents/MacOS/Blender","blender"].filter(Boolean);}
function command(cmd,args=[],timeout=20000){try{return execFileSync(cmd,args,{encoding:"utf8",stdio:["ignore","pipe","pipe"],timeout}).trim();}catch{return null;}}
export function findBlender(){for(const bin of candidates()){const out=command(bin,["--version"]);if(out)return{bin,version:out.match(/Blender\s+([0-9.]+)/)?.[1]??out.split("\n")[0]};}return null;}
async function reachable(url){try{const r=await fetch(url,{method:"HEAD",signal:AbortSignal.timeout(8000)});return r.ok||r.status===405;}catch{return false;}}
export async function doctor(){
 const platform=osPlatform(),arch=osArch(),target=blenderTarget(platform,arch),checks=[];
 const add=(name,ok,detail,fix="",blocker=true)=>checks.push({name,ok,detail,fix,blocker});
 add("Platform",target.supported,`${platform}-${arch}`,target.note??"",true);
 add("Node.js >=22",Number(process.versions.node.split(".")[0])>=22,process.version,"Install Node.js 22 LTS.");
 const py=command("python3",["--version"]);add("Python 3",Boolean(py),py??"missing","Install Python 3.10+.");
 const git=command("git",["--version"]);add("git",Boolean(git),git??"missing","Install git.");
 const lfs=command("git",["lfs","version"]);add("git-lfs",Boolean(lfs),lfs??"missing","Install git-lfs before committing the real blend.",false);
 const zip=command("zip",["-v"]);add("zip",Boolean(zip),zip?"available":"missing","Will fall back to tar.gz.",false);
 const bl=findBlender();add(`Blender ${BLENDER_VERSION}`,Boolean(bl&&bl.version===BLENDER_VERSION),bl?`${bl.version} @ ${bl.bin}`:"missing","Run bash scripts/3d/install-blender.sh.");
 const ktx=command("toktx",["--version"]);add("toktx",Boolean(ktx),ktx??"not required for Phase 04","KTX tools are required in the later KTX phase.",false);
 try{const s=statfsSync(homedir()),gb=Number(s.bavail)*Number(s.bsize)/1e9;add("Disk free >= 3 GB",gb>=3,`${gb.toFixed(1)} GB`,"Free disk space.");}catch{add("Disk space",true,"not measured","",false);}
 const net=await reachable("https://download.blender.org/release/");add("Blender download access",net||Boolean(bl),net?"reachable":bl?"offline, blender present":"network unavailable and blender missing","Check DNS/proxy or use Docker/Codespaces/GitLab.",!bl);
 return{target,checks,ok:checks.every(c=>c.ok||!c.blocker)};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const r=await doctor();if(process.argv.includes("--json"))console.log(JSON.stringify(r,null,2));else{console.log(`Expected Blender: ${BLENDER_VERSION}\n`);for(const c of r.checks){console.log(`${c.ok?"OK   ":c.blocker?"FAIL ":"WARN "}${c.name.padEnd(28)} ${c.detail}`);if(!c.ok&&c.fix)console.log(`    -> ${c.fix}`);}console.log(r.ok?"\nPreflight OK.":"\nPreflight blocked.");}process.exit(r.ok?0:1);}
