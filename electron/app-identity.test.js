import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PRODUCT_NAME, STORAGE_DIR_NAME, pinStorageLocations } = require('./app-identity.js');

const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(here, '..', 'package.json'), 'utf8'));

function fakeApp() {
  const paths = { appData: path.join('/home/u/AppData'), home: '/home/u' };
  const calls = [];
  return {
    calls,
    getPath: (key) => paths[key],
    setPath: (key, value) => { calls.push(['setPath', key, value]); paths[key] = value; },
    setAppLogsPath: (value) => { calls.push(['setAppLogsPath', value]); },
  };
}

describe('pinStorageLocations', () => {
  it('keeps userData in the folder earlier versions used, not one named after the product', () => {
    const app = fakeApp();
    const { userData } = pinStorageLocations(app, { platform: 'win32' });
    expect(userData).toBe(path.join('/home/u/AppData', 'Sokuji'));
    expect(app.calls).toEqual([['setPath', 'userData', userData]]);
    expect(userData).not.toContain(PRODUCT_NAME);
  });

  it('keeps the macOS log folder too, because only setAppLogsPath moves it', () => {
    const app = fakeApp();
    const { logs } = pinStorageLocations(app, { platform: 'darwin' });
    expect(logs).toBe(path.join('/home/u', 'Library', 'Logs', 'Sokuji'));
    expect(app.calls).toContainEqual(['setAppLogsPath', logs]);
  });

  it('leaves logs alone off macOS, where they live inside userData', () => {
    for (const platform of ['win32', 'linux']) {
      const app = fakeApp();
      expect(pinStorageLocations(app, { platform }).logs).toBeNull();
      expect(app.calls.some(([kind]) => kind === 'setAppLogsPath')).toBe(false);
    }
  });
});

describe('product identity', () => {
  it('shows ExTrans while the storage folder keeps its old name', () => {
    expect(PRODUCT_NAME).toBe('ExTrans');
    expect(STORAGE_DIR_NAME).toBe('Sokuji');
  });

  it('matches the name packaging gives the app', () => {
    expect(pkg.productName).toBe(PRODUCT_NAME);
    expect(pkg.build.productName).toBe(PRODUCT_NAME);
    const forge = require('../forge.config.js');
    expect(forge.packagerConfig.name).toBe(PRODUCT_NAME);
  });

  it('keeps the identifiers that permissions, updates and the audio naming depend on', () => {
    expect(pkg.name).toBe('sokuji');
    expect(pkg.build.appId).toBe('ai.kizunaai.sokuji');
    const forge = require('../forge.config.js');
    expect(forge.packagerConfig.appId).toBe('ai.kizunaai.sokuji');
    expect(forge.packagerConfig.executableName).toBe('sokuji');
    const squirrel = forge.makers.find((m) => m.name === '@electron-forge/maker-squirrel');
    expect(squirrel.config.name).toBe('Sokuji');
    expect(squirrel.config.exe).toBe('sokuji.exe');
  });

  it('says ExTrans in the macOS usage descriptions', () => {
    for (const text of Object.values(pkg.build.mac.extendInfo)) expect(text).not.toMatch(/sokuji/i);
  });
});

describe('main process start-up order', () => {
  const main = readFileSync(path.join(here, 'main.js'), 'utf8');

  it('pins the storage locations before electron-conf resolves userData at require time', () => {
    const pin = main.indexOf('pinStorageLocations(app);');
    const adapter = main.indexOf("require('./better-auth-adapter')");
    expect(pin).toBeGreaterThan(-1);
    expect(adapter).toBeGreaterThan(-1);
    expect(pin).toBeLessThan(adapter);
  });

  it('pins before any other local module is required', () => {
    const pin = main.indexOf('pinStorageLocations(app);');
    const firstLocal = main.search(/require\('\.\/(?!app-identity)/);
    expect(firstLocal).toBeGreaterThan(pin);
  });
});

describe('user-visible strings in the main process', () => {
  // "Sokuji" may remain only where something else has to match it byte for
  // byte: log tags, the User-Agent token, installed driver and audio device
  // names, the Squirrel package id and install folder, the storage folder, the
  // internal app name and URLs. Prose (dialogs, titles, menus, error text) says
  // ExTrans.
  const kept = [
    [/\[Sokuji[\]\s]/, 'log tags'],
    [/Sokuji\//, 'User-Agent product token'],
    [/SokujiVirtualAudio|Sokuji Virtual Audio|isSokujiVirtualAudioInstalled/, 'installed macOS driver and device names'],
    [/devices contains \\"Sokuji\\"/, 'macOS device-list probe for the installed driver'],
    [/Sokuji_App_Capture|Sokuji_Virtual_(Speaker|Mic)|SokujiVerifyProbe|"Sokuji App Capture"|"Sokuji"|Monitor of Sokuji/, 'PulseAudio/PipeWire names the renderer and virtual devices match'],
    [/STORAGE_DIR_NAME\s*=\s*'Sokuji'/, 'user-data folder name'],
    [/'Sokuji'\)/, 'Squirrel install root'],
    [/%LocalAppData%\\+Sokuji/, 'Squirrel install folder in a comment'],
    [/\(ExTrans\|Sokuji\)|`Sokuji-<version>\.Setup\.exe`/, 'installers from before the rename'],
    [/https?:\/\/|kizuna-ai-lab\/sokuji/, 'URLs'],
  ];

  const files = readdirSync(here).filter((f) => f.endsWith('.js') && !/\.test\.js$/.test(f));

  it('has no stray Sokuji prose in non-test sources', () => {
    const offenders = [];
    for (const file of files) {
      readFileSync(path.join(here, file), 'utf8').split('\n').forEach((line, i) => {
        if (!/Sokuji/.test(line)) return;
        if (kept.some(([re]) => re.test(line))) return;
        offenders.push(`${file}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
