export {};

declare global {
  interface CloudflareEnv {
    NEON_DATABASE_URL?: string;
  }
}
