# Plan: panel mascot and settings categories

Implementer: Sonnet 5.5. Everything needed is in this file and in the files it names. When
this file and the prototype disagree, this file wins. When something is not covered, pick
the option that changes the fewest existing files and write the choice in the commit body.

Two features for the web panel, `packages/web` only:

1. The jellyfish mascot lives in the panel and is the way to open the chat.
2. Settings get categories and a search; the mascot settings live there.

Out of scope, do not build: the mobile app (Full Follow idea #26), the click menu, the
chat bubble and the design-system card of the prototype, moods driven by CRM data, any
change in `packages/core`, `server` or `mcp`, tests (CLAUDE.md: tests only for core rules).

## 0. Sources to read first

- `docs/design/maskot/prototype.html` (page script: behaviour, physics, moods, input),
  `jelly-body.js` (fur material, bell, tentacles, variants, tentacle reach with bell
  collision), `jelly-face.js` (eyes, brows, mouths including the talking mouth, blush,
  stars), `jelly-act.js` (activities: props and poses per chat phase), `jelly-config.js`
  (all tuning numbers). This is a working prototype; port it, do not redesign it. The
  chosen model is `etekli`. In the prototype the "Davranış" buttons of the card trigger
  each activity; open `prototype.html` through a local static server to see them.
- `docs/design/ayarlar.html`: visual reference for the settings layout (open it in a
  browser). Its values are examples.
- Existing code this plan builds on: `src/app/App.tsx`, `src/app/ChatWidget.tsx`,
  `src/components/chat/ChatButton.tsx`, `src/components/chat/ChatPanel.tsx` (the window has
  `id="chat-window"`), `src/lib/chatStore.ts` (pattern for localStorage prefs),
  `src/pages/Settings.tsx`, `src/pages/SettingsLists.tsx`, `src/app/routes.ts`,
  `src/lib/format.ts` (`norm()` is the Turkish, case-insensitive search key; reuse it),
  `src/styles/tokens.json` and `scripts/gen-tokens.mjs`, `scripts/check-tokens.mjs`.

## 1. Project rules that bite here

- `npm run check` (token check + `tsc`) must pass. `check-tokens.mjs` rejects in `src/`:
  hex colours (`#abc`), `rgb()/hsl()`, numbers with `px`, `rem`, `em`, `ms` units, and
  arbitrary Tailwind values with digits. So every colour, size and duration of the mascot
  that reaches CSS comes from `tokens.json`, and Three.js reads colours from CSS variables
  at runtime (section 3.4). Plain numbers in TypeScript (physics constants) are fine as
  named constants.
- Run `npm run tokens` after editing `tokens.json`; commit both `tokens.json` and the
  generated `tokens.css`.
- No file over 700 lines. Import order: packages, then relative, each group alphabetic.
- No em dash and no " - " used as a separator anywhere (code comments, commit messages).
- User-visible text is Turkish; code, comments and identifiers are English. Mascot texts
  go in a new `src/lib/mascotText.ts` (same pattern as `src/lib/chatText.ts`).
- `docs/plan-panel-chat.md` has uncommitted edits by another session. Do not stage or
  commit that file.
- One commit per packet, message style of this repo: `feat: ...`, `refactor: ...`,
  lowercase, English.
- If the panel chat work (for example the attachments packet) has uncommitted changes,
  commit that packet first, then start this plan, so each commit holds one logical change.
  Do the packets in order A, B, C, D, E without waiting, one commit each.

## 2. Packet A: settings categories and search

Commit: `feat: settings categories, search and /ayarlar/:kategori`

### 2.1 Files

- `src/pages/Settings.tsx`: becomes the shell only (search, category nav, rendering the
  active cards). Target under 200 lines.
- `src/pages/settings/registry.tsx`: the single source of categories, cards, titles and
  search keywords.
- `src/pages/settings/BusinessCards.tsx`: `FloorCard`, `TemplateCard` (moved, unchanged).
- `src/pages/settings/NetworkCards.tsx`: `NetworkCard`, `NetworkFields`, `MarketingFields`.
- `src/pages/settings/ClaudeCards.tsx`: `ChatNotesCard`, `ClaudeCard`.
- `src/pages/settings/AccountCards.tsx`: `SessionCard`.
- `src/pages/settings/Head.tsx`: the shared `Head` component.
- `src/pages/SettingsLists.tsx`: stays as is (`TagsCard`, `SectorsCard`, `SourcesCard`,
  `TrashCard`).
- `src/app/routes.ts`: add `settingsPath(slug: string) => \`${PATHS.settings}/${slug}\``
  next to `timelinePath`.
- `src/app/App.tsx`: the settings route becomes `${PATHS.settings}/:kategori?`.
- `src/styles/app.css`: settings layout classes and the highlight (section 2.5).

Moving cards must not change their behaviour or markup. Cards that today receive props
from the shell (`FloorCard`, `TemplateCard`, `ChatNotesCard` get `s.data`) get a small
wrapper in their own file that calls `useQuery<PriceFloor>(K.settings)` itself and keeps
the existing `key=` remount trick. `useQuery` shares one cache entry per key
(`src/api/store.ts`), so several cards calling it is one request.

### 2.2 Registry

```ts
export interface SettingsCard {
  id: string;            // stable, used as React key and in tests by hand
  title: string;         // shown title, also searched
  keywords: string[];    // field labels and synonyms, all searched
  render: () => ReactNode;
}
export interface SettingsCategory { slug: string; name: string; cards: SettingsCard[] }
export const SETTINGS: SettingsCategory[] = [...];
```

Categories, in this order (slug, name, cards, keywords):

1. `is`, "İş ve fiyat": Fiyat tabanı (bağkur, muhasebe, gider, sabit gider, vergi, net
   gelir, hedef, taban, fiyat), Ödeme şablonu (ödeme, peşinat, ara ödeme, teslim, vade,
   yüzde, gün, aşama, şablon).
2. `network`, "Network ve takip": Network (cevap bekleme, soğuma, takip dizisi, takip,
   haftalık hedef, giden mesaj, linkedin).
3. `listeler`, "Listeler": Etiketler (etiket, renk), Sektörler (sektör, alt sektör),
   Kaynaklar (kaynak, nereden buldum).
4. `claude`, "Claude": Sohbet sabit notları (sohbet, sabit not, kural, bağlam), Claude
   bağlantısı (mcp, bağlantı, sunucu). Packet D adds Maskot here, first in the list.
5. `hesap`, "Hesap ve veri": Çöp kutusu (çöp, silinen, geri al, kalıcı sil), Oturum
   (oturum, çıkış). `SessionCard` renders nothing when auth is off; the card stays in the
   registry and simply renders empty, no special case.

A card that is not in the registry does not render. Every user-visible label of a field
inside a card must also be in that card's `keywords`.

### 2.3 Shell behaviour

- Route param `kategori` picks the category. Missing or unknown slug: show the first
  category and replace the URL with `settingsPath("is")` (wouter `navigate(..., { replace:
  true })`).
- Layout (see `docs/design/ayarlar.html`): page title "Ayarlar", sub "Kategori seç ya da
  ara". Search input on top (max width as the design, full width on phone). Below it, desk
  width: a sticky category list on the left (name plus card count) and the cards on the
  right; phone width: the category list is a horizontally scrolling chip row above the
  cards. Use existing tokens and existing classes (`card`, `inp`, `lab`, `btn`) wherever
  they fit; new classes go in `app.css` and use tokens only.
- Clicking a category navigates to `settingsPath(slug)` and clears the search.
- Search: `const q = norm(input)`. A card matches when `norm([title, ...keywords].join("
  "))` includes `q`. With a query the category nav shows match counts per category and no
  active item; the content shows all matching cards from all categories, each group under
  its category name (small uppercase label). No match: one line `"<query>" için ayar
  bulunamadı` and a button "Aramayı temizle" that clears and refocuses the input.
- Keyboard: `/` focuses the settings search when focus is not in an input, textarea,
  select or contenteditable. Esc in the search clears it.
- The query is component state only, not in the URL.
- Keep the existing `rise` animation and `order(i)` on cards, numbered within the shown
  list.

### 2.4 Field highlight on search

Each card's field labels get `data-setting="<label text>"` on the `<label>` (or the title
element for cards without labels). After the query changes (debounce 150 ms with
`setTimeout`, constant `SETTINGS_SEARCH_DEBOUNCE` in the registry file), elements whose
`norm(dataset.setting)` includes `q` get the class `set-hit` for one animation run.

### 2.5 CSS

`set-hit`: background and a spread box-shadow of `--color-primary-soft-bg` fading to
transparent over `--dur-bar-grow`; no animation under `prefers-reduced-motion: reduce`.

### 2.6 Done when

- `/ayarlar` lands on `/ayarlar/is`; `/ayarlar/network` opens Network; `/ayarlar/xyz`
  lands on `/ayarlar/is`.
- "vergi" shows only Fiyat tabanı and highlights "Vergi oranı (%)"; "VERGİ" and "vergı"
  give the same; "takip" shows Network; "asdf" shows the empty state.
- Every card behaves exactly as before (save on blur, Kaydet, Geri al, trash restore).
- `npm run check` passes.

## 3. Packet B: mascot engine

Commit: `feat: panel mascot engine (three.js, lazy chunk), no chat wiring yet`

### 3.1 Dependencies

`npm i -w packages/web three@0.186.1` and the matching types
`@types/three@0.186.x` as a dev dependency (pick the highest 0.186 patch). Pin exact
versions. Import only from `three/webgpu` and `three/tsl`, plus
`three/examples/jsm/environments/RoomEnvironment.js`.

### 3.2 Files

All under `src/mascot/`:

- `config.ts`: every number from `jelly-config.js` `CFG` and `SIZE`, `VARIANTS` from
  `jelly-body.js`, plus the new constants of this plan (section 3.6). No colours.
- `palette.ts`: preset ids and how to read their colours from CSS (section 3.4).
- `body.ts`: port of `jelly-body.js`.
- `face.ts`: port of `jelly-face.js`.
- `scene.ts`: everything of the prototype page script that touches Three.js: renderer
  creation and init, lights, environment, `buildModel`, `frameModel`, `applyColor`,
  per-frame `pose` application (bell matrix, tentacle write, face update, uniforms),
  `render`, `resize`, `dispose`. Exports one async factory:
  `createMascotScene(canvas: HTMLCanvasElement, opts): Promise<MascotScene>`.
- `motion.ts`: the pure, Three.js-free part: state object, `simulate`, moods
  (`onImpact`, `land`, `moodStep`), springs, idle logic. Vectors as plain `{x, y, z}`
  objects. `scene.ts` converts.
- `Mascot.tsx`: the React component: DOM element, canvas, hit proxy, pointer and keyboard
  input, placement, the rAF loop, lazy import of `scene.ts`.
- `mascotStore.ts`: prefs and live state (section 3.7).
- `mascot.css` imported by `Mascot.tsx`, or a section in `app.css`; tokens only.

`body.ts`, `face.ts`, `scene.ts` are the only files importing `three`. `Mascot.tsx` loads
them with `import("./scene")` after the first `requestIdleCallback` (fallback
`setTimeout(0)`), only when the mascot is enabled. Check with `vite build` that `three`
is a separate chunk and not in the entry chunk.

### 3.3 Mount

In `App.tsx`, next to `ChatWidget`:
`const Mascot = lazy(() => import("../mascot/Mascot"));` rendered inside the same
`<Suspense fallback={null}>` as `ChatWidget`, with `onActivate={() => {}}` for now
(packet C wires it). Render it only for `auth === "in"` (it already is, inside that
branch).

### 3.4 Tokens and colours

Add to `tokens.json`, then `npm run tokens`:

- `color.mascot`: `amber-bell #EBA066`, `amber-glow #FFCB52`, `mercan-bell #E07E5E`,
  `mercan-glow #FF9A73`, `lila-bell #B293E2`, `lila-glow #D7A8FF`, `lagun-bell #5BB4CB`,
  `lagun-glow #7FE6FF`, `nane-bell #6CC79A`, `nane-glow #A6F59A`, `ink #4A2216`,
  `star #FFD34A`, `star-glow #FFB61A`, `blush rgba(255,120,130,.85)`, `eye #141012`,
  `spark #FFFFFF`, `light-key #FFF0DC`, `light-rim #D8E4FF`, `custom-mix #FFE6A0`.
- `z`: `mascot 45`, `mascot-perch 55`.
- `spacing`: `mascot-min 56px`, `mascot-max 180px`, `mascot-default 96px`.

`palette.ts` reads them with
`getComputedStyle(document.documentElement).getPropertyValue("--color-mascot-amber-bell")`
(check the exact generated variable names in `tokens.css`) and turns them into
`THREE.Color`. The custom colour comes from `<input type="color">` at runtime; the glow
is derived as in the prototype `colors()` with the `custom-mix` token instead of the hex.
The halo element uses `var(--color-mascot-<preset>-glow)` through a CSS custom property
set on the mascot element.

### 3.5 Behaviour (port, with these changes)

Keep from the prototype, unchanged: look, three variants, fur, swim pulse, wander,
jelly shear, squash, blink, look at pointer, drag, throw, wall bounce, moods `flying`,
`ouch`, `dizzy` (stars, spiral eyes), fall to the nearest bottom corner and pin there,
`shake`, `happy`, hover freeze, freeze on press, size from prefs, 2x supersampling,
render loop stopped while the tab is hidden.

Remove: the click menu, the chat bubble, the design-system card, the size slider and
swatches on the page, `localStorage` key `ff.jelly` (replaced by `mascotStore`),
`window.__S`, `mountActDemo` and the "Davranış" demo buttons.

Port `jelly-body.js` whole, including `reachTo` (warm started, smoothed FABRIK) and
`pushOut` (one continuous collision shape). They exist because the first versions let
tentacles pass through the bell and jitter; do not simplify them away. `jelly-act.js` and
the face looks it needs (`think`, `search`, `work`, `talk`, `error`, brows, talk mouth)
are ported in packet E, but port `jelly-face.js` whole in this packet so E only wires.

Change:

1. **Click** (press and release under the 6 px drag threshold) calls `onActivate()`. Enter
   and Space on the focused hit proxy do the same. The hit proxy is a `<button>` with
   `aria-label` from `mascotText.ts` ("Sohbeti aç").
2. **Home spot**: the spot of today's `ChatButton`, so: right edge
   `--spacing-fab-offset-mobile`, bottom `--spacing-fab-offset-mobile +
   --spacing-fab-size + --spacing-5`, measured at runtime from a hidden probe element or
   computed styles, never hard coded. When `wander` is off the mascot stays at home
   (pinned, same as the prototype `pinned` hold spring).
3. **Rest while working**: a capture listener on `document` for `keydown`, `wheel`,
   `touchmove`, `pointerdown` (ignoring events whose target is inside the mascot)
   sets `lastWorkAt = now`. While `now - lastWorkAt < MASCOT_IDLE_MS` the mascot swims to
   home and holds there; after that it wanders as in the prototype. A pin from a dizzy
   fall still wins (it stays in its corner until dragged or "Konumu sıfırla").
4. **Never cover what is in use**: a `MutationObserver` on `document.body`
   (`childList`, `subtree`, `attributes`, filter `aria-modal`) checks
   `document.querySelector('[role="dialog"][aria-modal="true"]')`. While one exists the
   mascot fades out (`opacity` 0, `pointer-events: none`, keeps simulating) and comes back
   when it closes. Its `z-index` is `var(--z-mascot)`; packet C raises it to
   `var(--z-mascot-perch)` only while perched.
5. **Bounds** exclude the sidebar on desk width: the left bound is the right edge of
   `<aside>`/the sidebar element (read its rect on resize).
6. **Phone width** (below the `desk` breakpoint, `matchMedia` with the token value):
   wander is forced off, size is `SIZE.phoneScale` of the pref, home spot as above.
7. **Reduced motion**: wander off, no dizzy fall (impacts only squash), pulse at 0.4 as
   in the prototype.
8. **3D unavailable**: if `createMascotScene` rejects (no WebGPU and no WebGL 2, or the
   chunk failed), set `mascotStore` live `engine = "failed"` and render nothing.

### 3.6 New constants in `config.ts`

`MASCOT_IDLE_MS = 20000`, `DRAG_THRESHOLD = 6` (from `CFG.dragTap`),
`SIZE.phoneScale = 0.8`, `PERCH_X = 0.6`, `PERCH_Y = 0.35` (fractions of the mascot size,
used in packet C).

### 3.7 `mascotStore.ts`

Prefs, persisted like `chatPrefs` (keys `ff.mascot.*`, every access in try/catch):
`show` (default true), `wander` (default true), `variant` (default `"etekli"`), `color`
(preset id or `"custom"`, default `"amber"`), `custom` (hex string or null), `size`
(px number, default from `SIZE.initial` = 96), `anchor` (`{x, y} | null`, the pin).

Live state (not persisted): `engine: "idle" | "loading" | "ready" | "failed"`.

Expose both through `useSyncExternalStore`-friendly `subscribe`/`get` functions and
setters, so the settings card (packet D) changes the running mascot without reload, and
`ChatWidget` (packet C) can read `engine` and `show`. A `resetPosition()` clears `anchor`
and sends the mascot home.

### 3.8 Done when

- The mascot appears after the page is idle, wanders, can be dragged and thrown; a hard
  throw makes it dizzy, it falls to a bottom corner and pins there, then shakes and smiles.
- Typing in any input or scrolling sends it home and keeps it there; 20 s of no input
  starts wandering again.
- Opening a sheet (+ FAB) hides it; closing brings it back.
- With the mascot disabled in `localStorage` (`ff.mascot.show` = "0"), `vite build`
  output shows `three` in its own chunk and the network panel shows no `three` chunk on
  load.
- Commit body lists the measured budget: `renderer.info.render.calls`, triangles, and
  frame time from the Performance panel.

## 4. Packet C: chat integration

Commit: `feat: mascot opens the chat, perches on it and shows reply status`

Start only when no chat packet of your own is half done on `ChatWidget.tsx`,
`ChatButton.tsx` or `ChatPanel.tsx`: finish and commit that one first.

1. **Open request API** in `src/lib/chatStore.ts`: an `EventTarget` named `chatBus` with
   `requestChatOpen()` dispatching `"open"`. `ChatWidget` listens: if closed, `toggle(true)`
   (which already focuses the composer); if open, only focus the composer
   (`input.current?.focus()`). It never closes the chat. The mascot `onActivate` calls
   `requestChatOpen()`.
2. **Chat live state for the mascot**: `ChatWidget` publishes `{ open, running, ready }`
   through a small external store in `chatStore.ts` (`chatLive.get/subscribe`), updated in
   an effect from its `open`, `thread.live` and `ready` values.
3. **Perch**: while `open` is true, the mascot reads `#chat-window`'s
   `getBoundingClientRect()` every frame and its hold target becomes
   `{ x: rect.right - size * PERCH_X, y: rect.top - size * PERCH_Y }`; wander, idle and
   dizzy fall are off while perched; `z-index` is `var(--z-mascot-perch)`. If the window
   rect covers the full viewport width (phone), the mascot hides instead of perching.
   When the chat closes it swims home.
4. **Status**: `running` makes the pulse period `CFG.pulseTravel * 0.6` and the glow
   `glowPow` 1.2x. `ready` (reply finished while minimized) plays `happy` once and shows
   the existing ready badge next to the mascot: reuse the `.cb-badge` look via a small
   element in `Mascot.tsx`. While `running` and minimized, show the status text and
   seconds (from `statusText` and `useElapsed` in `components/chat/StatusLine.tsx`) in a
   small pill left of the mascot, styled like `.cb-label` (move shared rules to a class
   both use, no duplication).
5. **ChatButton fallback**: `ChatButton` renders only when the mascot is not usable:
   `!show || engine === "failed"`, or while `engine` is not yet `"ready"` (so there is
   always one way to open the chat). Pass this as a prop from `ChatWidget`, which reads
   `mascotStore`. The ESC and minimize behaviour stay unchanged.

Done when checks 1, 2, 4, 5, 6 of section 6 pass.

## 5. Packet D: mascot settings card

Commit: `feat: mascot settings card under Ayarlar > Claude`

`src/pages/settings/MascotCard.tsx`, registered first in the `claude` category with
keywords (maskot, denizanası, göster, gizle, gezinsin, gezinme, model, yuvarlak, klasik,
etekli, renk, boyut, konum, sıfırla). Fields, all saving immediately through
`mascotStore` setters:

- "Göster" switch. Hint: "Kapalıysa sohbet eski düğmeyle açılır".
- "Gezinsin" switch. Hint: "Kapalıysa + düğmesinin üstünde bekler".
- "Model" segmented control: Yuvarlak, Klasik, Etekli.
- "Renk": five preset swatches (colours from the `color.mascot.*-bell` tokens) plus a
  custom colour input.
- "Boyut" range input, min/max/step from `SIZE`.
- "Konumu sıfırla" button: `resetPosition()`, toast "Maskot yerine döndü".

Reuse existing switch, segmented and swatch styles if the codebase has them (search
`role="switch"`, `aria-pressed` in `src/`); otherwise add minimal token-only classes.
Texts go in `mascotText.ts`.

Done when every control changes the running mascot without reload and survives F5.

## 5b. Packet E: mascot acting (what the chat is doing, without text)

Commit: `feat: mascot acts out the chat phase (think, search, work, talk, error)`

Port `jelly-act.js` to `src/mascot/act.ts` (imports `three`, so it lives in the lazy
chunk with `scene.ts`). Drop `mountActDemo`. Colours of the props become tokens in
`color.mascot` (`alu #C9CCD2`, `keys #2A2C31`, `screen #D6E9FF`, `screen-light #BFD8FF`,
`frame #2A1D18`, `lens #FFFFFF`, `brass #D9A441`, `handle #7A4B2A`, `drop #9ED8FF`,
`mouth-dark #2A0E08`, `tongue #E8737C`, `dot #FFFFFF`), read through `palette.ts`.

Activity comes from the chat live state published in packet C (`chatLive`), extended with
`phase` and `tool` from `thread.live` (`src/lib/useThread.ts`; tool names already arrive
without the `mcp__full-follow__` prefix, see `packages/server/src/chat/stream-parser.ts`).
Mapping, as a single table constant in `act.ts`:

| Chat state | Activity |
|------------|----------|
| `queued` | `queued` (nod) |
| `thinking` | `thinking` (dots, chin, eyes up) |
| `tool` with `find`, `get`, `timeline`, `today`, `report`, `open`, ToolSearch label | `search` (magnifier) |
| `tool` with any other tool (`save`, `move`, `pay`, `touch`, `draft`, `plan`, `delete`) | `work` (laptop, glasses, typing) |
| `writing` | `writing` (talk mouth, speech bubble) |
| reply finished `done` | `done` (happy once, props go away) |
| reply finished with an error state | `error` (sweat drop, worried) for `ACT_ERROR_MS` (3000), then idle |
| nothing running | `idle` |

Rules:

- The talk mouth uses the prototype's syllable generator; syncing it to the real text
  stream is not required.
- While an activity runs the mascot holds its place (or stays perched, packet C); look at
  pointer is off. Moods (`dizzy`, `shake`, `happy`, ...) win over activity looks, as in the
  prototype `pose()`.
- Below `ACT_PROPS_MIN_SIZE` (70 px mascot size) props (laptop, magnifier, glasses) are not
  shown; face looks, thought dots and the speech bubble still play.
- Activity changes are debounced by `ACT_MIN_MS` (400) so a 50 ms tool call does not flash
  the laptop.
- Reduced motion: no typing bounce, no magnifier sweep; looks and the bubble stay.

Done when, with the chat minimized, a reply that searches and then saves shows: nod,
thinking dots, magnifier, laptop with glasses and typing, talking mouth with bubble, happy;
and no tentacle passes through the bell or jitters (watch the magnifier and chin).

## 6. Checks (Özgür tests by hand after C, D and E)

1. Click the mascot: the chat opens with the cursor in the composer. Click it again: the
   chat stays open.
2. Drag and throw the mascot: the chat does not open. A hard throw stuns it and it drops
   to a bottom corner.
3. Type in any input or scroll a page: the mascot goes home and stays; 20 s later it
   wanders.
4. Open a sheet (+ FAB): the mascot is not above it.
5. Send a message, minimize the chat: faster pulse and status pill while the reply runs,
   then happy and the ready badge.
6. Turn "Göster" off: the old chat button is back and works.
7. Phone width: docked bottom right, opens the chat, no wandering.
8. Settings: "vergi" finds Fiyat tabanı, "maskot" finds the mascot card, `/ayarlar/network`
   opens Network, an unknown word shows the empty state.
9. First load with the mascot off transfers no `three` chunk.
10. Ask something that searches and saves, minimize the chat: the mascot acts out each
    step (section 5b) and is readable at the default size.
11. At 60 px size: no laptop or magnifier, but the talk mouth and the speech bubble show.
