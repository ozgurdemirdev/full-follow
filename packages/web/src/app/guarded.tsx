import { Redirect } from "wouter";
import { useModules } from "../api/modules";
import { PAGE_MODULE, pages, PATHS, type PageKey } from "./routes";

/** The page, or the dashboard when its module is not installed (the route of a module that is gone leads nowhere) */
function guard(key: PageKey) {
  const Page = pages[key];
  return function Guarded() {
    const { has } = useModules();
    return has(PAGE_MODULE[key]) ? <Page /> : <Redirect to={PATHS.today} replace />;
  };
}

export const guarded = Object.fromEntries((Object.keys(pages) as PageKey[]).map((k) => [k, guard(k)])) as unknown as typeof pages;
