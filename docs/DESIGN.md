# Ember — design system

A single visual language across cmux, Ghostty, pi, Neovim, Sketchybar, JankyBorders,
AeroSpace and the desktop.

Source of truth: [`tools/tokens.mjs`](../tools/tokens.mjs).
Nothing in this document is decorative — every token below has one job, and
[`tools/check-contrast.mjs`](../tools/check-contrast.mjs) fails the build if a rule is broken.

---

## 1. What was wrong

The previous setup had a consistent accent (`#ff7a6b` coral) sitting on **neutrals borrowed from four
unrelated palettes**:

| Surface | Neutral used | Actually from |
|---|---|---|
| Ghostty | `#1f1f28`, full 16-colour palette | Kanagawa Wave |
| JankyBorders | `#3b4261` inactive | TokyoNight Storm |
| cmux | `#3B4261` pane border, `#1E1E2E` sidebar tint | TokyoNight + Catppuccin **Mocha** |
| Sketchybar | `#181926` / `#1e1e2e` | Catppuccin **Macchiato** header, Mocha values |
| pi | `#121012`, `#4b3d40` | a bespoke warm-brown ramp |

Ghostty's header comment claimed Catppuccin Macchiato while the file actually set
`theme = Kanagawa Wave`. Neovim was stock `tokyonight-moon` with no customisation at all.

Two consequences:

1. **Nothing matched.** Five different "dark grey" families, none of them the same hue.
2. **The accent fought the substrate.** Coral is warm (hue 32°); Catppuccin and TokyoNight neutrals are
   cold blue-greys (hue ~265°). A warm accent on a cold substrate reads as an accident.

There was also a semantic collision: coral sat **0.13 ΔE** from the error colour. A focused pane border
and a failing test were nearly the same colour.

---

## 2. The direction

**One accent, one neutral family, hues chosen by measurement rather than taste.**

The status hues are effectively reserved — amber 85°, green 150°, teal 195°, red 22°. The accent is
**ember orange, `#f5810f`, OKLCH hue 55°** — chosen by preference for warmth, then checked: a full-wheel
sweep at the accent's L/C shows 55° clears every gate, at 0.128 ΔE from error and 0.140 from warning.
Identity now lives in the warm band, between the two warm states; `check-contrast.mjs` is what keeps
that margin from ever regressing silently.

The neutral ramp shares the accent's hue family (42°) at very low chroma. The substrate agrees with the
accent instead of fighting it, and the ember looks chosen rather than dropped on top.

Colour is authored in **OKLCH**, not hex, so lightness steps are perceptually even. `hex()` gamut-maps by
reducing chroma while holding L and H, which keeps a ramp even after clipping.

---

## 3. The central rule

> **The accent is IDENTITY and FOCUS. It is never a STATUS.**

- The accent answers *where am I / what is active / whose thing is this*.
- Green, amber, red, teal answer *what happened*.

This is what lets a strong accent coexist with a full status palette. Two concrete consequences:

- cmux's notification badge is **amber**, not the accent. Previously it was coral — the same colour as
  the selection indicator — which made "this workspace is selected" and "this workspace needs you"
  visually identical. Attention is a status.
- pi's tool-call titles are bright neutral, not accent. They appear on nearly every line; accenting them
  would drown the accent and leave nothing to mean "focused".

The one sanctioned exception is **syntax highlighting**, a closed system where colour encodes grammatical
category and carries no status meaning. There, the accent marks functions.

---

## 4. Tokens

### Neutral ramp — hue 292°, chroma tapering as lightness rises

| Token | Hex | Job |
|---|---|---|
| `ink[0]` | `#0f0907` | terminal bg, app bg |
| `ink[1]` | `#19120f` | sidebar, statusline, tab bar |
| `ink[2]` | `#241c19` | floats, popups, tool-call blocks |
| `ink[3]` | `#312824` | selection, hover, active row |
| `ink[4]` | `#433935` | indent guides, subtle dividers |
| `ink[5]` | `#5d534f` | pane dividers, inactive edges |
| `ink[6]` | `#7c726f` | comments, timestamps, disabled |
| `ink[7]` | `#a59c99` | secondary text, labels, tool output |
| `ink[8]` | `#d1cac8` | body text |
| `ink[9]` | `#f3efed` | headings, cursor, emphasis |

### Accent — hue 305°

| Token | Hex | Job |
|---|---|---|
| `accent.wash` | `#401d00` | background of a selected-and-focused row |
| `accent.deep` | `#834100` | inactive-but-owned edges, quote bars |
| `accent.dim` | `#ca6800` | secondary accent text, operators |
| `accent.base` | `#f5810f` | **the** accent — focus ring, active pane, cursor |
| `accent.bright` | `#ffb685` | hover, headings |
| `accent.pale` | `#ffd6bc` | reasoning-effort ramp, upper stop |
| `accent.lit` | `#ffeee3` | reasoning-effort ramp, top stop |

The last two exist so the reasoning-effort scale can climb past the accent without leaving its hue. It
used to end in amber and yellow, which reads as a change of *kind* rather than of degree — and with
`xhigh` as the default it was not a ramp at all, just a permanently warm dot pretending to be a state.
With a warm accent the ramp stays in-family by construction. `check-contrast.mjs` now asserts the ramp climbs in lightness at every step and stays within
5° of hue.

### Status

| Token | Hex | Meaning |
|---|---|---|
| `success` | `#67d283` | added lines, passing, connected |
| `info` | `#4fcdcd` | links, bash mode, ports |
| `warning` | `#f1bf4e` | modified, pending, **needs attention** |
| `error` | `#f24e56` | removed lines, failing |
| `special` | `#8bafff` | meta, keywords, untracked |

### Chrome surface

The system bar, at `#414048` — deliberately **lighter than the border tone**
(`ink[4]`), so the desktop furniture reads as a layer above the windows instead of another near-black slab
merging into them.

This forces a second set: on a surface this light the darkest status colour, `error`, falls to **2.6:1**,
under the 3:1 WCAG non-text minimum — a low-battery icon has to be seen. `stateOnChrome` lifts each status
colour's lightness while keeping its hue and meaning, restoring `error` to 4.9:1. Anything drawn on the bar uses
that set; everything on a terminal background uses the normal one.

The notch island is the deliberate exception: it stays on `bgBase`, because it has to match the physical
bezel for the notch to read as carved out of it. A lighter fill turns it into a panel floating over the
notch instead of an extension of it — so it keeps the normal status set too.

`check-contrast.mjs` asserts `bgChrome` stays lighter than `borderMuted`, so nudging the ramp cannot
silently invert the relationship.

### Tinted surfaces

State-carrying block backgrounds, all at `ink[2]`'s lightness so blocks sit at one elevation and only the
hue moves: `tint(85)` pending, `tint(150)` success, `tint(22)` error, `tint(265)` meta.

### Categorical

For things that are merely *different*, not better or worse — cmux workspaces only. Even hue spacing at
fixed L 0.72 / C 0.145, so no workspace looks more urgent than another just because of the colour it drew.
Twelve entries: Ember, Rose, Red, Amber, Lime, Green, Jade, Teal, Sky, Blue, Iris, plus a colourless Slate.

---

## 5. Focus hierarchy

Three levels of "what is active" are on screen simultaneously. **Each uses a different mechanism**, which
is what stops them reading as competing rings:

| Level | Surface | Mechanism | Value |
|---|---|---|---|
| 1 — window | JankyBorders | thick ring **outside** the window | 4px accent, round |
| 2 — pane | cmux | thin line **inside** the window | 1px accent; inactive `ink[4]` |
| 3 — split | Ghostty / Neovim | **no border** — dim the content instead | opacity 0.82, divider `ink[4]` |

Rules:

- Only **one** surface may draw an accent-coloured ring at a time.
- Border width decreases as you go inward. The outermost ring only needs to be *found*, not shouted —
  which is why JankyBorders went from 8px to 4px.
- pi's own `border` token is neutral `ink[5]`, not accent, because pi renders inside a cmux pane that is
  already drawing an accent border. Nesting two accent outlines is the failure this table exists to prevent.
- Neovim `WinSeparator` is `ink[4]` and never accent, for the same reason.

---

## 6. Non-colour scales

**Spacing** — 4px base with a 2px half-step for dense terminal chrome:
`xs 2 · sm 4 · md 8 · lg 12 · xl 16 · xxl 24`.

**Radius** — `tight 4 · soft 8 · round 12 · pill`. There is deliberately no 2px: below 4px a radius reads
as a rendering artefact at HiDPI rather than a choice.

**Stroke** — `hairline 1 · regular 2 · focus 3 · window 4`. See the focus hierarchy for which surface may
use which.

**Motion** — `fast 90ms` (hover, selection), `base 140ms` (pane focus), `slow 180ms` (workspace
transitions), easing `cubic-bezier(0.32, 0.72, 0, 1)`. Nothing exceeds 180ms: terminal chrome sits next to
text you are actively reading, and anything slower reads as lag rather than polish.

**Type** — `micro 10 · small 11 · body 13 · reading 15 · heading 18`. Terminal type size is owned by
Ghostty's `font-size` and is deliberately not duplicated here.

---

## 7. Typography and icons

- **Terminal: JetBrains Mono Nerd Font, 14px, `adjust-cell-height = 10%`.** Kept after evaluation, not by
  default — every alternative considered (Berkeley Mono, IosevkaTerm, Monaspace, CommitMono, Maple Mono)
  is absent from this machine, so switching means adding a dependency. It earns the slot anyway: tall
  x-height at 14px, unambiguous `0/O` and `1/l/I`, and complete Nerd Font coverage for the glyphs
  Sketchybar, lazygit and the pi TUI all rely on. The 10% extra leading is the single highest-leverage
  readability setting for long sessions.
- **Prose is not monospace.** cmux's markdown viewer previously forced JetBrainsMono, so every README and
  PR body was read in a code font. It now uses the proportional system font at 15px, with `maxWidth` cut
  from 980px to 760px — 980px at 15px is ~120 characters per line, far past the ~70–80 where reading
  speed drops off.
- **Icons carry meaning, never decoration.** An icon may only use a status colour if it is reporting that
  status. Otherwise it takes `ink[7]`.

---

## 8. Active / inactive

- **Active** = accent, at full strength, on exactly one thing per level.
- **Inactive** = recede by *lowering contrast*, never by changing hue. An unfocused pane is the same
  colours at less contrast, so the eye reads "same kind of thing, not current" rather than "different
  kind of thing".
- Ghostty dims unfocused splits to `0.82` opacity rather than tinting them.

---

## 9. Notifications

Ranked by how much they interrupt. A signal may only escalate if the one below it is insufficient.

1. **Unread ring** on the pane — passive, always on.
2. **Dock badge / menu bar** — visible without switching.
3. **Sound + banner** — only `agentTurnComplete: whenIdle`, i.e. only when actually away.

Deliberate choices:

- `paneFlash` is **off**. The unread ring already owns "this pane has news", and a flashing pane edge
  competes with the focus border for the same visual channel — a coloured edge. Two unrelated meanings,
  one treatment.
- `suppressOnlyFocusedSurface` is **on**. Never interrupt about the pane already being looked at.
- Spinner sits **leading**, notification badge **trailing**. A spinner is transient ("busy") and a badge
  is persistent ("unread"); putting them in the same slot lets them trade places.

**Intentional deviation:** `swift/CmuxDock` adds a Dock tile showing aggregate agent state, worst-wins. It
sits between levels 1 and 2 — passive like the unread ring, but it survives cmux not being frontmost.

It obeys the ranking rather than breaking it, because **the tile only exists while there is something to
report**. An `.accessory` app has no Dock tile at all, so the app switches activation policy at runtime:
idle demotes to `.accessory` and the icon leaves the Dock entirely; any non-idle workspace promotes it to
`.regular` and the tile returns. Showing is immediate, hiding waits 4s — agent state flaps, and an icon
entering and leaving the Dock on every flap is worse than one that lingers.

Its ring is the accent only at rest, which is the one moment it is never seen. In practice the ring always
carries a state colour, because the tile is only visible when there is a state.

The count clears when cmux is focused, because focusing cmux *is* reading the notification. A badge that
only ever grows stops meaning anything.

---

## 10. Narrow and wide layouts

- **Narrow terminal**: pi's header and footer degrade *progressively* — segments drop in priority order
  (session name → branch → context → thinking → model) rather than hard-truncating, so the most important
  information survives. `render()` must never return a line wider than `width`.
- **Unicode width is not string length.** pi uses `Intl.Segmenter` graphemes plus east-asian-width, with
  RGI emoji and regional indicators pinned to width 2. Always measure with the `@earendil-works/pi-tui`
  helpers; `String.length` is wrong for emoji, CJK and Nerd Font glyphs.
- **Narrow sidebar**: cmux's notification preview is capped at 5 lines (was 8). Eight lines of preview
  pushed real workspaces off screen on a laptop display.
- **Wide**: `diffViewer.defaultLayout = split`, and markdown is capped at 760px rather than filling the
  window.

---

## 11. Validation

```bash
node tools/check-contrast.mjs        # palette gates — exits non-zero on failure
node tools/build.mjs --check         # generated configs match tokens
```

Gates enforced:

- Body text ≥ **7:1** (AAA) on every surface it can land on; secondary ≥ 4.5:1; dim ≥ 3:1.
- Status colours ≥ 4.5:1 on both `bgBase` and `bgPanel`.
- Focus border ≥ 3:1 against its background (WCAG 1.4.11 non-text), and ≥ 2.5:1 against the *inactive*
  border — otherwise the focus hierarchy collapses.
- **OKLab ΔE ≥ 0.10 between every status pair, and between the accent and every status colour.** Contrast
  ratio cannot see hue, so two colours can both pass contrast and still be indistinguishable. ΔE catches
  that. Added-vs-removed is held to a stricter 0.25 — it is the most consequential pair on screen.
- Neutral ramp strictly increasing in lightness.
