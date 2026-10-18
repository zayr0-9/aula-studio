import { validateStreamProfile } from '../shared/stream';
import { validateKnobProfile } from '../shared/knob';
import { app, BrowserWindow, ipcMain, session } from 'electron';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ShellInfo } from '../shared/contracts';
import type { IpcMainInvokeEvent } from 'electron';
import { createBackend } from './backend';

const backend = createBackend();
const { brightness, knob, stream } = backend;
const primaryInstance = app.requestSingleInstanceLock();
if (!primaryInstance) app.quit();

const directory = fileURLToPath(new URL('.', import.meta.url));
let mainWindow: BrowserWindow | null = null;
const developmentUrl = process.env.ELECTRON_RENDERER_URL;

function trustedRendererUrl(url: string): boolean {
  if (!app.isPackaged && developmentUrl) {
    const expected = new URL(developmentUrl);
    return expected.hostname === '127.0.0.1' && new URL(url).origin === expected.origin;
  }
  return url === new URL('../renderer/index.html', import.meta.url).href;
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 850,
    minWidth: 880,
    minHeight: 640,
    backgroundColor: '#10151b',
    title: 'AULA Studio',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(directory, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!trustedRendererUrl(url)) event.preventDefault();
  });
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.webContents.on('did-start-navigation', () => {
    knob.disable();
    stream.stop();
  });
  mainWindow.webContents.on('render-process-gone', () => {
    knob.disable();
    stream.stop();
  });
  mainWindow.on('closed', () => {
    knob.disable();
    stream.stop();
    mainWindow = null;
  });
  if (!app.isPackaged && developmentUrl) {
    if (!trustedRendererUrl(developmentUrl))
      throw new Error('Only loopback development URL allowed');
    void mainWindow.loadURL(developmentUrl);
  } else {
    void mainWindow.loadFile(join(directory, '../renderer/index.html'));
  }
}

void app.whenReady().then(() => {
  if (!primaryInstance) return;
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) =>
    callback(false),
  );
  session.defaultSession.setPermissionCheckHandler(() => false);
  function authorize(event: IpcMainInvokeEvent): void {
    if (
      !mainWindow ||
      event.sender !== mainWindow.webContents ||
      event.senderFrame !== mainWindow.webContents.mainFrame ||
      !trustedRendererUrl(event.senderFrame.url)
    ) {
      throw new Error('Untrusted renderer');
    }
  }
  ipcMain.handle('shell:info', (event): ShellInfo => {
    authorize(event);
    return {
      mode: 'simulator',
      hardwareEnabled: backend.hardwareEnabled,
      platform: process.platform,
    };
  });
  ipcMain.handle('stream:status', (event, ...args: unknown[]) => {
    authorize(event);
    if (args.length) throw new Error('Unexpected stream status arguments');
    stream.heartbeat();
    return stream.snapshot();
  });
  ipcMain.handle('stream:start', (event, ...args: unknown[]) => {
    authorize(event);
    if (args.length !== 1) throw new Error('Expected one stream profile');
    validateStreamProfile(args[0]);
    if (stream.isOwned()) throw new Error('Stream already owned');
    brightness.reserveStream();
    try {
      return stream.start(args[0]);
    } catch (error) {
      if (!stream.isOwned()) brightness.releaseStream();
      throw error;
    }
  });
  ipcMain.handle('stream:update', (event, ...args: unknown[]) => {
    authorize(event);
    if (args.length !== 1) throw new Error('Expected one stream profile');
    validateStreamProfile(args[0]);
    return stream.update(args[0]);
  });
  ipcMain.handle('stream:stop', (event, ...args: unknown[]) => {
    authorize(event);
    if (args.length) throw new Error('Unexpected stream stop arguments');
    return stream.stop();
  });
  ipcMain.handle('indicators:read', (event, ...args: unknown[]) => {
    authorize(event);
    if (args.length) throw new Error('Unexpected indicator read arguments');
    return brightness.readIndicators();
  });
  ipcMain.handle('indicators:set', (event, ...args: unknown[]) => {
    authorize(event);
    if (args.length !== 2) throw new Error('Expected indicator key and RGB');
    return brightness.setIndicator(args[0], args[1]);
  });
  ipcMain.handle('brightness:read', (event, ...args: unknown[]) => {
    authorize(event);
    if (args.length !== 0) throw new Error('Unexpected read arguments');
    return brightness.read();
  });
  ipcMain.handle('brightness:set', (event, ...args: unknown[]) => {
    authorize(event);
    if (args.length !== 1) throw new Error('Expected one brightness value');
    return brightness.set(args[0]);
  });
  ipcMain.handle('effect:read', (event, ...args: unknown[]) => {
    authorize(event);
    if (args.length !== 0) throw new Error('Unexpected read arguments');
    return brightness.readEffect();
  });
  ipcMain.handle('effect:set', (event, ...args: unknown[]) => {
    authorize(event);
    if (args.length !== 1) throw new Error('Expected one effect selector');
    return brightness.setEffect(args[0]);
  });
  ipcMain.handle('effect:set-brightness', (event, ...args: unknown[]) => {
    authorize(event);
    if (args.length !== 2) throw new Error('Expected effect and brightness');
    return brightness.setEffectBrightness(args[0], args[1]);
  });
  ipcMain.handle('speed:read', (event, ...args: unknown[]) => {
    authorize(event);
    if (args.length !== 0) throw new Error('Unexpected read arguments');
    return brightness.readSpeed();
  });
  ipcMain.handle('speed:set', (event, ...args: unknown[]) => {
    authorize(event);
    if (args.length !== 1) throw new Error('Expected one speed value');
    return brightness.setSpeed(args[0]);
  });
  ipcMain.handle('color:read', (event, ...args: unknown[]) => {
    authorize(event);
    if (args.length !== 0) throw new Error('Unexpected color arguments');
    return brightness.readColor();
  });
  ipcMain.handle('color:set', (event, ...args: unknown[]) => {
    authorize(event);
    if (args.length !== 1) throw new Error('Expected one color object');
    return brightness.setColor(args[0]);
  });
  ipcMain.handle('mapping:read', (event, ...args: unknown[]) => {
    authorize(event);
    if (args.length !== 0) throw new Error('Unexpected mapping arguments');
    return brightness.readMappings();
  });
  ipcMain.handle('mapping:set', (event, ...args: unknown[]) => {
    authorize(event);
    if (args.length !== 2) throw new Error('Expected source and target key');
    return brightness.setMapping(args[0], args[1]);
  });
  ipcMain.handle('mapping:read-pgup', (event, ...args: unknown[]) => {
    authorize(event);
    if (args.length) throw new Error('Unexpected mapping arguments');
    return brightness.readPgUp();
  });
  ipcMain.handle('mapping:set-pgup', (event, ...args: unknown[]) => {
    authorize(event);
    if (args.length !== 1) throw new Error('Expected one mapping target');
    return brightness.setPgUp(args[0]);
  });
  ipcMain.handle('knob:status', (event, ...args: unknown[]) => {
    authorize(event);
    if (args.length) throw new Error('Unexpected knob arguments');
    knob.heartbeat();
    return knob.snapshot();
  });
  ipcMain.handle('knob:enable', (event, ...args: unknown[]) => {
    authorize(event);
    if (args.length !== 1) throw new Error('Expected one knob profile');
    validateKnobProfile(args[0]);
    return knob.enable(args[0]);
  });
  ipcMain.handle('knob:profile', (event, ...args: unknown[]) => {
    authorize(event);
    if (args.length !== 1) throw new Error('Expected one knob profile');
    validateKnobProfile(args[0]);
    return knob.setProfile(args[0]);
  });
  ipcMain.handle('knob:disable', (event, ...args: unknown[]) => {
    authorize(event);
    if (args.length) throw new Error('Unexpected knob arguments');
    return knob.disable();
  });
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Finish the active bounded transaction; discard queued work before exiting.
let shutdownStarted = false;
let shutdownReady = false;
app.on('before-quit', (event) => {
  if (shutdownReady) return;
  event.preventDefault();
  if (shutdownStarted) return;
  shutdownStarted = true;
  void Promise.all([stream.shutdown(), knob.shutdown(), brightness.stop()]).finally(() => {
    shutdownReady = true;
    app.quit();
  });
});
