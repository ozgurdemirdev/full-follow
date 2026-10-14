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

  it("referral lists: thanks go to whoever introduced a recent win (once, newest first), asks to delivered and paid clients who introduced nobody, a late payment dims the row; the state follows the open request and the waiting draft", () => {
    const source = app.get("source", "R10").row.id;
    const ada = app.people.create({ name: "Ada" }).row;
    const bora = app.people.create({ name: "Bora", referred_by_id: ada.id }).row;
    const can = app.people.create({ name: "Can" }).row;
    const deniz = app.people.create({ name: "Deniz" }).row;
    const suggestions = () => app.mod("referrals")!.suggestions();
    /** an opportunity won with its offer, which opens the project */
    const win = (person: { id: number }, value: number) => {
      const o = app.opportunities.create({ title: "İş", person_id: person.id, source_id: source, estimated_value: value }).row;
      app.offers.update(app.offers.create({ opportunity_id: o.id, amount: value }).row.id, { accepted: true });
      app.opportunities.move(o.id, { stage: "kazanildi" });
      return app.projects.list({ filter: { person_id: person.id } }).rows[0];
    };
    const deliver = (project: { id: number }, payAll: boolean) => {
      for (const p of app.payments.list({ filter: { project_id: project.id } }).rows) if (payAll || p.milestone === "pesinat") app.payments.pay(p.id, p.expected_amount);
      app.projects.move(project.id, { stage: "teslim" });
    };
    expect(suggestions()).toEqual({ thanks: [], asks: [] });

    const boraProject = win(bora, 42000);
    expect(suggestions().thanks).toEqual([{ person: { id: ada.id, name: "Ada" }, ready: true, state: "idle", request_title: "Ada için teşekkür mesajı taslağı hazırla", why: "Tanıttığı Bora kazanıldı · ₺42.000" }]);
    // being introduced does not matter for the ask, only having introduced somebody: Bora is asked once delivered and paid
    deliver(boraProject, true);
    const canProject = win(can, 30000);
    deliver(canProject, true);
    const denizProject = win(deniz, 20000);
    deliver(denizProject, false);
    // Can and Bora are delivered and paid; Deniz paid only the deposit, which is not late yet, so he is not asked at all
    expect(suggestions().asks.map((a) => [a.person.name, a.ready, a.why])).toEqual([
      ["Can", true, "İş bugün teslim edildi, ödemesi tamam. Kimseyi tanıtmadı."],
      ["Bora", true, "İş bugün teslim edildi, ödemesi tamam. Kimseyi tanıtmadı."],
    ]);
    // sixty days on: Deniz's money is late, his row comes last and dimmed; the wins are past the thank-you window, Can and Bora are 60 days after delivery
    today = "2026-12-13";
    const asks = suggestions().asks;
    expect(asks.map((a) => [a.person.name, a.ready])).toEqual([["Can", true], ["Bora", true], ["Deniz", false]]);
    expect(asks[2].why).toMatch(/^Şimdi değil: ₺[\d.]+ ödemesi gecikmede$/);
    expect(suggestions().thanks).toEqual([]);
    // an introducer is never asked: Ada is not in the list even with a delivered project; the window ends 120 days after delivery
    today = "2027-03-01";
    expect(suggestions().asks).toEqual([]);

    today = "2026-10-14";
    expect(suggestions().asks[0].state).toBe("idle");
    app.tasks.create({ title: "Can için referans ricası taslağı hazırla", assignee: "claude", person_id: can.id });
    expect(suggestions().asks.find((a) => a.person.name === "Can")!.state).toBe("asked");
    app.drafts.create({ person_id: can.id, channel: "email", body: "merhaba" });
    expect(suggestions().asks.find((a) => a.person.name === "Can")!.state).toBe("drafted");
    // without the modules each list reads, it is empty; without the calendar and drafts the state stays idle
    expect(appWithout(["pipeline"], h, "ozgur", clock).mod("referrals")!.suggestions().thanks).toEqual([]);
    expect(appWithout(["projects"], h, "ozgur", clock).mod("referrals")!.suggestions().asks).toEqual([]);
    expect(appWithout(["calendar", "drafts"], h, "ozgur", clock).mod("referrals")!.suggestions().asks[0].state).toBe("idle");
    expect(appWithout(["people"], h, "ozgur", clock).mod("referrals")!.suggestions()).toEqual({ thanks: [], asks: [] });
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
