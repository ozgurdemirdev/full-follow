import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, DiscoveryModule } from "@nestjs/core";
import { AuthController, AuthGuard } from "./auth";
import { coreControllers } from "./controllers";
import { claudeProvider, coreProvider } from "./core.provider";
import { ErrorFilter } from "./http";
import { JobHost } from "./jobs";
import { moduleControllers, moduleProviders } from "./modules.generated";
import { OpenApiController, OpenApiService } from "./openapi/openapi.controller";

@Module({
  imports: [DiscoveryModule],
  controllers: [
    AuthController, OpenApiController,
    ...coreControllers,
    // controllers of the installed feature modules (generated list)
    ...moduleControllers,
  ],
  providers: [
    coreProvider,
    claudeProvider,
    JobHost,
    OpenApiService,
    // providers of the installed modules (the chat module's event hub and Claude runner)
    ...moduleProviders,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: ErrorFilter },
  ],
})
export class AppModule {}
