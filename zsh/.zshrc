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

# Completions
if type brew &>/dev/null; then
  FPATH=$(brew --prefix)/share/zsh-completions:$FPATH
  autoload -Uz compinit
  compinit -i
fi

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


# completion using arrow keys (based on history)
bindkey '^[[A' history-search-backward
bindkey '^[[B' history-search-forward

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
  __conda_setup="$('/Users/awate/miniconda3/bin/conda' 'shell.zsh' 'hook' 2> /dev/null)"
  if [ $? -eq 0 ]; then eval "$__conda_setup"; else
    [ -f "/Users/awate/miniconda3/etc/profile.d/conda.sh" ] && . "/Users/awate/miniconda3/etc/profile.d/conda.sh"
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
export PNPM_HOME="/Users/awate/Library/pnpm"
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac
# pnpm end

# bun completions
[ -s "/Users/awate/.bun/_bun" ] && source "/Users/awate/.bun/_bun"


. "$HOME/.local/bin/env"

# OpenAI API Key (set in secure location, not here)
# export OPENAI_API_KEY=""
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"


# opencode
export PATH=/Users/awate/.opencode/bin:$PATH

# bun
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
export PATH="$HOME/.local/bin:$PATH"

# Added by Antigravity
export PATH="/Users/awate/.antigravity/antigravity/bin:$PATH"
eval "$(atuin init zsh)"

# fzf
source <(fzf --zsh)
export FZF_DEFAULT_COMMAND="fd --type f --hidden --follow --exclude .git"
export FZF_CTRL_T_COMMAND="$FZF_DEFAULT_COMMAND"
export FZF_ALT_C_COMMAND="fd --type d --hidden --follow --exclude .git"
bindkey -v
alias help-cli='~/productivity-help.sh'
export PATH="$HOME/.dantse/bin:$PATH"

# dantse.cc mount functions
[ -f ~/.dantse-mount.sh ] && source ~/.dantse-mount.sh

# OpenClaw Completion (deshabilitado - comando no encontrado)
# source <(openclaw completion --shell zsh)
export PATH="$HOME/.local/bin:$PATH"
