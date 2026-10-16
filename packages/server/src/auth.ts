import {
  BadRequestException, Body, CanActivate, ConflictException, Controller, ExecutionContext, ForbiddenException, Get, HttpException, Inject, Injectable,
  Post, Req, Res, UnauthorizedException,
} from "@nestjs/common";
import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { OWNER_PASSWORD_MAX, OWNER_PASSWORD_MIN, SETUP_REQUIRED_CODE } from "@fullfollow/core";
import { MIN_PASSWORD_LENGTH, SESSION_MAX_AGE_MS } from "./constants";
import { CORE, type Core } from "./core.provider";
import { LoginThrottle } from "./login-throttle";
import { m } from "./messages";
import { savePassword, storedPassword, verifyPassword } from "./password-store";
import { bumpSessionEpoch, sessionEpoch, sessionSecret } from "./session-store";

const COOKIE = "ff_session";

const envPassword = () => process.env.FF_PASSWORD || "";
const digest = (v: string) => createHash("sha256").update(v).digest();

/** Where the password comes from: FF_PASSWORD in .env wins, then the one set in the panel; null is the first run (no password yet) */
export type PasswordSource = "env" | "app" | null;
export const passwordSource = (): PasswordSource => (envPassword() ? "env" : storedPassword() ? "app" : null);

/**
 * The signature of a session: the key is random (never derived from the password, so a captured cookie cannot be used to guess it
 * offline), and the signed text holds the epoch (logout raises it) and a digest of the password or of its stored hash (changing it ends every session).
 */
const sign = (exp: string, epoch: number) => {
  const mark = digest(envPassword() || storedPassword()?.hash || "").toString("hex");
  return createHmac("sha256", sessionSecret()).update(`${exp}.${epoch}.${mark}`).digest("hex");
};

/** The cookie value of a new session */
function newSession(): string {
  const exp = String(Date.now() + SESSION_MAX_AGE_MS);
  const epoch = sessionEpoch();
  return `${exp}.${epoch}.${sign(exp, epoch)}`;
}

const startSession = (res: Response) =>
  res.setHeader("Set-Cookie", `${COOKIE}=${newSession()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_MS / 1000}`);

/** Compares fixed length digests, so neither the time nor an early length check tells how long the secret is */
export function safeEqual(a: string, b: string) {
  return timingSafeEqual(digest(a), digest(b));
}

/** A password exists (FF_PASSWORD or one set in the panel); without one the install is in its first run and only the setup works */
export const authEnabled = () => passwordSource() !== null;

/** FF_PASSWORD is set but shorter than MIN_PASSWORD_LENGTH (start warns when such a server listens beyond this computer) */
export const weakPassword = () => [...envPassword()].length > 0 && [...envPassword()].length < MIN_PASSWORD_LENGTH;

/** Whether a typed password is the install's password */
async function rightPassword(typed: string): Promise<boolean> {
  if (envPassword()) return safeEqual(typed, envPassword());
  const stored = storedPassword();
  return !!stored && (await verifyPassword(typed, stored));
}

function cookieValue(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) {
      try {
        return decodeURIComponent(part.slice(i + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
}

export function validSession(header: string | undefined): boolean {
  const v = cookieValue(header, COOKIE);
  if (!v) return false;
  const [exp, epoch, sig, extra] = v.split(".");
  const current = sessionEpoch();
  return !!exp && !!sig && extra === undefined && Number(exp) > Date.now() && epoch === String(current) && safeEqual(sig, sign(exp, current));
}

/** Routes that answer without a session: the session state, login, logout, the health check and the setup (which refuses itself once a password exists) */
const PUBLIC = ["/api/login", "/api/logout", "/api/health", "/api/me", "/api/setup"];
/** In the first run only these answer; everything else is a 401 with SETUP_REQUIRED_CODE, which shows the setup screen */
const FIRST_RUN_OPEN = ["/api/health", "/api/setup"];

/** Everything under /api needs a session, except PUBLIC; in the first run everything except FIRST_RUN_OPEN is closed */
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const path: string = req.path ?? req.url;
    if (!authEnabled()) {
      if (FIRST_RUN_OPEN.includes(path)) return true;
      throw new UnauthorizedException({ message: m.auth.setupRequired, code: SETUP_REQUIRED_CODE });
    }
    if (PUBLIC.includes(path) || validSession(req.headers.cookie)) return true;
    throw new UnauthorizedException(m.auth.required);
  }
}

const throttle = new LoginThrottle();
const clientOf = (req: Request) => req.ip ?? "?";

/**
 * One password check under the brute force limit: a locked address is a 429. The attempt counts as wrong until it proves right,
 * so guesses sent in parallel cannot outrun the lock while scrypt works.
 */
async function guarded(req: Request, check: () => Promise<boolean>): Promise<boolean> {
  const ip = clientOf(req);
  if (throttle.locked(ip)) throw new HttpException(m.auth.tooManyAttempts, 429);
  throttle.failed(ip);
  if (!(await check())) return false;
  throttle.succeeded(ip);
  return true;
}

/** A new password as typed: a string within OWNER_PASSWORD_MIN..MAX characters */
function newPassword(v: unknown): string {
  if (typeof v !== "string" || !v) throw new BadRequestException(m.auth.passwordRequired);
  const n = [...v].length;
  if (n < OWNER_PASSWORD_MIN) throw new BadRequestException(m.auth.passwordShort(OWNER_PASSWORD_MIN));
  if (n > OWNER_PASSWORD_MAX) throw new BadRequestException(m.auth.passwordLong(OWNER_PASSWORD_MAX));
  return v;
}

@Controller("api")
export class AuthController {
  constructor(@Inject(CORE) private core: Core) {}

  /** Session state; a logged in request also learns where the password comes from (Settings shows the change form only for "app") */
  @Get("me")
  me(@Req() req: Request) {
    const loggedIn = validSession(req.headers.cookie);
    return loggedIn ? { auth: true, loggedIn, password: passwordSource() } : { auth: true, loggedIn };
  }

  @Post("login")
  async login(@Body() b: { password?: string }, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (typeof b?.password !== "string") throw new BadRequestException(m.auth.passwordRequired);
    const typed = b.password;
    if (!(await guarded(req, () => rightPassword(typed)))) throw new UnauthorizedException(m.auth.wrongPassword);
    startSession(res);
    return { ok: true };
  }

  /**
   * First run: the owner's name and the password in one step, then this browser is logged in. Works only while no password exists
   * (afterwards 409); the first run listens on this computer only, so nobody on the network can claim the install.
   */
  @Post("setup")
  async setup(@Body() b: { name?: unknown; password?: unknown }, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (throttle.locked(clientOf(req))) throw new HttpException(m.auth.tooManyAttempts, 429);
    if (authEnabled()) {
      throttle.failed(clientOf(req));
      throw new ConflictException(m.auth.alreadySetUp);
    }
    const password = newPassword(b?.password);
    this.core.settings.set("owner_name", b?.name);
    if (!(await savePassword(password, { first: true }))) throw new ConflictException(m.auth.alreadySetUp);
    startSession(res);
    return { ok: true, owner_name: this.core.settings.all().owner_name };
  }

  /** Changes a password set in the panel: every session ends, this browser gets a new one. FF_PASSWORD is changed in .env (409). */
  @Post("password")
  async changePassword(@Body() b: { current?: unknown; password?: unknown }, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (passwordSource() === "env") throw new ConflictException(m.auth.passwordInEnv);
    if (typeof b?.current !== "string") throw new BadRequestException(m.auth.passwordRequired);
    const current = b.current;
    const next = newPassword(b?.password);
    if (!(await guarded(req, () => rightPassword(current)))) throw new ForbiddenException(m.auth.wrongCurrent);
    await savePassword(next, { first: false });
    bumpSessionEpoch();
    startSession(res);
    return { ok: true };
  }

  /** Ends every session, on every device; only a logged in request may do that, so a stranger cannot log the owner out */
  @Post("logout")
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (validSession(req.headers.cookie)) bumpSessionEpoch();
    res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    return { ok: true };
  }
}
