import { env } from "../config/env.js";

export function toPublicUrl(relativePath: string | null | undefined) {
  if (!relativePath) return null;
  if (/^https?:\/\//i.test(relativePath)) return relativePath;

  const baseUrl = env.PUBLIC_API_URL ?? `http://localhost:${env.PORT}`;
  return new URL(relativePath.replace(/\\/g, "/"), `${baseUrl}/`).toString();
}
