#!/bin/sh
# Rebuild tv.js from the shared glow script (run after changing android/.../ambient.js).
cd "$(dirname "$0")" && cat tv-pre.js ../android/app/src/main/assets/ambient.js tv-post.js > tv.js
