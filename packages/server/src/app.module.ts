import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { AuthController, AuthGuard } from "./auth";
import { CompaniesController } from "./controllers/companies.controller";
import { CommentsController } from "./controllers/comments.controller";
import { FilesController } from "./controllers/files.controller";
import { OffersController } from "./controllers/offers.controller";
import { OpportunityPeopleController } from "./controllers/opportunity-people.controller";
import { LinksController } from "./controllers/links.controller";
import { NotesController } from "./controllers/notes.controller";
import { SectorsController } from "./controllers/sectors.controller";
import { DraftsController } from "./controllers/drafts.controller";
import { MiscController } from "./controllers/misc.controller";
import { OpportunitiesController } from "./controllers/opportunities.controller";
import { PaymentsController } from "./controllers/payments.controller";
import { PeopleController } from "./controllers/people.controller";
import { ProjectsController } from "./controllers/projects.controller";
import { SourcesController } from "./controllers/sources.controller";
import { TouchesController } from "./controllers/touches.controller";
import { TemplatesController } from "./controllers/templates.controller";
import { IdeasController } from "./controllers/ideas.controller";
import { OwnProjectsController } from "./controllers/own-projects.controller";
import { MarketingController } from "./controllers/marketing.controller";
import { TagsController, TrashController } from "./controllers/tags.controller";
import { ChatController } from "./chat/chat.controller";
import { ChatHub } from "./chat/chat-hub";
import { ClaudeRunner } from "./chat/claude-runner";
import { coreProvider, followupsProvider } from "./core.provider";
import { ErrorFilter } from "./http";
import { moduleControllers } from "./modules.generated";

@Module({
  controllers: [
    AuthController, MiscController, PeopleController, CompaniesController, SourcesController,
    OpportunitiesController, ProjectsController, PaymentsController, DraftsController,
    TouchesController, CommentsController, SectorsController, NotesController, LinksController, FilesController, OffersController, OpportunityPeopleController,
    TemplatesController, IdeasController, OwnProjectsController, MarketingController, TagsController, TrashController, ChatController,
    // controllers of the installed feature modules (generated list)
    ...moduleControllers,
  ],
  providers: [
    coreProvider,
    followupsProvider,
    ChatHub,
    ClaudeRunner,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: ErrorFilter },
  ],
})
export class AppModule {}
