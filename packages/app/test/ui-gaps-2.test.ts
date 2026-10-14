import { beforeEach, expect, it } from "vitest";
import { FFError, openDb, type Clock, type DbHandle } from "@fullfollow/core";
import { appFor, appWithout, suite, type TestApp } from "./helpers";

let today = "2026-10-14";
const clock: Clock = { today: () => today, now: () => `${today}T10:00:00Z` };

suite("the data the second batch of screens reads", () => {
  let h: DbHandle;
  let app: TestApp;
  let claude: TestApp;
  beforeEach(() => {
    today = "2026-10-14";
    h = openDb(":memory:");
    app = appFor(h, "ozgur", clock);
    claude = appFor(h, "claude", clock);
  });

  it("Claude's question carries quick answers within the limits; opening the thread marks Claude's comments read, only for Özgür", () => {
    const ada = app.people.create({ name: "Ada" }).row;
    const ask = claude.comments.add({ target_type: "person", target_id: ada.id, body: "Ajans mı?", options: ["Evet", "Hayır"] }).row;
    expect(ask.options).toEqual(["Evet", "Hayır"]);
    expect(app.comments.add({ reply_to: ask.id, body: "Evet" }).row.options).toBeNull();
    expect(() => app.comments.add({ target_type: "person", target_id: ada.id, body: "x", options: ["a"] })).toThrow(FFError);
    expect(() => claude.comments.add({ reply_to: ask.id, body: "x", options: ["1", "2", "3", "4", "5"] })).toThrow(/options/);
    expect(() => claude.comments.add({ reply_to: ask.id, body: "x", options: ["a".repeat(41)] })).toThrow(/options/);
    const answer = claude.comments.add({ reply_to: ask.id, body: "Etiketledim" }).row;
    const unread = () => app.get("comment", ask.id).row.comments.map((c: any) => [c.created_by, c.read_at]);
    expect(unread()).toEqual([["claude", null], ["ozgur", null], ["claude", null]]);
    expect(() => claude.comments.markRead(ask.id)).toThrow(/Özgür/);
    // opening through any comment of the thread: only Claude's unread comments get the time, Özgür's own stay null, a second open keeps the first time
    today = "2026-10-15";
    app.comments.markRead(answer.id);
    expect(unread()).toEqual([["claude", "2026-10-15T10:00:00Z"], ["ozgur", null], ["claude", "2026-10-15T10:00:00Z"]]);
    today = "2026-10-16";
    app.comments.markRead(ask.id);
    expect(unread().map((c: any[]) => c[1])).toEqual(["2026-10-15T10:00:00Z", null, "2026-10-15T10:00:00Z"]);
  });

  it("a pitch task links an idea instead of free text, shows its title, takes one target only, loses the link with the idea and needs the ideas module", () => {
    const idea = app.ideas.create({ title: "Klinik botu" }).row;
    const ada = app.people.create({ name: "Ada" }).row;
    const pitch = app.tasks.create({ title: "Kısa anlatım metni hazırla", assignee: "claude", idea_id: idea.id }).row;
    expect(pitch.idea_id).toBe(idea.id);
    expect(app.find("task", { filter: { idea_id: idea.id } }).rows).toMatchObject([{ id: pitch.id, idea_title: "Klinik botu" }]);
    expect(app.find("task", { q: "klinik" }).total).toBe(1);
    expect(() => app.tasks.create({ title: "x", idea_id: idea.id, person_id: ada.id })).toThrow(/en fazla bir kayda/);
    expect(() => app.tasks.create({ title: "x", idea_id: 999 })).toThrow(/fikir #999 bulunamadı/);
    app.ideas.remove(idea.id);
    expect(app.get("task", pitch.id).row).toMatchObject({ idea_id: null, idea_title: null });
    app.restore("idea", "Klinik botu");
    expect(app.get("task", pitch.id).row.idea_id).toBe(idea.id);
    expect(() => appWithout(["ideas"], h, "ozgur", clock).mod("calendar")!.tasks.create({ title: "x", idea_id: idea.id })).toThrow(/"ideas" modülü kurulu değil/);
  });

  it("the focus project is a setting that must name an own project; it clears itself when that project is deleted", () => {
    const focus = () => app.settings.all().focus_own_project_id;
    expect(focus()).toBeNull();
    const p = app.ownProjects.create({ name: "Full Follow" }).row;
    expect(() => app.settings.set("focus_own_project_id", 999)).toThrow(/kendi projesi #999/);
    app.settings.set("focus_own_project_id", p.id);
    expect(focus()).toBe(p.id);
    app.settings.set("focus_own_project_id", null);
    expect(focus()).toBeNull();
    app.settings.set("focus_own_project_id", p.id);
    app.ownProjects.remove(p.id);
    expect(focus()).toBeNull();
  });
});
