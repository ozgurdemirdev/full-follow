import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import { FFError, HttpFailure } from "@fullfollow/core";

export { intId, listOpts, withList } from "@fullfollow/core";

const STATUS: Record<string, number> = {
  validation: HttpStatus.BAD_REQUEST,
  not_found: HttpStatus.NOT_FOUND,
  rule: HttpStatus.CONFLICT,
  ambiguous: HttpStatus.CONFLICT,
  forbidden: HttpStatus.FORBIDDEN,
  duplicate: HttpStatus.CONFLICT,
  http: HttpStatus.BAD_REQUEST,
};

/** Çekirdek hatalarını (FFError) anlamlı HTTP yanıtlarına çevirir: { error, code } */
@Catch()
export class ErrorFilter implements ExceptionFilter {
  catch(e: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    if (e instanceof FFError) {
      return res.status(STATUS[e.code] ?? 500).json({ error: e.message, code: e.code, candidates: e.candidates, duplicate: e.duplicate });
    }
    if (e instanceof HttpFailure) return res.status(e.status).json({ error: e.message, code: e.code });
    if (e instanceof HttpException) {
      const body = e.getResponse() as string | { message?: string; code?: string };
      if (typeof body === "string") return res.status(e.getStatus()).json({ error: body, code: "http" });
      return res.status(e.getStatus()).json({ error: body.message ?? e.message, code: body.code ?? "http" });
    }
    console.error(e);
    return res.status(500).json({ error: "beklenmeyen hata", code: "internal" });
  }
}
