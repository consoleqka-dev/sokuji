# Review checklist for UI changes

Use this for any change that touches a stylesheet, a visible string or a layout. See `DESIGN.md`
for the direction and `CLAUDE.md` ("UI Design System") for the token mechanics.

## Must pass

- `NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/styles` (Node 22). On a loaded
  machine add `--testTimeout=120000`; a timeout there is not a failure of the change.
- `cd extension && NODE_ENV=production npm run build -- --mode production`.
- No new colour literal in a component stylesheet: use a token alias. If a literal is truly
  needed (a brand mark, a user preset), the ledger row in `colourLedger.consistency.test.ts`
  moves in the same diff with a comment saying why.
- No test is weakened to make a change pass. A pinned value changes only with the reason in the
  commit message.

## Look at it

- Screenshots in **both schemes** at 420 px wide (the side panel) and at 1280 px: the wizard steps,
  the main panel, settings and the popup. Compare with the previous build side by side.
- Keyboard: every control reachable, with a visible focus ring in both schemes.
- Reduced motion: nothing moves or lifts.

## Brand and copy

- User-visible text says **ExTrans**; identifiers, keys and storage names stay as they are.
- Strings about the Electron app's macOS permissions keep the name macOS shows (see `DESIGN.md`).
- A new string goes into all catalogs (`src/locales/*/translation.json`, and
  `extension/_locales/*/messages.json` for the extension shell).
- The AGPL attribution to Sokuji by Kizuna AI Lab stays in the READMEs and the user guide.

## Never

- API keys in screenshots, logs, test fixtures or the user guide.
- Logos, images or copy taken from a reference site.
