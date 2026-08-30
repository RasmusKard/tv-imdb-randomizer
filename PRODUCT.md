# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

Android TV only, for now — per the owner, no other platform needs consideration at present. (The Expo TV fork keeps tvOS/mobile/web buildable; that is incidental, not a commitment.)

## Users

A solo power user with strong taste: one person drives the remote, tunes precise filters (type, rating band, year band, votes band, 21 genres in tri-state), and wants zero repeats. Family members end up watching the picks; the app is not designed around group negotiation.

## Product Purpose

what.watch ends the "what do we watch tonight" scroll by filtering a 534,836-title IMDb corpus on a D-pad-first board, then rolling one title at a time — never repeating within a session — onto a verdict screen. The primary action is labelled in plain action words ("Pick tonight's show" on the board, "Pick another" on a verdict). Success: the user presses it, gets one confident answer, and watches it. The browsing session itself is what gets deleted.

## Positioning

Your corpus, no algorithm. Exact match counts, user-owned filters, watched-list exclusion — the anti-streaming-service picker. A neighbouring product running a recommendation engine could not truthfully copy "the count you see is the count that exists, and nothing is optimising for engagement."

## Operating Context

- watched from a couch, ~3 metres from the panel, driven by a five-button D-pad remote (no pointer, no touch as primary path)
- depends on the self-hosted **what-watch API** (PostgREST-style, `/title_full`), reached via `EXPO_PUBLIC_API_URL` — the app is a thin client; corpus, plots and posters are the server's job
- IMDb ratings export (`ratings.csv`) is the user's existing list; import happens by scanning a QR shown on the TV, which opens an upload page hosted by the TV itself on the LAN (phone drops the file); SAF document picker and paste-CSV are fallbacks
- updates arrive as OTA: tags on the repo produce releases; the app checks daily, silently, and hands the APK to Android's system installer after an MD5 verify
- development: Expo SDK 57 on `react-native-tvos`, `yarn prebuild:tv` then `yarn android`; `yarn typecheck` + `yarn checks` must stay green, CI runs them on push; no test framework beyond the one pure-logic check

## Capabilities and Constraints

- filters: kinds (movie/series, last one cannot be removed), rating/year/votes dual-range sliders with seven band presets each, 21 genres cycling off → include → never-show
- exact count of remaining matches, debounced per "done fiddling", shown as a split-flap counter; roll fetches a batch of 20 and drains it
- session-level no-repeat (`shown` list); watched-list exclusion happens server-side when a session token rides the request
- account: email/password sign-in and registration on-device (remote typing kept to exactly two fields by design)
- verdict screen: title, rating, year, runtime, votes, genres, plot (when the API serves it), placeholder poster panel until TMDB support lands (`tmdb-for-the-api.md` is the open ask); "Open in Plex" is a planned same-pattern ask (`plex-slugs-for-the-api.md`)
- Android TV overscan respected (5% inset); `REQUEST_INSTALL_PACKAGES` exists solely for the OTA handoff
- undecided: none recorded beyond the two open server asks above

## Brand Commitments

- the name/wordmark is **what.watch** (lowercase, the dot rendered as the one amber accent — a visual fact already committed in the incumbent system, recorded here because the wordmark is identity, not styling)
- **voice, confirmed by every string in the incumbent UI:** lowercase sentences; plain words a person says out loud; state the fact and the way out, never apologize and never plead ("no answer — try again", not "Oops! Something went wrong"); no exclamation marks; numbers written as digits, grouped with spaces (534 836)

## Evidence on Hand

- measured API spec: `consuming-the-api.md` (client written against it)
- open server asks with measured context: `tmdb-for-the-api.md`, `plex-slugs-for-the-api.md`
- planning docs in measured-facts style: `PLAN.md` (board wiring), `PLAN-plex.md`, `PLAN-update.md` (OTA), `ota-updates.md` (release runbook)
- device screenshots: `artifacts/` (board, slider states, tri-state, verdict, dock)
- no testimonials, customers, or press exist; nothing here may fabricate them

## Product Principles

1. **Exact over estimated.** Counts are fetched, not guessed; every number in a doc was checked against a running server or device.
2. **The D-pad is the only pointer.** Every control must be reachable, countable, and escapable with five buttons; "down is straight down" is a contract.
3. **Never repeat.** Session memory and watched-list exclusion are the product's core promise, not niceties.
4. **The client owns nothing.** Corpus, plots, posters, watched state live server-side; the app stays a thin TV face.
5. **Silent when unsure.** The daily update check never steals focus; dead servers end in notices, not broken-feeling buttons.

## Accessibility & Inclusion

- UI readable from ~3 m: uppercase wide-tracked mono labels, one-lamp contrast discipline
- reduce-motion honored (the counter's settle animation is skipped entirely)
- every state is spoken: tri-state chips carry "included"/"never show" wording, slider values ride the accessibility label; focus is ring + lift + brighten, never hue alone (TV panels are calibrated by strangers)
