const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { ProfileManager } = require('./automation/profile-manager');
const { FlowRunner } = require('./automation/flow-runner');

let win;
let profileManager;
let runner;

function appDir() { return app.getPath('userData'); }
function ensureDirs() {
  for (const p of ['profiles','downloads','logs']) fs.mkdirSync(path.join(appDir(), p), { recursive: true });
}

async function createWindow() {
  ensureDirs();
  profileManager = new ProfileManager(appDir());
  runner = new FlowRunner({ appDir, emit: (event, data) => win?.webContents.send(event, data) });
  win = new BrowserWindow({
    width: 1440, height: 920, minWidth: 1100, minHeight: 720,
    backgroundColor: '#111318',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  await win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

ipcMain.handle('profiles:list', () => profileManager.list());
ipcMain.handle('profiles:add', (_, name) => profileManager.add(name));
ipcMain.handle('profiles:remove', (_, id) => profileManager.remove(id));
ipcMain.handle('profiles:login', async (_, id) => profileManager.openForLogin(id));
ipcMain.handle('profiles:open', async (_, id) => profileManager.openForAutomation(id));
ipcMain.handle('profiles:stop', async (_, id) => profileManager.stop(id));
ipcMain.handle('queue:run', async (_, payload) => runner.runQueue(payload));
ipcMain.handle('queue:stop', async () => runner.stop());
ipcMain.handle('queue:status', () => runner.status());
ipcMain.handle('settings:get', () => runner.settings());
ipcMain.handle('settings:set', (_, settings) => runner.saveSettings(settings));
ipcMain.handle('open-folder', (_, folder) => shell.openPath(folder));

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
