import { ArgumentsHost, BadRequestException, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import { FFError } from "@fullfollow/core";

const STATUS: Record<string, number> = {
  validation: HttpStatus.BAD_REQUEST,
  not_found: HttpStatus.NOT_FOUND,
  rule: HttpStatus.CONFLICT,
  ambiguous: HttpStatus.CONFLICT,
  forbidden: HttpStatus.FORBIDDEN,
  duplicate: HttpStatus.CONFLICT,
};

/** Çekirdek hatalarını (FFError) anlamlı HTTP yanıtlarına çevirir: { error, code } */
@Catch()
export class ErrorFilter implements ExceptionFilter {
  catch(e: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    if (e instanceof FFError) {
      return res.status(STATUS[e.code] ?? 500).json({ error: e.message, code: e.code, candidates: e.candidates, duplicate: e.duplicate });
    }
    if (e instanceof HttpException) {
      const body = e.getResponse() as string | { message?: string; code?: string };
      if (typeof body === "string") return res.status(e.getStatus()).json({ error: body, code: "http" });
      return res.status(e.getStatus()).json({ error: body.message ?? e.message, code: body.code ?? "http" });
    }
    console.error(e);
    return res.status(500).json({ error: "beklenmeyen hata", code: "internal" });
  }
}

/** ?q=&limit=&offset= dışındaki tüm sorgu alanları filter olur */
export function listOpts(query: Record<string, any>) {
  const { q, limit, offset, ...filter } = query ?? {};
  return {
    q: q as string | undefined,
    limit: limit !== undefined ? Number(limit) : undefined,
    offset: offset !== undefined ? Number(offset) : undefined,
    filter,
  };
}

/** ?with=touches,tasks */
export const withList = (w?: string) => (w ? String(w).split(",").map((s) => s.trim()).filter(Boolean) : []);

export function intId(v: string): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new BadRequestException(`geçersiz id "${v}"`);
  return n;
}
