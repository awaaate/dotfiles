# dotfiles

Configuración de macOS con una identidad visual oscura y **cinco temas conmutables**.
El activo es **ember** `#f5810f`; ver [Temas](#temas).

El sistema de diseño completo, con la justificación de cada decisión, está en
[`docs/DESIGN.md`](docs/DESIGN.md). El estado previo al rediseño y los problemas encontrados
están en [`docs/AUDIT.md`](docs/AUDIT.md).

> La instalación es por **copia**, no por symlinks. Varias de estas aplicaciones no cargan bien
> su configuración cuando la ruta o alguno de sus directorios es un enlace simbólico.

## Regla central

> **El acento significa IDENTIDAD y FOCO. Nunca ESTADO.**

El acento responde a *dónde estoy / qué está activo*. Verde, ámbar, rojo y teal responden a
*qué ha pasado*. Por eso el badge de notificaciones de cmux es ámbar y no del color de acento:
"seleccionado" y "requiere atención" no pueden compartir tratamiento visual.

## Contenido

| Ruta | Qué es |
|---|---|
| `tools/` | Tokens de diseño, matemática de color, validador y generador |
| `docs/` | Auditoría UX y sistema de diseño |
| `.aerospace.toml` | Tiling window manager |
| `borders/` | Anillo de foco de ventana (nivel 1 de 3) |
| `cmux/` | Interfaz, paneles, sidebar y workspaces |
| `ghostty/` | Terminal + `themes/ember` (generado) |
| `karabiner/` | Remapeo de teclado (sin cambios en este rediseño) |
| `nvim/` | Neovim (**sin cambios** — ver limitaciones) |
| `pi/` | Tema ember y extensiones globales |
| `sketchybar/` | Barra de estado |
| `wallpapers/` | Fondos generados, dark y light |
| `zsh/` | Shell + prompt Powerlevel10k |

## Los colores son generados, no escritos a mano

`tools/tokens.mjs` es la **única fuente de verdad** del color. `tools/build.mjs` genera desde ahí:

```
pi/themes/<tema>.json     ghostty/themes/<tema>     cmux/cmux.json
sketchybar/colors.sh      borders/bordersrc
```

Esos archivos llevan cabecera `GENERATED`. **No los edites a mano**: se sobreescriben. Para
cambiar un color se edita `tools/tokens.mjs` y se regenera.

Existe porque el problema original del repo era justo ese: un acento coherente sobre neutros
tomados de cuatro paletas distintas (Kanagawa, TokyoNight, Catppuccin Mocha y Macchiato). Generar
en lugar de editar hace esa deriva imposible por construcción.

```bash
node tools/build.mjs          # regenerar configs
node tools/wallpaper.mjs      # regenerar fondos
```

## Temas

Un tema son **dos hues**: el acento y el matiz de los neutros (acento − 13°). Todo lo demás —
paradas de luminosidad, colores de estado, superficies teñidas — es idéntico entre temas, así que
cambiar de tema jamás cambia lo que un color *significa*, solo el aspecto de la identidad.

| Tema | Hue | Acento | ΔE mín vs estados | Carácter |
|---|---|---|---|---|
| **ember** (activo) | 55° | `#f5810f` | 0.128 (error) | fuego, neutros tostados |
| fucsia | 330° | `#e077d8` | 0.171 (special) | el máximo margen del círculo |
| iris | 305° | `#be84fb` | 0.120 (special) | el original del rediseño |
| rosa | 348° | `#f171b8` | 0.130 (error) | chicle, cálido |
| lima | 110° | `#abac00` | 0.122 (success) | fósforo ácido retro |
| azur | 225° | `#00a8d4` | 0.117 (special) | cian eléctrico — el único azul viable |

Azur existe gracias a un override por tema de las paradas del acento (`stops` en `THEMES`): los
hues azules reciben su croma sRGB a menor luminosidad que los cálidos, así que su `base` baja a
L 0.68 — lo más oscuro que permite el gate de 4.5:1 sobre el fondo. Un azul más profundo es
imposible bajo este sistema sin rediseñar los colores de estado: a luminosidad legible, el arco
195°–265° pertenece a `info` y `special`.

Para cambiar: edita `ACTIVE` en `tools/tokens.mjs` y regenera. `build.mjs` reapunta él mismo
`theme =` en `ghostty/config` y `"theme"` en `pi/settings.json`; los temas de ghostty y pi se
generan para los cinco y conviven por nombre, el resto de archivos lleva solo el activo.

```bash
node tools/build.mjs && node tools/wallpaper.mjs && ./install.sh
```

`check-contrast.mjs` valida los gates de identidad de **todos** los temas en cada corrida,
también los inactivos — un candidato no puede pudrirse en la tabla sin que el build falle.

## Instalación

```bash
git clone https://github.com/awaaate/dotfiles.git ~/dotfiles
cd ~/dotfiles && ./install.sh
```

`install.sh` hace copia de seguridad de todo lo que vaya a sobreescribir (en
`~/dotfiles-backup-<fecha>`), copia, y verifica que cada destino existe. Prueba primero con
`./install.sh --dry-run`, que no toca nada.

**El script es la fuente de verdad de qué se instala y dónde.** Esta lista vivía antes en prosa aquí y se
desincronizó: una instalación limpia se quedaba sin los atajos de pi y sin las seis plantillas, así que el
panel de bienvenida anunciaba comandos que no existían en esa máquina. `tools/check-install.mjs` verifica
ahora que todo lo que el repo trae tenga destino en el instalador.

pi se copia archivo por archivo a propósito, para no tocar `auth.json`, sesiones ni cachés de modelos que
viven en el mismo directorio.

Lo que **no** automatiza, y por qué: el fondo de pantalla (depende de tu resolución) y CmuxDock (compila
una app y carga un LaunchAgent). El script imprime los comandos exactos al terminar.

## CmuxDock — estado de agentes en el Dock de macOS

Un tile en el Dock con el estado agregado de los workspaces de cmux (*worst-wins*: error > atención >
trabajando > reposo).

**El icono solo existe cuando hay algo que reportar.** En reposo la app se degrada a `.accessory` y
desaparece del Dock (y de Cmd-Tab); en cuanto un workspace deja de estar idle se promociona a `.regular` y
el tile vuelve. Aparecer es inmediato; ocultarse espera 4 s, porque el estado de los agentes oscila y un
icono entrando y saliendo del Dock en cada oscilación molesta más que uno que se queda un momento de más.

Esto es la consecuencia directa de que una app `.accessory` **no tiene tile**: "oculto" y "con tile" son
excluyentes, así que la única forma de tener ambos es alternar la activation policy en runtime.
`LSUIElement` está en `true` para que no parpadee en el Dock al arrancar — es solo la política *inicial*,
`setActivationPolicy` la cambia en ambas direcciones.

```bash
cd swift/CmuxDock && ./build.sh --install
cp swift/CmuxDock/com.iris.cmuxdock.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.iris.cmuxdock.plist
cp tools/cmux-dock-hook.sh ~/.config/cmux/dock-hook.sh && chmod +x ~/.config/cmux/dock-hook.sh
```

Solo necesita las Command Line Tools (`swiftc`), no Xcode ni SwiftPM: un bundle de AppKit es un directorio
con un `Info.plist` y un binario.

**Funciona sin acceso al socket.** Si el hook no puede consultar a cmux, sigue sabiendo lo único
imprescindible: que una notificación acaba de dispararse. Cuenta notificaciones y el tile muestra ese
número. Al enfocar cmux el contador se limpia y el icono se va — así el número significa "desde la última
vez que miraste", no un total que crece para siempre. Si el socket sí responde, sustituye el contador por
el detalle real por workspace.

**Por qué está partido en dos procesos.** cmux rechaza conexiones al socket desde fuera de sí mismo con
`socketControlMode: cmuxOnly` — verificado en cmux 0.64.20, donde `ping`, `capabilities`, `list-windows`,
`identify` y `workspace list` responden *"Access denied"*. Solo `cmux version` funciona sin socket. Así que
la app, lanzada por launchd, **nunca** puede consultar a cmux. El hook sí, porque lo lanza cmux vía
`notifications.command`; consulta, escribe `~/.cmux/dock-state.json`, y la app solo lee.

Se usa `notifications.command` y no `notifications.hooks` a propósito: los *hooks* reciben JSON de política
por stdin y deben devolver política actualizada por stdout dentro de `timeoutSeconds`, y si fallan cmux
*"falls back to default notification behavior"*. Un icono no tiene por qué estar en la ruta de entrega.

La app observa el **directorio**, no el archivo: el hook escribe con temp + `rename`, y un `rename` cambia
el inode, así que un watcher sobre el archivo se quedaría sordo tras la primera escritura.

Depuración:

```bash
log stream --predicate 'process == "CmuxDock"'
cat ~/.cmux/dock-probe.log
```

## Aplicar cambios en caliente

```bash
sketchybar --reload
pkill -x borders; (~/.config/borders/bordersrc &)
aerospace reload-config
exec zsh
```

Ghostty: `super+shift+r` recarga; `super+shift+.` abre la config.
pi: `/reload` dentro de la sesión.

**cmux no se puede recargar desde fuera.** Con `socketControlMode: cmuxOnly`, `cmux reload-config`
responde `Access denied - only processes started inside cmux can connect`. Hay que ejecutarlo
desde una shell **dentro** de cmux, o reiniciar la aplicación.

## Copiar cambios en vivo de vuelta al repo

Las aplicaciones escriben en `~/.config` y `~/.pi`, así que los cambios hay que copiarlos
explícitamente. Ojo: los archivos generados se sobreescriben al correr `node tools/build.mjs`.

```bash
cd ~/dotfiles
cp ~/.aerospace.toml .aerospace.toml
rsync -a ~/.config/sketchybar/ sketchybar/
rsync -a ~/.config/ghostty/ ghostty/
rsync -a ~/.config/cmux/ cmux/
cp ~/.zshrc zsh/.zshrc && cp ~/.p10k.zsh zsh/.p10k.zsh
rsync -a ~/.pi/agent/extensions/ pi/extensions/
rsync -a ~/.pi/agent/themes/ pi/themes/
rsync -a ~/.pi/agent/prompts/ pi/prompts/
cp ~/.pi/agent/keybindings.json pi/keybindings.json

# lastChangelogVersion es estado efímero de pi; no se versiona
jq 'del(.lastChangelogVersion)' ~/.pi/agent/settings.json > pi/settings.json
```

Esta lista es el reverso del `MAP` de `install.sh`, y por tanto puede desincronizarse igual. Si añades algo
al repo, añádelo en los dos sitios — `tools/check-install.mjs` te avisa del lado del instalador.

## Validación

```bash
node tools/check-contrast.mjs                                    # contraste y separación semántica
node tools/check-install.mjs                                     # ¿instala todo lo que el repo trae?
node tools/check-pi.mjs                                          # tema, teclas y ajustes de pi
node tools/build.mjs --check                                     # ¿generados == tokens?
/Applications/Ghostty.app/Contents/MacOS/ghostty +validate-config
/Applications/cmux.app/Contents/MacOS/cmux config doctor
bash -n ~/.config/sketchybar/sketchybarrc
```

`check-contrast.mjs` **sale con código distinto de cero** si algo falla; no es un informe. Exige
texto de cuerpo a 7:1 (AAA), estados a 4.5:1, borde de foco a 3:1, y un mínimo de **0.10 ΔE** en
OKLab entre el acento y cada color de estado — porque el ratio de contraste no ve el tono, y dos
colores pueden pasar contraste y aun así ser indistinguibles.

## Rollback

```bash
BK=~/dotfiles-backup-XXXXXXXX-XXXXXX     # el directorio creado antes de instalar
rsync -a "$BK/sketchybar/" ~/.config/sketchybar/ && sketchybar --reload
cp "$BK/.zshrc" ~/.zshrc && exec zsh
```

## Secretos y rutas de máquina

- `zsh/.zshrc` y `zsh/.p10k.zsh` no contienen rutas absolutas de home ni credenciales; se verificó
  antes de versionarlos. Usa `$HOME`, nunca `/Users/<usuario>`.
- `pi/settings.json` guarda proveedor y modelo por defecto, **no** claves de API. No se versionan
  `auth.json`, sesiones, catálogos de modelos ni índices de importación.
- `sketchybar/plugins/icon_map.sh` es un archivo generado por sketchybar-app-font. Las apps que no
  conoce se añaden en `plugins/workspaces.sh` (`__icon_override`), para no ensuciar el generado.

## Dependencias

`aerospace`, `sketchybar`, `borders`, `ghostty`, `cmux`, `pi`, `nvim`, `powerlevel10k`,
`zsh-autosuggestions`, `zsh-syntax-highlighting`, `atuin`, `zoxide`, `fzf`, y las fuentes
**JetBrainsMono Nerd Font** y **sketchybar-app-font**.

Las fuentes no son opcionales. Sketchybar cae en fallback silencioso cuando una familia no existe,
así que una fuente ausente no da error: dibuja cajas vacías. Todos los codepoints de
`sketchybar/icons.sh` están verificados contra la tabla `cmap` de JetBrainsMono Nerd Font.

## Limitaciones conocidas

- **Neovim está sin tocar.** Sigue siendo un LazyVim de serie con `tokyonight-moon`, así que hoy es
  la única superficie que no comparte la paleta.
- **No hay capturas antes/después.** El proceso que hizo el rediseño no tenía permiso de grabación
  de pantalla, así que la verificación se hizo consultando el estado aplicado
  (`sketchybar --query`, `ghostty +show-config`, `cmux config doctor`) en vez de mirar píxeles.
  Eso confirma lo que la aplicación resolvió, no cómo se ve.
- **El SSID del WiFi no se muestra.** macOS lo redacta sin permiso de Localización, por todos los
  métodos disponibles. La barra muestra el estado del enlace, que sí es fiable.
- **`karabiner/` no se auditó a fondo** y no se cambió.
- El fondo anterior no se pudo recuperar: ya había sido reemplazado antes de empezar. El que estaba
  activo se conservó en el backup.
