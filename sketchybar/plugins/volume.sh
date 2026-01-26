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

if [ "$MUTED" = "true" ]; then
  ICON=$VOLUME_0
  COLOR=$RED
elif [ "$VOLUME" -ge 66 ]; then
  ICON=$VOLUME_100
  COLOR=$WHITE
elif [ "$VOLUME" -ge 33 ]; then
  ICON=$VOLUME_66
  COLOR=$WHITE
elif [ "$VOLUME" -ge 1 ]; then
  ICON=$VOLUME_33
  COLOR=$WHITE
else
  ICON=$VOLUME_0
  COLOR=$GREY
fi

sketchybar --set "$NAME" icon="$ICON" icon.color="$COLOR" label="$VOLUME%" label.color="$WHITE"
