# dotfiles

Configuraciones personales de macOS con una identidad visual oscura y acento coral `#FF7A6B`.

> Estas configuraciones se instalan mediante **copias**, no mediante symlinks. Algunas aplicaciones no cargan correctamente su configuración cuando la ruta completa o alguno de sus directorios es un enlace simbólico.

## Contenido

- **.aerospace.toml** - Tiling window manager
- **borders/** - Bordes de ventanas con acento coral
- **cmux/** - Interfaz, paneles, sidebar y workspaces de cmux
- **ghostty/** - Terminal, fuente, tema, cursor y selección
- **karabiner/** - Keyboard remapping
- **nvim/** - Neovim
- **pi/** - Tema coral y extensiones globales de pi
- **sketchybar/** - Barra de estado
- **wallpapers/** - Fondos de pantalla
- **zsh/** - Shell

## Instalación

```bash
# Clonar el repositorio
git clone https://github.com/awaaate/dotfiles.git ~/dotfiles

# Crear los directorios de destino
mkdir -p \
  ~/.config/{borders,cmux,ghostty,karabiner,nvim,sketchybar} \
  ~/.pi/agent/{extensions,themes} \
  ~/Pictures

# Copiar configuraciones de macOS y terminal
cp ~/dotfiles/.aerospace.toml ~/.aerospace.toml
rsync -a ~/dotfiles/borders/ ~/.config/borders/
rsync -a ~/dotfiles/cmux/ ~/.config/cmux/
rsync -a ~/dotfiles/ghostty/ ~/.config/ghostty/
rsync -a ~/dotfiles/karabiner/ ~/.config/karabiner/
rsync -a ~/dotfiles/nvim/ ~/.config/nvim/
rsync -a ~/dotfiles/sketchybar/ ~/.config/sketchybar/
cp ~/dotfiles/zsh/.zshrc ~/.zshrc

# Copiar pi sin tocar credenciales, modelos ni sesiones
cp ~/dotfiles/pi/settings.json ~/.pi/agent/settings.json
rsync -a ~/dotfiles/pi/extensions/ ~/.pi/agent/extensions/
rsync -a ~/dotfiles/pi/themes/ ~/.pi/agent/themes/

# Copiar wallpapers
rsync -a ~/dotfiles/wallpapers/ ~/Pictures/
```

## cmux

La configuración usa:

- Borde del panel activo coral `#FF7A6B`.
- Divisores oscuros `#3B4261`.
- Workspaces con estilo `washRail`.
- Badge de notificaciones coral.
- Sidebar integrada con el fondo Kanagawa de Ghostty.
- Integraciones de Claude Code y Gemini.
- Fuente JetBrainsMono Nerd Font en Markdown.

Antes de reemplazar una configuración existente:

```bash
cp ~/.config/cmux/cmux.json ~/.config/cmux/cmux.json.$(date +%Y%m%d-%H%M%S).bak
cp ~/dotfiles/cmux/cmux.json ~/.config/cmux/cmux.json
cmux config doctor
cmux reload-config
```

cmux también lee `~/.config/ghostty/config`, por lo que el tema Kanagawa, la fuente, el cursor y la selección coral se comparten con Ghostty.

## pi

La carpeta `pi/` versiona únicamente configuración portable:

- `settings.json`
- `themes/coral-glow.json`
- extensiones globales

No se versionan `auth.json`, sesiones, catálogos de modelos, índices de importación ni ninguna credencial.

Después de copiar la configuración, ejecuta dentro de pi:

```text
/reload
```

## Actualizar el repositorio desde la máquina local

Las aplicaciones modifican archivos reales en `~/.config` y `~/.pi`; por eso los cambios deben copiarse explícitamente al repositorio:

```bash
cp ~/.config/cmux/cmux.json ~/dotfiles/cmux/cmux.json
cp ~/.config/ghostty/config ~/dotfiles/ghostty/config
cp ~/.config/borders/bordersrc ~/dotfiles/borders/bordersrc
cp ~/.config/sketchybar/colors.sh ~/dotfiles/sketchybar/colors.sh

jq 'del(.lastChangelogVersion)' ~/.pi/agent/settings.json > ~/dotfiles/pi/settings.json.tmp
mv ~/dotfiles/pi/settings.json.tmp ~/dotfiles/pi/settings.json
rsync -a ~/.pi/agent/extensions/ ~/dotfiles/pi/extensions/
rsync -a ~/.pi/agent/themes/ ~/dotfiles/pi/themes/
```

El filtro de `jq` evita versionar campos de estado efímeros como `lastChangelogVersion`.

## Secretos

Los tokens, sesiones, claves personales y archivos de autenticación no se versionan. Deben permanecer en las rutas locales de cada aplicación o cargarse mediante variables de entorno.
