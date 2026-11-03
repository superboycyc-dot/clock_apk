#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
./build_apk.sh
APP_VERSION=$(python3 -c 'import json;print(json.load(open("dist/update.json"))["versionName"])')
gh release create "v$APP_VERSION" --repo superboycyc-dot/clock_apk --title "翻页时钟 $APP_VERSION" --notes-file RELEASE_NOTES.md "dist/FlipClock-$APP_VERSION.apk" dist/update.json dist/SHA256SUMS.txt
