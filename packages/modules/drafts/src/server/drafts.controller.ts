import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { APP_TOKEN, intId, listOpts, withList, type Core } from "@fullfollow/core";

@Controller("api/drafts")
export class DraftsController {
  constructor(@Inject(APP_TOKEN) private app: Core) {}

  private get drafts() {
    return this.app.mod("drafts")!;
  }

  @Get()
  list(@Query() query: Record<string, any>) {
    return this.app.find("draft", listOpts(query));
  }

  @Get(":id")
  one(@Param("id") id: string, @Query("with") w?: string) {
    return this.app.get("draft", intId(id), withList(w), 50);
  }

  @Post()
  create(@Body() b: unknown) {
    return this.drafts.create(b);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() b: unknown) {
    return this.drafts.update(intId(id), b);
  }

  /** Taslak onayı, ret ve "gönderdim" sadece Özgür'de (web); MCP'de yok */
  @Post(":id/approve")
  approve(@Param("id") id: string) {
    return this.drafts.approve(intId(id));
  }

  @Post(":id/reject")
  reject(@Param("id") id: string, @Body() b: { note?: string; no_reason?: boolean }) {
    return this.drafts.reject(intId(id), b);
  }

  @Post(":id/send")
  send(@Param("id") id: string) {
    return this.drafts.markSent(intId(id));
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.app.remove("draft", intId(id));
  }
}
