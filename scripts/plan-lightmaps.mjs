#!/usr/bin/env node
import {mkdirSync,readFileSync,writeFileSync} from "node:fs";import {dirname,resolve} from "node:path";import {pathToFileURL} from "node:url";
export const GROUPS=["shell","production","photo","left","right"],TIERS={high:{maxPx:4096,budgetMB:24},mid:{maxPx:2048,budgetMB:10},low:{maxPx:1024,budgetMB:4}};
const SIZES=[512,1024,2048,4096],EFF=.72,MIP=1.333;
export function planSingleAtlas(meshes, maxPx) {
  const a = meshes.filter((mesh) => mesh.lightmapPolicy !== "shared-ao-ibl");
  const area = a.reduce((sum, mesh) => sum + Number(mesh.surfaceM2 || 0), 0);
  const limit = Math.min(4096, Math.max(512, Number(maxPx)));
  // Scene Bible density is the high-tier target. Mid/low scale with atlas resolution.
  const targetDensityScale = limit / 4096;
  const need = a.reduce((sum, mesh) => {
    const surface = Number(mesh.surfaceM2);
    const target = Number(mesh.targetTexelsPerM) * targetDensityScale;
    if (!(surface > 0 && target > 0)) throw Error("Área/densidade inválida");
    return sum + surface * target * target / EFF;
  }, 0);
  if (!a.length || area <= 0) throw Error("Grupo sem superfícies baked");
  const px = SIZES.find((size) => size <= limit && size * size >= need);
  const chosen = px || limit;
  return {
    atlasPx: chosen,
    atlases: 1,
    fits: Boolean(px),
    surfaceM2: +area.toFixed(6),
    requiredTexels: Math.ceil(need),
    targetDensityScale: +targetDensityScale.toFixed(3),
    effectiveTexelsPerM: +Math.sqrt(chosen * chosen * EFF / area).toFixed(1),
    memoryMB: +(chosen * chosen * MIP / 1048576).toFixed(3),
    paddingPixels: +(MARGIN * chosen).toFixed(3),
    meshCount: a.length,
  };
}
export function buildPlan(r,b){const fails=[],add=(ok,msg)=>{if(!ok)fails.push(msg);};add(r?.phase===12,"Fase do relatório inválida");add(r?.status==="source-validated","Validação Blender falhou");add(r?.uv2Independent===true,"UV2 não independente");add(Number(r?.smartProjectAngleDegrees)===66,"Ângulo !=66");add(Number(r?.smartProjectIslandMargin)===.003,"Island margin !=.003");add(Number(r?.packMargin)===.004,"Pack margin !=.004");add(Number(r?.paddingAt4096Px)>=8,"Padding <8px");add(b?.version===3&&Array.isArray(b?.elements),"Scene Bible v3 em falta");const zones=new Set((b?.elements||[]).map(e=>e.zone));for(const g of GROUPS)add(zones.has(g),"Zona em falta "+g);const ms=Array.isArray(r?.meshAreas)?r.meshAreas:[];add(ms.length>0,"Sem áreas medidas");for(const m of ms){add(GROUPS.includes(m.lmGroup),"lmGroup inválido "+m.name);add(Number(m.surfaceM2)>0,"Área inválida "+m.name);add(m.uvMap==="UVMap"&&m.uvLightmap==="UV_Lightmap"&&m.uv2Independent===true,"UV2 em falta "+m.name);if(m.lightmapPolicy!=="shared-ao-ibl")add(Number(m.maxIslandStretch)<=1.15,"Stretching >1.15 "+m.name);add([32,64,96,128].includes(Number(m.targetTexelsPerM)),"Densidade inválida "+m.name);}
const tiers={};for(const [t,c] of Object.entries(TIERS)){const groups={};let total=0;for(const g of GROUPS){let p;try{p=planSingleAtlas(ms.filter(m=>m.lmGroup===g),c.maxPx);}catch(e){p={atlasPx:c.maxPx,atlases:1,fits:false,surfaceM2:0,requiredTexels:0,effectiveTexelsPerM:0,memoryMB:0,paddingPixels:0,meshCount:0};fails.push(t+"/"+g+": "+e.message);}groups[g]=p;total+=p.memoryMB;add(p.fits,t+"/"+g+" não cabe num atlas");}total=+total.toFixed(3);add(total<=c.budgetMB,t+" excede "+c.budgetMB+" MiB: "+total);tiers[t]={maxPx:c.maxPx,budgetMB:c.budgetMB,totalMemoryMB:total,groups};}
return {version:1,phase:12,status:fails.length?"failed":"within-budget",sourceCommit:r?.sourceCommit||"unknown",sourceElements:b?.elements?.length||0,meshCount:ms.length,policy:{oneAtlasPerGroupPerTier:true,packMargin:.004,paddingAt4096Px:16.384,stretchLimit:1.15},tiers,failures:[...new Set(fails)]};}
function arg(n,d){const i=process.argv.indexOf(n);return i>=0&&process.argv[i+1]?process.argv[i+1]:d;}
function md(p){const l=["# Fase 12: UV2 e orçamento de lightmaps","","Estado: "+p.status,"Commit fonte: "+p.sourceCommit,"Elementos Scene Bible: "+p.sourceElements,"Malhas medidas: "+p.meshCount,"","Plano calculado com áreas do .blend reaberto. Não declara bake, que pertence à Fase 13.","","| Tier | Máximo px | Memória MiB | Limite MiB |","|---|---:|---:|---:|"];for(const[t,v]of Object.entries(p.tiers)){l.push("| "+t+" | "+v.maxPx+" | "+v.totalMemoryMB+" | "+v.budgetMB+" |");l.push("","## "+t,"","| Grupo | Atlas px | Atlases | Área m² | Memória MiB |","|---|---:|---:|---:|---:|");for(const[g,a]of Object.entries(v.groups))l.push("| "+g+" | "+a.atlasPx+" | "+a.atlases+" | "+a.surfaceM2+" | "+a.memoryMB+" |");}l.push("","## Falhas","");if(p.failures.length)for(const x of p.failures)l.push("- "+x);else l.push("- Nenhuma falha de orçamento.");l.push("");return l.join("\n");}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{const r=JSON.parse(readFileSync(resolve(arg("--input","art/out/phase12-mesh-areas.json")),"utf8")),b=JSON.parse(readFileSync(resolve(arg("--scene-bible","docs/camping-v3/scene-bible.json")),"utf8")),m=resolve(arg("--output","docs/camping-v3/phase-12/lightmap-plan.md")),j=resolve(arg("--json-output","art/xoyens-studio.phase12.plan.json")),p=buildPlan(r,b);mkdirSync(dirname(m),{recursive:true});mkdirSync(dirname(j),{recursive:true});writeFileSync(m,md(p));writeFileSync(j,JSON.stringify(p,null,2)+"\n");console.log(JSON.stringify({status:p.status,tiers:p.tiers,failures:p.failures},null,2));if(p.status!=="within-budget")process.exitCode=1;}catch(e){console.error(e.message);process.exitCode=1;}}
