import os from "node:os";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ALLOWED_BODY_TYPES, LOCAL_HOSTS, SAFE_FETCH_SITES, SAFE_METHODS } from "./constants";
import { m } from "./messages";

/** Host names from the FF_ALLOWED_HOSTS list (comma separated, for example a name the phone reaches the computer by) */
const extraHosts = () => (process.env.FF_ALLOWED_HOSTS ?? "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);

/** The host name of a Host header without its port: "localhost:3000" is "localhost", "[::1]:3000" is "[::1]" */
export function hostName(header: string | undefined): string {
  const h = (header ?? "").trim().toLowerCase();
  if (h.startsWith("[")) return h.slice(0, h.indexOf("]") + 1);
  return h.split(":")[0];
}

/** This computer's own interface addresses, written the way a Host header writes them (IPv6 in brackets) */
const interfaceHosts = () => Object.values(os.networkInterfaces()).flatMap((list) => (list ?? []).map((n) => (n.family === "IPv6" ? `[${n.address.toLowerCase()}]` : n.address)));

/** Whether a Host header names this computer: localhost, a loopback address, an own interface address, or a name in FF_ALLOWED_HOSTS */
export function hostAllowed(header: string | undefined): boolean {
  const host = hostName(header);
  return !!host && (LOCAL_HOSTS.includes(host) || extraHosts().includes(host) || interfaceHosts().includes(host));
}

/**
 * Whether a data changing request comes from another site or another port of this one. A browser always names the page that
 * sent it (Origin, Sec-Fetch-Site); a multipart form posts cross origin without a preflight and carries the session cookie of a
 * page on the same host, so the body type alone does not stop it. Clients that send neither header (curl, the tests) pass.
 */
export function crossOrigin(headers: Request["headers"]): boolean {
  const site = headers["sec-fetch-site"];
  if (typeof site === "string" && !SAFE_FETCH_SITES.includes(site.toLowerCase())) return true;
  const origin = headers.origin;
  if (origin === undefined) return false;
  try {
    return new URL(origin).host.toLowerCase() !== (headers.host ?? "").trim().toLowerCase();
  } catch {
    return true; // "null" (a sandboxed frame, a file) or garbage is no page of ours
  }
}

const mediaType = (header: string | undefined) => (header ?? "").split(";")[0].trim().toLowerCase();

/**
 * Three checks for every request, whether or not a password is set. A Host that is not this computer is refused (421): a web page that
 * rebinds its own name to 127.0.0.1 cannot read the API. A request that changes data and comes from another origin is refused (403).
 * A request that changes data must declare a JSON or multipart body (415): a form or a no-cors fetch from another site cannot send
 * JSON without a preflight the server never answers.
 */
export const requestGuard: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  if (!hostAllowed(req.headers.host)) return void res.status(421).json({ error: m.guard.foreignHost, code: "http" });
  if (!SAFE_METHODS.includes(req.method) && crossOrigin(req.headers)) return void res.status(403).json({ error: m.guard.crossOrigin, code: "http" });
  if (!SAFE_METHODS.includes(req.method) && !ALLOWED_BODY_TYPES.includes(mediaType(req.headers["content-type"]))) {
    return void res.status(415).json({ error: m.guard.bodyType, code: "http" });
  }
  next();
};
