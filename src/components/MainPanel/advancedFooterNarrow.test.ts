import { describe, it, expect } from 'vitest';
import { compile } from 'sass';
import { resolve } from 'node:path';

// At the side panel's 360 to 420px the advanced footer holds the status dot, the mode picker, the input level,
// Start, the output waveform and the language pair. Measured in the built extension at 420px, the row needed 576px
// and pushed the pair and the output waveform out of the panel. Below a 480px container the input level narrows,
// the output waveform is hidden and the pair ends in an ellipsis. Asserted on the compiled CSS.
const css = compile(resolve(__dirname, 'MainPanel.scss')).css;
const rule = (selector: string, within = css) => within.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
const narrow = css.match(/@container \(max-width: 480px\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';

describe('the advanced footer at a narrow width', () => {
  it('lets the metadata box shrink below its content', () => {
    const metadata = rule('\\.control-footer\\.advanced \\.footer-metadata');
    expect(metadata).toMatch(/\bmin-width:\s*0\b/);
    expect(metadata).not.toMatch(/flex-shrink:\s*0\b/);
  });

  it('cuts the language pair with an ellipsis on one line', () => {
    const pair = rule('\\.control-footer\\.advanced \\.footer-metadata \\.language-pair');
    expect(pair).toMatch(/\bmin-width:\s*0\b/);
    expect(pair).toMatch(/\boverflow:\s*hidden\b/);
    expect(pair).toMatch(/\btext-overflow:\s*ellipsis\b/);
    expect(pair).toMatch(/\bwhite-space:\s*nowrap\b/);
  });

  it('keeps Start from shrinking', () => {
    expect(rule('\\.control-footer\\.advanced \\.action-cluster')).toMatch(/flex-shrink:\s*0\b/);
  });

  it('narrows the input level and hides the output waveform below a 480px container', () => {
    expect(narrow).not.toBe('');
    expect(rule('\\.control-footer\\.advanced \\.waveform-input-group', narrow)).toMatch(/\bwidth:\s*64px\b/);
    expect(rule('\\.control-footer\\.advanced \\.waveform-input-group \\.waveform-strip--full', narrow)).toMatch(/\bwidth:\s*100%/);
    expect(rule('\\.control-footer\\.advanced > \\.waveform-strip--output', narrow)).toMatch(/\bdisplay:\s*none\b/);
  });
});
