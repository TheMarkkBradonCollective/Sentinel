import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity, AlertTriangle, ArrowLeft, ArrowUpRight, GitBranch, GitPullRequest, Github, ShieldCheck, Workflow } from "lucide-react";
import { requireSession } from "@/lib/session";
import { getRepoOverview } from "@/lib/github";

export const runtime = "edge";
export default async function ProjectPage({ params }: { params: Promise<{ owner: string; repo: string }> }) {
  const { owner, repo } = await params;
  const session = await requireSession();
  let data;
  try { data = await getRepoOverview(session, owner, repo); }
  catch { notFound(); }
  const { details, workflows, pulls, issues } = data;
  const latest = workflows[0];
  const status = latest?.conclusion === "success" ? "Passing" : latest?.conclusion === "failure" ? "Failing" : latest ? latest.status : "No workflow data";
  return <main className="project-page">
    <header className="project-top"><Link href="/" className="back-link"><ArrowLeft size={16}/> All projects</Link><a href={details.html_url} target="_blank" rel="noreferrer" className="external-link">Open on GitHub <ArrowUpRight size={14}/></a></header>
    <div className="project-title"><div className="project-icon"><Github size={24}/></div><div><div className="eyebrow">PROJECT COMMAND CENTER</div><h1>{details.full_name}</h1><p>{details.description || "No project description has been added."}</p></div></div>
    <div className="project-stats">
      <article><span>VISIBILITY</span><b>{details.private ? "Private" : "Public"}</b></article>
      <article><span>DEFAULT BRANCH</span><b><GitBranch size={14}/>{details.default_branch}</b></article>
      <article><span>OPEN ISSUES</span><b>{details.open_issues_count}</b></article>
      <article><span>LANGUAGE</span><b>{details.language || "Not detected"}</b></article>
    </div>
    <div className="project-grid">
      <section className="panel"><div className="eyebrow">CONTINUOUS INTEGRATION</div><h2><Workflow size={18}/> Latest workflow runs</h2>
        {workflows.length ? workflows.map((run) => <a className="detail-row" key={run.id} href={run.html_url} target="_blank" rel="noreferrer"><span className={`run-dot ${run.conclusion === "success" ? "ok" : run.conclusion === "failure" ? "bad" : ""}`}/><div><b>{run.name}</b><small>{run.status} · {run.conclusion || "in progress"}</small></div><ArrowUpRight size={14}/></a>) : <div className="detail-empty">No GitHub Actions runs were found or the Actions endpoint is unavailable.</div>}
        <div className="disclaimer"><ShieldCheck size={14}/> Workflow data comes directly from GitHub. No independent tests have been run by Sentinel yet.</div>
      </section>
      <section className="panel"><div className="eyebrow">OPEN WORK</div><h2><GitPullRequest size={18}/> Pull requests</h2>
        {pulls.length ? pulls.map((item) => <a className="detail-row" key={item.id} href={item.html_url} target="_blank" rel="noreferrer"><span className="run-dot ok"/><div><b>#{item.number} {item.title}</b><small>Updated {new Date(item.updated_at).toLocaleDateString()}</small></div><ArrowUpRight size={14}/></a>) : <div className="detail-empty">No open pull requests.</div>}
      </section>
      <section className="panel"><div className="eyebrow">ISSUE TRACKING</div><h2><AlertTriangle size={18}/> Open issues</h2>
        {issues.length ? issues.map((item) => <a className="detail-row" key={item.id} href={item.html_url} target="_blank" rel="noreferrer"><span className="run-dot"/><div><b>#{item.number} {item.title}</b><small>Updated {new Date(item.updated_at).toLocaleDateString()}</small></div><ArrowUpRight size={14}/></a>) : <div className="detail-empty">No open issues.</div>}
      </section>
      <section className="panel"><div className="eyebrow">SENTINEL HEALTH</div><h2><Activity size={18}/> Monitoring summary</h2>
        <div className="health-line"><span>Latest workflow status</span><b className={latest?.conclusion === "success" ? "healthy" : latest?.conclusion === "failure" ? "unhealthy" : ""}>{status}</b></div>
        <div className="health-line"><span>Repository archived</span><b>{details.archived ? "Yes" : "No"}</b></div>
        <div className="health-line"><span>Last repository update</span><b>{new Date(details.updated_at).toLocaleString()}</b></div>
        <div className="disclaimer"><ShieldCheck size={14}/> This is a live GitHub snapshot, not a complete security or uptime audit.</div>
      </section>
    </div>
  </main>;
}