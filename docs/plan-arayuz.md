# New web UI: implementation plan

Source of truth: the approved design canvas (16 boards, one per screen). Each board is a mock with fake data; this plan maps it onto the existing Vite + React + Tailwind + Motion code. Markup and fake data are never copied. Branch: `claude/yeni-arayuz`. One reviewable change per step; Özgür checks each screen before the next starts.

Rules that hold for every step:

- Web never writes the database; anything new goes through core (single entry door, `created_by` from the entry point, events written in core, tests only for core rules).
- Every literal has one named home: colours, radii, spacing, durations in `packages/web/src/styles/tokens.json` (generated into `tokens.css` by `npm run tokens`), user text in the page or label maps, thresholds in `packages/core/src/constants.ts`.
- Files stay under 700 lines; a page that grows is split into components.
- Nothing the current pages can do is dropped silently. Each screen section below lists what the board leaves out; those parts move into the new layout unless Özgür says otherwise.
- Done means: `npm run build` and `npm test` pass, the screen is checked at 1440px and 390px on port 3001 with a copy of the real database, and `favicon.svg` rewritten by the build is reverted.

## 1. Design tokens

Two levels in `tokens.json`:

- `palette`: raw values, not emitted as Tailwind utilities. Extend `packages/web/scripts/gen-tokens.mjs` so semantic entries can reference `{palette.x}` and the palette itself is emitted only as private CSS variables.
- Semantic layer (what components use). Existing semantic names are kept where the meaning matches, so most components change by value, not by name.

| Semantic | Value | Replaces / note |
|---|---|---|
| `bg-canvas` | #0B0B0C | page |
| `surface-1` | #141416 | card fill |
| `surface-2` | #1A1A1D | inner block |
| `surface-inset` | #111113 | wells, inputs |
| `border-subtle` / `border` | #1F1F22 / #2A2A2E | card border / control border |
| `text-primary` / `text-secondary` / `text-muted` | #F5F5F2 / #A3A3A0 / #8A8A87 | `text-body` merges into primary |
| `accent` (was `primary`) | #D4F25A, ink on accent #111112 | one token, later user tweakable |
| `claude` / `claude-soft` / `claude-bg` | #E0855F / #F2A17F / #2A1A13 | replaces `accent-claude`, `author-claude-*` |
| `warning` / `danger` / `info` | #F5CB73 / #FF8A7A / #9CCBF0 | replaces `accent-warning` and status text tokens |

- Stage, chip and tag colour groups stay, re-valued from the boards (Pipeline stage colours, platform colours on Posts, avatar pairs).
- Radius: `card` 24, `inner` 16 (18 for large inner blocks), `pill` 999. Old `card-sm`, `xl`, `2xl` fold into these.
- Fonts: Geist and Geist Mono are already self hosted in `fonts.css`; only weights and sizes are re-valued. Numbers and amounts use Geist Mono.
- Motion: `ease` cubic-bezier(.2,.8,.2,1), a `rise` enter animation (opacity plus `rise-distance`), the expand overlay duration (460 ms on close in the board). `prefers-reduced-motion` keeps fades only, as today.
- `check-tokens.mjs` keeps failing the build on raw hex or px in components.

Step 1 commit: tokens only. Every existing screen must still render (colours shift, layout untouched).

## 2. Shared pieces (before any screen)

| Piece | Where | Notes |
|---|---|---|
| App shell | `app/Sidebar.tsx`, `app/App.tsx`, `app.css` | Sidebar 256px, collapses to an 80px icon rail (state kept in localStorage); under 860px (`breakpoint-mobile`, already 860) it becomes a horizontal scrolling strip instead of the drawer. Groups and order from the boards: Network (Dashboard, Takvim, Kişiler, Firmalar, Referanslar, Taslaklar, Yorumlar), Pazarlama (Paylaşımlar, Gelir fikirleri, Şablonlar), Satış ve projeler (Satış hunisi, Müşteri projeleri, Kendi projelerim, Zaman çizelgesi, Rapor), footer: Ayarlar and the user block ("Claude bağlı"). "Para fikirleri" becomes "Gelir fikirleri", label only. Haftalık inceleme stays under Rapor (not on the boards). Badges reuse today's counts. |
| Card | `components/ui.tsx` (`Card`) | Fill, 1px border, radius 24, no coloured stripes; colour only in chips and dots. Header row: title, optional count pill that opens the expand overlay. |
| Layout helpers | `components/layout.tsx` (new) | `Masonry` (n independent columns, items assigned in order to the shortest column; Dashboard uses 3, Comments 2), `TileColumns` (CSS columns for tile lists: Companies, Posts, Templates), `Pair` (stretch for side by side panels). Never a grid row with `align-items:start` and unequal cards. |
| Segmented pills | `components/ui.tsx` (`Segmented`) | Replaces the tab rows in `filters.tsx`; scrolls sideways on phones, never wraps or overflows. |
| Expand overlay | `components/ExpandOverlay.tsx` (new), replaces `Sheet.tsx` for record detail | Grows from the source card's rect to full screen with 16px gaps (12px under 860px), above the sidebar; Esc and backdrop close; focus trapped and returned. Used by Dashboard count pills, People, Companies, Templates, OwnProjects. `Sheet.tsx` stays for forms (add person, add opportunity) until those are restyled. |
| Toast | `components/Toasts.tsx` | Restyle only. |
| Hatched progress bar | `components/ui.tsx` (`Meter`) | Solid part plus hatched remainder, used by goals, plan, projects, funnel bars. |
| Number field | `components/NumberField.tsx` (new) | No native spinners anywhere: `type="text"`, `inputMode="numeric"`, shows Turkish thousand separators (45.000), parses by stripping non digits. Optional pill `+`/`-` stepper (Settings board). Replaces the 8 current `type="number"` inputs (amount fields in OfferForm and payments, QuotaFields, BusinessCards, goal forms; list them with `grep -rn 'type="number"' packages/web/src`). |
| Dictation button | `components/MicButton.tsx` (new) | Native Web Speech API (`webkitSpeechRecognition`, `tr-TR`); the button is not rendered when the API is missing. Writes into the input it sits next to. Used on Calendar, People, Companies, Comments. |
| Avatar | `components/ui.tsx` | Initials on one of the five avatar colour pairs, picked by id. |

Step 2 commit: shell plus shared pieces, existing pages wrapped in the new shell.

## 3. Screens

Each step: board file, target files, data sources, interactions, and what the current page has that the board leaves out.

### 3.1 Dashboard (`Main.dc.html`) → `pages/Today.tsx` (353 lines, split into `components/dash/*`)

- Header: greeting, date and counts line, search (existing `app/Search.tsx`), "Yeni kayıt" (existing `app/Fab.tsx` menu).
- Goal strip, 3 meters: monthly collections vs monthly floor (`GET /api/report`, floor from settings), weekly outgoing vs `weekly_target` (`GET /api/stats/week`), third meter see gap G2.
- "Senden bekleyenler": open Claude comment questions only (`GET /api/today`, unanswered comments where Claude asked), each with "Cevapla" into the thread.
- Three masonry columns: Bugünün planı (`GET /api/plan`, check off via tasks/goals), Onay bekleyen taslaklar (`GET /api/drafts?status=bekliyor`, approve and edit inline), Cevap bekleyenler and Soğuyan bağlantılar (`today.network`), Tahsilat (`GET /api/payments`, grouped Gecikmiş / Bu hafta / Sonra, "Ödeme kaydet", "Hatırlat" creates a draft request), Haftalık aktivite (`GET /api/stats/activity`, metric tabs Temas / Taslak / Teklif, see G22), Projeler (client and own tabs, `GET /api/projects`, `GET /api/own-projects`), Satış hunisi summary (`GET /api/opportunities`, `report/sources`), Yorumlar.
- Count pills open the expand overlay with the full list and a "… sayfasına git" link.
- Board leaves out, keep anyway: QuotaCard, GoalStrip goal logging, Friday ReviewCard, posts due, follow-ups due ("Şimdi hazırla"). Place them as cards in the masonry.

### 3.2 Calendar (`Calendar.dc.html`) → `pages/Calendar.tsx`, `components/DayPlan.tsx`

- Week view (7 day rows with done ratio meter and coloured item chips) and month view (35 cells, dots, first item), "Bugün", range label with ISO week.
- Summary row: done this week, carried to tomorrow, goal fill; kind filter pills (Görüşme, Takip, Ödeme, Görev) toggle visibility.
- Day panel: items with time and kind, check off, quick add with time parsing ("14:00 Elif ile görüşme") and dictation; end of day box (done, left, carried); weekly goals.
- Data: `GET /api/calendar` (goals and tasks per day), payments due, follow-ups. Time and kind need G3.
- Board leaves out: goal logging per day (keep inside the day panel).

### 3.3 People (`People.dc.html`) → `pages/People.tsx` split into `components/people/*`

- "Bugün dokun": up to 4 cards ranked follow-up due, awaiting reply, cooling (`today.network`), each with "Claude yazsın" (existing draft request), "Yaptım" (dismiss for today, local).
- Filter pills with counts (Hepsi, Takibi gelen, Cevap bekleyen, Soğuyan, Yeni), channel pills, search.
- Rows: avatar, name, role and company, last message with direction, warmth dot (days since last touch: named thresholds), 12 week rhythm sparkline (G4), next step and date.
- Person overlay: rhythm chart, channels with handles, open deal, how we met (source), referral value, tags; composer with modes Temas / Not / Claude'a (touch, note, comment) and direction for touches; stream filter Hepsi / Temaslar / Notlar / Claude; "Cevap beklemiyorum" (`touch expects_reply:false`), "Konu kapandı" (resolve comment). Data: `GET /api/people/:id/card`.
- Board leaves out: tag, sector and source filters, edit and delete, referrals and offers on the card, channel accounts editing. Keep them in a "Süzgeç" menu and the overlay header menu.

### 3.4 Companies (`Companies.dc.html`) → `pages/Companies.tsx`

- KPI row (won, due collections, open opportunity value, decision maker not reached), segment pills (Hepsi, Müşteri, Aday, Partner) and sort pills (Değer, Son temas, İsim), tiles in CSS columns with a money bar (won / due / open), people avatars, last touch, hint line.
- Company overlay: money block, facts, projects and opportunities, "İçerideki kişiler" with influence role, contact composer with dictation, stream.
- "Adresle yazılmış temaslar" card: loose touches (`GET /api/touches?loose=1`) with a suggested match (G8).
- Data: `GET /api/companies`, `/:id/card`; money, segment and influence need G5, G6, G7.
- Board leaves out: sector, tag, source filters, website and social fields editing. Keep in overlay menu and a filter menu.

### 3.5 Pipeline (`Pipeline.dc.html`) → `pages/Pipeline.tsx` (327 lines, split board and analytics)

- KPI row: open value, won this month vs floor, stale count.
- "Nerede kaybediyorsun": stage funnel with stage to stage rates over 90 days; clicking a stage scrolls the board to that column.
- Board: dnd-kit (already used) with edge auto scroll while dragging; scroll snap off on the board while a drag runs. Card: company, person, value, age meter against the stage's stale limit, next step, expandable details (source, hint, "Claude takip yazsın", person link). Dropping on Kaybedildi opens the lost reason dialog (existing `components/LostReason.tsx`, restyled with reason chips); cancel puts the card back. Won card links to its project; the card title opens the opportunity page.
- Below: lost reasons breakdown (`lost_reason`), sources with win rate (`GET /api/report/sources`).
- Data: `GET /api/opportunities`, `POST /:id/move`. Stale limits and rates need G9.
- Board leaves out: mobile list mode (keep for under 860px), hide lost toggle exists on the board.

### 3.6 Drafts (`Drafts.dc.html`) → `pages/Drafts.tsx`

- Tabs Onay bekliyor / Gönderildi / Reddedildi with counts.
- One at a time stack: top card with recipient, channel and handle, kind, subject (G11), text, word count; Düzenle (inline textarea), Kopyala, Reddet (reason chips plus own text, "Reddet ve öğret"), "Onayla, gönderdim" (existing approve and send). Card flies out right on approve, left on reject; peeks show the next two; progress dots.
- Side: "Neden şimdi" (`drafts.reason`) with record link, last touches with this person, learned rules (G12).
- Tone buttons (Daha kısa / sıcak / resmi) need G10.
- Board leaves out: "Taslak yaz" form with template suggestion (keep as a button in the header), follow-up step chip (keep on the card).

### 3.7 Comments (`Comments.dc.html`) → `pages/Comments.tsx`

- Tabs Açık / Sana soruldu / Claude'da / Kapandı; new thread composer with target pills (recent records) and dictation; threads in two masonry columns with record chip, state chip, bubbles, quick answer chips (G13), reply box, close and reopen.
- State rules: last word from Özgür → "Claude'da"; Claude asked and no reply → "Sana soruldu"; unread Claude reply → "Yeni cevap" (G13).
- Data: `GET /api/comments`, `POST`, `/:id/resolve`.

### 3.8 Projects (`Projects.dc.html`) → `pages/Projects.tsx`

- Tabs Aktif / Bakımda / Teslim edildi (from `projects.stage`); waiting summary cards (İş sende / Müşteride / Gecikti) with money held, clickable as filter (G14).
- Project row: avatar, name, client, received vs total, milestone money track over the 6 stages with the amount tied to each stage (payments by milestone), waiting chip, next step.
- Expanded: tasks with owner (Sen / Claude / Müşteri), payments with "Alındı" (`POST /api/payments/:id/pay`), Claude's note (latest Claude comment), "Claude hatırlatma yazsın", comments link.
- Board leaves out: links card, files (core supports project files), stage move control, maintenance fee. Keep in the expanded area.

### 3.9 OwnProjects (`OwnProjects.dc.html`) → `pages/OwnProjects.tsx`, `components/ProjectIdeas.tsx`

- Focus hero: name, one line, sellability chip, journey Fikir → Doğrulama → Demo → Ürün, next step with check, interest rate, open and done idea counts, top ideas; other projects as a gallery; "Rafta" list (left and finished) with "Raftan indir".
- Project overlay: sellability and note, sectors, validation meter, links, comments, idea columns by priority (existing drag, fixed this week) with stage chip and interest, done list, status pills, "Odağa al".
- Data: `GET /api/own-projects`, `/:id`. Focus, journey stage and next step need G15.

### 3.10 Referrals (`Referrals.dc.html`) → `pages/Referrals.tsx`

- KPI row (won from referrals, open, close rate vs other sources, people introduced); leader list with won and open bars; selected person's tree (SVG, parent centred on children) and indented list; "Teşekkür zamanı" and "Kimden referans istenir" lists with draft requests (G18).
- Data: `GET /api/report/referrals`, people `referred_by_id`.

### 3.11 Posts (`Posts.dc.html`) → `pages/Posts.tsx`

- "Güncelleme zamanı" (posts due, "Güncelledim" = `POST /api/posts/:id/refresh`), platform KPI with won value bars, platform pills, post tiles in CSS columns (platform, format G17, age, title, excerpt from `body`, people / opportunities / won counts, avatars), sorted by value.
- Data: `GET /api/posts`, `GET /api/report/marketing` (post return).
- "Claude'un önerisi" card: see G17.

### 3.12 Ideas, "Gelir fikirleri" (`Ideas.dc.html`) → `pages/Ideas.tsx` (241 lines)

- Four lanes by stage with interest dots and rate; detail: stage stepper, problem, money note (G16), interest ring, verdict sentence (rule based, thresholds as named constants in core), "Projeye dönüştür" (`POST /api/own-projects/from-idea/:id`), pitch draft request; "Kime anlatıldı" list where tapping the reaction cycles Anlatıldı → İlgilendi → İlgilenmedi (`PATCH /api/ideas/people/:linkId`), add person.
- Board leaves out: sectors, parent ideas, delete. Keep in the detail menu.

### 3.13 Templates (`Templates.dc.html`) → `pages/Templates.tsx`

- Kind pills, tiles sorted by reply rate with meta (channel, sector), rate meter coloured by named thresholds, "emekliye ayır" flag, placeholder highlighting.
- Overlay: recipient pills that fill placeholders live (`GET /api/templates/:id/render`), Kopyala, "Taslak olarak kullan" (`POST /api/drafts` with `template_id`), stats, tip (G19). Reuse `templateComparison()` for rates and early flags.

### 3.14 Timeline (`Timeline.dc.html`) → `pages/Timeline.tsx` (337 lines)

- Search, focus card for one record ("Kartı aç", "Hepsine dön"), week strip (Sen vs Claude split, week counts), actor pills, type pills, day groups with time, actor chip, type icon, text, record chip (click to focus), amount.
- Data: `GET /api/timeline/:type/:id` and the global event feed already used; week counts G23.

### 3.15 Report (`Report.dc.html`) → `pages/Report.tsx`

- Hero: this month's collections vs monthly floor, gap or surplus, expected rest of month, insight sentence (G20).
- Last 6 months bars with the floor line (`GET /api/report/months`), month select; expected this month list (payments due).
- "Taban nasıl hesaplanıyor": Bağ-Kur, muhasebe, sabit gider, hedef net, vergi oranı edited in place with `NumberField`, stacked bar, floor (settings, `PUT /api/settings`).
- Source conversion table (`GET /api/report/sources`).
- Board leaves out: template comparison and source funnel sections added this week, link to Haftalık inceleme. Keep below.

### 3.16 Settings (`Settings.dc.html`) → `pages/Settings.tsx`, `pages/settings/*`

- Left category nav, search across all settings with hit counts, rows typed as toggle, stepper (`NumberField` with pills), pills, text, chips, link, restore.
- Categories: Hesap ve görünüm, İşletme ve vergi (Bağ-Kur, vergi, link to Report), Takip kuralları (follow-up days, cooling threshold, post refresh default), Claude (connection line, learned rules chips, locked "send without asking" shown as info), Maskot (existing `MascotCard`), Etiketler ve listeler (existing `SettingsLists.tsx`), Çöp kutusu (`GET /api/trash`, restore).
- Board leaves out: payment template, daily channel limits and email warmup, weekly target, goals. Keep them in İşletme ve vergi and Takip kuralları.
- Rows that need decisions: G1, G12, G21.

### Screens without a board

Opportunity page (`pages/Opportunity.tsx`) and Haftalık inceleme (`pages/Review.tsx`) have no board. They get the new tokens, shell, cards and segmented pills in the step of their nearest screen (Pipeline and Report).

## 4. Data gaps (decisions for Özgür)

Each gap lists the smallest core change; "derive" means a new core query with no schema change.

| # | Board shows | Smallest core change | Alternative | Proposed |
|---|---|---|---|---|
| G1 | Light / dark / system theme | Light palette does not exist; needs a second semantic value set | Dark only, hide the toggle | Alternative |
| G2 | Dashboard third goal "Yeni müşteri 2 / 3" | Setting `monthly_new_clients_target`, count projects started this month | Drop the meter | Alternative |
| G3 | Calendar items with time and kind (Görüşme, Takip, Görev) | `tasks.due_time` (HH:MM) and `tasks.kind`; kind from a keyword rule in core when typed in quick add | Time only, all items "Görev" | Build |
| G4 | 12 week contact rhythm per person | Derive from touches | Drop the sparkline | Build |
| G5 | Company segment, city, size | Segment derived (won project → Müşteri, ajans or iş ortağı tag → Partner, else Aday); `companies.city` column | Drop city and size | Build segment and city, drop size |
| G6 | Influence role on company people (Karar verici, Etkileyici, Kullanıcı), KPI "Karar vericiye ulaşılmamış" | `people.influence` nullable enum | Use opportunity team roles only | Build |
| G7 | Company money: won, due, open | Derive from projects, payments, opportunities | none needed | Build |
| G8 | Loose touches with a suggested person or company | Derive by matching existing keys (domain, email) | Show list without suggestion | Build |
| G9 | Stale days per stage, stage to stage rates, card hint | Named constants in core plus a stage rate query over stage events; hint = latest open Claude comment on the opportunity | Drop the stage rates | Build, hint from comments |
| G10 | Draft tone rewrite (kısa, sıcak, resmi) | Needs Claude: button opens a comment asking for a rewrite, Claude saves a new body over MCP (not instant) | Drop, keep Düzenle | Alternative |
| G11 | Email subject on drafts | `drafts.subject` nullable | Subject inside the body | Build |
| G12 | "Claude'un öğrendikleri" from reject reasons, deletable in Settings | Setting `draft_rules` (JSON list) filled from reject notes, shown to Claude in `today()` | Show recent reject notes read only | Build |
| G13 | Quick answer chips on Claude questions, "Yeni cevap" unread state | `comments.options` (JSON) and `comments.read_at` | Free text replies only | Build |
| G14 | Project waiting on Sen / Müşteri / Gecikti, task owner Müşteri | Add `musteri` to task assignees (constant and Zod, text column); waiting derived | Late only | Build |
| G15 | Own project focus, journey stage, next step | Setting `focus_own_project_id`, `own_projects.stage`, next step derived from the top open high priority idea | Derive stage from ideas, no focus | Build |
| G16 | Idea money note | `ideas.money_note` | Use notes | Build |
| G17 | Post format, "Claude'un önerisi" next post | `posts.format` nullable; suggestion = latest Claude comment on posts | Drop both | Build format, drop suggestion |
| G18 | Referral thank-you and ask lists | Derive (recent won from a referral; delivered project, paid, no referral given; skip when a payment is late) | Drop the two lists | Build |
| G19 | Template tip | Derive from `templateComparison()` | Drop | Build |
| G20 | Report insight sentence | Derive from expected payments and floor gap | Drop | Build |
| G21 | Settings toggles: Monday summary, default draft tone, auto stage, learn from rejects, close on "Cevap beklemiyorum", MCP connection line | Connection line derived from the latest event by Claude; others are new settings or core rule switches | Keep only the connection line and existing settings | Connection line only, drop the toggles |
| G22 | Weekly activity per day for drafts and offers | Extend the activity query | Touches only | Build |
| G23 | Timeline week strip (Sen vs Claude, tahsilat, biten görev) | Derive from events | Drop the strip | Build |

Decision (2026-10-14): Özgür told the work to go on without stopping, so the "Proposed" column is the decision. "Build" gaps are built; "Alternative" and "drop" parts are left out of the UI, not faked.

## 5. Order and review

1. Tokens.
2. Shell and shared pieces.
3. Screens in this order, one each: Dashboard, Calendar, People, Companies, Pipeline (with Opportunity page), Drafts, Comments, Projects, OwnProjects, Referrals, Posts, Ideas, Templates, Timeline, Report (with Haftalık inceleme), Settings.

Screens follow each other without waiting for a review in between (Özgür, 2026-10-14). Each screen matches its board one to one: same layout, sections, order, spacing, sizes, type scale, colours, chips, empty states and interactions, with real data in place of the board's fake data. Where a board value has no token yet, the token is added; the board is never approximated.

Accepted gaps are built in core first, inside the step of the first screen that needs them, as their own commit with migration and, where a core rule is involved, a test.
