import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { CORE, type Core } from "../core.provider";
import { intId, listOpts, withList } from "../http";

/** Paylaşımlar (R10, LinkedIn, Instagram): yenileme hatırlatması ve getirdikleri */
@Controller("api/posts")
export class PostsController {
  constructor(@Inject(CORE) private core: Core) {}

  @Get()
  list(@Query() query: Record<string, any>) {
    return this.core.find("post", listOpts(query));
  }

  @Get(":id")
  one(@Param("id") id: string, @Query("with") w?: string) {
    return this.core.get("post", intId(id), withList(w), 100);
  }

  @Post()
  create(@Body() b: unknown) {
    return this.core.posts.create(b);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() b: unknown) {
    return this.core.posts.update(intId(id), b);
  }

  /** "Güncelledim": yenileme tarihi bugün olur */
  @Post(":id/refresh")
  refresh(@Param("id") id: string) {
    return this.core.posts.refresh(intId(id));
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.core.remove("post", intId(id));
  }
}
