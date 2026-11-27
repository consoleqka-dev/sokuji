# ExTrans user guide: light theme, unpacked install, Gemini key text, live demo

## Outcome

The recorder and the Vietnamese guide are updated. A keyless run exits 0 and produced 22 light-theme stills plus the MP4
(h264, yuv420p, 720x1474, 165 s). The keyed path was exercised only with an obviously fake key (see "Verified"); the
owner runs the real keyed recording.

## What changed

Files touched: `scripts/dev/record-user-guide.mjs` (rewritten, about 770 lines), `docs/user-guide/extrans-user-guide.vi.md`,
`docs/user-guide/images/*` (24 step numbers, 22 stills; the old 16 stills are gone), `docs/user-guide/media/extrans-user-guide.mp4`
(git-ignored).

1. **Light theme throughout.** Pass 1 stores `settings.common.theme = 'light'` and `localStorage['sokuji.theme'] = 'light'`
   before the app loads; pass 2 uses `colorScheme: 'light'`. The Appearance section shows Dark (step 22 click) then Light (step 23 click).
2. **No "based on Sokuji" line** in the title or end card of the video. The license section stays in the markdown guide.
3. **Store bullet removed**; the video and guide start with `chrome://extensions`: Developer mode (clicked), Load unpacked
   (highlighted), a text card saying to pick `extension/dist` (native picker cannot be recorded), the ExTrans card, a pin text card.
   Playwright drives chrome://extensions fine (shadow-DOM selectors); if it ever cannot, steps 1-4 fall back to text cards.
   The page is zoomed to 0.8 on the `extensions-manager` element only, because at 420 px the Developer mode toggle ran off the edge.
4. **Gemini key section:** text card in the video (step 6) and a short text-only section in the guide (aistudio.google.com/apikey,
   Google sign-in, Create API key, project, copy, keep private). No screenshots.
5. **Live demo** (`--live` or `EXTRANS_GEMINI_API_KEY`): wizard "I have my own API key" + Google Gemini, key typed into a masked
   field (CSS `-webkit-text-security: disc` plus blur, injected on every page, fail-closed computed-style check before typing),
   Validate, wait for "Key accepted." (45 s), English to Vietnamese, Finish; main panel mode "Me", Start, wait up to 60 s for at
   least 2 translated lines, hold 6 s, Stop. Mic is Chrome's fake device fed from a WAV built at run time (`say -v Samantha`, 3-4
   sentences, then ffmpeg to 48 kHz 16-bit mono PCM, about 40 s) in a temp dir.
6. **Keyless** (no env, no `--live`): Skip for now, Start highlighted not clicked, one-line notice printed.
7. **Caption never covers a solid ring** (CAP_REACH logic in `installOverlay`) kept. Checked on stills 02, 03, 04, 17, 23.

Step numbers in the guide match the captions (1-24). Steps 5 and 6 are text cards, so there are 22 stills.

## Secrecy design

- Key source is only env `EXTRANS_GEMINI_API_KEY` or a hidden raw-mode stdin prompt (`--live`, env unset). Never argv, never a file.
- The env var is deleted from `process.env` right after reading; child processes get a copy without it.
- The key is typed with `page.keyboard.type` and is never passed to `page.evaluate`; error output goes through `scrub()`.
- The Chrome profile, video temp dir and audio temp dir are removed in `finally` and on SIGINT/SIGTERM.

## How to run the keyed recording

```
export PATH=$HOME/.nvm/versions/node/v22.23.5/bin:$PATH
export DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/Cellar/x265/4.2/lib   # Homebrew ffmpeg on this machine
# build the extension first; the default --dist is extension/dist (pass --dist DIR for another build)

EXTRANS_GEMINI_API_KEY=...  node scripts/dev/record-user-guide.mjs     # env var
node scripts/dev/record-user-guide.mjs --live                            # hidden prompt, no echo
```

Do not wrap the node call in `env -u ...`: macOS SIP strips `DYLD_*` through `/usr/bin/env` and ffmpeg then fails to load libx265.
The usage comment at the top of the script documents both commands. Expect about 3-4 minutes; a live run is longer.

## Verified

- `node --check` passes; keyless run exit 0; stills and MP4 produced; stills 02, 03, 04, 17, 23 viewed (light theme, dark only
  in the Dark still; captions clear of solid rings).
- Fake-key dry run (`FAKE-DRYRUN-...`, temp output dirs): fake mic WAV built, masking check passed, key typed, Validate pressed,
  Google rejected the key, script printed a clear error and exited 1. Afterwards: the fake key string does not appear in the log,
  stills or any file; profile and temp dirs were removed; no Chrome for Testing left running.
- Fake mic: `getUserMedia({audio:true})` resolves with "Fake Default Audio Input" and non-zero signal energy.

## Not verified

- Anything after a successful Validate: "Key accepted." wording and timing, the Me-mode session, at least 2 translated lines in 60 s,
  Stop, and the key staying masked on Settings > Accounts and keys. These need a real key.
- Whether the app's echo-cancellation/noise-suppression constraints leave the synthetic voice audible enough to be transcribed.
  If no lines arrive, the run fails with a clear error rather than recording an empty session.
- The pin step and the native folder picker cannot be recorded; they are text cards.
- Still 11 (`11-wizard-api-key.png`) was not opened (name-based privacy hook concern avoided by the rename); the keyless run
  only rings the field and presses Skip.
- The extensions page was recorded from a build in `/tmp`, so the version and extension ID shown are from that build.

## Cleanup

Removed `/tmp/extrans-dist-rec` and all my temp scripts, logs, zoom images and dry-run dirs. The throwaway profile was deleted by the script.
Other `/tmp/extrans-*` entries belong to earlier sessions and were not touched; neither was `/tmp/sokuji-guide-profile`.
Nothing committed, stashed or reset.

## Unresolved questions

- Should the committed stills and MP4 be refreshed from the real `extension/dist` build (version and extension ID appear in stills 03 and 04)?
- Step 18 wording describes both modes; once the keyed video exists, should the guide drop the keyless sentence?

Status: DONE_WITH_CONCERNS
Summary: Recorder and guide are updated for light theme, unpacked install, a text-only Gemini key section and a live masked-key demo; the keyless run passes and the keyed path was only exercised with a fake key (rejected, exit 1, no leak, cleanup done).
Concerns/Blockers: the real-key flow (validation success, Me-mode translation lines, Stop) is unverified by design; the owner must run it and view the result.
