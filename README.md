# 🚀 JUMP TO THE STAR (JTTS)

**Professor Shapi's Lab Experiment #001** — a physics-first, endless side-scrolling flight arcade.
Vanilla JavaScript + Canvas2D. No engine, no build step, no external assets: every sprite is drawn
with vector primitives at runtime.

Fly **left → right only**. Gravity is always on. There is no free lift, no hover, no infinite
ascent — momentum, bounces, boosts and a little luck are all you get.

---

## Play it

```bash
npm start           # → http://localhost:8080  (binds 0.0.0.0, so phones on the LAN can join)
```

Any static file server works (`python3 -m http.server`), but **it must be HTTP** — the game is
plain ES modules and browsers refuse `file://` module imports.

In-game: press **`F`** or tap the **⛶** button — there is also a **⛶ FULLSCREEN** row in the main menu.
On phones it also requests a landscape lock. The HUD reserves that button column, so the coin pill
and boost stars never draw underneath it.

**Open it in its own tab.** Inside an embed preview the game lives in an iframe, where the
Fullscreen API is refused. The **↗ NEW TAB** button in the menu opens `?standalone=1` in a fresh
browser tab; the game also drops a plain **open in new tab** link under the menu for a few seconds,
so a popup blocker can never leave you stuck. In standalone mode it asks for fullscreen and a
landscape lock on the first tap — inside a normal page those requests are skipped, so nothing
throws.

**Tiếng Việt / English.** The whole game is bilingual and starts in **Vietnamese**. Switch at any
time with the **VI / EN** chip in the menu header or SETTINGS → LANGUAGE. The choice is saved and
covers menus, buttons, the in-canvas HUD, tutorial hints, item names, pilot skills, upgrade cards,
region names, combo tiers and the result screen. The title art stays "JUMP TO THE STAR" in both.

**See further:** the camera has three view distances — Normal (1×), Wide (0.72×) and **Ultra (0.5×)**.
Ultra shows ~2 960 world-px across a 1600px screen (about two hops ahead). Cycle live with **`Z`** or
pick one in SETTINGS → VIEW (default: Wide).

Tested in: headless Node 22 (see the honest test report below). **Not yet launched in a real
browser window by me** — open it and tell me what breaks.

---

## Controls

| Action | Keyboard | Touch | Mouse |
| --- | --- | --- | --- |
| Launch / charge catapult | hold `Space`, release in the **42–62 %** window for a perfect launch | hold **JUMP** | — |
| Boost (3 charges at launch, capacity 5–6 with unlocks) | `Space` in the air | **BOOST** | right-click |
| Steer | `A` / `D` or `←` / `→` | left thumb pads | — |
| Character skill | `Shift` (hold-skills can be held) | **SKILL** | right-click (hold) |
| Pause | `Esc` / `P` | ⏸ button | — |
| Mute | `M` | — | — |
| Fullscreen | `F` or ⛶ button (also in the menu) | ⛶ button | ⛶ button |
| Own tab / standalone | ↗ NEW TAB in the menu (opens `?standalone=1`) | ↗ button | ↗ button |
| Language | VI / EN chip in the menu, or SETTINGS → LANGUAGE | same | same |
| View distance | `Z` cycles Normal → Wide → Ultra 0.5× | SETTINGS → VIEW | SETTINGS → VIEW |

Input is buffered for 140 ms, so a press slightly before the boost lockout ends still fires.
Boost priority: **up, then right** — it is a rescue tool first.

---

## The five pilots

| Pilot | Difficulty | Unlock | Skill | How it plays |
| --- | --- | --- | --- | --- |
| **PROFESSOR FROG** | Easy | free | **BIO SPRING** — legs become giant springs: a huge upward kick, and pads bounce you higher | forgiving gravity, big bounces, the tutorial pilot |
| **CHICKEN 9000** | Medium | 900 ★ | **PANIC THRUST** — hold to burn energy for continuous lift | the only sustained-lift skill; energy is your real fuel gauge |
| **CHEESUS** | Medium | 1 800 ★ | **CHEESE MAGNETISM** — hold to suck in nearby loot (and drift toward the tastiest cluster) | lower gravity, build-your-own loot lines |
| **PIG METEOR** | Hard | 3 000 ★ | **METEOR SLAM** — dive; pad impact converts dive speed into altitude | risk/reward: the dive is controllable but commits you |
| **ERROR-404** | Hard | 4 200 ★ | **GLITCH BOOST** — cycles **POWER → CONTROL → RECOVERY**, telegraphed in the HUD before it fires | a rhythm kit: each mode is strong at a different moment |

Each pilot has its own stat block (gravity, drag, bounce, energy, steering, launch), its own rig,
animations and expressions — no skins.

---

## Items — 20 objects, each with its own mechanic

| Item | Kind | Mechanic |
| --- | --- | --- |
| Energy Orb | pickup | +10 energy |
| Super Energy | pickup | +30 energy |
| Combo Energy | pickup | small energy, big combo charge |
| Star Coin | pickup | currency, never blocks the flight line |
| Power Cell | pickup | +22 energy instantly (the big one) |
| Boost Star | pickup | restores one boost charge, up to the run's capacity |
| Crazy Spring | pad | high, springy bounce |
| Bounce Mushroom | pad | soft, forgiving bounce |
| Slippery Ice | pad | deflects and slides: keeps your speed instead of popping you up |
| Shapi Safety Net | pad | rescue trampoline — costs 8 % energy and breaks the combo |
| Spike Mine | hazard | drains energy + brief invulnerability |
| Mini Rocket | booster | instant forward+up kick |
| Push Bomb | booster | explosive shove off a bad trajectory |
| Jet Gate | gate | additive thrust along its printed angle |
| Glitch UFO | ride | carries you hands-free, then throws you |
| Hot Air Jet | zone | continuous updraft column |
| Giggle Balloon | buff | low gravity while it lasts |
| Quantum Coffee | buff | +45 % boost power for the duration |
| Reverse Magnet | buff | sucks loot to you |
| Underpants Chute | buff | soft fall (3.6 s) — turns a plunge into a glide |

Item placement is deliberate: loot sits on the natural flight arc, tools sit mid-hop, hazards
only outside the safe corridor.

---

## World: infinite, streamed, and survivable

| Distance | Region | Loot density |
| --- | --- | --- |
| 0–500 m | Shapi's Launch Lab | 1.00 |
| 500–2 000 m | The Bouncy Wilds | 0.86 |
| 2 000–5 000 m | Cloud Chaos | 0.72 |
| 5 000–15 000 m | Illegal Science Zone | 0.58 |
| 15 000 m + | The Star Frontier | 0.50 |

Density also falls off with distance: measured as **0.0375 / 0.0263 / 0.0190 / 0.0099 items/m** in
the 300–1 500 m, 1 500–4 000 m, 4 000–9 000 m and 9 000–20 000 m bands. The late bands thin out on
purpose (cluster chance, cluster size and mid-pad chance all shrink with distance) so the endgame
stays readable instead of becoming a loot carpet. The map is generated in chunks, streamed ahead of the camera and recycled
behind it (measured steady state: **45–112 live entities, 5 resident chunks** over 40 km).

**A missed hop is a real death.** There are no safety nets (they were removed on request — they felt
like a bug). What keeps the map honest instead: every pad is placed on the *descending* crossing of
the previous pad's real bounce arc, with the same maths the player uses, so a reachable line always
exists. The reference pilot proves it: **25/25 routes to 10 km** and a deeper sweep of **50/50 routes
to 20 km** using only steering + three boosts (no skills, no upgrades).

**The opening is forgiving.** For the first 700 m the generator shortens hops (down to ×0.78), widens
landing pads (up to ×1.4), drops the tilt chance to zero and caps drops at ×0.65, then ramps to the
normal rules. Past 3 km a `late` factor starts thinning the loot. A hard cap (3 100 px) means no hop
is ever longer than the engine's proven ceiling.

**The sky is open.** The corridor breathes ±1 000 px, and **62 %** of hops carry a **sky shelf**:
premium loot (boost star, super energy, magnet, coffee, balloon, chute) parked 620–1 400 px above the
route, past the reach of any normal bounce (114 shelves measured over 20 km). Every shelf ships with a thermal column (or a near-vertical
jet gate) that can actually lift you there — the test checks the climb against the lift, not "looks fine".

---

## Progression

* **Star Coins** are earned per run (distance, orbs, combo, skill bonuses, no-death bonus).
* **Upgrade trees** — 8 categories per pilot, **5 levels each**, costs `120 / 240 / 460 / 800 / 1400`
  per level: Launch Power, Boost Engine, Energy Capacity, Aerodynamics, Steering, Energy Efficiency,
  Item Synergy, Special Skill. Total per pilot: **24 160 ★** (3 020 ★ per category).
* Everything is capped. Level 5 Energy Capacity is +43 % max energy, Efficiency bottoms out at a
  floor, so no pilot becomes immortal and no single upgrade is mandatory.
* Records: best distance / score / combo / coins, runs, per-character bests, last 10 runs,
  achievements — all in the **Records** screen.

---

## Project layout

```
index.html                  app shell + all screens (menu/characters/upgrades/records/settings/pause/gameover)
styles/main.css             UI skin, responsive + touch layout
src/config/config.js        EVERY tuning number lives here (physics, economy, regions, quality)
src/core/                   mathx (RNG, clamp, damp), loop (fixed 1/120 step), input (keyboard+touch+buffer),
                            i18n (EN/VI dictionary, t/pick/regionLabel/applyI18n, saved language)
src/game/                   save, characters, upgrades, physics, flight, bounce, items, world,
                            camera, particles, score, audio, game (state machine + rules)
src/art/                    art primitives, 5 character rigs, item art, world scenery, HUD, scene renderer
src/main.js                 boot, screen router, menus, upgrade lab, records, settings, loop wiring
test/run.mjs                75 engine/gameplay/i18n/voice checks (headless, real modules)
test/browser.mjs            24 DOM/boot/UI checks (jsdom + stubbed canvas)
test/sweep.mjs              deep fairness sweep: 50 seeded routes to 20 km
test/autopilot.mjs          reference pilot used to prove generated maps are flyable
test/play.mjs               headless run harness, can dump gameplay frames
tools/serve.mjs             dependency-free static server
tools/render.mjs            offline art preview renderer (@napi-rs/canvas)
```

Engine facts: fixed **1/120 s** timestep decoupled from render rate, object pooling for particles
and floaters, chunk load/unload, adaptive quality (Low / Balanced / High + auto-degrade when FPS
drops below 45), DPR-aware canvas sizing, all audio synthesised with WebAudio and unlocked on the
first user gesture.

**Music:** `src/game/music.js` is a small pure-function sequencer; `src/game/audio.js` turns its
events into sound. Four tracks: **menu = electric EDM, 128 BPM** (four-on-the-floor kick, claps on
2 & 4, offbeat supersaw stabs, rolling 16th bass with a sidechain pump, arpeggio lead, riser + impact
every 8 bars, 15.00 s loop), launch 132, flight 138 (adds layers as your combo climbs), game-over 96
(half-time pad + plucks).

---

## Testing — what I actually ran

Environment: **Node v22.22.3**, Linux container, **no GPU, no browser window, no audio device**.
The renderer was exercised through `@napi-rs/canvas` (a CPU Canvas2D implementation) and the UI
through **jsdom** with a stubbed 2D context and stubbed `AudioContext`.

The two test suites need optional dev-only packages (`@napi-rs/canvas` for a real Canvas2D, `jsdom`
for the DOM). Neither ships with the game — without them the rendering checks fail loudly and the
browser-path suite skips:

```bash
npm i --no-save @napi-rs/canvas jsdom   # only if you want to run the tests
```

```bash
node test/run.mjs        # 75/75 passed
node test/browser.mjs    # 24/24 passed
node test/sweep.mjs 20   # 50/50 routes to 20 km
```

### `test/run.mjs` — 75 checks, 75 passing

| Group | What is actually asserted |
| --- | --- |
| physics (4) | gravity always pulls and is capped at terminal velocity; drag only above the floor and never reverses direction; a 3000 px/s pass through a pad is caught by swept collision; 60 s of extreme inputs stays finite and clamped |
| pads (3) | pads are one-way (land on the face, pass from behind); 50 chained bounces never exceed the velocity cap; the bounce stat changes the arc |
| world generation (7) | all 19 object kinds appear and **zero rescue pads spawn**; chunks are contiguous; the hazard floor stays inside its band across 5 seeds × 30 km; sky shelves are >600 px above the line and inside thermal reach (measured against the physics); pad-to-pad climbs and gaps stay inside the reachable envelope; loot density falls with distance (0.0367 → 0.0224 items/m); entity count stays flat over 40 km |
| camera view (3) | wide/ultra show more world than normal (1 480 / 2 056 / 2 960 world-px), ultra is exactly 0.5×, switching is live, and the corridor fits on screen |
| music (4) | the menu loop is 128 BPM with exactly 4 kicks and 2 claps per bar, 4 offbeat stabs, a lead and a riser over a 15 s loop; all 912 events across 4 tracks are finite and in range; the engine really schedules (44 oscillators + 24 percussion in 2 s of menu); scene changes swap tracks and stop cleanly |
| items (5) | each pickup fires exactly once and cannot be farmed; buffs measurably change the flight model; jet gates and UFOs apply their impulse/ride; zones lift; hazards drain energy and grant i-frames; no object kind is decorative |
| characters & skills (4) | 5 distinct stat blocks and 5 distinct skills; every skill spends energy and changes flight state (cheesus proved via magnet pulling loot closer); hold skills burn over time; error-404 cycles POWER→CONTROL→RECOVERY deterministically |
| boost (3) | 3 charges, lockout, hard stop at zero; a 2400 px/s fall is reversed; boost stars refill but never exceed the cap |
| scoring (3) | distance never decreases; combo tier reaches "SHAPI APPROVES!" and decays; score components sum exactly |
| save data (5) | per-field corruption repair; broken JSON resets with a backup; save→reload round trip; v1→v2 migration; upgrade costs ascend and cap at level 5 |
| run lifecycle (4) | floor death builds a summary and pays coins; restart clears every per-run field; pause freezes and resumes; the launch charge window produces a perfect launch (measured: 53 % charge → vy −1699) |
| engine (2) | 20 fps and 120 fps frame budgets produce the **same** simulation (x 4985.8 vs 4985.8); a stalled frame cannot spin the accumulator |
| rendering (4) | all five regions render with a **balanced** save/restore stack (this caught two real leaks); launch/fly/dead all render; 640×360 and 2560×1440 render; average frame cost |
| audio (2) | the engine is a safe no-op before user interaction; every SFX name used in code exists in the synth (29 names → 45 voices) |
| voices (4) | "ey"/"ooh" are layered formant voices (≥3 voices × 3 band-pass formants + a breath layer + vibrato), not beeps; the crowd scales and caps at 4 voices; a broken WebAudio graph cannot throw into the game loop; a perfect launch really fires the "ey" cheer and a tier-3 combo really fires the "ooh" crowd |
| i18n (7) | 149 EN/VI pairs with no missing side; 82 markup `data-i18n` keys all resolve; switching language changes what the player reads (CHƠI/PLAY, LÒ XO SINH HỌC/BIO SPRING); all 5 pilots, 20 items and 8 upgrades carry Vietnamese text; EN and VI use identical `{placeholders}`; region names and combo tiers are localised; the save remembers the language and repairs garbage back to `vi` |
| performance (1) | simulation + streaming costs **0.86 ms of CPU per wall-clock second** (7 µs/step) |
| wiring (7) | every DOM id the code looks up exists; every `data-action` is handled; every relative import resolves (57); game logic never touches `document`/`localStorage`; tuning constants all live in config; no emoji/placeholder art |

### Fairness runs (inside `test/run.mjs`)

* **25 routes** — 5 pilots × 5 seeds — flown to **10 km** with steering and 3 boosts only
  (no skills, no upgrades). 25/25 survived.
* Ad-hoc deeper sweep (not part of the suite): **50 routes** — 5 pilots × 10 seeds — to **20 km**:
  50/50 survived.
* A pilot who presses *nothing at all* now dies in the first kilometre — by design, since the nets
  are gone. Falling is a mistake, not a rescue.

### `test/browser.mjs` — 24 checks, 24 passing

Loads the real `index.html` in jsdom, boots the real `src/main.js`, and drives the real UI:
menu → characters → upgrades → records → settings → menu routing; character cards (locked pilots
refused, paid unlocks work, reselect works); upgrade lab (cannot buy without coins, purchase
deducts and persists); settings sliders persist; the VIEW control switches camera zoom (and
persists); the menu fullscreen button is wired; the EDM sequencer schedules notes once audio
unlocks; **language switching** (VI ⇄ EN flips the PLAY button and persists to the save);
**NEW TAB** renders a real `?standalone=1` link with `target=_blank` (and the standalone gate stays
hidden in a normal visit); **RESTART refills the launch charge bar** (the regression from this
batch: after a restart the meter charged to 67 % and launched); PLAY starts a run and the launch
fires; 20 s of flight stays finite and scores (a death caused by *no input at all* is retried, so
the check never depends on luck); **the live HUD is drawn in Vietnamese and then in English** —
`NĂNG LƯỢNG` / `ENERGY` are captured from real `fillText` calls, with no `{n}`/`undefined` ever
painted; right-click fires the skill and releases cleanly; `Esc` pauses and resumes with the
simulation frozen; death writes coins, records, history and the save, and shows the game-over
screen; a fresh `SaveStore` reloads that save intact; quality switching re-renders; no uncaught
errors. The pause **journey map** is checked for Vietnamese region names (`PHÒNG PHÓNG SHAPI`,
`Đang bay`) as well.

I also eyeballed a software-rendered Vietnamese frame (`node test/play.mjs`, PNG dumped locally):
`ĐIỂM 2,114`, `NĂNG LƯỢNG`, `KỸ NĂNG` and the minimap label `ĐỒNG NÂY` all draw with correct
diacritics and stay inside their boxes. DOM panels (menu/characters/settings) were **not**
screenshotted — no browser — so Vietnamese line lengths there are reasoned about, not seen.

### Rendering numbers (CPU canvas, no GPU)

`renderScene` at 1600×900, high quality: **avg 3.6 ms, worst 5.2 ms** on the lab region (that
region is the heaviest because of the launch site), 3.9–5.2 ms in the other four. Simulation is
0.86 ms/s. A real GPU-composited browser should be faster, not slower — but I have not measured it
in a browser.

### What I did **not** test (so don't take it as verified)

* **A real browser.** No Chrome/Firefox window was available in this environment. The DOM and
  canvas paths are covered by jsdom + a real Canvas2D implementation, but layout, CSS, device
  pixel ratio, pointer events and WebAudio graph behaviour in a live browser are unverified.
* **A physical Android device.** The touch layout, `--touch-scale`, coarse-pointer detection and
  the 45 fps auto-degrade are implemented and unit-checked, not field-tested.
* **Audio by ear.** The synth is written and its voice table is verified — including the new
  crowd/formant voices — but no human has heard them.
* **Vietnamese typography in a real browser.** The canvas frames were checked with a real CPU
  Canvas2D and Vietnamese glyph coverage; the HTML panels were checked only through jsdom text
  assertions, not visually. Some in-world signage (`CAUTION`, `LAUNCH ZONE`, the logo) is painted
  art and stays English on purpose.
* **Long real-time play sessions** (30 min+, memory growth in a browser tab).
* **Frame pacing under thermal load** on low-end phones.

---

## Known limitations

* Adaptive quality changes particle counts, haze and DPR cap; it does not re-tessellate art.
* Records and upgrades are per-browser (`localStorage`), no cloud sync.
* The EDM sequencer schedules ~34 voices/second at 128 BPM. That is fine on desktop WebAudio, but
  nobody has profiled it on a low-end phone.
* The reference autopilot in `test/` is a test fixture, not an in-game AI.
* `.art-out/` previews are generated locally (`npm run art`) and intentionally not committed.
