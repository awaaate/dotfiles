# Enable Powerlevel10k instant prompt. Should stay close to the top of ~/.zshrc.
# Initialization code that may require console input (password prompts, [y/n]
# confirmations, etc.) must go above this block; everything else may go below.
if [[ -r "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh" ]]; then
  source "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh"
fi

export PATH="/opt/homebrew/opt/postgresql@18/bin:$PATH"
source /opt/homebrew/share/powerlevel10k/powerlevel10k.zsh-theme

# To customize prompt, run `p10k configure` or edit ~/.p10k.zsh.
[[ ! -f ~/.p10k.zsh ]] || source ~/.p10k.zsh

# ── Completions ─────────────────────────────────────────────────────────────
# A full `compinit` re-scans every fpath directory for insecure ownership and
# regenerates ~/.zcompdump from scratch. Measured at 183-238ms of a 335ms
# startup — 60-70% of the whole shell. The standard once-a-day guard below
# rebuilds the dump at most every 24h; every other shell takes `compinit -C`,
# which trusts the existing dump and skips the security scan entirely.
#
# `brew --prefix` was also a fork per shell. This file already hardcodes
# /opt/homebrew in five other places, so the prefix is resolved without one.
: ${HOMEBREW_PREFIX:=/opt/homebrew}
[[ -d $HOMEBREW_PREFIX/share/zsh-completions ]] &&
  FPATH="$HOMEBREW_PREFIX/share/zsh-completions:$FPATH"

autoload -Uz compinit
_zcompdump="${ZDOTDIR:-$HOME}/.zcompdump"
# Glob qualifiers `(N.mh-24)`: null_glob, plain file, mtime under 24 hours.
# A `for` loop is used rather than `[[ -n ... ]]` because the test builtin does
# not perform filename generation unless extended_glob is on, which would
# silently make the check always true.
_zcompdump_fresh=0
for _f in $_zcompdump(N.mh-24); do _zcompdump_fresh=1; done
if (( _zcompdump_fresh )); then
  compinit -C -d "$_zcompdump"
else
  compinit -i -d "$_zcompdump"
  # Byte-compile the dump so the next shell mmaps a .zwc instead of parsing
  # ~56KB of zsh source. Only ever written on the same once-a-day path, and
  # zsh ignores a .zwc older than its source, so it cannot go stale.
  [[ -s $_zcompdump ]] && zcompile -R -- "$_zcompdump.zwc" "$_zcompdump" 2>/dev/null
fi
unset _zcompdump _zcompdump_fresh _f

# ── Completion menu — Iris ──────────────────────────────────────────────────
# Colours address the ANSI palette by INDEX, never by hex, so they track
# ~/.config/ghostty/themes/ember automatically:
#   1 red #f24e56 · 2 green #67d283 · 3 amber #f1bf4e · 4 blue #8bafff
#   5 ember #f5810f · 6 teal #4fcdcd · 7 muted #a59c99 · 8 border #5d534f
#
# The accent is reserved for exactly one thing here: the entry under the
# cursor (`ma`), because that is FOCUS. File kinds are merely different, not
# better or worse, so they take blue/teal/green/amber; red is kept for things
# that are genuinely broken (orphan symlinks, setuid).
zstyle ':completion:*' menu select
zstyle ':completion:*' group-name ''
zstyle ':completion:*' matcher-list 'm:{a-zA-Z}={A-Za-z}' 'r:|=*' 'l:|=* r:|=*'
export LS_COLORS='di=1;34:ln=36:or=31:mi=31:ex=32:pi=33:so=36:bd=33:cd=33:su=1;31:sg=1;31:tw=1;34:ow=1;34'
zstyle ':completion:*' list-colors "${(s.:.)LS_COLORS}" 'ma=7;38;5;5'
zstyle ':completion:*:descriptions' format '%F{8}%d%f'
zstyle ':completion:*:messages'     format '%F{6}%d%f'
zstyle ':completion:*:warnings'     format '%F{1}no matches%f'

# Plugins
source /opt/homebrew/share/zsh-autosuggestions/zsh-autosuggestions.zsh

# history setup
HISTFILE=$HOME/.zhistory
SAVEHIST=1000
HISTSIZE=999
setopt share_history
setopt hist_expire_dups_first
setopt hist_ignore_dups
setopt hist_verify


# Arrow-key history search used to be bound here:
#     bindkey '^[[A' history-search-backward
#     bindkey '^[[B' history-search-forward
# Both were dead. They landed in the `emacs` keymap, and `bindkey -v` further
# down (see the fzf block) swaps in `viins`/`vicmd` and discards them.
# Re-binding them correctly would be worse than leaving them out: atuin binds
# ^[[A into viins AND vicmd explicitly, so it survives `bindkey -v` and already
# owns Up with its own fuzzy history search. Verified live:
#     bindkey -M viins → "^[[A" atuin-up-search-viins
# Adding these back would clobber atuin, so they are removed rather than fixed.

source /opt/homebrew/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh

# ---- Eza (better ls) -----

alias ls="eza --icons --group-directories-first"
alias ll="eza --icons --group-directories-first -la"
alias lt="eza --icons --group-directories-first --tree --level=2"

# ---- Zoxide (better cd) ----
eval "$(zoxide init zsh)"

# bat (cat con syntax highlighting)
alias cat="bat --style=auto"

# NVM lazy-loading (solo carga cuando usas nvm/node/npm)
export NVM_DIR="$HOME/.nvm"
nvm() {
  unset -f nvm node npm npx
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  nvm "$@"
}
node() { nvm --version > /dev/null 2>&1; unset -f node; node "$@"; }
npm() { nvm --version > /dev/null 2>&1; unset -f npm; npm "$@"; }
npx() { nvm --version > /dev/null 2>&1; unset -f npx; npx "$@"; }
openclaw() { nvm --version > /dev/null 2>&1; unset -f openclaw; openclaw "$@"; }


# Conda lazy-loading (solo carga cuando usas conda)
conda() {
  unset -f conda
  __conda_setup="$("$HOME/miniconda3/bin/conda" 'shell.zsh' 'hook' 2> /dev/null)"
  if [ $? -eq 0 ]; then eval "$__conda_setup"; else
    [ -f "$HOME/miniconda3/etc/profile.d/conda.sh" ] && . "$HOME/miniconda3/etc/profile.d/conda.sh"
  fi
  unset __conda_setup
  conda "$@"
}

# Pyenv lazy-loading
export PYENV_ROOT="$HOME/.pyenv"
[[ -d $PYENV_ROOT/bin ]] && export PATH="$PYENV_ROOT/bin:$PATH"
pyenv() {
  unset -f pyenv
  eval "$(command pyenv init -)"
  pyenv "$@"
}

#VSCODE path
export PATH="$PATH:/usr/local/bin/code"
export PATH="$PATH:/Applications/Visual Studio Code.app/Contents/Resources/app/bin"

# pnpm
export PNPM_HOME="$HOME/Library/pnpm"
case ":$PATH:" in
  *":$PNPM_HOME/bin:"*) ;;
  *) export PATH="$PNPM_HOME/bin:$PATH" ;;
esac
# pnpm end

# bun completions
[ -s "$HOME/.bun/_bun" ] && source "$HOME/.bun/_bun"


[ -f "$HOME/.local/bin/env" ] && . "$HOME/.local/bin/env"

# OpenAI API Key (set in secure location, not here)
# export OPENAI_API_KEY=""
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"


# opencode
export PATH=$HOME/.opencode/bin:$PATH

# bun
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
export PATH="$HOME/.local/bin:$PATH"

# Added by Antigravity
export PATH="$HOME/.antigravity/antigravity/bin:$PATH"
eval "$(atuin init zsh)"

# fzf
source <(fzf --zsh)
export FZF_DEFAULT_COMMAND="fd --type f --hidden --follow --exclude .git"
export FZF_CTRL_T_COMMAND="$FZF_DEFAULT_COMMAND"
export FZF_ALT_C_COMMAND="fd --type d --hidden --follow --exclude .git"

# ── fzf — Iris ──────────────────────────────────────────────────────────────
#   prompt / pointer / spinner  accent #f5810f — your input and the cursor are
#                               FOCUS, which is the one thing the accent means.
#   hl / hl+                    amber  #f1bf4e — a match is transient STATUS,
#                               not identity, so it must not take the accent
#                               (same rule as Search in Neovim).
#   bg+                         #2a2932 bgSelected — the current row.
#   fg+                         #f0eff3 textBright.
#   marker                      #67d283 green — a confirmed multi-select.
#   info                        #4fcdcd teal — the neutral match counter.
#   border/separator            #5d534f / #433935.
#   header                      #7c726f textDim — recedes behind the list.
#   bg / gutter = -1            inherit the terminal, which the Iris Ghostty
#                               theme already sets to bgBase #0f0907. Keeping
#                               it adaptive means fzf never paints a mismatched
#                               rectangle if the surface changes.
export FZF_DEFAULT_OPTS="
  --color=fg:#cccbd1,bg:-1,hl:#f1bf4e
  --color=fg+:#f0eff3,bg+:#2a2932,hl+:#f1bf4e
  --color=info:#4fcdcd,prompt:#f5810f,pointer:#f5810f,spinner:#f5810f
  --color=marker:#67d283,header:#7c726f,border:#5d534f,separator:#433935
  --color=gutter:-1,label:#a59c99,query:#f0eff3
"
bindkey -v
alias help-cli='~/productivity-help.sh'
export PATH="$HOME/.dantse/bin:$PATH"

# dantse.cc mount functions
[ -f ~/.dantse-mount.sh ] && source ~/.dantse-mount.sh

# OpenClaw Completion (deshabilitado - comando no encontrado)
# source <(openclaw completion --shell zsh)
export PATH="$HOME/.local/bin:$PATH"

alias claude="claude --dangerously-skip-permissions"

# ui.sh / uidotsh MCP (Cursor reads ${env:UIDOTSH_TOKEN} in ~/.cursor/mcp.json)
export UIDOTSH_TOKEN="${UIDOTSH_TOKEN:-}"
