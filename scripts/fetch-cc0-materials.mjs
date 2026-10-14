#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const API = "https://api.polyhaven.com";
export const USER_AGENT = "SyndicateStudioPBRPipeline/1.0 (CC0 material ingestion; github.com/edmundokutuzov333/syndicate-drop-zone)";
export const OUT_DIR = "art/textures/materials";
export const MANIFEST = "art/textures/materials.manifest.json";
export const SIZE = 2048;
export const REQUIRED_MAPS = ["BC", "N", "ORM"];

export const PROFILES = [
 {name:"floor_walnut_semi_gloss",search:"dark walnut wood floor planks",tags:["walnut","wood","floor","planks"],baseColorSRGB:[62,30,16],roughness:.45,metallic:0,normalStrength:1,coatWeight:.15,coatRoughness:.35},
 {name:"bamboo_weave",search:"bamboo woven weave rattan cane",tags:["bamboo","woven","weave","rattan","cane"],baseColorSRGB:[125,75,28],roughness:.72,metallic:0,normalStrength:1.2},
 {name:"plaster_stucco_cream",search:"rough beige plaster stucco wall",tags:["plaster","stucco","rough","wall"],baseColorSRGB:[205,178,142],roughness:.92,metallic:0,normalStrength:1.6},
 {name:"paint_black_matte",search:"black matte painted wall plaster",tags:["black","paint","matte","wall"],baseColorSRGB:[8,8,9],roughness:.85,metallic:0,normalStrength:.8},
 {name:"leather_black_quilted",search:"black quilted leather upholstery",tags:["black","leather","quilted","upholstery"],baseColorSRGB:[12,12,13],roughness:.44,metallic:0,normalStrength:.8,coatWeight:.25,coatRoughness:.4},
 {name:"leather_black_tufted",search:"black leather upholstery textured",tags:["black","leather","upholstery","textured"],baseColorSRGB:[12,12,13],roughness:.46,metallic:0,normalStrength:.75,coatWeight:.2,coatRoughness:.42},
 {name:"fabric_black_acoustic",search:"black acoustic fabric textile cloth",tags:["black","acoustic","fabric","textile","cloth"],baseColorSRGB:[7,7,8],roughness:.95,metallic:0,normalStrength:1,sheenWeight:1,sheenRoughness:.8},
 {name:"foam_black_grid",search:"black acoustic foam pyramid grid",tags:["black","acoustic","foam","grid","pyramid"],baseColorSRGB:[5,5,5],roughness:.98,metallic:0,normalStrength:1},
 {name:"steel_brushed",search:"brushed stainless steel metal",tags:["brushed","steel","metal","stainless"],baseColorSRGB:[170,170,175],roughness:.35,metallic:1,normalStrength:.65},
 {name:"steel_black",search:"black powder coated metal steel",tags:["black","powder","coated","metal","steel"],baseColorSRGB:[10,10,10],roughness:.5,metallic:.12,normalStrength:.7},
 {name:"cotton_black",search:"black cotton jersey fabric textile",tags:["black","cotton","jersey","fabric","textile"],baseColorSRGB:[14,14,15],roughness:.92,metallic:0,normalStrength:.9,sheenWeight:.5,sheenRoughness:.85},
 {name:"paper_black_seamless",search:"black seamless photo backdrop paper",tags:["black","seamless","backdrop","paper"],baseColorSRGB:[18,16,15],roughness:.85,metallic:0,normalStrength:.3},
 {name:"paper_matte",search:"kraft matte paper fibrous",tags:["kraft","paper","matte","fibrous"],baseColorSRGB:[96,75,54],roughness:.85,metallic:0,normalStrength:.55},
 {name:"wood_reclaimed_planks",search:"reclaimed weathered wood planks",tags:["reclaimed","weathered","wood","planks"],baseColorSRGB:[96,58,30],roughness:.65,metallic:0,normalStrength:1.3},
 {name:"wood_reclaimed_top",search:"reclaimed wood timber board tabletop",tags:["reclaimed","wood","timber","board"],baseColorSRGB:[96,58,30],roughness:.55,metallic:0,normalStrength:1.1},
 {name:"vinyl_black_matte",search:"black rubber vinyl flooring",tags:["black","rubber","vinyl","flooring"],baseColorSRGB:[10,10,11],roughness:.7,metallic:0,normalStrength:.65},
 {name:"canvas_print_mural",search:"canvas fabric woven material",tags:["canvas","fabric","woven","textile"],baseColorSRGB:[120,70,55],roughness:.8,metallic:0,normalStrength:.6},
 {name:"fabric_black_flag",search:"black woven flag fabric cloth",tags:["black","woven","flag","fabric","cloth"],baseColorSRGB:[9,9,10],roughness:.9,metallic:0,normalStrength:.7},
 {name:"wood_dark_stained",search:"dark stained walnut wood boards",tags:["dark","stained","walnut","wood","boards"],baseColorSRGB:[35,18,10],roughness:.56,metallic:0,normalStrength:1},
 {name:"fabric_black_softbox",search:"black light absorbing textile fabric",tags:["black","fabric","textile","cloth"],baseColorSRGB:[6,6,7],roughness:.95,metallic:0,normalStrength:.65,sheenWeight:.25,sheenRoughness:.9}
];

const ROOT = process.cwd();
const outDir = resolve(ROOT, OUT_DIR);
const manifestPath = resolve(ROOT, MANIFEST);
let sharpModule;
const digest = (data, algorithm="sha256") => createHash(algorithm).update(data).digest("hex");
const clean = value => String(value ?? "").toLowerCase().replace(/[_-]+/g," ").replace(/[^a-z0-9 ]+/g," ").replace(/\s+/g," ").trim();
const isLfsPointer = data => data.length < 512 && data.toString("utf8",0,100).startsWith("version https://git-lfs.github.com/spec/v1");
const pngDimensions = data => data.length >= 24 && data.toString("hex",0,8)==="89504e470d0a1a0a" ? {width:data.readUInt32BE(16),height:data.readUInt32BE(20)} : null;

export function packOrmChannels(ao, roughness, metallic, count) {
  if (!Number.isInteger(count) || count < 1) throw new Error("count must be positive");
  for (const [name,channel] of [["AO",ao],["roughness",roughness],["metallic",metallic]]) {
    if (!channel || channel.length !== count) throw new Error(name + " channel length must be " + count);
  }
  const out=Buffer.alloc(count*3);
  for(let i=0;i<count;i++){out[i*3]=ao[i];out[i*3+1]=roughness[i];out[i*3+2]=metallic[i];}
  return out;
}
export function invertDirectXGreenChannel(rgb,width,height) {
  if (!Buffer.isBuffer(rgb)||rgb.length!==width*height*3) throw new Error("Normal map must be packed RGB");
  const out=Buffer.from(rgb);
  for(let i=1;i<out.length;i+=3)out[i]=255-out[i];
  return out;
}
async function sharp() {
  if(!sharpModule)sharpModule=(await import("sharp")).default;
  return sharpModule;
}
async function get(url,json=false,tries=4) {
  let last;
  for(let i=0;i<tries;i++){
    try{
      const response=await fetch(url,{headers:{"User-Agent":USER_AGENT,"Accept":json?"application/json":"*/*"},signal:AbortSignal.timeout(90000)});
      if(!response.ok){
        const error=new Error("HTTP "+response.status+" for "+url);
        if(response.status===404||(response.status>=400&&response.status<500&&response.status!==429))throw error;
        last=error;
      }else return json?await response.json():Buffer.from(await response.arrayBuffer());
    }catch(error){last=error;if(String(error?.message??"").includes("HTTP 404"))throw error;}
    await new Promise(r=>setTimeout(r,500*(i+1)));
  }
  throw last??new Error("Request failed "+url);
}
function extractAssets(payload){
  const result=new Map();
  const add=(id,meta,score=0)=>{
    if(typeof id!=="string"||!id)return;
    const m=meta&&typeof meta==="object"?meta:{};
    if(m.type!==undefined&&Number(m.type)!==1&&String(m.type).toLowerCase()!=="texture")return;
    const old=result.get(id);
    result.set(id,{id,meta:old?.meta?.name?old.meta:m,apiScore:Math.max(score,old?.apiScore??0)});
  };
  const row=r=>{
    if(!r||typeof r!=="object")return;
    const score=Number(r.score??r.similarity??0);
    const a=r.assets??r.asset;
    if(a&&typeof a==="object"&&!Array.isArray(a))for(const [id,m] of Object.entries(a))add(id,m,score);
    const id=r.slug??r.id??r.asset_id??r.assetId;
    if(typeof id==="string")add(id,r.metadata??r.info??r,score);
  };
  if(Array.isArray(payload))for(const item of payload)row(item);
  else if(payload&&typeof payload==="object"){
    if(Array.isArray(payload.results))for(const item of payload.results)row(item);
    for(const [id,meta] of Object.entries(payload)){
      if(["results","query","model","total","considered","type","minScore"].includes(id))continue;
      if(meta&&typeof meta==="object"&&!Array.isArray(meta))add(id,meta,Number(meta.score??0));
    }
  }
  return [...result.values()];
}
function infoText(meta){
  const tags=Array.isArray(meta?.tags)?meta.tags.join(" "):Object.values(meta?.tags??{}).join(" ");
  const categories=Array.isArray(meta?.categories)?meta.categories.join(" "):String(meta?.category??"");
  const authors=meta?.authors&&typeof meta.authors==="object"?Object.keys(meta.authors).join(" "):"";
  return clean([meta?.name,meta?.description,tags,categories,authors].join(" "));
}
function relevance(candidate,profile){
  const hay=infoText(candidate.meta);
  const words=clean(profile.search).split(" ").filter(x=>x.length>2);
  const match=words.filter(x=>hay.includes(x)).length/Math.max(words.length,1);
  const tags=profile.tags.filter(x=>hay.includes(clean(x))).length/Math.max(profile.tags.length,1);
  return match+tags*.35+candidate.apiScore*.4;
}
async function fullIndex(){
  try{
    const list=extractAssets(await get(API+"/assets?t=textures",true));
    if(list.length>=10){console.log("Poly Haven full texture index: "+list.length+" entries");return list;}
  }catch(error){console.warn("Full /assets?t=textures unavailable: "+error.message);}
  return null;
}
async function candidatesFor(profile,index){
  if(index){
    const ranked=index.map(c=>({...c,score:relevance(c,profile)})).sort((a,b)=>b.score-a.score);
    if(ranked[0]?.score>.05)return ranked;
  }
  const response=await get(API+"/assets?q="+encodeURIComponent(profile.search.toLowerCase())+"&t=textures&min=0.12&limit=40",true);
  return extractAssets(response).map(c=>({...c,score:relevance(c,profile)})).sort((a,b)=>b.score-a.score);
}
async function detailedInfo(candidate){
  if(candidate.meta?.name&&(Array.isArray(candidate.meta.tags)||candidate.meta.description))return candidate;
  try{return {...candidate,meta:await get(API+"/info/"+encodeURIComponent(candidate.id),true)};}catch{return candidate;}
}
function leaves(node,prefix=[],out=[]){
  if(!node||typeof node!=="object")return out;
  if(typeof node.url==="string"){out.push({path:prefix.join("/"),url:node.url,size:Number(node.size??0),md5:String(node.md5??"").toLowerCase()});return out;}
  for(const [key,value] of Object.entries(node))leaves(value,[...prefix,key],out);
  return out;
}
function twoK(file){
  const p="/"+String(file.path).toLowerCase()+"/";
  return /\/2k(?:\+)?\//.test(p)||/(?:^|[_\-.])2k(?:[_\-.]|$)/.test(file.path.toLowerCase());
}
function kind(path){
  const p=clean(path);
  if(/nor gl|normal opengl|normal gl/.test(p))return "normalGL";
  if(/nor dx|normal directx|directx/.test(p))return "normalDX";
  if(/normal/.test(p))return "normal";
  if(/ambient occlusion|(^| )ao( |$)/.test(p))return "ao";
  if(/roughness|(^| )rough( |$)/.test(p))return "roughness";
  if(/metalness|metallic|(^| )metal( |$)/.test(p))return "metallic";
  if(/displacement|height|(^| )disp( |$)|bump/.test(p))return "height";
  if(/diffuse|albedo|base color|base colour|colour|(^| )color( |$)/.test(p))return "BC";
  return null;
}
function bestFile(files,k){
  const a=files.filter(f=>twoK(f)&&kind(f.path)===k);
  a.sort((x,y)=>{
    const score=f=>{const ext=f.url.toLowerCase().split("?")[0].split(".").pop();return ext==="png"?3:ext==="jpg"||ext==="jpeg"?2:0;};
    return score(y)-score(x);
  });
  return a[0]??null;
}
async function selectAsset(profile,index,used){
  const ranking=await candidatesFor(profile,index);
  const ordered=ranking.filter(c=>(c.score??0)>=.06).sort((a,b)=>{
    return ((b.score??0)-(used.has(b.id)?.18:0))-((a.score??0)-(used.has(a.id)?.18:0));
  });
  const errors=[];
  for(const item of ordered.slice(0,12)){
    const c=await detailedInfo(item);
    try{
      const all=leaves(await get(API+"/files/"+encodeURIComponent(c.id),true));
      const maps={
        BC:bestFile(all,"BC"),normalGL:bestFile(all,"normalGL"),normalDX:bestFile(all,"normalDX"),
        normal:bestFile(all,"normal"),ao:bestFile(all,"ao"),roughness:bestFile(all,"roughness"),
        metallic:bestFile(all,"metallic"),height:bestFile(all,"height")
      };
      maps.N=maps.normalGL??maps.normal??maps.normalDX;
      if(!maps.BC||!maps.N){errors.push(c.id+": no exact 2K BC/normal maps");continue;}
      return {candidate:c,files:all,maps,reused:used.has(c.id)};
    }catch(e){errors.push(c.id+": "+e.message);}
  }
  throw new Error("No 2K CC0 asset for "+profile.name+". Candidates: "+ordered.slice(0,12).map(x=>x.id).join(", ")+". "+errors.join("; "));
}
async function sourceBytes(file){
  if(!file)return null;
  const bytes=await get(file.url,false);
  if(file.md5&&digest(bytes,"md5")!==file.md5)throw new Error("Source MD5 mismatch for "+file.url);
  return bytes;
}
async function edgeMetric(buffer){
  const s=await sharp();
  const r=await s(buffer).resize(64,64,{fit:"fill"}).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const d=r.data,c=r.info.channels;let total=0,count=0;
  for(let y=0;y<64;y++)for(let ch=0;ch<c;ch++){
    total+=Math.abs(d[(y*64)*c+ch]-d[(y*64+63)*c+ch]);count++;
    total+=Math.abs(d[y*c+ch]-d[(63*64+y)*c+ch]);count++;
  }
  return Math.round(total/Math.max(count,1)*100)/100;
}
async function writeOutput(buffer,path){
  await writeFile(path,buffer);
  return {path:path.slice(ROOT.length+1).replace(/\\/g,"/"),bytes:buffer.length,sha256:digest(buffer),width:SIZE,height:SIZE};
}
async function renderMaterial(profile,selected,staging){
  const s=await sharp();const src=selected.maps;const downloaded={};
  for(const k of ["BC","N","ao","roughness","metallic","height"])downloaded[k]=await sourceBytes(src[k]);
  const names={BC:"T_"+profile.name+"_BC.png",N:"T_"+profile.name+"_N.png",ORM:"T_"+profile.name+"_ORM.png",H:"T_"+profile.name+"_H.png"};
  const paths=Object.fromEntries(Object.entries(names).map(([k,v])=>[k,join(staging,v)]));
  const buffers={};
  buffers.BC=await s(downloaded.BC).resize(SIZE,SIZE,{fit:"fill"}).removeAlpha().toColourspace("srgb").png().toBuffer();
  await writeFile(paths.BC,buffers.BC);
  const norm=await s(downloaded.N).resize(SIZE,SIZE,{fit:"fill"}).removeAlpha().raw().toBuffer({resolveWithObject:true});
  if(norm.info.channels!==3)throw new Error(profile.name+" normal expected RGB, got "+norm.info.channels);
  const dx=src.N===src.normalDX||/nor_dx|directx/i.test(src.N.path);
  const normalRaw=dx?invertDirectXGreenChannel(norm.data,SIZE,SIZE):norm.data;
  buffers.N=await s(normalRaw,{raw:{width:SIZE,height:SIZE,channels:3}}).png().toBuffer();
  await writeFile(paths.N,buffers.N);
  const pixels=SIZE*SIZE;
  const gray=async(k,fallback)=>downloaded[k]
    ?s(downloaded[k]).resize(SIZE,SIZE,{fit:"fill"}).removeAlpha().extractChannel(0).raw().toBuffer()
    :Buffer.alloc(pixels,Math.max(0,Math.min(255,Math.round(fallback))));
  const ao=await gray("ao",255),rough=await gray("roughness",profile.roughness*255),metal=await gray("metallic",profile.metallic*255);
  buffers.ORM=await s(packOrmChannels(ao,rough,metal,pixels),{raw:{width:SIZE,height:SIZE,channels:3}}).png().toBuffer();
  await writeFile(paths.ORM,buffers.ORM);
  if(downloaded.height){
    buffers.H=await s(downloaded.height).resize(SIZE,SIZE,{fit:"fill"}).removeAlpha().extractChannel(0).png().toBuffer();
    await writeFile(paths.H,buffers.H);
  }
  const edge=await edgeMetric(buffers.BC);
  const source=selected.candidate.meta??{};
  const authors=source.authors&&typeof source.authors==="object"?Object.keys(source.authors):[];
  const sourceUrl="https://polyhaven.com/a/"+selected.candidate.id;
  const outputMaps={};
  for(const key of ["BC","N","ORM","H"]){
    if(!buffers[key])continue;
    const srcMap=key==="BC"?src.BC:key==="N"?src.N:key==="H"?src.height:null;
    const out=await writeOutput(buffers[key],resolve(paths[key]));
    out.sourceUrl=srcMap?.url??(key==="ORM"?API+"/files/"+selected.candidate.id:null);
    out.sourceMd5=srcMap?.md5??null;out.outputName=names[key];outputMaps[key]=out;
  }
  return {
    material:profile.name,
    target:profile,
    sourceAsset:{provider:"Poly Haven",id:selected.candidate.id,name:source.name??selected.candidate.id,url:sourceUrl,apiUrl:API+"/files/"+selected.candidate.id,license:"CC0 1.0",licenseUrl:"https://creativecommons.org/publicdomain/zero/1.0/",authors,reusedByAnotherMaterial:selected.reused},
    maps:outputMaps,
    sourceMaps:{
      BC:src.BC?{path:src.BC.path,url:src.BC.url,md5:src.BC.md5,resolution:"2k"}:null,
      N:src.N?{path:src.N.path,url:src.N.url,md5:src.N.md5,resolution:"2k",convention:dx?"DirectX converted to OpenGL":"OpenGL or labelled normal"}:null,
      AO:src.ao?{path:src.ao.path,url:src.ao.url,md5:src.ao.md5,resolution:"2k"}:null,
      Roughness:src.roughness?{path:src.roughness.path,url:src.roughness.url,md5:src.roughness.md5,resolution:"2k"}:null,
      Metallic:src.metallic?{path:src.metallic.path,url:src.metallic.url,md5:src.metallic.md5,resolution:"2k"}:null,
      Height:src.height?{path:src.height.path,url:src.height.url,md5:src.height.md5,resolution:"2k"}:null
    },
    ormChannels:{red:"ambient occlusion",green:"roughness",blue:"metallic"},
    tileability:{edgeMeanDelta:edge,maxAcceptedDelta:64,status:edge<=64?"pass":"review"},
    generatedAt:new Date().toISOString()
  };
}
async function existingIsValid(){
  try{
    const data=await readFile(manifestPath);if(isLfsPointer(data))return false;
    const manifest=JSON.parse(data.toString("utf8"));
    if(manifest.materials?.length<18)return false;
    for(const m of manifest.materials)for(const key of REQUIRED_MAPS){
      const entry=m.maps?.[key];if(!entry?.path)return false;
      const data=await readFile(resolve(ROOT,entry.path));const dims=pngDimensions(data);
      if(isLfsPointer(data)||!dims||dims.width!==SIZE||dims.height!==SIZE||digest(data)!==entry.sha256)return false;
    }
    return true;
  }catch{return false;}
}
async function main(){
  if(!process.argv.includes("--force")&&await existingIsValid()){
    console.log("PBR manifest and 2K maps already verified; reusing committed assets.");return;
  }
  const index=await fullIndex();
  const staging=resolve(ROOT,OUT_DIR+".staging");
  await rm(staging,{recursive:true,force:true});await mkdir(staging,{recursive:true});
  const used=new Set(), materials=[];
  try{
    for(let i=0;i<PROFILES.length;i++){
      const p=PROFILES[i];
      console.log("["+ (i+1)+"/"+PROFILES.length+"] Choosing Poly Haven CC0 source for "+p.name);
      const selected=await selectAsset(p,index,used);used.add(selected.candidate.id);
      const built=await renderMaterial(p,selected,staging);
      if(built.tileability.edgeMeanDelta>built.tileability.maxAcceptedDelta)throw new Error(p.name+" tileability edge metric "+built.tileability.edgeMeanDelta+" exceeds "+built.tileability.maxAcceptedDelta);
      materials.push(built);
      console.log("  asset="+built.sourceAsset.id+" edgeΔ="+built.tileability.edgeMeanDelta+" BC/N/ORM=2048²");
    }
    if(materials.length<18)throw new Error("Less than 18 materials prepared");
    await mkdir(outDir,{recursive:true});
    for(const file of await readdir(outDir).catch(()=>[]))if(/^T_.+_(BC|N|ORM|H)\.png$/i.test(file))await rm(join(outDir,file),{force:true});
    for(const file of await readdir(staging))await rename(join(staging,file),join(outDir,file));
    const manifest={
      version:1,generatedAt:new Date().toISOString(),provider:"Poly Haven",apiBase:API,
      poweredBy:"Powered by Poly Haven",defaultLicense:"CC0 1.0",mapResolution:SIZE,
      outputFormat:"PNG",normalConvention:"OpenGL; DirectX green channel inverted when nor_dx is the only available 2K normal",
      ormConvention:{R:"AO",G:"roughness",B:"metallic"},generatedBy:"scripts/fetch-cc0-materials.mjs",materials
    };
    await mkdir(resolve(ROOT,"art/textures"),{recursive:true});
    await writeFile(manifestPath+".tmp",JSON.stringify(manifest,null,2)+"\n");
    await rename(manifestPath+".tmp",manifestPath);
    console.log("Manifest written: "+MANIFEST+" · "+materials.length+" material sets.");
  }catch(error){
    console.error("Material ingestion failed. No placeholder maps were generated.");
    throw error;
  }finally{await rm(staging,{recursive:true,force:true});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error("CC0 ingestion failed:",e instanceof Error?e.message:String(e));process.exit(1);});
