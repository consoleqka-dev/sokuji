// The name users see for the desktop app, and the storage locations that keep
// the name it used to have.
//
// Electron derives app.getPath('userData') (and from it sessionData, crash
// dumps and, off macOS, logs) from the app's name at startup, which is the
// package.json `productName`. Renaming the product therefore moves every
// user's settings, history, sign-in and downloaded models to an empty folder
// unless the old location is pinned. app.setName() does not help: it leaves
// those paths where the startup name put them.
//
// Deliberately does not require('electron') at load time so it stays unit
// testable; main.js passes the app in.

const path = require('path');

/** What the user sees: window titles, dialogs, menus, permission lists. */
const PRODUCT_NAME = 'ExTrans';

/** The folder name the app has always stored its data under. Never change it. */
const STORAGE_DIR_NAME = 'Sokuji';

/**
 * Keep userData (and the paths under it) and the macOS log folder where
 * earlier versions put them. Must run before anything reads those paths:
 * electron-conf resolves userData when it is constructed, at require time.
 *
 * @param {Electron.App} app
 * @param {{ platform?: NodeJS.Platform }} [deps]
 * @returns {{ userData: string, logs: string|null }} what was pinned
 */
function pinStorageLocations(app, { platform = process.platform } = {}) {
  const userData = path.join(app.getPath('appData'), STORAGE_DIR_NAME);
  app.setPath('userData', userData);

  // Windows and Linux keep logs inside userData, so the line above covers
  // them; macOS keeps them in ~/Library/Logs/<app name>.
  let logs = null;
  if (platform === 'darwin') {
    logs = path.join(app.getPath('home'), 'Library', 'Logs', STORAGE_DIR_NAME);
    app.setAppLogsPath(logs);
  }
  return { userData, logs };
}

module.exports = { PRODUCT_NAME, STORAGE_DIR_NAME, pinStorageLocations };
