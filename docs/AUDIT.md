# UX audit — state before the Iris redesign

Captured 2026-07-25 on macOS 25.5.0, MacBook Pro with a 3024×1964 Liquid Retina XDR display.
Every version below was read off the installed binary, not assumed.

| Surface | Version |
|---|---|
| Ghostty | 1.3.1 (Zig 0.15.2, CoreText + Metal) |
| cmux | app bundle at `/Applications/cmux.app` (no `--version` output) |
| pi | 0.82.1 |
| Neovim | 0.12.4 / LuaJIT 2.1, LazyVim 16.0.0, lazy.nvim 11.17.5 |
| Sketchybar | v2.24.0 |
| JankyBorders | v1.9.0 |
| Zsh | Powerlevel10k, no plugin manager |

---

## 1. The headline finding: four palettes, one accent

Confirmed by reading resolved values, not file comments.

- **Ghostty's header comment was wrong.** Line 3 claimed "Catppuccin Macchiato"; line 68 set
  `theme = Kanagawa Wave`, and `+show-config` resolved `background = #1f1f28`, `foreground = #dcd7ba`.
  Macchiato would be `#24273a`/`#cad3f5`. The comment had been wrong since the theme was last changed.
- **Two coral overrides silently beat the theme.** `cursor-color` and `selection-background` were both
  set to `#ff7a6b` inline. They sit *before* `theme =` in the file and still win, because Ghostty applies
  explicit values over theme values regardless of order. The real palette was therefore impossible to
  read off the file.
- **JankyBorders** used `#3b4261` (TokyoNight Storm) as inactive.
- **cmux** used `#3B4261` (TokyoNight) for pane borders and `#1E1E2E` (Catppuccin **Mocha**) for the
  sidebar tint, while its workspace colours were Catppuccin **Macchiato**.
- **Sketchybar** declared "Catppuccin Macchiato" in its header but mixed Macchiato crust `#181926` with
  Mocha `#1e1e2e` / `#313244` / `#45475a`.
- **pi** used a bespoke warm-brown ramp (`#121012`, `#201a1c`, `#4b3d40`) unrelated to all of the above.

Net: five different "dark grey" families under one coral accent, and the accent's warm hue (32°) fought
the cold blue-grey neutrals (~265°) it sat on.

**Semantic collision:** coral `#ff7a6b` measured **0.13 ΔE** from the error colour `#ff5470` — right at
the floor of what is distinguishable. A focused pane border and a failing test were nearly the same colour.

---

## 2. Per surface

### Ghostty — config was valid but under-used

- Live and repo copies byte-identical (md5 `0218b57d…`), but the live file is a real copy, not a symlink,
  so nothing prevented future divergence.
- `background-blur-radius` is a **deprecated alias** for `background-blur`, accepted silently in 1.3.1.
- `super+shift+comma=open_config` does **not** replace the built-in `super+shift+,`=reload_config —
  both triggers persist, so the binding was shadowed.
- Default `ctrl+tab`, `ctrl+shift+tab` and `shift+arrow` were swallowed before nvim and tmux could see them.
- `unfocused-split-opacity`, `split-divider-color` and `window-padding-color` were all supported and unused.
- **Fonts:** only JetBrains Mono Nerd Font is installed. Berkeley Mono, IosevkaTerm, Monaspace, SF Mono,
  Maple Mono, CommitMono, Fira Code, Hack and Symbols Nerd Font are all **absent**.

### cmux — valid, but ~14 schema sections unused

- `config doctor` reported OK; zero invalid keys against the published schema.
- cmux takes its **terminal palette from `~/.config/ghostty/config`**, not from `cmux.json`
  (`cmux themes list` confirms the resolution and names the source file). Theming Ghostty therefore
  themes cmux's terminal automatically.
- Unused and directly relevant: `notifications.suppressOnlyFocusedSurface`, `notifications.agentTurnComplete`,
  `notifications.agentIdleReminder`, `sidebar.loadingSpinnerPosition`, `sidebar.notificationBadgePosition`,
  `sidebar.hideAllDetails`, `diffViewer.defaultLayout`, `terminal.copyOnSelect`,
  `app.commandPaletteSearchesAllSurfaces`, `app.focusHistoryIncludesPanesAndTabs`.
- **`notificationBadgeColor` was set to the accent** — the same colour as the selection indicator, so
  "selected" and "needs attention" were visually identical.
- **`markdown.fontFamily` was JetBrainsMono** at `maxWidth: 980`, i.e. every README and PR body read in
  monospace at ~120 characters per line.
- `reload-config` is refused from outside cmux under `socketControlMode: cmuxOnly` — reloading requires a
  shell *inside* cmux, or an app restart.

### pi — theme was valid; the extensions were the risk

- Theme schema is `additionalProperties: false` with exactly **52 valid colour keys**. The old
  `coral-glow.json` was fully valid — 0 invalid, 0 missing.
- Only 6 keys are backgrounds; `export` permits only `pageBg`, `cardBg`, `infoBg` and affects `/export`
  HTML only, never the TUI.
- **Latent failure:** a typo in a `vars` name falls back to the stock `dark` theme *silently, with no
  error*. The old theme's var names deliberately shadowed token names (`"borderMuted": "borderMuted"`),
  putting it one character from a silent, hard-to-diagnose failure.
- Theme hot-reload watches **only** `~/.pi/agent/themes/<activeName>.json`; project, package and
  `--theme` themes need an explicit `/reload`.
- `coral-ui.ts`'s `setFooter` **replaced pi's built-in footer entirely**, dropping the cost, queue and
  hotkey readouts it provides.
- `rename.ts` hardcodes provider `openai-codex` / model `gpt-5.6-luna` for its nested call.
- pi handles Unicode width properly (`Intl.Segmenter` + east-asian-width, RGI emoji and regional
  indicators pinned to 2). `render()` must never exceed `width`.

### Neovim — a stock starter with zero customisation

- Active colorscheme `tokyonight-moon`, resolved at runtime. **No** `on_highlights`, **no** `on_colors`,
  no transparency, no `nvim_set_hl` anywhere.
- The only user-authored content in the whole tree was `lua/plugins/vimbegood.lua` and one enabled extra
  (`ai.copilot-chat`). `options.lua`, `keymaps.lua`, `autocmds.lua` are comment-only.
- `lua/plugins/example.lua` is **dead code** — line 3 is `if true then return {} end`, so its gruvbox
  override never ran.
- `vim.o.winborder` was `""` — floating windows had no border at all.
- tokyonight and catppuccin are both installed; nothing else is.
- Startup ~27 ms headless. Health errors limited to a missing `tree-sitter` CLI and a parser-dir
  runtimepath warning.
- **Caveat:** running `nvim --headless` during the audit let lazy.nvim finish an install that was already
  mid-flight, rewriting `lazy-lock.json` from 3 to 34 entries. State changed as a side effect of reading.

### Zsh — the repo copy was the regression

- Startup mean **0.335 s** over 10 runs (min 0.320, max 0.410). Bare `zsh -f` is ~32 ms, so ~300 ms is
  configuration.
- **`compinit` is 183–238 ms — 60–70 % of total.** The compdump is rewritten on every single start with
  no daily guard and no `-C`.
- No hex colours anywhere in the zsh config; only ANSI indices, all in `~/.p10k.zsh` (coral = index 209).
- `FZF_DEFAULT_OPTS` unset, `LS_COLORS` unset, zero completion styling.
- **The repo copy is worse than the live file**, and its newer mtime makes the direction easy to misread:
  it hardcodes `/Users/awate` in 5 places, has a pnpm `PATH` entry missing `/bin`, and unguardedly sources
  a nonexistent `$HOME/.local/bin/env`.
- fzf's Ctrl-R binding (line 122) overrides atuin's (line 119) — verified `^R` → `fzf-history-widget`.
- `bindkey '^[[A'`/`'^[[B'` at lines 35–36 are dead, discarded by `bindkey -v` at line 126.
- `~/.p10k.zsh`, `~/.zprofile` and the atuin config were untracked entirely.
- **`alias claude="claude --dangerously-skip-permissions"`** silently bypasses permission prompts on every
  invocation. Left untouched — this is a decision for the user, not a styling change.

---

## 3. Known gaps in this audit

- **No before/after screenshots.** Screen recording permission is denied to this process
  (`screencapture` returns "could not create image from display"), so visual verification was done by
  querying applied state instead — `sketchybar --query`, `ghostty +show-config`, `nvim_get_hl` — which
  reports what the app actually resolved rather than what a file says.
- The pre-coral wallpaper could not be recovered; it had already been replaced before this work started.
  The coral wallpaper that was live has been preserved under `backups/<timestamp>/wallpaper/`.
- AeroSpace and Karabiner were inventoried but not deeply audited; neither was changed.
