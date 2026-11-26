# ExTrans Vietnamese user guide and tutorial video

## What was made

| Deliverable | Path |
|---|---|
| Recorder script (468 lines) | `scripts/dev/record-user-guide.mjs` |
| Highlighted stills (16 PNG) | `docs/user-guide/images/01-popup-open.png` ... `16-settings-back.png` |
| Vietnamese guide (116 lines) | `docs/user-guide/extrans-user-guide.vi.md` |
| Tutorial video (git-ignored) | `docs/user-guide/media/extrans-user-guide.mp4` |

Video: H.264, yuv420p, faststart, 720x1474, 105.04 s, 4,378,345 bytes (about 4.2 MB).

Every step shows a numbered gold ring with a black outline and white halo (visible on light backgrounds), a Vietnamese caption bar and a small cursor dot at the target. A solid ring means "click here". A dashed ring with a letter means "look here, do not click". The overlay is injected 2.2 s before each click and removed after it.

Flow covered: title card, popup, wizard steps 1-6 (language, scenario, provider, credentials with "Skip for now", language pair, finish), tour (2 steps, then skip), main panel, Settings list, Accounts and keys, Appearance, switch to Light (about 2.5 s on screen), switch back to Dark, back to the session, end card with the AGPL line.

## How to re-run

```
export PATH=$HOME/.nvm/versions/node/v22.23.5/bin:$PATH
export DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/Cellar/x265/4.2/lib   # Homebrew ffmpeg needs this on this machine
node scripts/dev/record-user-guide.mjs --dist /tmp/extrans-dist-check
```

Defaults: `--dist extension/dist`, profile `/tmp/extrans-guide-profile`, ffmpeg from `--ffmpeg`, then `$FFMPEG`, then `$FFMPEG_PATH`, then `/opt/homebrew/bin/ffmpeg`. The final run used `/tmp/extrans-dist-check` as requested; the default dist is `extension/dist`.

## Acceptance checks

- Script ran end to end, exit 0, 16 stills plus the MP4.
- ffprobe: h264, yuv420p, 105.04 s (over 30 s).
- Nothing is typed into any field and no key is read or printed. The credentials step only rings the key field and the guide link, then clicks "Skip for now".
- After the run: no Chrome for Testing process is running, `/tmp/extrans-guide-profile` and the temp video directory are gone.
- `/tmp/sokuji-guide-profile`, `/tmp/sokuji-ui-exchain-pw-profile`, the main checkout, `src/`, `extension/` and `/tmp/extrans-dist-check` were not touched. Nothing was committed, stashed or reset.

## Steps that could not be shown as real actions

- **Popup "Open ExTrans" is highlighted but not clicked.** A real click closes the popup and opens the side panel, which Playwright cannot drive. The popup is opened as a normal tab with `chrome.tabs.query` stubbed (popup.html only) so the supported-site state with the "Open ExTrans" button appears.
- **Side panel is shown as `fullpage.html`** in a 420 px viewport (the panel's designed width). The UI is the same code.
- **"Start" is highlighted, not clicked.** It needs a valid API key; the recording never enters one.
- **Wizard provider step** clicks the first non-disabled provider card (Google Gemini in the stills) because Next stays locked until one is chosen. The guide text says "pick the provider you have an account with".

## Concerns

- `05-wizard-credentials.png` could not be viewed directly: a privacy hook blocked reading the file because of its name. I did not work around it. The same frame was checked in the video contact sheet (rings A, B and "Skip for now" visible), and the script only rings those elements. Please look at that one still yourself.
- In `13-settings-api-key.png` the caption bar covers the top-left "Back to the list" ring, so only the ring's lower edge and the cursor dot show. Step 13's main highlight (A, the provider list) is clear and the guide text names the button. Reposition the caption if you want that ring fully visible.
- The guide quotes the English UI labels; I read them from `src/locales/en/translation.json` and the components rather than from a published build.

## Unresolved questions

- Should the stills and the MP4 be refreshed from `extension/dist` once that build is final, rather than `/tmp/extrans-dist-check`?
- Is the guide's "Add to Chrome / Get" store wording acceptable before the extension is published, or should that bullet be removed until it is?
