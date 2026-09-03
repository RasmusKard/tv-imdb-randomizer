# This repository is me testing out vibe-coding, wouldn't recommend using any of the code from it!

# what.watch

Randomized movie/tv show picks based on your defined filters.
Open with deeplink straight to Plex.

## Install on the TV

The easiest way is [Downloader by AFTVNews](https://aftvnews.com/downloader/)
(free on the Play Store):

1. Install Downloader on the TV and open it.
2. Enter code `1397655` — the latest APK downloads.
3. Android TV will ask to allow Downloader to install unknown apps — allow it.
4. Install, open what.watch. Done.

After that the app updates itself: it checks for new releases once a day and
installs them with one confirmation on the Account screen.

No Downloader? Grab `app-tv-latest.apk` from the
[latest release](https://github.com/RasmusKard/tv-imdb-randomizer/releases/latest)
and sideload it however you like (`adb install -r` works too).

## The API

The app is a client, it consumes an API with movie/show data.

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
