import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { CLAUDE_APP_TOKEN, startJobs } from "@fullfollow/core";
import type { Core } from "./core.provider";

/** Runs the scheduled jobs the installed modules contribute (as Claude) while the server is up; stops them on shutdown */
@Injectable()
export class JobHost implements OnModuleInit, OnModuleDestroy {
  private stop: (() => void) | null = null;

  constructor(@Inject(CLAUDE_APP_TOKEN) private claude: Core) {}

  onModuleInit() {
    this.stop = startJobs(this.claude.jobs(), this.claude);
  }

  onModuleDestroy() {
    this.stop?.();
    this.stop = null;
  }
}
