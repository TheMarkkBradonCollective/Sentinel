import { NextResponse } from "next/server";
import { syncRepositories } from "@/lib/db/persist";
import { readSession } from "@/lib/session";
import { getRepositories } from "@/lib/github";
export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const repositories = await getRepositories(session);
    const persistence = await syncRepositories(session, repositories);
    return NextResponse.json({
      repositories,
      syncedAt: new Date().toISOString(),
      persistence: persistence.ok
        ? { ok: true, repositories: persistence.data.repositories }
        : { ok: false, reason: persistence.reason, message: persistence.message },
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load repositories." }, { status: 502 });
  }
}