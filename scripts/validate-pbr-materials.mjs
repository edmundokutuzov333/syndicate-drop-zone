#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const REQUIRED_MAPS=["BC","N","ORM"];
export const MIN_MATERIALS=18;
export const SIZE=2048;
export const MANIFEST="art/textures/materials.manifest.json";
export const LICENSE_FILE="docs/camping-v3/ASSET-LICENSES.md";
export const START_MARKER="<!-- POLY HAVEN MATERIALS START -->";
export const END_MARKER="<!-- POLY HAVEN MATERIALS END -->";
export function pngDimensions(data){
  if(!Buffer.isBuffer(data)||data.length<24||data.toString("hex",0,8)!=="89504e470d0a1a0a")return null;
  return {width:data.readUInt32BE(16),height:data.readUInt32BE(20)};
}
export function isLfsPointer(data){
  return Buffer.isBuffer(data)&&data.length<512&&data.toString("utf8",0,100).startsWith("version https://git-lfs.github.com/spec/v1");
}
export function renderLicenseRows(materials){
  const tick=String.fromCharCode(96);
  const rows=["| Material | Asset ID | Autor(es) | Licença | Fonte | Transformações |","|---|---|---|---|---|---|"];
  for(const m of materials){
    const a=m.sourceAsset??{};
    const authors=Array.isArray(a.authors)&&a.authors.length?a.authors.join(", "):"Não indicado pela API";
    rows.push("| "+m.material+" | "+tick+(a.id??"missing")+tick+" | "+authors.replace(/\|/g,"\\|")+" | CC0 1.0 | [Poly Haven]("+(a.url??"https://polyhaven.com")+") | mapas PNG 2K; ORM R=AO/G=roughness/B=metallic; normal OpenGL; SHA-256 registado |");
  }
  return rows.join("\n");
}
export async function writeLicenseSection(root,manifest){
  const file=resolve(root,LICENSE_FILE);
  if(!existsSync(file))throw new Error("Asset-license document missing: "+file);
  let text=await readFile(file,"utf8");
  const section=START_MARKER+"\n\n## Materiais PBR CC0 recolhidos pela API Poly Haven\n\n"+
    "Os materiais são CC0 1.0. Os IDs, autores, links, mapas de origem e hashes de saída abaixo são gerados a partir da resposta real da API. **Powered by Poly Haven**.\n\n"+
    renderLicenseRows(manifest.materials)+"\n\n"+END_MARKER;
  const start=text.indexOf(START_MARKER),end=text.indexOf(END_MARKER);
  if(start!==-1&&end>=start)text=text.slice(0,start)+section+text.slice(end+END_MARKER.length);
  else text=text.trimEnd()+"\n\n"+section+"\n";
  await writeFile(file,text);
}
export async function validateManifest(root=process.cwd(),manifestPath=MANIFEST){
  const errors=[],notes=[],file=resolve(root,manifestPath);
  if(!existsSync(file))throw new Error("Material manifest missing: "+manifestPath);
  const raw=await readFile(file);
  if(isLfsPointer(raw))throw new Error("Material manifest is an LFS pointer, not JSON");
  const manifest=JSON.parse(raw.toString("utf8"));
  if(manifest.version!==1)errors.push("manifest version must be 1");
  if(!Array.isArray(manifest.materials)||manifest.materials.length<MIN_MATERIALS)errors.push("expected at least "+MIN_MATERIALS+" profiles, found "+(manifest.materials?.length??0));
  if(manifest.ormConvention?.R!=="AO"||manifest.ormConvention?.G!=="roughness"||manifest.ormConvention?.B!=="metallic")errors.push("ORM must be R=AO/G=roughness/B=metallic");
  const names=new Set();
  for(const m of manifest.materials??[]){
    if(!m.material||names.has(m.material))errors.push("missing or duplicate material name: "+m.material);
    names.add(m.material);
    const src=m.sourceAsset??{};
    if(!src.id)errors.push(m.material+": source asset ID missing");
    if(src.provider!=="Poly Haven")errors.push(m.material+": provider must be Poly Haven");
    if(src.license!=="CC0 1.0")errors.push(m.material+": license is not CC0 1.0");
    if(!/^https:\/\/polyhaven\.com\/a\//.test(src.url??""))errors.push(m.material+": exact Poly Haven source URL missing");
    if(!src.authors?.length)notes.push(m.material+": Poly Haven API did not identify authors");
    for(const key of REQUIRED_MAPS){
      const entry=m.maps?.[key];
      if(!entry?.path){errors.push(m.material+": missing "+key);continue;}
      const resolved=resolve(root,entry.path);
      if(!resolved.startsWith(resolve(root)+"/")){errors.push(m.material+": unsafe path");continue;}
      try{
        const data=await readFile(resolved);
        if(isLfsPointer(data)){errors.push(m.material+" "+key+": LFS pointer instead of PNG");continue;}
        const dims=pngDimensions(data);
        if(!dims){errors.push(m.material+" "+key+": invalid PNG");continue;}
        if(dims.width!==SIZE||dims.height!==SIZE||entry.width!==SIZE||entry.height!==SIZE)errors.push(m.material+" "+key+": expected 2048x2048, got "+dims.width+"x"+dims.height);
        if(data.length!==entry.bytes)errors.push(m.material+" "+key+": byte count mismatch");
        if(createHash("sha256").update(data).digest("hex")!==entry.sha256)errors.push(m.material+" "+key+": SHA-256 mismatch");
        if(data.length<4096)errors.push(m.material+" "+key+": image suspiciously small");
      }catch{errors.push(m.material+" "+key+": missing file "+entry.path);}
    }
    if(m.tileability?.status!=="pass"||!Number.isFinite(m.tileability?.edgeMeanDelta)||m.tileability.edgeMeanDelta>(m.tileability.maxAcceptedDelta??64))errors.push(m.material+": tileability metric not accepted");
    if(m.ormChannels?.red!=="ambient occlusion"||m.ormChannels?.green!=="roughness"||m.ormChannels?.blue!=="metallic")errors.push(m.material+": ORM channel metadata incorrect");
    if(m.sourceMaps?.N?.convention?.includes("DirectX"))notes.push(m.material+": DirectX normal converted to OpenGL");
    if(m.maps?.H){
      try{const d=await readFile(resolve(root,m.maps.H.path));const dims=pngDimensions(d);if(!dims||dims.width!==SIZE||dims.height!==SIZE)errors.push(m.material+": height map must be 2048x2048 PNG");if(createHash("sha256").update(d).digest("hex")!==m.maps.H.sha256)errors.push(m.material+": height SHA-256 mismatch");}
      catch{errors.push(m.material+": height map path missing");}
    }
  }
  const licence=resolve(root,LICENSE_FILE);
  if(!existsSync(licence))errors.push("ASSET-LICENSES.md missing");
  else{
    const text=await readFile(licence,"utf8");
    if(!text.includes(START_MARKER)||!text.includes(END_MARKER))errors.push("license rows missing; run --write-licenses");
    if(!text.includes("Powered by Poly Haven"))errors.push("Poly Haven credit missing in ASSET-LICENSES.md");
    const tick=String.fromCharCode(96);
    for(const m of manifest.materials??[])if(m.sourceAsset?.id&&!text.includes(tick+m.sourceAsset.id+tick))errors.push("license table misses source "+m.sourceAsset.id);
  }
  return {manifest,errors,notes};
}
async function main(){
  const root=process.cwd(),manifest=process.argv.slice(2).find(x=>!x.startsWith("--"))??MANIFEST;
  const raw=await readFile(resolve(root,manifest));const data=JSON.parse(raw.toString("utf8"));
  if(process.argv.includes("--write-licenses"))await writeLicenseSection(root,data);
  const result=await validateManifest(root,manifest);
  for(const m of result.manifest.materials??[])console.log("PASS  "+m.material+" · "+m.sourceAsset?.id+" · edgeΔ="+(m.tileability?.edgeMeanDelta??"?"));
  for(const n of result.notes)console.log("NOTE  "+n);
  for(const e of result.errors)console.error("FAIL  "+e);
  if(result.errors.length){console.error(result.errors.length+" PBR validation error(s); Phase 05 remains open.");process.exit(1);}
  console.log("PASS  "+result.manifest.materials.length+" CC0 materials, 2048² BC/N/ORM maps, hashes, channel convention and asset licenses.");
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error("PBR validator failed:",e instanceof Error?e.message:String(e));process.exit(1);});
