import { NextRequest, NextResponse } from "next/server";
export const runtime = "edge";
export async function GET(request: NextRequest) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) return NextResponse.redirect(new URL("/?error=github_not_configured", request.url));
  const state = crypto.randomUUID();
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", new URL("/api/auth/callback", request.url).toString());
  url.searchParams.set("scope", "read:user user:email repo");
  url.searchParams.set("state", state);
  const response = NextResponse.redirect(url);
  response.cookies.set("sentinel_oauth_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 600 });
  return response;
}