import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/session";

export const runtime = "edge";
const GH = "https://api.github.com";
const headers = (token: string) => ({ Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "Sentinel-Command-Center" });
function safePath(owner: string, name: string) {
  if (!/^[A-Za-z0-9_.-]{1,100}$/.test(owner) || !/^[A-Za-z0-9_.-]{1,100}$/.test(name)) throw new Error("Invalid repository name.");
  return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/contents/plan.md`;
}
async function getPlan(token: string, path: string) {
  const response = await fetch(GH + path, { headers: headers(token), cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub could not read plan.md (HTTP ${response.status}).`);
  const data = await response.json() as { content?: string; sha: string; encoding: string; html_url?: string };
  if (!data.content || data.encoding !== "base64") throw new Error("Unsupported plan.md encoding.");
  const binary = atob(data.content.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return { content: new TextDecoder().decode(bytes), sha: data.sha, url: data.html_url || "" };
}
function diff(before: string, after: string) {
  const a = before.split("\n").filter(x => x.trim() && x.trim() !== "## Change history");
  const b = after.split("\n").filter(x => x.trim() && x.trim() !== "## Change history");
  const oldSet = new Set(a), newSet = new Set(b);
  const removed = a.filter(x => !newSet.has(x));
  const added = b.filter(x => !oldSet.has(x));
  return { added, removed, updated: removed.length && added.length ? Math.min(removed.length, added.length) : 0 };
}
export async function GET(request: NextRequest, { params }: { params: Promise<{ owner: string; repo: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Connect GitHub first." }, { status: 401 });
  try {
    const { owner, repo } = await params;
    const path = safePath(owner, repo);
    const plan = await getPlan(session.accessToken, path);
    return NextResponse.json({ exists: !!plan, content: plan?.content || "", sha: plan?.sha || null, url: plan?.url || null });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to read project plan." }, { status: 400 });
  }
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ owner: string; repo: string }> }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Connect GitHub first." }, { status: 401 });
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).host !== request.nextUrl.host) return NextResponse.json({ error: "Request origin check failed." }, { status: 403 });
  try {
    const { owner, repo } = await params;
    const path = safePath(owner, repo);
    const body = await request.json() as { content?: string; provider?: string };
    if (typeof body.content !== "string" || body.content.trim().length < 1 || body.content.length > 100000) return NextResponse.json({ error: "Plan content must be between 1 and 100,000 characters." }, { status: 400 });
    const provider = ["cursor", "chatgpt", "claude"].includes(body.provider || "") ? body.provider! : "chatgpt";
    // Verify the authenticated user can access this exact repository before writing.
    const repoCheck = await fetch(`${GH}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, { headers: headers(session.accessToken), cache: "no-store" });
    if (!repoCheck.ok) return NextResponse.json({ error: "This GitHub account cannot access that repository." }, { status: 403 });
    const current = await getPlan(session.accessToken, path);
    const changes = diff(current?.content || "", body.content);
    const stamp = new Date().toISOString();
    const history = [
      "",
      "## Change history",
      `### ${stamp} — Plan run via Sentinel (${provider})`,
      `- Added: ${changes.added.length}`,
      `- Removed: ${changes.removed.length}`,
      `- Updated estimate: ${changes.updated}`,
      ...(changes.added.slice(0, 40).map(line => `- [ADDED] ${line}`)),
      ...(changes.removed.slice(0, 40).map(line => `- [REMOVED] ${line}`)),
      ""
    ].join("\n");
    const base = body.content.replace(/\n*## Change history[\s\S]*$/, "").trimEnd();
    const finalContent = base + history;
    const encoded = btoa(Array.from(new TextEncoder().encode(finalContent), b => String.fromCharCode(b)).join(""));
    const write = await fetch(GH + path, {
      method: "PUT",
      headers: { ...headers(session.accessToken), "Content-Type": "application/json" },
      body: JSON.stringify({ message: `sentinel: update project plan (${provider})`, content: encoded, ...(current?.sha ? { sha: current.sha } : {}) })
    });
    const result = await write.json() as { message?: string; content?: { html_url?: string }; commit?: { sha?: string } };
    if (!write.ok) return NextResponse.json({ error: result.message || `GitHub write failed (HTTP ${write.status}). Check the GitHub app's repository write permission.` }, { status: write.status });
    return NextResponse.json({
      ok: true, created: !current, commit: result.commit?.sha || null, url: result.content?.html_url || `https://github.com/${owner}/${repo}/blob/HEAD/plan.md`,
      changes, provider, timestamp: stamp,
      handoff: `Execute the approved project plan in ${owner}/${repo}. Read plan.md from the repository first. Implement the requirements and tasks in order. Before editing, inspect the existing code and preserve working behavior. Do not expose or print secrets. Update plan.md with implementation status, files changed, tests run, and evidence. Run relevant tests and report anything not verified. Do not claim completion unless tests pass.`
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save project plan." }, { status: 400 });
  }
}