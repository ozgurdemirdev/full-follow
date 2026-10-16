import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { CORE, type Core } from "../core.provider";
import { intId, listOpts, withList } from "../http";

@Controller("api/comments")
export class CommentsController {
  constructor(@Inject(CORE) private core: Core) {}

  @Get()
  list(@Query() query: Record<string, any>) {
    return this.core.find("comment", listOpts(query));
  }

  @Get(":id")
  one(@Param("id") id: string, @Query("with") w?: string) {
    return this.core.get("comment", intId(id), withList(w), 50);
  }

  @Post()
  create(@Body() b: unknown) {
    return this.core.comments.create(b);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() b: unknown) {
    return this.core.comments.update(intId(id), b);
  }

  /** Konuyu kapatır (resolved: false ile yeniden açar) */
  @Post(":id/resolve")
  resolve(@Param("id") id: string, @Body() b: { resolved?: boolean }) {
    return this.core.comments.resolve(intId(id), b?.resolved ?? true);
  }

  /** The owner opened the thread: Claude's comments in it count as read */
  @Post(":id/read")
  read(@Param("id") id: string) {
    return this.core.comments.markRead(intId(id));
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.core.remove("comment", intId(id));
  }
}
