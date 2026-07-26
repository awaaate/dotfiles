#!/bin/bash

source "$CONFIG_DIR/icons.sh"
source "$CONFIG_DIR/colors.sh"

PERCENTAGE=$(pmset -g batt | grep -Eo "\d+%" | cut -d% -f1)
CHARGING=$(pmset -g batt | grep 'AC Power')

if [ "$PERCENTAGE" = "" ]; then
  exit 0
fi

# The GLYPH already encodes the level (full → empty), so colour is reserved
# for urgency and a healthy battery stays neutral like every other icon.
#
# The previous version painted 60-100% green, and used $ORANGE for 10-29% and
# $YELLOW for 30-59% — but both resolve to the SAME warning colour in this
# palette, so two different levels rendered identically while a perfectly
# normal battery shouted in green.
case ${PERCENTAGE} in
  9[0-9]|100)  ICON=$BATTERY_100; COLOR=$GREY   ;;
  [6-8][0-9])  ICON=$BATTERY_75;  COLOR=$GREY   ;;
  [3-5][0-9])  ICON=$BATTERY_50;  COLOR=$GREY   ;;
  [1-2][0-9])  ICON=$BATTERY_25;  COLOR=$YELLOW ;;  # warning
  *)           ICON=$BATTERY_0;   COLOR=$RED    ;;  # error
esac

# Charging is a state change worth announcing, whatever the level.
if [[ "$CHARGING" != "" ]]; then
  ICON=$BATTERY_CHARGING
  COLOR=$GREEN
fi

sketchybar --set "$NAME" icon="$ICON" icon.color="$COLOR" label="${PERCENTAGE}%" label.color="$WHITE"
