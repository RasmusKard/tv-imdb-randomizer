# Proposal: the two-point slider without the OK-walk

**Status:** Option B ("focus is the mode") was picked and is implemented — see `src/components/RangeSlider.tsx`, `src/lib/range.ts` (`blocked`/`driver`), and the DESIGN.md RangeSlider section. This document stays as the record of the alternatives and the reasoning.
**Scope:** the interaction grammar of `RangeSlider` (src/components/RangeSlider.tsx), its wiring in `Board.tsx`, and the DESIGN.md RangeSlider section. Visual identity (one focus row, two pills, amber fill, drawn chevrons, mono numerals) is preserved by every option.

---

## 1. The problem

The slider is one focus cell and OK walks it: **OK arms the lower end → OK switches to the upper end → OK exits**. Values apply live while arrows move, which is right — but the *ceremony* around the arrows is three presses deep, and the walk is a mode:

| Complaint | Where it comes from |
|---|---|
| "OK to start, OK again to switch, OK to exit" | the walk itself: 3 OK presses of pure overhead per tuning visit |
| "messing with navigation" | while armed, **all four nextFocus directions point at the slider itself** — up/down are dead until you finish the walk or press Back |
| needs teaching | the aside hint `ok: lower · upper · done — arrows adjust` exists because nothing on screen would otherwise reveal the convention |

Concretely, from a band chip, nudging the floor 7.0 → 6.5 and going back down to the bands costs today: **↑ OK ←×5 OK OK ↓** — six presses, three of them ceremony, and the ↓ only works at the very end. The band presets (one press) are ergonomically *cheaper than fine-tuning the thing they shortcut into*, which inverts their relationship.

---

## 2. What the research says

**Android's own platform semantic: focus = adjust, no OK.** `SeekBarPreference` with `adjustable=true` transfers DPAD left/right straight to the bar and deliberately does **not** consume DPAD_CENTER (it falls through). A focused Android slider is already in its adjusting state; there is no arm step. ([SeekBarPreference source](https://android.googlesource.com/platform/prebuilts/fullsdk/sources/android-28/+/refs/heads/androidx-lifecycle-release/androidx/preference/SeekBarPreference.java))

**tvOS: the same.** Sliders are single focus items; directional input on the focused control adjusts its value (the "adjustable focus item" concept), and the focus engine keeps exactly one focused element at a time. ([About focus interactions for Apple TV](https://developer.apple.com/documentation/uikit/about-focus-interactions-for-apple-tv), [WWDC 2016 session 215](https://nonstrict.eu/wwdcindex/wwdc2016/215/))

**The accessibility standard's answer for two thumbs: two focus stops, not a mode.** WAI-ARIA APG multi-thumb: each thumb is separately focusable, arrows adjust the focused thumb, and — the part that matters for us — *the stop order stays constant regardless of where the thumbs visually sit*. ([Slider (Multi-Thumb) Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/slider-multithumb/))

**Game/console UI never solved dual-range either.** Devforum threads converge on two camps: (a) hold-a-modifier to grab the knob (a lock), or (b) reserve left/right while focused — and (b) only works because game sliders are single-ended. Consoles ship bumpers/triggers for coarse steps; our remote has none — **the band rows are this app's bumpers**. ([Roblox DevForum](https://devforum.roblox.com/t/how-would-you-implement-slider-controls-for-gamepad/2148986), [Unity discussions](https://discussions.unity.com/t/gamepad-support-878706/878706))

**Modes on TV are where mode errors bite hardest.** Poorly signaled modes cause errors, and a lean-back user with five buttons has no escape hatch; WCAG 2.1.2 (No Keyboard Trap) requires a trap to be escapable with unmodified keys — ours technically is, but only via the walk's own vocabulary. ([NN/g: Modes](https://www.nngroup.com/articles/modes/), [WCAG 2.1.2](https://www.w3.org/WAI/WCAG22/understanding/no-keyboard-trap.html))

**Nobody ships this control.** androidx.tv / Compose TV Material has no RangeSlider — not even a plain TV Slider ([component list](https://composables.com/jetpack-compose/androidx.tv/tv-material/components)); every TV app that needs ranges either uses preset chips or rolls its own mode. The OK-walk we have is a decent invention — it just costs too much per visit.

**This app already owns the right idiom:** genre chips are one cell whose OK *cycles internal state* (off → include → never show), marked by a pattern, never hidden. The slider's OK-walk is the same idiom — it just spends its cycles on *sequence position* (lower → upper → done) instead of on *meaning*, and three of its states are ceremony.

---

## 3. The design space

Two independent values, one horizontal axis, five buttons. Left/right must both **adjust** and (sometimes) **switch ends**; up/down is contractually navigation ("down is straight down", PRODUCT.md principle 2). Every solution is one of four families:

1. **Ceremony modes** — OK arms/switches/exits (what we have). Explicit, teachable, expensive.
2. **Focus-is-the-mode** — the focused row is already adjusting; one key remains to switch ends (OK). Platform-consistent, mode-free.
3. **Split the ends** — give each end its own row/cell so no key ever switches (ARIA's answer, laid out for a D-pad). Zero ceremony, costs layout.
4. **Mind-reading rules** — infer the end from the direction pressed. No extra key ever. Analyzed and rejected — see §7.

---

## 4. Option A — "the walk, untrapped" (minimal repair)

**One sentence:** keep OK-walk, but up/down always navigates (exiting the walk), and the third OK state is gone because leaving *is* exiting.

- OK arms the **last-driven end** (sticky per axis, default lower) — returning to the slider you tuned keeps its end.
- Arrows adjust; **up/down work while armed** and simply close the walk and move focus (values are live-applied, nothing to commit). Back still closes.
- OK toggles lower ↔ upper (a cycle, like the genre chips — no "done" state to walk to).
- Hint aside updates: `ok swaps ends · arrows adjust — leave anytime` (shown while armed, as today).
- Everything else — the trap on left/right (inert anyway: a full-width row has no horizontal neighbours), the repeat ramp, the armed tint, `editing` plumbing — unchanged.

| Tune | Presses today | Presses A |
|---|---|---|
| floor 7.0→6.5 from bands | ↑ OK ←×5 OK OK ↓ | ↑ OK ←×5 **↓** |
| 6.0–8.0 from Any | ↑ OK →hold OK ←hold OK ↓ | ↑ OK →hold OK ←hold **↓** |

- **Risk:** near zero. Strictly fewer presses, no new concepts, the taught convention survives in modified form.
- **Weakness:** still a mode; still needs the first OK before arrows mean anything; the hint is still load-bearing.
- **Diff:** ~25 lines in RangeSlider (step() toggle, untrap up/down, sticky side) + Board hint copy. `checks.ts` untouched.

---

## 5. Option B — "focus is the mode" (the amber end) ★ recommended

**One sentence:** a focused slider is already adjusting — its **amber end** (chevrons, as today's live handle) takes every left/right immediately, OK moves the amber mark to the other end, and up/down is always navigation.

### The rules (all five are one sentence each)

1. **A focused slider always shows one live end** — chevrons on it, exactly today's live-handle mark. On first focus the sticky end is live (per axis, session-persistent, default lower).
2. **Left/right drive the live end immediately.** No arm press. Values apply as they move (unchanged), the repeat ramp unchanged.
3. **A direction the live end cannot take goes to the other end.** If the live end is blocked (axis wall, or its partner one step away so `nudge` produces no change), the amber mark transfers and the *other* end takes that step. This is the rescue for the commonest first gesture: from `Any`, focusing the slider and pressing **left** — the lower end is at the wall, so the ceiling takes the step and the hold narrows from above. It also fires mid-session whenever the sticky end is against a wall.
4. **OK transfers the amber mark without moving.** The one explicit end-switch — the genre-chip idiom: OK cycles the cell's internal state, marked by chevrons, never hidden.
5. **Leaving is navigating.** Up/down always work (to Type row / band row), focus-out closes, Back needs no special case — the BackHandler and the four-direction self-trap are deleted. There is no exit because there is nothing to exit.

A hold never re-evaluates mid-stream: the transfer (rule 3) can happen only at a press's first notch; continuation drives the current live end and visibly bonks at walls. No hold can ever silently move *both* ends.

### Visual states (today's vocabulary, one new mark)

| State | Row | Live end | Other end |
|---|---|---|---|
| focused, untouched | amber 0.17 tint (today's `sliderFocused`) | **dim chevrons** (the one new mark) | `lit` |
| driving (moved this focus) | amber 0.32 tint, fill 1.0 (today's `sliderArmed`) | sodium + chevrons (`live`) | `dim` |

The new dim-chevron preview is what kills the mode error: you can read *which end the arrows will move* **before** pressing, which is exactly the signaling the mode research demands. Hint aside shows while focused: `arrows tune the amber end · ok swaps ends`.

| Tune | Presses today | Presses B |
|---|---|---|
| floor 7.0→6.5 from bands | ↑ OK ←×5 OK OK ↓ | ↑ ←×5 **↓** (0 OK) |
| ceiling 10→8.0 from Any | ↑ OK OK ←hold OK | ↑ ←hold **↓** (0 OK — rule 3) |
| 6.0–8.0 from Any | ↑ OK →hold OK ←hold OK ↓ | ↑ →hold OK ←hold **↓** (1 OK) |

- **The honest cost:** a stray horizontal press on passthrough (crossing the row vertically) now moves an end one notch instead of doing nothing. It is visible (tint + chevrons + the count), correctable in one press, and it is the *platform's own trade* — a stray press on any focused Android SeekBar moves it too.
- **Wrong-end presses** (sticky end isn't the one you meant, mid-band): the amber mark makes them readable instantly; one OK + re-hold recovers. Blocked-end presses self-rescue via rule 3.
- **Code impact — net simpler than today.** Deleted: the three-state walk, the BackHandler, all four `nextFocus* = self` trap wires, the `selfNode` prop. Kept: `editing` as a board-wide **driving** guard (entered by the first arrow instead of OK — the touch/IR race it guards against is unchanged), `valueRef` pattern, repeat ramp, band-freeze. Added: sticky side (component-local state), blocked-transfer (~15 lines around a pure helper `blocked(axis, value, side, dir)`), dim-chevron state. Roughly −60/+45 lines in a file whose comments already carry the harder knowledge.
- **TalkBack:** label gains the live end — `Rating, 6.0 to 10, lower end active` — and updates on transfer/OK (announce on change needs on-device verification; every state is spoken is a product commitment).

---

## 6. Option C — "two ends, two rows" (the ARIA-honest split)

**One sentence:** each axis gets two full-width single-ended rows — **min** and **max** — each behaving exactly like every native TV slider (focus = adjust, left/right steps, no OK anywhere).

- Zero new conventions: each row is the platform semantic (Android `adjustable`, tvOS adjustable item). No chevrons needed — the focused row is the adjusted row. No modes to teach, ever.
- Board grows by one row per axis. Today's block: head 28 + slider 50 + gap 4 + bands 54. Two 36px end-rows: head 28 + 36 + 4 + 36 + 4 + bands 54 → **+26px per axis, +78px total** against maybe 60–80px of observable slack (probe-screen.png). Fits only after a spacing audit (block gaps 14→12, notice/dock paddings) — and the board visibly thickens: six slider rows plus three band rows makes the board read as *all sliders*.
- The single-glyph range visual — the amber band between two pills, the at-a-glance fact the receipt later restates — is lost; two separate fills say "two numbers", not "one band".
- Focus chain: Type ↓ min-row ↓ max-row ↓ bands (straight-down preserved; `registerFirst` wiring gains one hop). Band-freeze applies to both rows while either drives.
- **This is the zero-ceremony endgame** — if the board ever gets a layout pass that finds 80px, C beats B on purity. Today it buys mode-freeness with the two things the board can least afford: vertical space and visual calm.

---

## 7. Rejected patterns, with the traces that killed them

**Direction owns the end (no OK ever):** e.g. left→ceiling, right→floor. Direct for both *narrowing* motions always — but widen-below then drags the **ceiling** from 10 down to 7.1 before any handoff (band 7.0–10, wanting floor 5.0: the innocent end silently crosses the axis). The mirror mapping (widen-first) fails ceiling-down the same way. Every direction→end mapping has a trace where a hold silently moves an end the user never selected. Mind-reading corrupts; it doesn't merely annoy.

**Push-through handoff (bonk transfers to the partner on contact):** floor 7.0–8.5, hold right wanting ceiling→10: the floor slides 7→8.4, bonks, hands off, ceiling rises — end state **8.4–10**, not 7–10. One hold, two ends moved. Option B's rule-3 transfer is deliberately narrower: it fires only when the live end is *blocked*, only at a press's first notch, and a hold then stays on one end.

**Grab / hold-modifier (hold OK to take the knob):** the "lock" the user is asking to remove; and on this event stream OK is undeliverable as a modifier — `useTVEventHandler` surfaces center as a single ACTION_UP, with no DOWN to grab on.

**Up/down adjusts, left/right switches:** breaks the straight-down contract (PRODUCT.md principle 2) and every row-to-row hop on the hottest paths on the board.

**Two half-width cells in one row (min-slider | max-slider):** left/right must then both walk cells and adjust the focused cell — the same collision one level down, unresolvable.

**Numeric entry / keypad overlay:** the product's answer to remote typing is "never"; an overlay is a bigger mode than the one being removed.

---

## 8. Recommendation

**Option B.** It is the only option that satisfies both stated wants literally — values change with the first arrow (no lock-in), and navigation is never blocked (no trap) — while *reducing* the component's state machine (no walk, no BackHandler, no self-trap). It inherits Android's own focused-slider semantic, reuses the app's genre-chip idiom for OK, and answers the mode-error research with the always-visible amber mark. Option A is the fallback if the stray-press trade is judged unacceptable; Option C is the one to revisit if the board ever gets a layout pass.

**Migration path (when picked):**
1. Pure helper first: `blocked(axis, value, side, dir)` + transfer selection in `src/lib/range.ts`, with cases in `src/lib/checks.ts` (walls, partner-step, both-blocked) — the repo rule is typecheck + checks green, and principle 1 is "checkable without a device".
2. RangeSlider: enter driving on first arrow, OK transfer, delete walk/BackHandler/self-trap, add dim-chevron focus state and sticky side.
3. Board: hint copy, drop `selfNode` plumbing; `focusedKey` already exists for the hint condition.
4. Rewrite the DESIGN.md **RangeSlider** section (it documents the OK-walk as the incumbent contract) and the aside grammar.
5. On-device pass (per the Android reference): adb key sweeps for the three scenarios in §5's table, TalkBack announcements on transfer, passthrough stray-press feel, reduce-motion unaffected (no new motion), band-freeze while driving.

**Micro-decisions left to implementation:** the hint's exact wording (voice: lowercase, plain, no exclamation); whether the hint retires per-axis after the first OK-swap of a session (today's hint retires when the walk ends); the dim-chevron ink (onSodium at reduced alpha vs chalk at low alpha — must pass the 3-metre/one-lamp checks and never read as a second focus ring); TalkBack announce mechanism for transfers.
