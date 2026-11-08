#!/bin/sh
# Builds the Chrome Web Store version of the extension into store/dist and store/ambient-video-store.zip.
# Store version = the glow on YouTube and on any other site with a video (no YouTube TV user-agent switch, so it passes review),
# plus a tiny marker on the Ambient Video site so the site knows the extension is installed.
set -e
cd "$(dirname "$0")"
rm -rf dist && mkdir dist
cp ../extension/content.js ../extension/anysite.js ../extension/fs-main.js ../extension/content.css ../extension/icon16.png ../extension/icon48.png ../extension/icon128.png dist/
cp manifest.json popup.html site.js dist/
cp ../extension/popup.js dist/popup.js
# the store popup has no YouTube TV button
sed -i "/getElementById('tv')/d" dist/popup.js
rm -f ambient-video-store.zip && (cd dist && zip -qr ../ambient-video-store.zip .)
echo built store/ambient-video-store.zip
