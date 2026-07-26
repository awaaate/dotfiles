#!/bin/bash

# Nerd Font glyphs (Font Awesome range), rendered with JetBrainsMono Nerd Font.
#
# These were SF Symbols (U+1000xx, Apple private use). SF Pro is NOT installed on
# this machine — only SFNS.ttf, the system font — so every one of them rendered as
# a tofu box. Sketchybar silently falls back on a missing font family rather than
# erroring, which is why the breakage was invisible in the config.
#
# Every codepoint below was verified present in
# ~/Library/Fonts/JetBrainsMonoNerdFont-Regular.ttf by reading its cmap table.

# General
export LOADING=  # U+F1CE spinner
export APPLE=  # U+F179 apple
export PREFERENCES=  # U+F013 cog
export ACTIVITY=  # U+F080 bar-chart
export LOCK=  # U+F023 lock
export BELL=  # U+F0F3 bell
export BELL_DOT=  # U+F0F3 bell
export CHEVRON=  # U+F054 chevron-right

# Battery
export BATTERY_100=  # U+F240 battery-full
export BATTERY_75=  # U+F241 battery-three-quarters
export BATTERY_50=  # U+F242 battery-half
export BATTERY_25=  # U+F243 battery-quarter
export BATTERY_0=  # U+F244 battery-empty
export BATTERY_CHARGING=  # U+F0E7 bolt

# Volume
export VOLUME_100=  # U+F028 volume-up
export VOLUME_66=  # U+F028 volume-up
export VOLUME_33=  # U+F027 volume-down
export VOLUME_10=  # U+F026 volume-off
export VOLUME_0=  # U+F026 volume-off

# Network
export WIFI_CONNECTED=  # U+F1EB wifi
export WIFI_DISCONNECTED=  # U+F05E ban

# Media
export MUSIC_PLAY=  # U+F04B play
export MUSIC_PAUSE=  # U+F04C pause

# System
export CPU=  # U+F2DB microchip
export MEMORY=  # U+F1C0 database
export CLOCK=  # U+F017 clock
