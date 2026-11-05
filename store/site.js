// Lets the Ambient Video site know the extension is installed, so it can hide its "Add to Chrome" button.
document.documentElement.dataset.ambientExt = chrome.runtime.getManifest().version;
