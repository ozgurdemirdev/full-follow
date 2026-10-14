import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { APP_TOKEN, intId, listOpts, withList, type Core } from "@fullfollow/core";

/** Paylaşımlar (R10, LinkedIn, Instagram): yenileme hatırlatması ve getirdikleri */
@Controller("api/posts")
export class PostsController {
  constructor(@Inject(APP_TOKEN) private app: Core) {}

  private get posts() {
    return this.app.mod("posts")!;
  }

  @Get()
  list(@Query() query: Record<string, any>) {
    return this.app.find("post", listOpts(query));
  }

  @Get(":id")
  one(@Param("id") id: string, @Query("with") w?: string) {
    return this.app.get("post", intId(id), withList(w), 100);
  }

  @Post()
  create(@Body() b: unknown) {
    return this.posts.create(b);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() b: unknown) {
    return this.posts.update(intId(id), b);
  }

  /** "Güncelledim": yenileme tarihi bugün olur */
  @Post(":id/refresh")
  refresh(@Param("id") id: string) {
    return this.posts.refresh(intId(id));
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.app.remove("post", intId(id));
  }
}
