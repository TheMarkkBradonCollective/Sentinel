import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { getRepositories } from "@/lib/github";
export const runtime = "edge";
export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const repositories = await getRepositories(session);
    return NextResponse.json({ repositories, syncedAt: new Date().toISOString() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load repositories." }, { status: 502 });
  }
}