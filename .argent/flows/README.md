# what.watch regression flows

Nineteen Argent flows covering the app functionality as of the current UI
snapshot (Android TV, D-pad driven; touch directives do not exist on this
platform, so navigation is recorded `tool: tv-remote` steps gated by `await:`
identity/readiness checks).

| Flow | Covers |
| --- | --- |
| qa-board-first-screen | Fresh launch lands on the board; pick button, the three header doors (reset / presets / account), wordmark |
| qa-board-genre-tri-state | Genre chip cycles off → included → never show → off, asserted through the chip's spoken label |
| qa-board-band-preset | Rating band `Great` writes the slider to 8.0–10.0 |
| qa-board-reset-filters | Great band applied, then the header reset chip returns the slider to 5.0–10.0 |
| qa-board-kind-toggle | Movies turned off; a roll from the TV-shows-only board is proven by the verdict receipt (`Filters: TV shows, …`) |
| qa-roll-verdict-roundtrip | Roll → verdict identity (title, Pick another) → receipt returns to the board |
| qa-roll-again | `Pick another` from a verdict produces a fresh verdict |
| qa-verdict-mark-watched | `Watched it` on a verdict pushes the title to the watched list (`On your list` + notice), stays inert after, and a second roll lands on a fresh title |
| qa-account-screen | Watched-list screen via the header chip (device summary, watched count, import door); back returns to the board |
| qa-board-check-updates | Manual update check on the board header answers `up to date` on the board's notice line (build has no update manifest) |
| qa-import-screen | Import screen (the ATV emulator has no LAN address, so the QR is fatally disabled and the header says so); back returns to the board |
| qa-presets-keep-load | Keep the default board, wander to Great, load the preset back; the board returns to its kept defaults (repeat-safe: the duplicate-keep guard holds the list at one card) |
| qa-presets-keep-twice | Keeping the same board twice answers `already kept` and stacks no duplicate; ends deleted |
| qa-presets-rename | Rename a kept preset by typing `night picks` — the name applies as typed (the TV editor never releases focus for a done press, so the flow cannot hang the rename on a leave gesture), then relaunches and requires the renamed card to come back from storage; ends deleted |
| qa-presets-replace | Replace a kept preset with a Great board; the card keeps its name but carries the new summary; ends deleted |
| qa-presets-delete | Delete a kept preset; empty state answers and survives a relaunch |
| qa-verdict-plot-focus | On a long-plot verdict the plot is a clamped teaser that can never take focus: the TMDB credit proves the plot renders, a hidden check fails if an expand affordance (`+ more`) ever returns, and right-then-select from Pick another must land on `Watched it` (`On your list` answers) — a focusable plot would have eaten the presses. Deterministic because every title in the Classic+Awful+Obscure window was given a >210-char plot in the dev DB |
| qa-slider-hold-repeat | The rating slider is its own adjusting state the moment focus lands (no arm press since the ok-walk was removed); the hint and the `lower end live` label prove the row took the keys. A burst of eight discrete rights must land exactly one notch each (`5.0 → 5.8`), and walking off the row must leave the value standing (adb presses arrive as ACTION_UP only; a held key drives the OS `longRight`/`longLeft` repeat stream, which the slider moves once per event) |
| qa-slider-hold-ramp | Focus the rating slider and replay a real-device *hold* through the `__DEV__` seam (`globalThis.__tvdHold` in App.tsx emits the one `longLeft` DOWN and the UP 4.2s in — the only two events a held key delivers); the slider must stream past its long-press notch (≥ 2 notches; the stalled build lands exactly one and fails). Ends reset to defaults via the header reset chip. Needs the debug build + Metro (the seam and `debugger-evaluate` are dev-only); the ramp's cadence itself is renderer-load-bound and was measured by hand — ~24 notches per 4.2s hold under swiftshader, full traverse on real hardware |

Known gap, reported to the owner: the delete/replace **undo** notice row is a
focusable Pressable but is not reachable by D-pad from any neighbor — the
undo paths are therefore not covered by flows.

## Replaying

```sh
cd <this worktree>
argent flow run <name> --platform android --device <emulator-serial>
```

Requires:

- an Android TV emulator booted through `argent run boot-device --avdName …`
  (a raw `emulator -avd …` launch does not register with Argent's tool server),
- the what-watch API reachable at `http://10.0.2.2:3000`. Two sources are known
  to work: the real corpus (`~/what-watch-postgre && ./start dev`) or, when
  Docker is not available, the dev stub `node artifacts/fake-api.js 3000` —
  every roll then lands a brand-new id, every title carries a >210-char plot,
  and `posterUrl`/`plexUrl` stay null; the flows' assertions are written to
  hold against either,
- a release APK built with `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000` and
  `android:usesCleartextTraffic="true"` (the manifest patch is required for
  release builds to talk to the plain-HTTP local API; it is kept uncommitted
  in `app.json`/`AndroidManifest.xml` so it never ships).

Exception: `qa-slider-hold-ramp` replays its hold through the JS runtime
(`debugger-evaluate` → `globalThis.__tvdHold`), so it runs against the debug
build with Metro connected (`adb reverse tcp:8081 tcp:8081`) instead of the
release APK.

Two key injections matter on this platform:

- the keyboard step (`adb input text`) leaves the system keyboard "shown";
  while it is shown the next D-pad press is swallowed before it reaches the
  app, so a flow that types must dismiss the keyboard (a hardware `back`
  works and does not reach the app) before driving the remote again;
- a rename cannot be committed by a leave gesture at all — the editor never
  blurs. MainActivity's `dispatchKeyEvent` (mirrored by
  `plugins/esc-to-back.js`) folds ok/up/down into the editor's IME action
  while a text editor is on screen, so on real hardware "dismiss the
  keyboard, then leave" commits; the rename flow instead proves persistence
  across a relaunch, which survives the injection quirks.

Side effects: none anymore — the import flow only opens the screen (its QR is
fatally disabled on the ATV emulator, and the paste route is gone); the
presets flows keep the device's preset list empty at start and end of every
run.

## Recording environment notes

- The TV focus walk is deterministic but re-render-sensitive: any D-pad walk
  that starts right after a screen change (launch, filter change, screen
  switch) needs a settle (`delayMs` on the walk step, or an `await` on a
  stable element) or presses land a row off.
- `describe` (uiautomator CLI) dies whenever the android-devtools helper
  instrumentation is connected — i.e. after any `await-ui-element` has run.
  Recovery: `adb shell am force-stop com.argent.androiddevtools`, then use
  `describe` before the next instrumented read. See the note added to the
  argent-tv-interact / argent-create-flow skills.
- Back-to-back full-suite replays can flake entry walks on a long-running
  emulator; if a flow fails only in a long sweep, rerun it isolated before
  diagnosing.
