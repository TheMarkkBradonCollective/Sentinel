import { NextResponse } from "next/server";
export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.delete("sentinel_session");
  return response;
}