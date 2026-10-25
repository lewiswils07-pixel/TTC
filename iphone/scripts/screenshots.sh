#!/bin/bash
# Takes iPhone simulator screenshots of the screens named below.
# Usage: iphone/scripts/screenshots.sh <path to Sodalis.app> <output folder>
set -euo pipefail

APP="$1"
OUT="$2"
BUNDLE_ID="com.sodaliscollective.app"
SCREENS=(whos-going whos-going-scrolled filters filters-large chat chat-menu signup signup-scrolled signup-date)
mkdir -p "$OUT"

# Pick a simulator by name pattern from the newest iOS runtime installed.
pick() {
  xcrun simctl list devices available -j | python3 -c '
import json, re, sys
pattern = re.compile(sys.argv[1])
data = json.load(sys.stdin)["devices"]
def ver(rt):
    m = re.search(r"iOS-(\d+)-(\d+)", rt)
    return (int(m.group(1)), int(m.group(2))) if m else (0, 0)
for rt in sorted(data, key=ver, reverse=True):
    if "iOS" not in rt:
        continue
    for d in sorted(data[rt], key=lambda d: d["name"], reverse=True):
        if pattern.fullmatch(d["name"]):
            print(d["udid"], d["name"].replace(" ", "-"))
            sys.exit(0)
' "$1"
}

shoot() {
  local udid="$1" label="$2"
  shift 2
  xcrun simctl boot "$udid" 2>/dev/null || true
  xcrun simctl bootstatus "$udid" -b >/dev/null
  xcrun simctl status_bar "$udid" override --time "9:41" --batteryState discharging --batteryLevel 100 --cellularMode active --cellularBars 4 --wifiBars 3 || true
  xcrun simctl install "$udid" "$APP"
  for screen in "$@"; do
    xcrun simctl launch --terminate-running-process "$udid" "$BUNDLE_ID" -screen "$screen" >/dev/null
    sleep 5
    xcrun simctl io "$udid" screenshot "$OUT/$label--$screen.png" >/dev/null
    echo "took $label $screen"
  done
  xcrun simctl shutdown "$udid" || true
}

read -r MAIN MAIN_NAME < <(pick 'iPhone 1[6-7]')
echo "Main phone: $MAIN_NAME"
shoot "$MAIN" "$MAIN_NAME" "${SCREENS[@]}"

if read -r SE SE_NAME < <(pick 'iPhone SE.*|iPhone 16e'); then
  echo "Small phone: $SE_NAME"
  shoot "$SE" "$SE_NAME" whos-going chat signup
fi

# Shrink for a lighter download.
for f in "$OUT"/*.png; do
  sips -s format jpeg -s formatOptions 75 "$f" --out "${f%.png}.jpg" >/dev/null && rm "$f"
done
ls -la "$OUT"
