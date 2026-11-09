import { NextRequest, NextResponse } from "next/server";
import { recordGithubConnection } from "@/lib/db/persist";
import { sealSession } from "@/lib/session";
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expected = request.cookies.get("sentinel_oauth_state")?.value;
  const fail = (reason: string) => NextResponse.redirect(new URL(`/?error=${encodeURIComponent(reason)}`, request.url));
  if (!code || !state || !expected || state !== expected) return fail("oauth_state_invalid");
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) return fail("github_not_configured");
  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code })
  });
  const tokenData = await tokenResponse.json() as { access_token?: string; error?: string };
  if (!tokenResponse.ok || !tokenData.access_token) return fail(tokenData.error || "oauth_token_failed");
  const userResponse = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: "application/vnd.github+json", "User-Agent": "Sentinel-Command-Center" }
  });
  if (!userResponse.ok) return fail("github_profile_failed");
  const user = await userResponse.json() as { id: number; login: string; avatar_url: string };
  if (!Number.isSafeInteger(user.id) || user.id <= 0) return fail("github_profile_failed");
  const recorded = await recordGithubConnection({ githubId: String(user.id), login: user.login, avatarUrl: user.avatar_url });
  if (!recorded.ok && recorded.reason === "unavailable") {
    console.error(JSON.stringify({ event: "persistence_failed", action: "github.connected", reason: recorded.reason }));
  }
  const response = NextResponse.redirect(new URL("/", request.url));
  const sessionCookie = await sealSession({
    accessToken: tokenData.access_token!,
    login: user.login,
    avatarUrl: user.avatar_url,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    githubId: user.id,
  });
  response.cookies.set("sentinel_session", sessionCookie, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
  response.cookies.delete("sentinel_oauth_state");
  return response;
}