import type { SentinelSession } from "@/lib/session";

const API = "https://api.github.com";
export type GitHubRepo = {
  id: number; name: string; full_name: string; description: string | null;
  html_url: string; language: string | null; stargazers_count: number;
  forks_count: number; open_issues_count: number; default_branch: string;
  updated_at: string; private: boolean; archived: boolean;
  pushed_at: string | null; visibility: string;
};
export async function githubRequest<T>(session: SentinelSession, path: string): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "Sentinel-Command-Center"
    },
    cache: "no-store"
  });
  if (!response.ok) {
    const message = response.status === 401 ? "GitHub authorization expired. Reconnect your account." :
      response.status === 403 ? "GitHub rate limit or permission restriction. Try again later." :
      `GitHub API returned ${response.status}.`;
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}
export async function getRepositories(session: SentinelSession) {
  const repos = await githubRequest<GitHubRepo[]>(session, "/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator,organization_member");
  return repos;
}
export async function getRepoOverview(session: SentinelSession, owner: string, repo: string) {
  const [details, workflows, pulls, issues] = await Promise.all([
    githubRequest<GitHubRepo>(session, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`),
    githubRequest<{ workflow_runs: Array<{ id: number; name: string; status: string; conclusion: string | null; html_url: string; updated_at: string }> }>(session, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs?per_page=8`).catch(() => ({ workflow_runs: [] })),
    githubRequest<Array<{ id: number; number: number; title: string; state: string; html_url: string; updated_at: string }>>(session, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?state=open&per_page=8`),
    githubRequest<Array<{ id: number; number: number; title: string; state: string; html_url: string; updated_at: string }>>(session, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues?state=open&per_page=8`)
  ]);
  return { details, workflows: workflows.workflow_runs, pulls, issues: issues.filter((item) => !("pull_request" in item)) };
}