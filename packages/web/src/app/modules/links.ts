// `linkTo(type, id)` and what manifests build on it. Kept apart from the registry on purpose: a manifest may import this file,
// and the registry imports the manifests, so this file must never import the registry (the registry hands it the resolver when it loads).
import { PATHS } from "../routes";

type Resolver = (type: string, id: number) => string | null;
let resolve: Resolver = () => null;
export const setLinkResolver = (fn: Resolver) => void (resolve = fn);

/** The page of a record: what the installed, visible module that serves its type says; null when none does or the type has no page of its own (the caller shows plain text) */
export const linkTo = (type: string, id: number) => resolve(type, id);

/** For a quickAdd entry's `form.page`: the saved record's page, the dashboard when it has none */
export const byRecord = (type: string) => (id: number | undefined) => (id ? (linkTo(type, id) ?? PATHS.today) : PATHS.today);
