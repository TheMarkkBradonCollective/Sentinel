import { NextResponse } from "next/server";
import { readPersistenceStatus } from "@/lib/db/persist";
import { readSession } from "@/lib/session";

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const status = await readPersistenceStatus(session);
  return NextResponse.json(status, { headers: { "Cache-Control": "private, no-store" } });
}
