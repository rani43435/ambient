# Chrome Web Store listing — Ambient Video

Upload: `ambient-video-store.zip` (run `./build.sh` to rebuild it).

## Store listing tab
**Name** (from the manifest): Ambient Video – Glow for YouTube

**Summary** (from the manifest): Ambilight for YouTube: the colours at the edge of the video glow softly around the player. Works in full screen.

**Description:**
Ambient Video brings an Ambilight-style glow to YouTube.

The colours at the very edge of the picture spill out softly around the player, so the video feels bigger and the screen blends into the room — great in a dark room and in full screen.

• Works on any YouTube video, in the normal player, theatre mode and full screen
• One button next to YouTube's settings gear turns the glow on or off (or press G)
• Choose how strong the glow is and how big the video is
• Light: the glow reads a tiny 96×54 copy of the frame a few times a second
• Private: nothing leaves your computer — no accounts, no tracking, no data collected

Made by Rani Marjy. More at https://rani43435.github.io/ambient/

**Category:** Entertainment (or: Make Chrome Yours → Accessibility/Photos are not a fit)
**Language:** English

**Graphics:**
- Store icon 128×128: `icon128.png` (inside the zip / extension folder)
- Screenshots 1280×800: `screenshot-1.png`, `screenshot-2.png`
- Small promo tile 440×280: `promo-small-440x280.png`

## Privacy practices tab
**Single purpose:** Adds an ambient (Ambilight-style) glow around the YouTube video player, made from the colours at the edge of the video.

**Permission justification:**
- `storage`: saves the user's glow settings (on/off, strength, video size) so they stay the same next time.
- Host access (youtube.com via content script): the glow is drawn inside the YouTube player and reads the colours of the video that is playing.
- Host access (rani43435.github.io/ambient): tells the Ambient Video website that the extension is installed, so the site can hide its "Add to Chrome" button. Nothing is read or sent.

**Remote code:** No, I am not using remote code.

**Data usage:** Collects none of the listed data types. Tick the three certifications (not sold, not used for unrelated purposes, not used for credit).

**Privacy policy URL:** https://rani43435.github.io/ambient/privacy.html

## Distribution tab
Free · Public · All regions
