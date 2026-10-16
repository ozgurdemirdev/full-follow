import type { NestExpressApplication } from "@nestjs/platform-express";
import type { NextFunction, Request, Response } from "express";
import { APP_CSP, DOCS_CSP, DOCS_PATH } from "./constants";
import { requestGuard } from "./guard";

/**
 * Headers every answer carries, the refusals of the guard included. The policy allows only this server's own files, so a script
 * or image address that a record, an upload or a Claude reply carries is never loaded or run, and no other site may frame the
 * panel. The Swagger UI page has its own policy: it styles itself inline.
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  res.setHeader("Content-Security-Policy", req.path === DOCS_PATH || req.path.startsWith(`${DOCS_PATH}/`) ? DOCS_CSP : APP_CSP);
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Content-Type-Options", "nosniff");
  next();
}

/**
 * The HTTP layer every host of the app shares (main.ts and the tests): the security headers, the request guard, then the JSON body parser.
 * The app is created with `bodyParser: false` so the urlencoded parser Nest adds by default stays off: nothing sends a form body.
 */
export function configureApp(app: NestExpressApplication): void {
  app.use(securityHeaders);
  app.use(requestGuard);
  app.useBodyParser("json");
}
