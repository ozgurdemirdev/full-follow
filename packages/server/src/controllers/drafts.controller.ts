import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { CORE, type Core } from "../core.provider";
import { intId, listOpts, withList } from "../http";

@Controller("api/drafts")
export class DraftsController {
  constructor(@Inject(CORE) private core: Core) {}

  @Get()
  list(@Query() query: Record<string, any>) {
    return this.core.find("draft", listOpts(query));
  }

  @Get(":id")
  one(@Param("id") id: string, @Query("with") w?: string) {
    return this.core.get("draft", intId(id), withList(w), 50);
  }

  @Post()
  create(@Body() b: unknown) {
    return this.core.drafts.create(b);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() b: unknown) {
    return this.core.drafts.update(intId(id), b);
  }

  /** Taslak onayı, ret ve "gönderdim" sadece Özgür'de (web); MCP'de yok */
  @Post(":id/approve")
  approve(@Param("id") id: string) {
    return this.core.drafts.approve(intId(id));
  }

  @Post(":id/reject")
  reject(@Param("id") id: string, @Body() b: { note: string }) {
    return this.core.drafts.reject(intId(id), b?.note);
  }

  @Post(":id/send")
  send(@Param("id") id: string) {
    return this.core.drafts.markSent(intId(id));
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.core.remove("draft", intId(id));
  }
}
