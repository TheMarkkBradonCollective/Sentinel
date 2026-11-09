import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function applyFile(path: string, prior: ReadonlySet<string>): boolean {
  if (!existsSync(path)) return false;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || prior.has(key)) continue;
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
  return true;
}

/** Load local env files without overriding variables already set in the process. */
export function loadLocalEnv(): string[] {
  const prior = new Set(Object.keys(process.env));
  const loaded: string[] = [];
  for (const name of [".env", ".env.local", ".dev.vars"]) {
    if (applyFile(resolve(process.cwd(), name), prior)) loaded.push(name);
  }
  return loaded;
}
