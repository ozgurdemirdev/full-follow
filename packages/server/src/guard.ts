import os from "node:os";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ALLOWED_BODY_TYPES, LOCAL_HOSTS, SAFE_METHODS } from "./constants";
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

const mediaType = (header: string | undefined) => (header ?? "").split(";")[0].trim().toLowerCase();

/**
 * Two checks for every request, whether or not a password is set. A Host that is not this computer is refused (421): a web page that
 * rebinds its own name to 127.0.0.1 cannot read the API. A request that changes data must declare a JSON or multipart body (415):
 * a form or a no-cors fetch from another site cannot send those without a preflight the server never answers.
 */
export const requestGuard: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  if (!hostAllowed(req.headers.host)) return void res.status(421).json({ error: m.guard.foreignHost, code: "http" });
  if (!SAFE_METHODS.includes(req.method) && !ALLOWED_BODY_TYPES.includes(mediaType(req.headers["content-type"]))) {
    return void res.status(415).json({ error: m.guard.bodyType, code: "http" });
  }
  next();
};
