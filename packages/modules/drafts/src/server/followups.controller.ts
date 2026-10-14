import { Controller, Get, Inject, Post } from "@nestjs/common";
import { APP_TOKEN, CLAUDE_APP_TOKEN, type Core } from "@fullfollow/core";

@Controller("api/followups")
export class FollowupsController {
  /** `claude` is the same app acting as Claude: follow-up drafts are Claude's, whoever asks for them now */
  constructor(@Inject(APP_TOKEN) private app: Core, @Inject(CLAUDE_APP_TOKEN) private claude: Core) {}

  /** Zamanı gelen takipler (taslak bekleyen) */
  @Get()
  due() {
    return this.app.mod("drafts")!.followups.due();
  }

  /** Takip taslaklarını şimdi hazırla (zamanlayıcının yaptığını hemen yapar) */
  @Post("run")
  run() {
    return this.claude.mod("drafts")!.followups.generate();
  }
}
