# Design

How ExTrans should look and why. The mechanics of the theme (the `--sk-*` tokens, the Sass
aliases, the guards) are in `CLAUDE.md` under "UI Design System"; this file is the art direction
those tokens serve.

## Brand

- The product name users see is **ExTrans**. Code identifiers, storage keys, message keys, URLs and
  the Kizuna AI provider name keep "Sokuji", so settings carry over between versions.
- Strings that name the Electron app as macOS shows it (screen and system audio permissions, the
  driver repair prompts, the caption-share firewall note) keep "Sokuji" until the desktop
  packaging is renamed, so they match what the user sees in System Settings.
- The mark is a white "Ex" on a rounded square with the accent gradient
  (`extension/icons/source/extrans-icon.svg`; the PNGs are rendered from it).
- ExTrans is based on Sokuji by Kizuna AI Lab, licensed under AGPL-3.0. Keep that line in the
  READMEs and the user guide.

## Direction

Calm, trustworthy and technical: a fintech-style navy and blue palette (the reference was
exchain.jp's palette and shapes, not its logo, images or copy). Two schemes, both first-class:

| Role | Dark (default) | Light |
|---|---|---|
| Page | `#0d1530` navy | `#ffffff` |
| Surface | `#121c3a` | `#f6f9fd` |
| Body text | `#f3f6fc` | `#1e3056` |
| Accent text | `#6f9bff` | `#1c46ab` |
| Primary action | gradient `#2d5bd2` to `#1572b8` | gradient `#1c46ab` to `#1572b8` |

`src/styles/theme.scss` is the source of truth; the table is a summary.

## Rules

- **One primary action per view**, drawn with the `primary-gradient` mixin as a pill
  (`$radius-pill`). Secondary actions are outlined pills; tertiary ones are links.
- **Shapes.** Radii 6 / 10 / 14 px (`$radius-sm/md/lg`) plus the pill. Cards carry `$shadow-card`,
  floating panels `$shadow-float`; nothing else casts a shadow.
- **Selection** is the accent tint plus a 3 px inset accent bar on the leading edge, never colour
  alone.
- **Glows.** The wizard page and the popup have two soft radial glows (accent and info) at the
  top corners. Keep them under 15% so text contrast is measured against the flat colour.
- **Type.** Nunito (variable weight, SIL OFL 1.1), bundled from `src/assets/fonts/nunito` with
  only its upright Latin, Vietnamese and Cyrillic subsets, then the system stack and the CJK tail
  (pinned by `uiFont.test.ts`). Headings weight 700 with slight letter-spacing. The popup loads the
  same files.
- **Contrast.** Body text 4.5:1 and large or secondary icons 3:1 on every surface, in both schemes;
  white on every accent fill 4.5:1. `theme.consistency.test.ts` enforces these.
- **Status fills.** In dark mode the bright `error` and `usage` hues are for text and outlines;
  a fill under a white label (Stop, recording, the attention banner) uses `error-fill` or
  `usage-fill`, and its hover `error-deep`.
- **Motion.** Transitions 120 to 200 ms on colour, shadow and a 1 px lift. Every transform and
  transition has a `prefers-reduced-motion` fallback.
- **Width.** The side panel is used at 360 to 420 px. Every new layout is checked there first.
  Below a 480 px container the advanced footer narrows its input level, hides the output
  waveform and cuts the language pair with an ellipsis (`advancedFooterNarrow.test.ts`).

## Surfaces

- Extension: `fullpage.html` (side panel: main panel, settings, the six-step setup wizard, the
  tour) and `popup.html` (plain CSS in `extension/popup.css`, mirroring the tokens as `--pp-*`).
- User-coloured surfaces (the conversation, the subtitles) keep the user's colours; an unset
  conversation colour follows the scheme, and its dark default is the page navy.
