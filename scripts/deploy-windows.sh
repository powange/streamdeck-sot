#!/usr/bin/env bash
# Copies the built plugin from WSL into the Windows Stream Deck plugins folder, then restarts Stream Deck.
# Usage: npm run deploy:win
set -euo pipefail

PLUGIN="com.powange.seaofthieves.sdPlugin"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

APPDATA_WIN="$(powershell.exe -NoProfile -Command '[Environment]::GetFolderPath("ApplicationData")' | tr -d '\r')"
PLUGINS_DIR="$(wslpath "$APPDATA_WIN")/Elgato/StreamDeck/Plugins"

if [[ ! -d "$PLUGINS_DIR" ]]; then
	echo "Stream Deck plugins folder not found: $PLUGINS_DIR" >&2
	exit 1
fi

echo "Stopping Stream Deck..."
powershell.exe -NoProfile -Command 'Stop-Process -Name StreamDeck -ErrorAction SilentlyContinue; Start-Sleep -Seconds 2' || true

echo "Copying $PLUGIN to $PLUGINS_DIR"
rm -rf "${PLUGINS_DIR:?}/$PLUGIN"
cp -r "$ROOT/$PLUGIN" "$PLUGINS_DIR/$PLUGIN"
rm -rf "$PLUGINS_DIR/$PLUGIN/logs"

echo "Starting Stream Deck..."
powershell.exe -NoProfile -Command 'Start-Process "C:\Program Files\Elgato\StreamDeck\StreamDeck.exe"'
echo "Done."
