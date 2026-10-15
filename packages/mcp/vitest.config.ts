import path from "node:path";
import { mergeConfig } from "vitest/config";
import appConfig from "../app/vitest.config";

// Same aliases as the app's tests: core and every module package from their sources
export default mergeConfig(appConfig, {
  resolve: { alias: [{ find: /^@fullfollow\/app$/, replacement: path.resolve(__dirname, "../app/src/index.ts") }] },
});
