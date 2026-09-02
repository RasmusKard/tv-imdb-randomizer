---
name: what.watch
description: A projection booth at showtime — film black, one tungsten amber, every number on a mono ledger. Every px value below is a design-space px: the app is drawn at 1920x1080 and scaled to the real window width by s(n) = n x windowWidth / 1920.
colors:
  board: "#0A0A0C"
  boardLo: "#050507"
  tape: "#121114"
  slat: "#141417"
  slatHi: "#232329"
  slatLit: "#33333B"
  sodium: "#FFB02E"
  sodiumDim: "#C98622"
  onSodium: "#171200"
  onSodiumDim: "#4A3A08"
  cold: "#55CFE6"
  chalk: "#E8E6DC"
  dim: "#8A8878"
typography:
  display:
    fontFamily: "Archivo ExtraBold (useFonts key Archivo800)"
    fontSize: "136px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  action:
    fontFamily: "Archivo ExtraBold (useFonts key Archivo800)"
    fontSize: "28px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "0.12em"
  mono:
    fontFamily: "Chivo Mono Regular (useFonts key ChivoMono400)"
    fontSize: "24px"
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: "0.02em"
  monoBold:
    fontFamily: "Chivo Mono Bold (useFonts key ChivoMono700)"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "0.02em"
rounded:
  xs: "2px"
  sm: "3px"
spacing:
  xs: "4px"
  sm: "6px"
  md: "8px"
  col: "12px"
  lg: "18px"
  xl: "20px"
  xxl: "28px"
components:
  button-solid:
    backgroundColor: "{colors.sodiumDim}"
    textColor: "{colors.onSodium}"
    typography: "{typography.action}"
    rounded: "{rounded.sm}"
    height: "80px"
  button-solid-focus:
    backgroundColor: "{colors.sodium}"
    textColor: "{colors.onSodium}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.sodium}"
    typography: "{typography.action}"
    rounded: "{rounded.sm}"
    height: "80px"
  button-ghost-focus:
    backgroundColor: "{colors.sodium}"
    textColor: "{colors.onSodium}"
  button-disabled:
    backgroundColor: "transparent"
    textColor: "{colors.dim}"
    typography: "{typography.action}"
    rounded: "{rounded.sm}"
    height: "80px"
  chip-off:
    backgroundColor: "{colors.slat}"
    textColor: "{colors.dim}"
    typography: "{typography.mono}"
    rounded: "{rounded.sm}"
    height: "58px"
  chip-on:
    backgroundColor: "{colors.sodium}"
    textColor: "{colors.onSodium}"
    typography: "{typography.monoBold}"
    rounded: "{rounded.sm}"
    height: "58px"
  chip-excluded:
    backgroundColor: "{colors.boardLo}"
    textColor: "{colors.cold}"
    typography: "{typography.mono}"
    rounded: "{rounded.sm}"
    height: "58px"
  input:
    backgroundColor: "{colors.slat}"
    textColor: "{colors.chalk}"
    typography: "{typography.mono}"
    rounded: "{rounded.sm}"
    height: "64px"
    padding: "0 16px"
  tag:
    backgroundColor: "transparent"
    textColor: "{colors.dim}"
    typography: "{typography.mono}"
    rounded: "2px"
    padding: "9px 20px"
  receipt:
    backgroundColor: "{colors.tape}"
    textColor: "{colors.dim}"
    typography: "{typography.mono}"
    rounded: "{rounded.sm}"
    height: "76px"
    padding: "0 22px"
  receipt-focus:
    backgroundColor: "{colors.tape}"
    textColor: "{colors.dim}"
---

# Design System: what.watch

## Overview

**Creative North Star: "The Projection Booth at Showtime"**

The screen is a projected frame. Every surface sits on film black, the frame's own edges carry sprocket strips, and one tungsten amber — the gate light — carries every signal that matters: focus, inclusion, the count, the pick. Emulsion-white Archivo caps stand in the gate glow for titles; Chivo Mono is the booth's ledger, carrying every number and label, tracked wide enough to read from three metres. The verdict screen is the direction's proof surface: a leader countdown in hard cuts, the title standing in the gate glow, and the active filters remembered on a strip of leader tape.

Depth is material and light, never drawn shadows: a six-step ladder of near-black surfaces (boardLo up to slatLit) does the structural work, and glow is volumetric warmth through that material — layered translucent amber shells and SVG radial gradients, not neon edges. Motion happens in hard steps, never easing: the thread-up is three 240 ms cuts, the split-flap counter settles digit by digit, and reduce-motion skips both whole. State is never hue alone: exclusion strikes the label through as well as turning it cyan, and focus is three signals at once — ring, lift, brighten — because TV panels are colour-calibrated by strangers.

The world refuses poster-carousel streaming chrome: no columns of rules between board sections (rhythm does the separating), no cue marks on the frame, no chase animation on the sign — the marquee is lit and static by owner decision, and ray-fan and baked-emission textures were tried and removed; the CSS glow shells are the shipped glow.

**Key Characteristics:**

- Film-black ground with a six-step near-black surface ladder; one amber lamp, one cyan cue, one emulsion white
- Two Omnibus-Type faces: Archivo ExtraBold for display and actions, Chivo Mono 400/700 for the ledger — every number is mono
- Drawn at 1920x1080, scaled by window width through s(); 5% overscan inset on every edge; a 7-column grid with sized cells
- Hard-step motion, reduce-motion honored by skipping whole
- States as mark patterns (strike-through, lift, ring, chevrons), never hue alone
- Glow as room light through material, static; no text shadows, no neon outlines

## Colors

A narrow warm band on an ink field: two ambers, one cyan, one white, and a ladder of blacks — nothing else carries meaning.

### Primary
- **Tungsten Amber** (sodium, #FFB02E): the gate light. Focus rings, included chips, the live slider handle, the settled count, the pick button at focus, the reel core. The brightest thing on any screen.
- **Amber at Rest** (sodiumDim, #C98622): the solid pick button before focus — taking focus is a visible step up in brightness, which is the only reason this token exists.
- **Ink on Amber** (onSodium, #171200) and **Dim Ink on Amber** (onSodiumDim, #4A3A08): text on amber fills; the dim step is a chip's second line.

### Secondary
- **Cue Cyan** (cold, #55CFE6): exclusion and warning only — the excluded genre, the never-show strike, thin-corpus and error notices, the "− genre" on the leader tape. It never marks focus and never fills a control.

### Neutral
- **Film Black** (board, #0A0A0C): the unlit ground of every screen.
- **Leader Black** (boardLo, #050507): deeper than the ground — the slider track groove, excluded chip fills, the leader overlay.
- **Leader Tape** (tape, #121114): the receipt strip, one step above the ground.
- **Slat** (slat, #141417): the raised film surface — chips at rest, inputs, cards, the poster panel.
- **Slat Edge** (slatHi, #232329): hairline rules, borders, slider handles at rest, flap tiles.
- **Lit Slat** (slatLit, #33333B): a handle once its slider has focus — the surface one step more lit.
- **Emulsion White** (chalk, #E8E6DC): titles, primary text, the focused solid button's border.
- **Dim Silver** (dim, #8A8878): muted labels, unselected chip names, the receipt body.
- **Dim Silver** (dim, #8A8878): muted labels, unselected chip names, the receipt body, the flap tiles' quiet digits — the one de-emphasis step below lit text.

Amber light also appears as alpha steps of the same hex — rgba(255,176,46,0.12/0.16/0.18/0.22/0.32) for glow shells, chip focus tints and the armed slider — and chalk as rgba(232,230,220,0.03–0.25) for the sign panel, sprocket strips and leader ring. These are the lamp at intensities, not new colors. The one surface outside the palette is the QR card on the import screen, which renders white because scanners read dark-on-light far more reliably; it is a machine target, not part of the booth. The phone-side upload page it opens is the same kind of machine target, set in the phone's own system UI at phone sizes.

### Named Rules
**The One Lamp Rule.** One tungsten amber carries all light: focus, inclusion, the count, the primary action. Cyan is the only second voice and it speaks exclusively for exclusion and warning. Nothing else may brighten.

**The Mark-Pattern Rule.** No state is hue alone. Excluded strikes the label through as well as turning it cyan; focus is ring + lift + brighten; the live slider handle gains drawn chevrons. If a stranger calibrates the panel, every state must still read.

## Typography

**Display Font:** Archivo (Omnibus-Type), ExtraBold 800, uppercase, line-height 1.1
**Body/Ledger Font:** Chivo Mono (Omnibus-Type), 400 and 700, line-height 1.25
**Label/Mono Font:** Chivo Mono — there is no third face; the ledger is the body

**Character:** An Argentine poster-and-signage foundry pairing: heavy grotesque caps for what the booth shouts, a wide-tracked mono for what it counts. Every text style is one of four recipes (mono, monoBold, display, displayHeavy), each fixing its face, line-height and tracking so a size and its tracking cannot drift apart.

### Hierarchy
- **Display** (Archivo 800, 136px, lh 1.1, −0.02em, caps): the verdict title, one per night. Long titles (>15 chars) drop to 88px and past 44 chars to 64px, so a two-line title stays one dramatic line (a main column at 136 fits ~15 caps, 88 ~22, 64 ~30); the thread-up numeral is the same face at 150px — the one digit Archivo carries, a display moment rather than data.
- **Headline** (Archivo 800, 32px, −0.02 to −0.03em): the wordmark what.watch on every screen header.
- **Action** (Archivo 800, 28px, +0.12em, caps): button labels only, and never a digit — versions live in the ledger.
- **Body/labels** (Chivo Mono 400, 18–30px, lh 1.25, +0.02 to +0.2em): the workhorse size is 24px for tracked-caps chrome labels; 26px mixed-case plot, changelog and step text (plot line-height 42); 22–23px for tags, log lines and quiet notes; 18px for the corpus aside and the TMDB credit. Tracked caps step through four widths only: 0.02em on selections, 0.08em on receipts, 0.1em on warnings and meta lines, 0.2em on labels.
- **Numbers** (Chivo Mono 700, 24–44px): the score at 44, flap digits at 34, the update version at 32, handle values, the progress percent and the receipt count at 26. Numbers set in the mono; groups of thousands separated by spaces (534 836) wherever a count is shown whole. Two deliberate compressions: slider handles and the receipt abbreviate (534K, 1M+) because a 124px handle cannot hold nine digits, and the split-flap tiles read digit-by-digit ungrouped — the grouped corpus note sits right beside them.

The projection is fixed: text never rescales with the system font size (`allowFontScaling` is pinned app-wide, because every row is fixed-height and s() is the only scale). Readability at three metres is designed in, not delegated to a setting.

### Named Rules
**The Ledger Rule.** Every number is set in Chivo Mono — counts, scores, years, votes, handle values, versions. Archivo never carries a digit.

**The Caps-for-Chrome Rule.** Uppercase plus wide tracking is reserved for chrome: section labels, buttons, meta lines, receipts. Selections (genre names, band names, type chips) read in mixed case — a wall of tracked caps across 21 genres was noise, not broadcast clarity.

## Layout

Everything is drawn in a 1920x1080 design space and scaled once at module load: s(n) = n x windowWidth / 1920 (a TV never rotates or resizes; a 1080p set reports ~960dp, so s(n) there is n/2). Every size in this document is a design-space number.

Every screen sits on the board ground inside a 5% overscan inset on all four edges (percentage padding resolves against the width, so every edge carries the same 96px band), so nothing lands on a bezel. The board is a 7-column grid: column gap s(12), cell width computed from the inset content width (cell = (contentWidth − 6 x gap) / 7), a cell spanning n columns is span(n) = n·cell + (n−1)·gap. Cells are sized, never flexed. Spacing rhythm on the board: header padding-bottom s(8) over a hairline on every screen; the cadence is gap contrast — s(4) inside a block, s(14) between blocks (blocks padding-top s(2)); each block gap s(4) under a 28px block head; a hairline above every dock (padding-top s(2)); wider gaps s(18–28) on the verdict. The verdict main column spans 5, the poster 2 (2:3 aspect); its action buttons share the main's five columns equally (three when Plex matched, two otherwise); the pick button on the board spans 3, the warning column 4; account and import forms span 4; the import dock shows three span(2) buttons — paste mode replaces pick mode, because four would be eight columns.

The counter lives in the header corner — "Titles left:" label, split-flap digits, a dim "(out of N)" corpus note — because it is feedback, not a control; the dock holds only the warning line and the pick button ("Pick tonight's show" / "Pick another"). Focus order is a contract, not a suggestion: down is straight down, short rows are inert at their own edges, and full-width rows are wired explicitly because Android's FocusFinder scores by centre distance.

### Named Rules
**The Straight-Down Rule.** Cells are sized, not flexed, so columns line up and down is straight down — the property that lets someone count presses to a target. A two-cell row leaves its cells in columns 1 and 2 rather than stretching them.

## Elevation & Depth

This system draws no drop shadows. Depth is conveyed two ways: by material — the near-black ladder boardLo < board < tape < slat < slatHi < slatLit, each step a surface one step more lit — and by light: the verdict's Gate SVG (a sodium cone from below at 0.1, a chalk wash above at 0.05, a broad chalk bloom behind the title at 0.1/0.045). On device the title bloom's falloff is smooth with no seam.

### Shadow Vocabulary
- **Focus lift** (scale 1.05 on chips, 1.03 on buttons; elevation 12; zIndex 3): the only "lift" in the system — a transform plus draw order, no drawn shadow.
- **Reel-core halo** (shadowColor sodium, shadowOpacity 0.3, shadowRadius s(30), elevation 6): the one warm native shadow, on the reel placeholder's core.

### Named Rules
**The Gate Light Rule.** Glow is volumetric warmth through material — layered translucent amber shells or SVG radial gradients that light the room. It is never a text shadow (an Android text shadow ends in a visible edge; the title bloom lives in the Gate gradient instead), never a neon outline on a shape, and never animated: the sign is lit and static by owner decision.

## Shapes

Corners are machine-cut, near-square: radius s(3) on controls and surfaces (chips, buttons, inputs, cards, receipt, poster), s(2) on tags. Borders are structural: 2px borders (s(2)) on chips, buttons and the receipt; StyleSheet.hairlineWidth rules everywhere else — under the header, above the dock, across the poster foot, down the flap hinge. Sprocket holes (s(18) x s(13), radius s(3)) run full-bleed along the frame's top and bottom edges on a chalk 5% strip: the film runs off the screen.

### Named Rules
**The Rhythm-Not-Rules Rule.** Board blocks are separated by spacing rhythm alone — no vertical column rules between sections (removed by owner decision), no cue marks on the frame. Hairlines appear only at true boundaries: under the header, above the dock, inside cards.

## Components

### Buttons
- **Shape:** near-square (radius s(3)), 2px border, height s(80), Archivo 800 caps at 28px / +0.12em.
- **Solid (primary):** fills sodiumDim at rest with onSodium ink, so focus is a step up in brightness to a full sodium fill, chalk border, scale 1.03 — scale alone is not readable focus on a large filled shape.
- **Ghost (secondary):** transparent face, sodium border and sodium ink at rest; fills sodium on focus. The fill is the focus state, not a resting variant.
- **Disabled:** transparent face, slatHi border, dim ink — no lamp at all. It stays focusable (an unfocusable cell would trap D-pad navigation) and shows the focus ring only, so it reads reached-but-inert.
- **Motion:** no transitions; states step.

### Chips
- **Style:** one grid cell wide; height s(54) with a sub-line (type, bands) — content-height, the mono leading is the padding — or s(44) single-line (genres); slat fill, transparent 2px border at rest, radius s(3); mixed-case Chivo Mono 22px (+0.02em; genre names 24px), sub 18px.
- **States:** off (slat, dim ink) / on (sodium fill and border, bold onSodium ink, onSodiumDim sub) / excluded (boardLo fill, cyan border, cyan ink struck through). Focus on any state: sodium ring, scale 1.05, lift; off-state ink brightens to chalk.
- **Genre chips cycle** off → include → never show, and the state rides the accessibility label ("included", "never show").

### Range Slider
One focus cell, not two handles: OK walks lower → upper → done (hinted in the block's aside while armed), arrows adjust with a 380 ms dead zone then a constant 100 ms repeat — no acceleration. While armed, every nextFocus direction points at itself. The slat tints amber (0.17 focused, 0.32 armed) instead of taking a ring — a ring around a full-width element reads as an alarm. Handles (124 x 44) sit slatHi at rest, slatLit when the row has focus, sodium when live; the live handle shows drawn SVG chevrons, never typed arrows. Track: boardLo groove, hairline slatHi edge, sodium fill at 0.22 for a whole axis at rest (an untouched range is not a choice), 0.45/0.75/1 by state once narrowed.

### Flaps (split-flap counter)
Six slatHi tiles (44 x 56, radius s(3)) with a hairline hinge, bold mono digits (34px): settled digits sodium, leading zeros and the in-flight "≈" dim — one de-emphasis step, holding 3:1 on the tile. A settled count settles right-to-left — 200 ms base plus 75 ms per digit on a 45 ms tick — and reduce-motion skips it entirely. Only the digits that changed flip: a pick that takes the count down one moves exactly one flap, so the motion states the fact and nothing more.

### Inputs / Fields
Slat fill, slatHi 2px border, radius s(3), chalk mono text (30px, height s(64)), dim placeholders. Remote typing is miserable, so forms are exactly two fields. A TV TextInput that holds focus eats the D-pad for its caret, so fields are rows first — the slider's grammar: OK opens the row for typing (sodium border while open), DONE or back closes it and focus returns to the row. Every screen owns its initial focus so arrows always have an anchor.

### Cards / Containers
Slat fill, slatHi 2px border, radius s(3), internal padding s(16) and gap s(12) — the update card is the instance: version in amber mono bold 32, three changelog lines in chalk mono 26 (the account screen has no scroll; more lines would push the version row off the inset), progress as a sodium fill in a slatHi track. No shadows; the border is the card.

### Receipt (leader tape)
Full-width strip (height s(76), tape fill, slatHi 2px border, radius s(3)) along the verdict's bottom: the active filters in tracked-caps mono 24 (+0.08em) dim ink, "+ genre" in sodium, "− genre" in cyan struck through, and the remaining count in bold sodium at the right end. It doubles as the way back to the board; focus is a sodium border only.

## Do's and Don'ts

### Do:
- **Do** draw every size through s() from the 1920x1080 design space, and keep every screen inside the 5% overscan inset.
- **Do** give focus three signals — sodium ring, scale lift (1.05 chips / 1.03 buttons), brighten — and nothing else.
- **Do** keep selections in mixed case; reserve uppercase plus wide tracking for chrome.
- **Do** set every number in Chivo Mono, thousands grouped with spaces.
- **Do** move in hard steps (240 ms thread-up cuts, 200+75 ms flap settle, constant 100 ms key repeat) and skip motion whole under reduce-motion.
- **Do** keep disabled controls focusable and dim — the D-pad must be able to pass through them.
- **Do** draw glow as SVG radial gradients (the title bloom lives in the Gate), never as a text shadow.

### Don't:
- **Don't** use a text shadow for glow — on Android it ends in a visible edge.
- **Don't** use Android boxShadow for coloured glow — it renders gray.
- **Don't** build a marquee letterform sign — a bulb-matrix NOW SHOWING was built, resized, repositioned, and scrapped by owner decision; the verdict opens straight onto the score and title, and the frame (sprockets, gate light) carries the booth alone.
- **Don't** add column rules between board blocks or cue marks on the frame — rhythm separates, hairlines live only at true boundaries.
- **Don't** mark a state with hue alone, and never let cyan mean anything but exclude/warn.
- **Don't** flex or stretch grid cells, and never widen a control past its span(n) — down is straight down.
- **Don't** introduce an easing curve, a third accent colour, or a display face besides Archivo; don't set selections in caps.
