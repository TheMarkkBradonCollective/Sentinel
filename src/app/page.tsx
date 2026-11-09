"use client";
import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowUpRight, Bell, Boxes, CheckCircle2, ChevronRight, CircleDot, Clock3, Code2, Command, Database, GitBranch, Github, LayoutDashboard, LockKeyhole, Menu, RefreshCw, Search, ShieldCheck, Shield, Sparkles, Workflow, X } from "lucide-react";

type Repo = { id: number; name: string; full_name: string; description: string | null; html_url: string; language: string | null; stargazers_count: number; open_issues_count: number; default_branch: string; updated_at: string; private: boolean; archived: boolean; pushed_at: string | null; visibility: string };
type ApiData = { repositories?: Repo[]; syncedAt?: string; error?: string };
type PersistenceStatus = { configured: boolean; reachable: boolean; pooled: boolean; database: string | null; counts: { repositories: number; planRuns: number; auditEvents: number } | null; recentPlanRuns: Array<{ provider: string; branch: string; pullRequestNumber: number; createdAt: string }>; reason?: string };
const nav = [{ label: "Overview", icon: LayoutDashboard }, { label: "Repositories", icon: Boxes }, { label: "Activity", icon: Activity }, { label: "Findings", icon: ShieldCheck }, { label: "Planner", icon: Command }];
function timeAgo(value: string) { const ms = Date.now() - new Date(value).getTime(); const hours = Math.floor(ms / 3600000); if (hours < 1) return "Just now"; if (hours < 24) return `${hours}h ago`; const days = Math.floor(hours / 24); return days < 30 ? `${days}d ago` : new Date(value).toLocaleDateString(); }
function initials(value: string) { return value.split(/[\s-]/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(); }
export default function Home() {
  const [data, setData] = useState<ApiData>({});
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState("Overview");
  const [mobileNav, setMobileNav] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [persistence, setPersistence] = useState<PersistenceStatus | null>(null);
  async function load() {
    setRefreshing(true);
    try {
      const response = await fetch("/api/github/repos", { cache: "no-store" });
      if (response.status === 401) { setConnected(false); setData({}); setPersistence(null); }
      else {
        const result = await response.json() as ApiData;
        if (!response.ok) throw new Error(result.error || "Could not load GitHub repositories.");
        setData(result); setConnected(true); setError("");
        const persistenceResponse = await fetch("/api/persistence", { cache: "no-store" });
        setPersistence(persistenceResponse.ok ? await persistenceResponse.json() as PersistenceStatus : null);
      }
    } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong."); }
    finally { setLoading(false); setRefreshing(false); }
  }
  useEffect(() => { void load(); }, []);
  const repos = data.repositories ?? [];
  const filtered = useMemo(() => (data.repositories ?? []).filter((repo) => `${repo.name} ${repo.full_name} ${repo.description || ""} ${repo.language || ""}`.toLowerCase().includes(query.toLowerCase())), [data.repositories, query]);
  const privateCount = repos.filter((repo) => repo.private).length;
  const publicCount = repos.length - privateCount;
  const recentlyActive = repos.filter((repo) => Date.now() - new Date(repo.pushed_at || repo.updated_at).getTime() < 7 * 86400000).length;
  return <main className="shell">
    <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
      <div className="brand"><div className="brand-mark"><Shield size={21} strokeWidth={2.4}/></div><div><strong>sentinel<span>.</span></strong><small>DEVELOPMENT COMMAND</small></div><button className="icon-btn mobile-close" onClick={() => setMobileNav(false)} aria-label="Close navigation"><X size={18}/></button></div>
      <div className="workspace-label">WORKSPACE</div><div className="workspace"><div className="org-avatar">M</div><div><b>TheMarkkBradonCollective</b><small>{connected ? "GitHub connected" : "Not connected"}</small></div><ChevronRight size={15}/></div>
      <div className="nav-label">COMMAND CENTER</div><nav>{nav.map(({ label, icon: Icon }) => <button key={label} onClick={() => { setActive(label); setMobileNav(false); if (label === "Planner") window.location.href = "/plan"; }} className={`nav-item ${active === label ? "active" : ""}`}><Icon size={17}/><span>{label}</span>{label === "Findings" && <i className="nav-dot"/>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="security-note"><LockKeyhole size={16}/><div><b>Controlled changes</b><small>Plan commits require your Run action.</small></div></div><div className="profile">{connected ? <><div className="avatar">{initials(data.repositories?.[0]?.full_name?.split("/")[0] || "GH")}</div><div><b>GitHub connected</b><small>Repository access active</small></div></> : <><div className="avatar">S</div><div><b>Sentinel workspace</b><small>Connect GitHub to begin</small></div></>}</div></div>
    </aside>
    {mobileNav && <button className="scrim" onClick={() => setMobileNav(false)} aria-label="Close menu"/>}
    <section className="main-area">
      <header className="topbar"><button className="icon-btn menu-trigger" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={20}/></button><div className="crumb">Workspace <span>/</span> <b>{active}</b></div><div className="top-actions"><div className="status-pill"><i/> SYSTEM {connected ? "CONNECTED" : "STANDBY"}</div><button className="icon-btn" aria-label="Notifications"><Bell size={18}/></button>{connected ? <form action="/api/auth/logout" method="post"><button className="connect-btn muted" type="submit">Disconnect</button></form> : <a className="connect-btn" href="/api/auth/login"><Github size={16}/> Connect GitHub</a>}</div></header>
      <div className="content">
        <div className="page-heading"><div><div className="eyebrow"><span className="pulse"/> YOUR DEVELOPMENT OVERVIEW</div><h1>{active === "Overview" ? "Command center" : active}</h1><p>Everything happening across your projects, in one place.</p></div><button className="refresh-btn" onClick={() => void load()} disabled={refreshing}><RefreshCw size={15} className={refreshing ? "spin" : ""}/> Refresh</button></div>
        {error && <div className="error-banner"><AlertTriangle size={17}/>{error}</div>}
        {!connected ? <section className="connect-hero"><div className="hero-glow"/><div className="hero-icon"><Github size={28}/></div><div className="eyebrow">FIRST CONNECTION</div><h2>Bring your projects<br/><span>into focus.</span></h2><p>Connect GitHub to give Sentinel a live view of your repositories, branches, activity, and project health. Your access starts read-only.</p><a href="/api/auth/login" className="primary-btn"><Github size={17}/> Connect GitHub account <ArrowUpRight size={16}/></a><div className="trust-line"><LockKeyhole size={13}/> Encrypted session · Read-only monitoring · No code changes</div></section> : <>
          <div className="stats-grid">
            <article className="stat-card"><div className="stat-top"><span>REPOSITORIES</span><Boxes size={17}/></div><div className="stat-value">{loading ? "—" : repos.length}</div><div className="stat-foot"><span className="green-text"><CircleDot size={12}/> Live from GitHub</span><span>All accessible repos</span></div></article>
            <article className="stat-card"><div className="stat-top"><span>ACTIVE THIS WEEK</span><Activity size={17}/></div><div className="stat-value">{loading ? "—" : recentlyActive}</div><div className="stat-foot"><span>Recent pushes</span><span>Last 7 days</span></div></article>
            <article className="stat-card"><div className="stat-top"><span>PRIVATE PROJECTS</span><LockKeyhole size={17}/></div><div className="stat-value">{loading ? "—" : privateCount}</div><div className="stat-foot"><span>Restricted visibility</span><span>{publicCount} public</span></div></article>
            <article className="stat-card"><div className="stat-top"><span>OPEN ISSUES</span><AlertTriangle size={17}/></div><div className="stat-value">{loading ? "—" : repos.reduce((sum, repo) => sum + repo.open_issues_count, 0)}</div><div className="stat-foot"><span>Across repositories</span><span>GitHub count</span></div></article>
          </div>
          <section className="panel repo-panel"><div className="panel-heading"><div><div className="eyebrow">CONNECTED WORK</div><h3>Repositories <span className="count">{repos.length}</span></h3></div><label className="search-box"><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search repositories..."/></label></div>
            {loading ? <div className="empty-state"><RefreshCw className="spin" size={20}/> Loading repositories…</div> : filtered.length === 0 ? <div className="empty-state"><Boxes size={22}/>{repos.length ? "No repositories match your search." : "No repositories were returned for this GitHub account."}</div> : <div className="repo-list">{filtered.map((repo) => <a className="repo-row" href={`/projects/${encodeURIComponent(repo.full_name.split("/")[0])}/${encodeURIComponent(repo.name)}`} key={repo.id}><div className="repo-icon"><Code2 size={18}/></div><div className="repo-main"><div className="repo-name">{repo.full_name}<ArrowUpRight size={13}/></div><p>{repo.description || "No description added yet."}</p><div className="repo-meta">{repo.language && <span><i className="language-dot"/> {repo.language}</span>}<span><GitBranch size={12}/> {repo.default_branch}</span><span><AlertTriangle size={12}/> {repo.open_issues_count} issues</span></div></div><div className="repo-right"><span className={`visibility ${repo.private ? "private" : ""}`}>{repo.private ? "PRIVATE" : "PUBLIC"}</span><small>Updated {timeAgo(repo.updated_at)}</small></div><ChevronRight className="repo-chevron" size={16}/></a>)}</div>}
            <div className="panel-footer"><span>Showing {filtered.length} of {repos.length} repositories</span><span>Synced {data.syncedAt ? new Date(data.syncedAt).toLocaleTimeString() : "—"}</span></div>
          </section>
          <div className="lower-grid"><section className="panel mini-panel"><div className="eyebrow">MONITORING STATUS</div><h3><ShieldCheck size={18}/> Protection overview</h3><div className="monitor-row"><span><CheckCircle2 size={15}/> GitHub connection</span><b className="green-text">Active</b></div><div className="monitor-row"><span><LockKeyhole size={15}/> Session encryption</span><b className="green-text">Enabled</b></div><div className="monitor-row"><span><Database size={15}/> Neon database</span><b className={persistence?.reachable ? "green-text" : "muted-text"}>{!persistence ? "Checking" : persistence.reachable ? "Connected" : persistence.reason === "not_configured" ? "Not configured" : persistence.reason === "not_migrated" ? "Schema not applied" : "Unreachable"}</b></div><div className="monitor-row"><span><Boxes size={15}/> Repository snapshots</span><b>{persistence?.counts ? persistence.counts.repositories : "—"}</b></div><div className="monitor-row"><span><Command size={15}/> Plan runs recorded</span><b>{persistence?.counts ? persistence.counts.planRuns : "—"}</b></div>{persistence?.recentPlanRuns[0] ? <div className="monitor-row"><span>Latest plan run</span><b>{persistence.recentPlanRuns[0].branch}</b></div> : null}<div className="monitor-row"><span><Workflow size={15}/> Workflow analysis</span><b className="muted-text">Next phase</b></div><div className="monitor-row"><span><Sparkles size={15}/> Code intelligence</span><b className="muted-text">Next phase</b></div></section><section className="panel mini-panel"><div className="eyebrow">NEXT STEPS</div><h3><Clock3 size={18}/> Build pipeline</h3><div className="pipeline-step done"><i>1</i><div><b>GitHub connection</b><small>Repository discovery is live</small></div><CheckCircle2 size={16}/></div><div className="pipeline-step current"><i>2</i><div><b>Project health checks</b><small>Workflow and issue analysis</small></div><span>UP NEXT</span></div><div className="pipeline-step"><i>3</i><div><b>Planner & verification</b><small>Features, milestones, acceptance tests</small></div></div></section></div>
        </>}
        <footer className="footer"><span><Shield size={13}/> SENTINEL <b>·</b> SEE EVERYTHING. BUILD ANYTHING.</span><span>GitHub data · Read-only access</span></footer>
      </div>
    </section>
  </main>;
}