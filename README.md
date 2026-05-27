# dotfiles

Mis configuraciones de macOS.

## Contenido

- **.aerospace.toml** - Tiling window manager
- **borders/** - Window borders
- **ghostty/** - Terminal
- **karabiner/** - Keyboard remapping
- **nvim/** - Neovim config
- **sketchybar/** - Status bar
- **zsh/** - Shell config

## Instalación

```bash
# Clonar
git clone https://github.com/awaaate/dotfiles.git ~/dotfiles

# Symlinks
ln -sf ~/dotfiles/.aerospace.toml ~/.aerospace.toml
ln -sf ~/dotfiles/karabiner ~/.config/karabiner
ln -sf ~/dotfiles/borders ~/.config/borders
ln -sf ~/dotfiles/sketchybar ~/.config/sketchybar
ln -sf ~/dotfiles/ghostty ~/.config/ghostty
ln -sf ~/dotfiles/nvim ~/.config/nvim
ln -sf ~/dotfiles/zsh/.zshrc ~/.zshrc
```

## Secretos

Los tokens y claves personales no se versionan. Cárgalos desde variables de entorno locales.
