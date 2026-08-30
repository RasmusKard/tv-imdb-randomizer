# what.watch

A random-episode/night's-pick shuffler for Android TV. It filters a corpus of 534 836
IMDb titles by type, rating, year, votes and genres on a D-pad-first board, then rolls
one title at a time — never repeating within a session — onto a verdict screen.

Built with Expo SDK 57 on the React Native TV fork (`react-native-tvos`), targeting
Android TV; also buildable for Apple TV, mobile and web.

## The API dependency

The app is a client. It talks to a PostgREST-style **what-watch API** (`/title_full`)
that serves the IMDb corpus — counts, filtered batches, random windows. See
`consuming-the-api.md` for the measured spec the client is written against. Point it
at the server with `EXPO_PUBLIC_API_URL` in `.env` (copy `.env.example`; `10.0.2.2`
reaches the host from an emulator, a LAN address reaches it from a physical device).

Plots and posters are the server's job: the ask lives in `tmdb-for-the-api.md`, and
until it lands the verdict keeps its placeholder panel. `plex-slugs-for-the-api.md`
is the same pattern for "Open in Plex".

## Run it

```sh
yarn
yarn prebuild:tv   # Expo prebuild with TV modifications (EXPO_TV=1)
yarn android       # build and install on a device/emulator
```

Debug builds need Metro running (`yarn start`); if several worktrees share a machine,
give this one its own port and map it per-device, e.g.
`adb -s emulator-5556 reverse tcp:8081 tcp:8082` against `expo start --port 8082`.

## Checks

There is no test framework. The one runnable check covers the pure logic a D-pad
walk-through cannot reach — query building, slider clamping, band presets:

```sh
yarn typecheck     # tsc --noEmit, strict
yarn checks        # tsx src/lib/checks.ts
```

Both must be green at the end of every change; CI runs them on push.

## Planning docs

`PLAN.md` documents how the board was wired to the real API, `PLAN-plex.md` the
"Open in Plex" experiment, and `tmdb-for-the-api.md` and `plex-slugs-for-the-api.md`
the asks that would give the verdict its poster, plot and Plex link. They are written
in a measured-facts style on purpose: every number in them was checked against a
running server or device, not assumed.
