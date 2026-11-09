import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE = "sentinel_session";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type SentinelSession = { accessToken: string; login: string; avatarUrl: string; expiresAt: number; githubId?: number };

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function fromBase64Url(value: string) {
  const base = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base + "=".repeat((4 - base.length % 4) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}
async function encryptionKey() {
  const secret = process.env.SENTINEL_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SENTINEL_SESSION_SECRET must be at least 32 characters.");
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}
export async function sealSession(session: SentinelSession) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await encryptionKey();
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(JSON.stringify(session)));
  return toBase64Url(new Uint8Array([...iv, ...new Uint8Array(encrypted)]));
}
export async function readSession(): Promise<SentinelSession | null> {
  try {
    const jar = await cookies();
    const value = jar.get(COOKIE)?.value;
    if (!value) return null;
    const bytes = fromBase64Url(value);
    const iv = bytes.slice(0, 12);
    const ciphertext = bytes.slice(12);
    const key = await encryptionKey();
    const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    const session = JSON.parse(decoder.decode(clear)) as SentinelSession;
    if (!session.accessToken || session.expiresAt < Date.now()) return null;
    return session;
  } catch { return null; }
}
export async function saveSession(session: SentinelSession) {
  const jar = await cookies();
  jar.set(COOKIE, await sealSession(session), {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7
  });
}
export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}
export async function requireSession() {
  const session = await readSession();
  if (!session) redirect("/");
  return session;
}