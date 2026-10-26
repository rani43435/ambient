# Ambient Video for the Mac

The Pocket TV app, for the Mac: a window that is its own browser, so YouTube TV
(sign in with your phone), Plex, Vimeo or any site plays inside it with the glow.
Uses the same glow script as the Pocket TV app (`app/ambient.js`, copied from
`android/app/src/main/assets/ambient.js`).

- `app/` — the Electron app (main.js, preload.js, settings panel, home page).
- `launcher/` — the `Ambient Video.app` wrapper: `Contents/MacOS/launcher` starts
  `Contents/Resources/Electron.app` (Electron 33.2.1, darwin-arm64) with `Contents/Resources/app`.

Shortcuts: ⌘, glow settings · ⌘G glow on/off · ⌘⇧H home · ⌘Y YouTube TV · ⌘[ back · ⌃⌘F full screen.
