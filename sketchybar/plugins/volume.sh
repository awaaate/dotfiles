#!/bin/bash

source "$CONFIG_DIR/icons.sh"
source "$CONFIG_DIR/colors.sh"

# Handle click to toggle mute
if [ "$SENDER" = "mouse.clicked" ]; then
  osascript -e 'set volume output muted (not (output muted of (get volume settings)))'
fi

# Get current volume
if [ "$SENDER" = "volume_change" ]; then
  VOLUME="$INFO"
else
  VOLUME=$(osascript -e 'output volume of (get volume settings)')
fi

MUTED=$(osascript -e 'output muted of (get volume settings)')

# Volume is a LEVEL, never a status — the glyph carries it, so the icon stays
# neutral at every level. Muted was previously red, which reads as "something
# is broken" for what is a deliberate user choice.
if [ "$MUTED" = "true" ]; then
  ICON=$VOLUME_0
elif [ "$VOLUME" -ge 66 ]; then
  ICON=$VOLUME_100
elif [ "$VOLUME" -ge 33 ]; then
  ICON=$VOLUME_66
elif [ "$VOLUME" -ge 1 ]; then
  ICON=$VOLUME_33
else
  ICON=$VOLUME_0
fi
COLOR=$GREY

sketchybar --set "$NAME" icon="$ICON" icon.color="$COLOR" label="$VOLUME%" label.color="$WHITE"
