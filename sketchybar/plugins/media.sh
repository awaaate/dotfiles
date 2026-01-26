#!/bin/bash

source "$CONFIG_DIR/icons.sh"
source "$CONFIG_DIR/colors.sh"

# Get now playing info
get_now_playing() {
  local app="$1"
  osascript -e "
    if application \"$app\" is running then
      tell application \"$app\"
        if player state is playing then
          set trackName to name of current track
          set artistName to artist of current track
          return trackName & \" - \" & artistName
        else
          return \"\"
        end if
      end tell
    else
      return \"\"
    end if
  " 2>/dev/null
}

# Get player state
get_player_state() {
  local app="$1"
  osascript -e "
    if application \"$app\" is running then
      tell application \"$app\"
        return player state as string
      end tell
    else
      return \"stopped\"
    end if
  " 2>/dev/null
}

# Check Spotify first, then Music
SPOTIFY_STATE=$(get_player_state "Spotify")
MUSIC_STATE=$(get_player_state "Music")

if [ "$SPOTIFY_STATE" = "playing" ]; then
  ICON=$MUSIC_PAUSE
  INFO=$(get_now_playing "Spotify")
  COLOR="$GREEN"
elif [ "$MUSIC_STATE" = "playing" ]; then
  ICON=$MUSIC_PAUSE
  INFO=$(get_now_playing "Music")
  COLOR="$MAGENTA"
elif [ "$SPOTIFY_STATE" = "paused" ]; then
  ICON=$MUSIC_PLAY
  INFO="Paused"
  COLOR="$GREY"
elif [ "$MUSIC_STATE" = "paused" ]; then
  ICON=$MUSIC_PLAY
  INFO="Paused"
  COLOR="$GREY"
else
  ICON=$MUSIC_PLAY
  INFO=""
  COLOR="$GREY"
fi

# Truncate long titles
if [ ${#INFO} -gt 40 ]; then
  INFO="${INFO:0:37}..."
fi

if [ -n "$INFO" ]; then
  sketchybar --set "$NAME" \
    icon="$ICON" \
    icon.color="$COLOR" \
    label="$INFO" \
    label.color="$WHITE" \
    drawing=on
else
  sketchybar --set "$NAME" drawing=off
fi
