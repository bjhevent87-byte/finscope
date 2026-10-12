import { handleRequest } from "../server.mjs";

// Vercel forwards every /api/* route to this one function. Keep the original
// route explicit so the same server handlers work locally and in production.
export default async function handler(req, res) {
  const url = new URL(req.url, "http://localhost");
  const route = url.searchParams.get("__path");
  if (route) {
    url.pathname = `/api/${route.replace(/^\/+/, "")}`;
    url.searchParams.delete("__path");
    req.url = `${url.pathname}${url.search}`;
  }
  return handleRequest(req, res);
}
