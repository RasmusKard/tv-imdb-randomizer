---
name: what.watch
description: A D-pad-first TV board that rolls a random movie or series from your IMDb-filtered corpus.
colors:
  board: "#0F1329"
  boardLo: "#0A0D1E"
  slat: "#1A1F3D"
  slatHi: "#2A3159"
  slatLit: "#3B4270"
  sodium: "#FFB02E"
  sodiumDim: "#C98622"
  onSodium: "#171200"
  onSodiumDim: "#4A3A08"
  cold: "#55CFE6"
  chalk: "#EDEAE0"
  dim: "#838BB4"
  dimmer: "#4E5680"
typography:
  display:
    fontFamily: "sans-serif (Android) / System (Apple platforms)"
    fontSize: "94px"
    fontWeight: 800
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "sans-serif (Android) / System (Apple platforms)"
    fontSize: "54px"
    fontWeight: 800
    letterSpacing: "-0.03em"
  title:
    fontFamily: "sans-serif (Android) / System (Apple platforms)"
    fontSize: "32px"
    fontWeight: 800
    letterSpacing: "-0.03em"
  control:
    fontFamily: "sans-serif (Android) / System (Apple platforms)"
    fontSize: "28px"
    fontWeight: 800
    letterSpacing: "0.12em"
  body:
    fontFamily: "monospace (Android) / Menlo (Apple platforms)"
    fontSize: "26px"
    fontWeight: 400
  label:
    fontFamily: "monospace (Android) / Menlo (Apple platforms)"
    fontSize: "26px"
    fontWeight: 400
    letterSpacing: "0.2em"
  label-sm:
    fontFamily: "monospace (Android) / Menlo (Apple platforms)"
    fontSize: "24px"
    fontWeight: 400
    letterSpacing: "0.1em"
  digit:
    fontFamily: "monospace (Android) / Menlo (Apple platforms)"
    fontSize: "34px"
    fontWeight: 700
rounded:
  sm: "2px"
  md: "3px"
  lg: "6px"
spacing:
  xs: "4px"
  sm: "6px"
  md: "12px"
  lg: "16px"
  xl: "32px"
components:
  button-solid:
    backgroundColor: "{colors.sodiumDim}"
    textColor: "{colors.onSodium}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    height: "80px"
  button-solid-focus:
    backgroundColor: "{colors.sodium}"
    textColor: "{colors.onSodium}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    height: "80px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.sodium}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    height: "80px"
  button-ghost-focus:
    backgroundColor: "{colors.sodium}"
    textColor: "{colors.onSodium}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    height: "80px"
  chip:
    backgroundColor: "{colors.slat}"
    textColor: "{colors.dim}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.md}"
    height: "64px"
    width: "1 grid column"
  chip-on:
    backgroundColor: "{colors.sodium}"
    textColor: "{colors.onSodium}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.md}"
    height: "64px"
    width: "1 grid column"
  chip-excluded:
    backgroundColor: "{colors.boardLo}"
    textColor: "{colors.cold}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.md}"
    height: "64px"
    width: "1 grid column"
  input:
    backgroundColor: "{colors.slat}"
    textColor: "{colors.chalk}"
    rounded: "{rounded.md}"
    height: "64px"
    padding: "0 16px"
  tag:
    backgroundColor: "{colors.slat}"
    textColor: "{colors.chalk}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.sm}"
    padding: "8px 14px"
  receipt:
    backgroundColor: "{colors.boardLo}"
    textColor: "{colors.chalk}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.md}"
    height: "76px"
    padding: "0 22px"
---

# Design System: what.watch

## Overview

**Creative North Star: "The Late-Night Cinema Marquee"**

what.watch is watched from a couch, three metres away, through a remote with five buttons that matter. The screen is a marquee after midnight: a deep indigo night, one sodium-amber lamp doing all the talking, and everything else arranged in the calm, mechanical certainty of a display that knows what it is showing. The board is the marquee's frame — seven columns of chips and slats you set like switches on a console. The verdict is the title card the marquee was built to show: one enormous uppercase title, its rating in amber, and a ticket-stub receipt along the bottom that remembers how you got here.

The system's personality is **mechanical and certain**. Nothing drifts, nothing bounces, nothing glows for its own sake. Values settle the way split-flap digits do — right to left, once, and only when the answer is final. Controls answer in detent steps: a tap is exactly one notch, focus is a visible step up in brightness, and "down is straight down" is a hard geometric contract, not a hope. The D-pad grid is drawn faintly on the board itself so the structure your thumb follows is visible on the wall.

Everything is drawn in a **1920×1080 design space** and scaled to the real screen width at module load (`s(n) = n × windowWidth / 1920`, rounded). Every px value in this document is a design-space value; a TV never rotates or resizes, so there are no breakpoints and no reflow — only one scale. All content sits inside a **5% overscan inset** so nothing lands on a bezel. Fonts are the platform faces for now (sans-serif/System for display, monospace/Menlo for the ledger); the intended drop-ins are Archivo (display) and IBM Plex Mono (numbers and labels).

**Key Characteristics:**
- Sodium amber is the single warm voice — focus, inclusion, the primary action, the count when it lands
- Cold cyan is the single counter-voice — exclusion and warnings, never decoration
- Every number and label is monospace, uppercase, tracked wide enough to read at three metres
- Flat tonal layering at rest; depth (elevation + scale + amber ring) appears only as a focus response
- A seven-column grid with sized cells governs every row on every screen; down is straight down
- Mechanical motion: split-flap settle, detent steps, no springy or ambient animation

## Colors

One warm lamp and one cold warning, carried on an indigo ground that steps up in brightness as surfaces rise.

### Primary
- **sodium** (#FFB02E): The marquee lamp. Focus rings, included chips, live slider handles, the pick button at focus, the settled count, the score on a verdict. Its rarity is the point.
- **sodiumDim** (#C98622): The same lamp at rest. Solid buttons sit here so taking focus is a visible step up in brightness, not a hue change.
- **onSodium** (#171200): Ink on top of sodium — button labels, chip names in the on state.
- **onSodiumDim** (#4A3A08): Dimmed ink on top of sodium, for a chip's second line.

### Secondary
- **cold** (#55CFE6): The warning voice. Excluded chips, error log lines, the dock's warnings, notices. Always paired with a second signal (strike-through, text), never hue alone.

### Neutral
- **board** (#0F1329): The board face — every screen's ground.
- **boardLo** (#0A0D1E): Recessed: the slider track groove, excluded chips, the receipt strip, the log box.
- **slat** (#1A1F3D): Raised slat surface — chips at rest, inputs, the poster stand-in.
- **slatHi** (#2A3159): Slat edge: borders, slider handles at rest, hairline rules, the flap tiles.
- **slatLit** (#3B4270): A handle once its slider has focus — lit from within the indigo family.
- **chalk** (#EDEAE0): Warm off-white — titles, primary text, values.
- **dim** (#838BB4): Muted label — chip names at rest, section labels, meta text.
- **dimmer** (#4E5680): The quietest readable step — leading zeros, a chip's second line, placeholders.

### Named Rules
**The One Lamp Rule.** Sodium appears on a small fraction of any screen — focus, selection, the count. If amber starts filling rest-state surfaces, the marquee becomes a flashlight.

**The Calibrated-by-a-Stranger Rule.** A TV panel is colour-calibrated by a stranger. No state is ever encoded in hue alone: exclusion is cyan *and* strike-through, focus is ring *and* lift *and* brighten, on-ness is fill *and* weight.

## Typography

**Display Font:** platform sans-serif (Android) / System (Apple platforms); intended drop-in Archivo
**Body Font:** platform monospace (Android) / Menlo (Apple platforms); intended drop-in IBM Plex Mono
**Label/Mono Font:** same mono face — it is the ledger of the whole app

**Character:** Two voices, strictly divided. The display face is for words that sell: the verdict title, the wordmark, button labels — always heavy (800), always tightly tracked, mostly uppercase and huge. The mono face is for everything that counts: labels, values, digits, the receipt — always uppercase, always tracked wide (0.05–0.24em) so it reads at three metres. Display tightens as it grows (negative tracking); mono always opens.

### Hierarchy
- **Display** (800, 94px, −0.035em, uppercase): The verdict title — the one enormous moment. Steps down to 68px when the title runs past 18 characters.
- **Headline** (800, 54px, −0.03em, uppercase): Poster-title scale, the verdict's right column.
- **Title** (800, 32px, −0.03em): Wordmarks ("what.watch", "sync your list"), the update version, the verdict plot (400 weight here).
- **Control** (800, 28px, +0.12em, uppercase): Button labels — display face, wide-tracked like the mono around it.
- **Body** (400, 26px): Changelog lines, import steps, account values, log lines. Mono, mixed case allowed.
- **Label** (400, 26px, +0.2em, uppercase): Section labels — "Type", "Genres", "Titles left".
- **Label-sm** (400, 24px, +0.09–0.15em, uppercase): Chip names and subs, meta lines, receipts, account chips.
- **Digit** (700, 34px): The split-flap counter's digits; the verdict score runs 42px/700.

### Named Rules
**The Mono Ledger Rule.** If it can be counted, matched, or pressed into a filter, it is mono and uppercase. The display face is reserved for titles, wordmarks, and button labels — words that sell, never numbers.

**The Tracking Split Rule.** Display tracking is negative and proportional to size; mono tracking is positive (≥0.05em) and computed against the font size it accompanies (`em` converted to dp at use). A size and its tracking are stated together (`mono(size, {em})`) so they cannot drift apart.

## Layout

Every screen is the same spatial model: the board ground (`board`), a 5% overscan inset on all edges, a hairline-ruled header row (wordmark left, labels/chips right), content in seven-column rows, and a dock pinned to the bottom by `marginTop: auto`.

- **The grid.** Seven columns (`COLS = 7`) across the overscan-safe width. Cells are *sized, not flexed*: `cell = (contentWidth − 6×gap) / 7`, `gap = 12px` design-space. A row with two cells leaves them in columns 1 and 2 — never stretched — so "down is straight down" stays true.
- **Spans.** A cell spanning n columns is `cell×n + gap×(n−1)`. The verdict's main column spans 5, the poster 2; the dock's counter and the pick button each span 3.
- **The column rules.** Six faint hairlines (white at 3.5% alpha) mark the gaps on the board, full height — the D-pad's map, drawn on the wall.
- **Vertical rhythm.** Blocks stack with a 10px gap; a block's label row is 28px tall; the header and dock are separated from content by hairlines in `slatHi`.
- **Full-width rows.** Sliders and the receipt span all seven columns. Their focus neighbours are wired explicitly (see Components), because Android's FocusFinder scores by centre distance and cannot find a full-width row from a left-hand chip.
- **Responsive behaviour.** None, by design. One scale (`s()`) from a 1920-wide design space, read once at module load; a TV never rotates or resizes.

## Elevation & Depth

The system rests flat. Depth at rest is **tonal layering**: recessed (`boardLo`) below the ground (`board`), slats (`slat`) above it, edges and rules (`slatHi`) above those — five indigo steps that read as physical depth without a single shadow. Hairlines (`StyleSheet.hairlineWidth`) do the separable work: header rule, dock rule, poster foot, the flap hinge.

Depth appears only as a **response to focus**: `elevation: 12`, a scale step (1.03 on buttons, 1.05 on chips), an amber ring, and a brighten — the four signals landing together, because scale alone is not readable on a large filled shape and a ring alone is not readable on a dark one.

### Shadow Vocabulary
- **focus-lift** (`elevation: 12`, approximated on web as `box-shadow: 0 10px 30px rgba(0,0,0,0.55)`): The only shadow in the system. Appears on focused buttons and chips, removed the instant focus leaves.

### Named Rules
**The Rests Flat Rule.** No shadow exists at rest. If a surface needs to look raised, it steps up one indigo tone instead.

## Shapes

Rectangles with barely-rounded corners — mechanical, close to the pixel grid. The standard corner is **3px** (`layout.radius`) on every interactive and container shape; tags run 2px, the progress track 6px. Standard stroke is a **2px border** (`layout.border`) on interactive shapes, `StyleSheet.hairlineWidth` on rules and separations. Status dots are text glyphs (●) inside labels, never circular containers. The one deliberate soft form is the poster stand-in (2:3, hairline border, 32px padding); the one deliberate color inversion is the QR card — pure white with the code printed in `boardLo`, because scanners read dark-on-light far more reliably than the inverted scheme.

## Components

### Buttons
- **Shape:** 3px radius, 2px border, 80px tall, label centered.
- **Primary (solid):** `sodiumDim` fill and border at rest — the lamp dimmed; `onSodium` label. On focus: `sodium` fill, `chalk` border, scale 1.03, elevation 12.
- **Secondary (ghost):** Transparent at rest with a `sodium` border and `sodium` label — it *fills in* on focus rather than at rest, so hierarchy is stated by what is filled.
- **Hover/Focus:** No transition duration is set; the state change is instantaneous, like a switch. Label: display face, 28px, 800, +0.12em, uppercase.

### Chips
One cell of the grid, in three states plus a focus layer. Default chips are 64px tall (name + optional second line); genre chips are 52px and single-line so 21 of them fit three rows.
- **off:** `slat` fill, `dim` name, `dimmer` sub, transparent border.
- **on:** `sodium` fill, `onSodium` name (700 weight), `onSodiumDim` sub.
- **excluded:** `boardLo` fill, `cold` border, `cold` name struck through.
- **Focus (any state):** `sodium` border, scale 1.05, elevation 12, zIndex 3; an off chip's name brightens to `chalk`. Focus is always ring + lift + brighten.

### Range Slider
A dual-handle slider that is **one focus cell**, full row width, 56px tall, 3px radius, no stroke — a ring around a 1700px element reads as an alarm, so the slat lights up instead (white 2.2% alpha at rest, amber 17% focused, amber 32% armed). OK walks the edit: lower end, upper end, done; while armed, every `nextFocus*` points at the slider itself so focus cannot leak. The track is a 6px groove (`boardLo`, hairline `slatHi` edge); the fill between handles is `sodium` at 0.45/0.75/1.0 opacity for rest/focus/armed. Handles are 124×46 pills (`slatHi`, 3px radius, mono 26/700 `chalk`) with four modes: rest, lit (`slatLit`), dim (0.4, the other end), live (`sodium` fill, `onSodium` text, ◀ ▶ arrows).

### Flaps (the counter)
The match count as a split-flap board: six 44×56 tiles (`slatHi`, 3px radius, hairline hinge in `boardLo`), mono 34/700 digits. Not settled: `dim` digits, a `dimmer` ≈ prefix, never animated. Settled: digits settle right-to-left (200ms base + 75ms per digit, 45ms tick), the count reads `sodium`, leading zeros stay `dimmer`. Honors reduce-motion by skipping the settle entirely.

### Cards / Containers
- **UpdateCard:** `slat` fill, `slatHi` 2px border, 3px radius, 16px padding, 12px internal gap. Version in display 32/800 `sodium`; changelog in mono 26 `chalk`; a full-width solid ActionButton, replaced by a progress bar (6px `slatHi` track, `sodium` fill, mono 26 percentage) while downloading.
- **Log box / receipt strip:** recessed — `boardLo` fill, `slatHi` border. The receipt is a 76px-tall full-width pressable: filter summary in mono 24 uppercase `chalk` (included genres `sodium`, excluded `cold`), "N left" right-aligned in `sodium`; focus adds a `sodium` border.

### Inputs / Fields
`slat` fill, `slatHi` 2px border, 3px radius, 64px tall, mono 30 `chalk` text, 16px horizontal padding, `dimmer` placeholders. Password and email rows sit under mono 26/800-equivalent uppercase labels.

### Navigation
No nav bar — three screens and a verdict overlay, plain state. Movement is the navigation: in-row neighbours are wired to each other and to *self* at row edges; full-width neighbours are named explicitly; focus returns to the pick button ("Pick tonight's show") when you come back from a verdict, and to whatever was just pressed, via `hasTVPreferredFocus`. The header's right side carries the account chip (`slatHi` border, `dim` label; `sodium` label once signed in) and, when an update exists, a `sodium`-bordered "● update ready" chip.

### Signature: GridRow (the focus contract)
Every row is a `GridRow`: it injects each cell with its in-row neighbours' `nextFocus*` and points the ends at *self* — so a short row is inert at its edges instead of jumping diagonally. Vertical hops that geometry cannot find (into or out of full-width rows) are wired by hand. Deliberately not a `TVFocusGuideView` with memory: straight-down beats remembering where you were.

## Do's and Don'ts

### Do:
- **Do** scale every size through `s()` from the 1920 design space, and keep all content inside the 5% overscan inset.
- **Do** keep every row seven columns wide, with sized cells — a two-cell row leaves them in columns 1 and 2.
- **Do** state a size and its tracking together (`mono(size, {em})`); mono labels are uppercase and tracked ≥0.05em.
- **Do** carry focus with all four signals — ring, lift, brighten, elevation — and let solid controls rest one step dimmer (`sodiumDim`) so focus is a step up.
- **Do** pair `cold` with a second signal (strike-through, text) whenever it marks a state.
- **Do** keep the counter unanimated while a count is in flight; settle only a settled count, right to left.
- **Do** wire focus edges to self, and name full-width rows' neighbours explicitly.

### Don't:
- **Don't** introduce a shadow, glow, or gradient at rest — depth at rest is one indigo tone step, never a shadow.
- **Don't** use `sodium` as a rest-state fill on anything but the on-chip and the live handle; if everything is lit, nothing is.
- **Don't** use `cold` for anything but exclusion and warnings, or `chalk`/`dim`/`dimmer` out of order — `dimmer` is the floor of readable text.
- **Don't** add a second accent hue, a rounded pill (radius > 6px), or a circular container.
- **Don't** animate ambiently, springily, or on hover-analogues; motion is settle-and-detent only.
- **Don't** stretch cells, center orphan cells, or let focus leave a row diagonally.
- **Don't** invert the QR card to dark-on-light's opposite — scanners need the white ground.
