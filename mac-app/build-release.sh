#!/bin/bash
# Builds the downloadable apps into dist/:
#   Ambient-Video-mac-arm64.zip, Ambient-Video-mac-x64.zip, Ambient-Video-windows-x64.zip
# Mac: the Ambient Video.app wrapper (launcher/) around the official, untouched Electron.app.
# Windows: Electron with the app in resources/app and electron.exe renamed to "Ambient Video.exe".
set -euo pipefail
EV=33.2.1
cd "$(dirname "$0")"
ROOT=$(pwd); OUT="$ROOT/../dist"; TMP=$(mktemp -d)
rm -rf "$OUT"; mkdir -p "$OUT"
URL=https://github.com/electron/electron/releases/download/v$EV
curl -fsSL "$URL/SHASUMS256.txt" -o "$TMP/SHASUMS256.txt"
get() { # $1 = platform-arch
  local f=electron-v$EV-$1.zip
  curl -fsSL "$URL/$f" -o "$TMP/$f"
  (cd "$TMP" && grep " \*$f\$" SHASUMS256.txt | sed 's/ \*/  /' | sha256sum -c - >/dev/null)
  echo "$TMP/$f"
}
for a in arm64 x64; do
  Z=$(get darwin-$a); D="$TMP/mac-$a"; C="$D/Ambient Video.app/Contents"
  mkdir -p "$C/MacOS" "$C/Resources/app"
  cp launcher/Info.plist "$C/"; cp launcher/launcher "$C/MacOS/"; chmod 755 "$C/MacOS/launcher"
  cp launcher/icon.icns "$C/Resources/"
  (cd "$C/Resources" && unzip -q "$Z" 'Electron.app/*')
  cp app/* "$C/Resources/app/"
  (cd "$D" && zip -qry "$OUT/Ambient-Video-mac-$a.zip" "Ambient Video.app")
done
Z=$(get win32-x64); D="$TMP/win/Ambient Video"; mkdir -p "$D"
(cd "$D" && unzip -q "$Z" && mv electron.exe "Ambient Video.exe" && rm -f resources/default_app.asar && mkdir -p resources/app)
cp app/* "$D/resources/app/"
(cd "$TMP/win" && zip -qr "$OUT/Ambient-Video-windows-x64.zip" "Ambient Video")
rm -rf "$TMP"; ls -la "$OUT"
