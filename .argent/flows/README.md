# what.watch regression flows

Seventeen Argent flows covering the app functionality as of the current UI
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
| qa-account-screen | Account summary via the header chip; back returns to the board |
| qa-account-check-updates | Manual update check answers `up to date` (build has no update manifest) |
| qa-import-screen | Import screen (the ATV emulator has no LAN address, so the QR is fatally disabled and the header says so); back returns to the board |
| qa-presets-keep-load | Keep the default board, wander to Great, load the preset back; the board returns to its kept defaults (repeat-safe: the duplicate-keep guard holds the list at one card) |
| qa-presets-keep-twice | Keeping the same board twice answers `already kept` and stacks no duplicate; ends deleted |
| qa-presets-rename | Rename a kept preset to `night picks` (typed, committed by leaving the field); ends deleted |
| qa-presets-replace | Replace a kept preset with a Great board; the card keeps its name but carries the new summary; ends deleted |
| qa-presets-delete | Delete a kept preset; empty state answers and survives a relaunch |
| qa-verdict-plot-focus | On a long-plot verdict (`+ more` visible), D-pad right from Pick another must stay on the action row — the focusable plot must not steal focus; the select after the right press must not open the plot. Deterministic because every title in the Classic+Awful+Obscure window was given a >210-char plot in the dev DB |
| qa-slider-hold-repeat | Arm the rating slider and burst eight discrete rights — every press must land exactly one notch (adb presses arrive as ACTION_UP only; a held key drives the OS `longRight`/`longLeft` repeat stream, which the slider now moves once per event) |

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
- the what-watch API reachable at `http://10.0.2.2:3000` (host port 3000,
  `~/what-watch-postgre && ./start dev`),
- a release APK built with `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000` and
  `android:usesCleartextTraffic="true"` (the manifest patch is required for
  release builds to talk to the plain-HTTP local API; it is kept uncommitted
  in `app.json`/`AndroidManifest.xml` so it never ships).

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
