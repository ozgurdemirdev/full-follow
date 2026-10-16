import { Body, Controller, Get, Inject, Param, Post, Query, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { intId } from "@fullfollow/core";
import { DRAFT_RUNS_CHANNEL } from "../constants";
import { ChatHub } from "./chat-hub";
import { DraftQueue } from "./draft-queue";
import { serveChannel } from "./sse";

/** Draft requests that a background Claude run writes at once; the buttons follow them on the stream */
@Controller("api/draft-runs")
export class DraftRunsController {
  constructor(@Inject(DraftQueue) private queue: DraftQueue, @Inject(ChatHub) private hub: ChatHub) {}

  @Post()
  request(@Body() b: unknown) {
    return this.queue.request(b);
  }

  @Get()
  list() {
    return { rows: this.queue.live() };
  }

  /** Every state change of every request as a `run` event (the row); closing the connection only unsubscribes */
  @Get("stream")
  stream(@Query("last_event_id") qLast: string | undefined, @Req() req: Request, @Res() res: Response) {
    serveChannel(this.hub, DRAFT_RUNS_CHANNEL, qLast, req, res);
  }

  @Get(":id")
  one(@Param("id") id: string) {
    return this.queue.get(intId(id));
  }
}
