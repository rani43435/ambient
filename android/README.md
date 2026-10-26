# Ambient Video for the Pocket TV

Android app: a full-screen browser (WebView) that adds the Ambilight glow to any
video it plays — YouTube (m.youtube.com) or other sites, including players inside
iframes. `app/src/main/assets/ambient.js` is injected into every page and frame;
it reads the `<video>` directly (same colour method as `index.html`), so no screen
sharing is needed. Protected services (Netflix, HBO…) show black and can't glow.

- Home screen: YouTube, "Video from this device", a link/search box, recent links.
- On a video: the round glow button (top left) or the remote's Menu key opens
  glow on/off, strength and size. Back goes back.

Install: double-click **Install Ambient on Pocket TV** (in ~/Applications on the Mac).
APK: `dist/AmbientVideo.apk`.

Build: `cd android && gradle :app:assembleRelease` (Android SDK 34, JDK 17).
Signing key `ambient-release.keystore` + `signing.properties` are kept off git
(a copy is on the Mac next to the installer); keep them so updates install over the old app.
