import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { AuthController, AuthGuard } from "./auth";
import { CompaniesController } from "./controllers/companies.controller";
import { CommentsController } from "./controllers/comments.controller";
import { LinksController } from "./controllers/links.controller";
import { GoalsController } from "./controllers/goals.controller";
import { NotesController } from "./controllers/notes.controller";
import { SectorsController } from "./controllers/sectors.controller";
import { DraftsController } from "./controllers/drafts.controller";
import { MiscController } from "./controllers/misc.controller";
import { OpportunitiesController } from "./controllers/opportunities.controller";
import { PaymentsController } from "./controllers/payments.controller";
import { PeopleController } from "./controllers/people.controller";
import { ProjectsController } from "./controllers/projects.controller";
import { SourcesController } from "./controllers/sources.controller";
import { TasksController } from "./controllers/tasks.controller";
import { TouchesController } from "./controllers/touches.controller";
import { PostsController } from "./controllers/posts.controller";
import { TemplatesController } from "./controllers/templates.controller";
import { IdeasController } from "./controllers/ideas.controller";
import { MarketingController } from "./controllers/marketing.controller";
import { TagsController, TrashController } from "./controllers/tags.controller";
import { coreProvider, followupsProvider } from "./core.provider";
import { ErrorFilter } from "./http";

@Module({
  controllers: [
    AuthController, MiscController, PeopleController, CompaniesController, SourcesController,
    OpportunitiesController, ProjectsController, PaymentsController, TasksController, DraftsController,
    TouchesController, CommentsController, SectorsController, NotesController, LinksController, GoalsController,
    PostsController, TemplatesController, IdeasController, MarketingController, TagsController, TrashController,
  ],
  providers: [
    coreProvider,
    followupsProvider,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: ErrorFilter },
  ],
})
export class AppModule {}
