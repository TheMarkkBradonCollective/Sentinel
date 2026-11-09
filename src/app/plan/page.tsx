"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bot, Check, Clipboard, FilePlus2, GitBranch, Play, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
type Repo={id:number;full_name:string;name:string;private:boolean};
type PlanData={exists:boolean;content:string;sha:string|null;url:string|null;error?:string};
type RunResult={ok:boolean;created:boolean;commit:string|null;url:string;branch:string;base:string;pullRequest:string;pullRequestNumber:number;changes:{added:string[];removed:string[];updated:number};provider:string;handoff:string;timestamp?:string;persistence?:{ok:boolean;reason?:string};error?:string};
const starter=`# Project Plan

## Project goal
Describe the outcome this project is intended to deliver.

## Current state
- [ ] Review the existing application and document its architecture.

## Planned changes
### Features
- [ ] Add the next feature and define its acceptance criteria.

### Improvements
- [ ] List performance, usability, and maintainability improvements.

### Fixes
- [ ] Record known bugs and their expected behavior.

## Acceptance criteria
- [ ] Relevant tests pass.
- [ ] Existing working functionality remains intact.
- [ ] Changes are documented and verified.

## Implementation status
- Proposed: 0
- In progress: 0
- Implemented: 0
- Tested: 0
- Verified: 0
`;
export default function PlannerPage(){
 const [repos,setRepos]=useState<Repo[]>([]),[selected,setSelected]=useState(""),[content,setContent]=useState(starter),[exists,setExists]=useState(false),[provider,setProvider]=useState("cursor"),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[message,setMessage]=useState(""),[result,setResult]=useState<RunResult|null>(null);
 useEffect(()=>{fetch("/api/github/repos").then(r=>r.json()).then(d=>{const list=(d.repositories||[]) as Repo[];setRepos(list);if(list[0])setSelected(list[0].full_name);}).catch(()=>setMessage("Could not load GitHub repositories.")).finally(()=>setLoading(false));},[]);
 useEffect(()=>{if(!selected)return;let active=true;fetch("/api/projects/"+selected.split("/").map(encodeURIComponent).join("/")+"/plan").then(r=>r.json()).then((d:PlanData)=>{if(!active)return;if(d.error){setMessage(d.error);return;}setContent(d.exists?d.content:starter);setExists(d.exists);setResult(null);setMessage(d.exists?"Loaded the existing plan.md.":"No plan.md found. Sentinel will create one when you run it.");}).catch(()=>setMessage("Could not load this project's plan."));return()=>{active=false;};},[selected]);
 async function run(){if(!selected||!content.trim())return;setSaving(true);setMessage("");setResult(null);try{const [owner,repo]=selected.split("/");const response=await fetch(`/api/projects/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/plan`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({content,provider})});const data=await response.json() as RunResult;if(!response.ok)throw new Error(data.error||"Plan run failed.");setResult(data);setExists(true);setContent(content.replace(/\n*## Change history[\s\S]*$/,"").trimEnd()+"\n\n## Change history\n\n"+`### ${data.timestamp} — Plan run via Sentinel (${provider})\n- Added: ${data.changes.added.length}\n- Removed: ${data.changes.removed.length}\n- Updated estimate: ${data.changes.updated}\n`+data.changes.added.slice(0,40).map(x=>"- [ADDED] "+x).join("\n")+"\n"+data.changes.removed.slice(0,40).map(x=>"- [REMOVED] "+x).join("\n"));const stored=data.persistence?.ok?" The run was recorded in Neon.":data.persistence?.reason==="not_configured"?" Neon is not configured, so this run was not stored in the database.":" The pull request was opened, but the Neon record was not saved.";setMessage("Plan committed to a dedicated branch and a review pull request was opened. No code was changed on the default branch."+stored);}catch(e){setMessage(e instanceof Error?e.message:"Plan run failed.");}finally{setSaving(false);}}
 async function copyPrompt(){if(!result)return;await navigator.clipboard.writeText(result.handoff);setMessage("Agent handoff prompt copied.");}
 const openAgent=()=>{if(provider==="chatgpt")window.open("https://chatgpt.com/","_blank","noopener,noreferrer");else if(provider==="claude")window.open("https://claude.ai/new","_blank","noopener,noreferrer");else window.open("https://cursor.com/","_blank","noopener,noreferrer");};
 return <main className="planner-page"><header className="planner-header"><Link href="/" className="back-link"><ArrowLeft size={16}/> Command center</Link><div className="planner-brand"><div className="brand-mark"><ShieldCheck size={20}/></div><span>SENTINEL <b>/ PLAN CONTROL</b></span></div></header>
 <section className="planner-intro"><div className="eyebrow"><Sparkles size={13}/> PROJECT CONTROL PLANE</div><h1>One plan. <span>Every change.</span></h1><p>Control project direction from the repository plan. Sentinel compares revisions, records the change history, and commits the plan when you run it.</p></section>
 <section className="planner-toolbar"><label>PROJECT REPOSITORY<select value={selected} onChange={e=>setSelected(e.target.value)} disabled={loading||!repos.length}>{repos.map(r=><option key={r.id} value={r.full_name}>{r.full_name}{r.private?" · Private":""}</option>)}</select></label><div className="plan-state"><span className={exists?"state-live":"state-new"}/>{exists?"PLAN.MD CONNECTED":"PLAN.MD WILL BE CREATED"}</div></section>
 <div className="planner-grid"><section className="panel plan-editor"><div className="editor-head"><div><div className="eyebrow">SOURCE OF TRUTH</div><h2><FilePlus2 size={18}/> plan.md</h2></div><span>MARKDOWN · LIVE EDITOR</span></div><textarea spellCheck={false} value={content} onChange={e=>setContent(e.target.value)} placeholder="Write the project plan in Markdown..."/><div className="editor-foot"><span>{content.length.toLocaleString()} characters</span><span><GitBranch size={12}/> Repository default branch</span></div></section>
 <aside className="plan-side"><section className="panel"><div className="eyebrow">EXECUTION HANDOFF</div><h3><Bot size={17}/> Choose your agent</h3><p>Run creates a dedicated branch, commits plan.md, and opens a review pull request. Then hand off implementation to your selected coding agent.</p><div className="agent-options">{[["cursor","Cursor"],["chatgpt","ChatGPT"],["claude","Claude"]].map(([id,label])=><button key={id} className={provider===id?"agent active":"agent"} onClick={()=>setProvider(id)}><span className="agent-symbol">{id==="cursor"?"⌘":id==="chatgpt"?"✳":"✦"}</span>{label}{provider===id&&<Check size={14}/>}</button>)}</div><div className="permission-note"><ShieldCheck size={15}/><span>Sentinel creates a plan-only branch and pull request. It does not yet execute agents directly. Copy the handoff prompt into your selected agent; keep implementation on the same branch for review.</span></div><button className="run-plan" disabled={!selected||saving||!content.trim()} onClick={run}>{saving?<RefreshCw className="spin" size={16}/>:<Play size={16} fill="currentColor"/>}{saving?"Saving plan…":"Run plan & open review PR"}</button></section>
 <section className="panel change-panel"><div className="eyebrow">CHANGE DETECTION</div><h3>Every revision is recorded</h3><div className="change-kind"><i className="added"/> <div><b>Added</b><small>New requirements, features, or tasks</small></div></div><div className="change-kind"><i className="removed"/> <div><b>Removed</b><small>Items removed from the plan</small></div></div><div className="change-kind"><i className="updated"/> <div><b>Updated</b><small>Tracked as paired removals and additions</small></div></div><small className="history-note">Git commit history provides the full revision trail. Sentinel also appends a summary to plan.md.</small></section></aside></div>
 {message&&<div className="plan-message">{message}</div>}
 {result&&<section className="panel run-result"><div className="result-title"><Check size={17}/> Plan committed to GitHub</div><div className="diff-counts"><span className="diff-add">+{result.changes.added.length} added</span><span className="diff-remove">−{result.changes.removed.length} removed</span><span>{result.changes.updated} possible updates</span></div><div className="run-links"><a href={result.url} target="_blank" rel="noreferrer">View plan.md on {result.branch} <GitBranch size={13}/></a><a className="pr-link" href={result.pullRequest} target="_blank" rel="noreferrer">Open pull request #{result.pullRequestNumber} <GitBranch size={13}/></a></div><div className="handoff"><b>Next: hand off to {provider}</b><p>The prompt tells your agent to use branch {result.branch}, read plan.md, implement the approved work, run tests, and update implementation status with evidence. The PR stays open for human review.</p><div className="handoff-actions"><button onClick={copyPrompt}><Clipboard size={14}/> Copy agent prompt</button><button onClick={openAgent}><ArrowLeft size={14}/> Open {provider}</button></div></div></section>}
 <footer className="planner-footer">SENTINEL · PLAN CONTROL · BRANCH + PR WORKFLOW · HUMAN REVIEW REQUIRED</footer></main>;
}