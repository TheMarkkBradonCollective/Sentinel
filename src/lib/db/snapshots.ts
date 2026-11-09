import type { RepositoryInput, RepositorySnapshot } from "@/lib/db/types";

function count(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

function timestamp(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function text(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  const cleaned = value.replace(/\u0000/g, "").trim();
  if (!cleaned) return null;
  return cleaned.slice(0, max);
}

export function githubId(id: number): string | null {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return String(id);
}

export function toRepositorySnapshot(repo: RepositoryInput): RepositorySnapshot | null {
  const id = githubId(repo.id);
  const fullName = text(repo.full_name, 200);
  const name = text(repo.name, 100);
  const htmlUrl = text(repo.html_url, 2048);
  const defaultBranch = text(repo.default_branch, 255);
  if (!id || !fullName || !name || !htmlUrl || !defaultBranch || !fullName.includes("/")) return null;
  const owner = text(fullName.slice(0, fullName.indexOf("/")), 100);
  if (!owner) return null;
  return {
    githubId: id,
    owner,
    name,
    fullName,
    description: text(repo.description, 2000),
    htmlUrl,
    language: text(repo.language, 100),
    visibility: text(repo.visibility, 32) ?? "unknown",
    isPrivate: repo.private === true,
    isArchived: repo.archived === true,
    defaultBranch,
    stargazersCount: count(repo.stargazers_count),
    forksCount: count(repo.forks_count),
    openIssuesCount: count(repo.open_issues_count),
    pushedAt: timestamp(repo.pushed_at),
    githubUpdatedAt: timestamp(repo.updated_at),
  };
}
