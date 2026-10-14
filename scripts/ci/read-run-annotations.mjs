#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const API = "https://api.github.com";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const EVIDENCE = resolve(ROOT, "docs/camping-v3/phase-04");
export const CAUSES = [
 {id:"BILLING_BLOCK",re:/recent account payments have failed|spending limit needs to be increased|account is locked due to a billing issue|billing issue/i,fix:"Review GitHub Billing, payment method, and Actions budgets."},
 {id:"ACTIONS_DISABLED",re:/actions? (is|are) disabled|workflows? (is|are) disabled/i,fix:"Enable GitHub Actions in repository/organization settings."},
 {id:"POLICY_BLOCK",re:/is not allowed to be used|not allowed because|startup_failure|actions? policy|restricted by policy/i,fix:"Review repository/organization Actions permissions and allowed actions."},
 {id:"NO_MATCHING_RUNNER",re:/no runner matching|waiting for a runner|no available runner|no matching runner|label/i,fix:"Check runner labels and availability."},
 {id:"QUOTA",re:/quota|minutes (limit|exceeded)|usage limit|spending limit/i,fix:"Review Actions minutes, spending limit, and account usage restrictions."},
];
export function classify(messages=[]) {
 const all=messages.filter(Boolean).join("\n"), hit=CAUSES.find((cause)=>cause.re.test(all));
 return hit?{cause:hit.id,fix:hit.fix}:{cause:"UNKNOWN",fix:"Do not guess. Read exact GitHub Actions Annotations or attach raw API response."};
}
export async function readRun(repo,runId,{token=process.env.GITHUB_TOKEN??process.env.GH_TOKEN,fetcher=fetch}={}) {
 if(!/^[^/]+\/[^/]+$/.test(repo)) throw new Error("Repository must be owner/name.");
 if(!/^\d+$/.test(String(runId))) throw new Error("run_id must be numeric.");
 const headers={Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28",...(token?{Authorization:`Bearer ${token}`}:{})};
 const get=async(path)=>{const r=await fetcher(`${API}${path}`,{headers});if(!r.ok)throw new Error(`${path} -> HTTP ${r.status}: ${(await r.text()).slice(0,800)}`);return r.json();};
 const jobs=(await get(`/repos/${repo}/actions/runs/${runId}/jobs?per_page=100`)).jobs??[], output=[];
 for(const job of jobs){
  let annotations=[],annotationError=null;
  try{annotations=await get(`/repos/${repo}/check-runs/${job.id}/annotations?per_page=100`);}
  catch(e){annotationError=e instanceof Error?e.message:String(e);annotations=[{message:`ANNOTATIONS_UNAVAILABLE: ${annotationError}`}];}
  output.push({job:job.name,id:job.id,status:job.status,conclusion:job.conclusion,runner_id:job.runner_id??0,runner_name:job.runner_name??"",steps:(job.steps??[]).length,started_at:job.started_at??null,completed_at:job.completed_at??null,labels:job.labels??[],annotation_error:annotationError,messages:annotations.map(a=>a.message).filter(Boolean)});
 }
 return {observedAt:new Date().toISOString(),repo,runId:Number(runId),jobs:output,verdict:classify(output.flatMap(j=>j.messages))};
}
export function formatText(r){
 const lines=[`Fase 04-R · leitura de anotações · ${r.observedAt}`,`Repositório: ${r.repo}`,`Run: ${r.runId}`];
 for(const j of r.jobs){lines.push("",`# job ${j.job} (${j.id}) status=${j.status} conclusion=${j.conclusion} runner_id=${j.runner_id} steps=${j.steps}`);if(j.annotation_error)lines.push(`  erro de anotações: ${j.annotation_error}`);for(const m of j.messages)lines.push(`  anotação: ${m}`);}
 lines.push("",`DIAGNÓSTICO: ${r.verdict.cause}`,`ACÇÃO: ${r.verdict.fix}`);return lines.join("\n")+"\n";
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [repo,runId,...flags]=process.argv.slice(2);
 if(!repo||!runId){console.error("Uso: GITHUB_TOKEN=<token> node scripts/ci/read-run-annotations.mjs owner/repo <run_id> [--json] [--no-write]");process.exit(2);}
 try{const r=await readRun(repo,runId),out=formatText(r);if(!flags.includes("--no-write")){mkdirSync(EVIDENCE,{recursive:true});writeFileSync(resolve(EVIDENCE,"annotations.json"),JSON.stringify(r,null,2)+"\n");writeFileSync(resolve(EVIDENCE,"annotations.txt"),out);}console.log(flags.includes("--json")?JSON.stringify(r,null,2):out);if(r.verdict.cause==="UNKNOWN"||r.jobs.some(j=>j.annotation_error))process.exitCode=1;}
 catch(e){console.error(e instanceof Error?e.message:String(e));process.exitCode=1;}
}
