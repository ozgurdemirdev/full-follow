import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { AuthController, AuthGuard } from "./auth";
import { CommentsController } from "./controllers/comments.controller";
import { FilesController } from "./controllers/files.controller";
import { LinksController } from "./controllers/links.controller";
import { NotesController } from "./controllers/notes.controller";
import { SectorsController } from "./controllers/sectors.controller";
import { MiscController } from "./controllers/misc.controller";
import { SourcesController } from "./controllers/sources.controller";
import { TagsController, TrashController } from "./controllers/tags.controller";
import { ChatController } from "./chat/chat.controller";
import { ChatHub } from "./chat/chat-hub";
import { ClaudeRunner } from "./chat/claude-runner";
import { claudeProvider, coreProvider } from "./core.provider";
import { ErrorFilter } from "./http";
import { JobHost } from "./jobs";
import { moduleControllers } from "./modules.generated";

@Module({
  controllers: [
    AuthController, MiscController, SourcesController,
    CommentsController, SectorsController, NotesController, LinksController, FilesController,
    TagsController, TrashController, ChatController,
    // controllers of the installed feature modules (generated list)
    ...moduleControllers,
  ],
  providers: [
    coreProvider,
    claudeProvider,
    JobHost,
    ChatHub,
    ClaudeRunner,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: ErrorFilter },
  ],
})
export class AppModule {}
