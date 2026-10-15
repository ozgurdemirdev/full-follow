import type { NestExpressApplication } from "@nestjs/platform-express";
import { requestGuard } from "./guard";

/**
 * The HTTP layer every host of the app shares (main.ts and the tests): the request guard first, then the JSON body parser.
 * The app is created with `bodyParser: false` so the urlencoded parser Nest adds by default stays off: nothing sends a form body.
 */
export function configureApp(app: NestExpressApplication): void {
  app.use(requestGuard);
  app.useBodyParser("json");
}
