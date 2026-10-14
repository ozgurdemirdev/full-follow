import { describe } from "vitest";
import { createCore, createRegistry, type Actor, type Clock, type DbHandle } from "@fullfollow/core";
import { createApp } from "../src";
import { modules } from "../src/modules.generated";

/** True when every one of these modules is installed (a module switched off with FF_MODULES_OFF is not in the generated list) */
export const installed = (...keys: string[]) => keys.every((k) => modules.some((m) => m.key === k));

/** A suite that needs the whole composed app: skipped when a module is switched off (the removal runs test the rest) */
export const suite = describe.skipIf(!installed("calendar", "companies", "network", "people", "pipeline", "posts", "projects", "referrals"));

/**
 * The composed app (core plus every installed module) with shorthands for the module APIs the cross module tests use:
 * `people`, `companies`, `touches`, `personCard`, `companyCard`, `network()`, `reports.week/activity/referrals`, `tasks`, `goals`, `opportunities`, `offers`, `oppPeople`, `projects`, `payments`.
 */
export function appFor(handle: DbHandle, actor: Actor, clock?: Clock) {
  const app = createApp(handle, actor, clock);
  const people = app.mod("people")!;
  const companies = app.mod("companies")!;
  const network = app.mod("network")!;
  const cal = app.mod("calendar")!;
  const pipeline = app.mod("pipeline")!;
  const projects = app.mod("projects")!;
  const referrals = app.mod("referrals")!;
  return Object.assign(app, {
    people: { create: people.create, update: people.update, remove: people.remove },
    companies: { create: companies.create, update: companies.update, remove: companies.remove },
    touches: network.touches,
    personCard: people.card,
    companyCard: companies.card,
    network: network.lists,
    reports: { ...app.reports, week: network.weekStats, activity: network.activity, referrals: referrals.report },
    tasks: cal.tasks,
    opportunities: pipeline.opportunities,
    offers: pipeline.offers,
    oppPeople: pipeline.team,
    projects: projects.projects,
    payments: projects.payments,
    goals: { ...cal.goals, plan: cal.plan, calendar: cal.calendar },
  });
}
export type TestApp = ReturnType<typeof appFor>;

/** Every installed module key */
export const everyKey = modules.map((m) => m.key);

/** The composed app with some modules switched off (the registry is built from the generated list minus `off`) */
export const appWithout = (off: string[], handle: DbHandle, actor: Actor = "ozgur", clock?: Clock) => createCore(handle, actor, clock, createRegistry(modules, off));
