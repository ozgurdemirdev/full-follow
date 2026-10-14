import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { APP_TOKEN, intId, listOpts, withList, type Core } from "@fullfollow/core";

/** ?person_id= | ?company_id= | ?contact= → muhatap */
const subject = (q: Record<string, string>) => ({
  person_id: q.person_id ? intId(q.person_id) : null,
  company_id: q.company_id ? intId(q.company_id) : null,
  contact: q.contact || null,
});

/** Mesaj şablonları: sektör ve kanala göre; taslak yazarken önerilir */
@Controller("api/templates")
export class TemplatesController {
  constructor(@Inject(APP_TOKEN) private app: Core) {}

  private get templates() {
    return this.app.mod("templates")!;
  }

  @Get()
  list(@Query() query: Record<string, any>) {
    return this.app.find("template", listOpts(query));
  }

  /** Kişi ya da firma ve kanala uyan şablonlar, en uygun önce */
  @Get("suggest")
  suggest(@Query() q: Record<string, string>) {
    return this.templates.suggest(subject(q), q.channel, q.kind);
  }

  @Get(":id")
  one(@Param("id") id: string, @Query("with") w?: string) {
    return this.app.get("template", intId(id), withList(w), 50);
  }

  /** Şablonun kişiye ya da firmaya uygulanmış metni (önizleme) */
  @Get(":id/render")
  render(@Param("id") id: string, @Query() q: Record<string, string>) {
    return this.templates.render(intId(id), subject(q));
  }

  @Post()
  create(@Body() b: unknown) {
    return this.templates.create(b);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() b: unknown) {
    return this.templates.update(intId(id), b);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.app.remove("template", intId(id));
  }
}
