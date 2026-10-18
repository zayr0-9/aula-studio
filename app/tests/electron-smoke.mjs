import { app, BrowserWindow, ipcMain } from 'electron';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

let window;
const timeout = setTimeout(() => {
  console.error('Electron smoke test timed out');
  app.exit(1);
}, 20000);
async function run() {
  try {
    console.log('smoke: waiting for Electron ready');
    await app.whenReady();
    console.log('smoke: ready');
    ipcMain.handle('shell:info', () => ({
      mode: 'simulator',
      hardwareEnabled: false,
      platform: process.platform,
    }));
    window = new BrowserWindow({
      show: true,
      webPreferences: {
        preload: fileURLToPath(new URL('../out/preload/index.cjs', import.meta.url)),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: false,
      },
    });
    window.webContents.on('console-message', (_event, details) => {
      if (details.level === 'error') console.error(details.message);
    });
    console.log('smoke: loading renderer');
    await window.loadFile(fileURLToPath(new URL('../out/renderer/index.html', import.meta.url)));
    console.log('smoke: renderer loaded');
    const observation = await window.webContents.executeJavaScript(`(async () => ({
    info: await window.aula.getShellInfo(),
    text: document.body.innerText,
    nodeExposed: typeof window.require !== 'undefined'
  }))()`);
    assert.equal(observation.info.mode, 'simulator');
    assert.equal(observation.info.hardwareEnabled, false);
    assert.equal(observation.nodeExposed, false);
    assert.match(observation.text, /Lighting/);
    assert.doesNotMatch(observation.text, /YOUR KEYBOARD|brightness lab|RESEARCH SNAPSHOT/);
    const navigation = await window.webContents.executeJavaScript(`(async () => {
      const navigate = async (name) => {
        [...document.querySelectorAll('nav button')].find(button => button.textContent === name).click();
        await new Promise(resolve => setTimeout(resolve, 30));
      };
      await navigate('Remapping');
      const mappingVisible = document.querySelector('#mapping-title').checkVisibility();
      const lightingHidden = !document.querySelector('#live-brightness-title').checkVisibility();
      await navigate('Lighting');
      const previewVisible = document.querySelector('#preview-title').checkVisibility();
      const previewAboveControls = Boolean(document.querySelector('#preview-title').compareDocumentPosition(document.querySelector('.lighting-sections')) & Node.DOCUMENT_POSITION_FOLLOWING);
      const noPreviewPage = ![...document.querySelectorAll('nav button')].some(button => button.textContent === 'Preview');
      const simulatorLabeled = !document.body.innerText.includes('Simulator') && document.body.innerText.includes('Not read');
      await navigate('Knob');
      const knobDisabled = [...document.querySelectorAll('#main-content button')]
        .find(button => /Enable interception/.test(button.textContent)).disabled;
      const knobProfileDisabled = document.querySelector('#knob-profile').disabled;
      const knobProfileSummary = document.body.innerText.includes('Play / pause') && document.body.innerText.includes('every device');
      await navigate('Macros');
      const macrosVisible = document.body.innerText.includes('Macros are not available yet');
      return { mappingVisible, lightingHidden, previewVisible, previewAboveControls, noPreviewPage, simulatorLabeled, knobDisabled, knobProfileDisabled, knobProfileSummary, macrosVisible };
    })()`);
    assert.ok(Object.values(navigation).every(Boolean), JSON.stringify(navigation));
    const dropdown = await window.webContents.executeJavaScript(`(async () => {
      const tick = () => new Promise(resolve => setTimeout(resolve, 30));
      const nav = name => [...document.querySelectorAll('nav button')].find(button => button.textContent === name).click();
      nav('Lighting'); await tick();
      const trigger = document.querySelector('#brightness-mode');
      const key = async name => { trigger.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true })); await tick(); };
      trigger.focus();
      await key('ArrowDown'); await key('End'); await key('Escape');
      const cancelled = trigger.textContent.includes('Per effect') && trigger.getAttribute('aria-expanded') === 'false';
      await key('Enter'); await key('ArrowDown'); await key('Enter');
      const committed = trigger.textContent.includes('Shared across effects') && document.activeElement === trigger;
      trigger.click(); await tick();
      [...document.querySelectorAll('[role=option]')].find(option => option.textContent.includes('Shared across effects')).click(); await tick();
      const pointer = trigger.textContent.includes('Shared across effects');
      await key('p'); await key('Enter');
      const typeahead = trigger.textContent.includes('Per effect');
      trigger.click(); await tick();
      document.querySelector('h1').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); await tick();
      const outside = trigger.getAttribute('aria-expanded') === 'false';
      trigger.click(); await tick(); await key('Tab');
      const tabCloses = trigger.getAttribute('aria-expanded') === 'false';
      nav('Lighting'); await tick();
      const disabled = document.querySelector('#live-effect'); disabled.click(); await tick();
      return { cancelled, committed, pointer, typeahead, outside, tabCloses,
        labeled: trigger.labels[0].textContent === 'Brightness behavior',
        disabled: disabled.disabled && disabled.getAttribute('aria-expanded') === 'false',
        noNative: document.querySelectorAll('select').length === 0 };
    })()`);
    assert.ok(Object.values(dropdown).every(Boolean), JSON.stringify(dropdown));
    // Theme checks run with hardware disabled and never change the real OS appearance.
    window.webContents.debugger.attach('1.3');
    const emulateScheme = (value) =>
      window.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-color-scheme', value }],
      });
    const themeState = () =>
      window.webContents.executeJavaScript(`({
      theme: document.documentElement.dataset.theme,
      label: document.querySelector('.theme-toggle').textContent.trim(),
      background: getComputedStyle(document.body).backgroundColor,
      scheme: getComputedStyle(document.documentElement).colorScheme,
      keyBackground: getComputedStyle(document.querySelector('.keyboard-keycap')).backgroundImage,
      keyText: getComputedStyle(document.querySelector('.keyboard-key')).color
    })`);
    const tick = () => new Promise((resolve) => setTimeout(resolve, 350));
    const reload = async () => {
      const loaded = new Promise((resolve) => window.webContents.once('did-finish-load', resolve));
      window.reload();
      await loaded;
      await tick();
    };
    await window.webContents.executeJavaScript("localStorage.removeItem('aula-studio.theme.v1')");
    await emulateScheme('light');
    await reload();
    assert.equal((await themeState()).label, 'Theme: System');
    assert.equal((await themeState()).theme, 'light');
    await emulateScheme('dark');
    await tick();
    assert.equal((await themeState()).theme, 'dark', 'System follows live appearance changes');
    await window.webContents.executeJavaScript("document.querySelector('.theme-toggle').click()");
    await tick();
    assert.equal((await themeState()).theme, 'light');
    assert.equal((await themeState()).scheme, 'light');
    assert.match((await themeState()).keyBackground, /rgb\(255, 255, 255\)/);
    assert.equal((await themeState()).keyText, 'rgb(48, 66, 56)');
    await reload();
    assert.equal((await themeState()).label, 'Theme: Light', 'explicit choice survives reload');
    assert.equal((await themeState()).theme, 'light', 'explicit light overrides dark system');
    await window.webContents.executeJavaScript("document.querySelector('.theme-toggle').click()");
    await tick();
    assert.equal((await themeState()).theme, 'dark');
    await emulateScheme('light');
    await tick();
    assert.equal((await themeState()).theme, 'dark', 'explicit dark overrides light system');
    await window.webContents.executeJavaScript("document.querySelector('.theme-toggle').click()");
    await tick();
    assert.equal((await themeState()).label, 'Theme: System');
    assert.equal((await themeState()).theme, 'light');
    await window.webContents.executeJavaScript("localStorage.removeItem('aula-studio.theme.v1')");
    await window.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [] });
    const motion = await window.webContents.executeJavaScript(`(async () => {
      const tick = () => new Promise(resolve => setTimeout(resolve, 40));
      const trigger = document.querySelector('#brightness-mode');
      trigger.click(); await tick();
      const menu = document.getElementById(trigger.getAttribute('aria-controls'));
      const opens = menu.classList.contains('t-dropdown') && menu.classList.contains('is-open') && !menu.inert;
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await tick();
      const closes = menu.inert && menu.getAttribute('aria-hidden') === 'true' && trigger.getAttribute('aria-expanded') === 'false';
      const page = document.querySelector('.lighting-page');
      const hasPageMotion = getComputedStyle(page).animationName !== 'none' || matchMedia('(prefers-reduced-motion: reduce)').matches;
      return { opens, closes, hasPageMotion };
    })()`);
    assert.ok(Object.values(motion).every(Boolean), JSON.stringify(motion));
    await window.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
    const reducedMotion = await window.webContents.executeJavaScript(`(() => {
      const elements = ['.lighting-page', '.theme-toggle', '.keyboard-keycap', '.select-menu'];
      return matchMedia('(prefers-reduced-motion: reduce)').matches && elements.every(selector => {
        const style = getComputedStyle(document.querySelector(selector));
        return style.animationName === 'none' && style.transitionDuration.split(',').every(value => parseFloat(value) === 0);
      });
    })()`);
    assert.ok(reducedMotion, 'reduced motion disables page, control, keycap and dropdown motion');
    await window.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [] });
    window.webContents.debugger.detach();
    // Second renderer pass uses semantic mocks, never a native backend.
    const { mappingSources } = await import('../src/shared/mapping.ts');
    let mappings = mappingSources.map((key) => ({ source: key.id, target: key.id }));
    const writes = [];
    ipcMain.removeHandler('shell:info');
    ipcMain.handle('shell:info', () => ({
      mode: 'simulator',
      hardwareEnabled: true,
      platform: process.platform,
    }));
    let lightingWrites = 0;
    let lightingReads = 0;
    ipcMain.handle('effect:read', () => {
      lightingReads++;
      return 1;
    });
    ipcMain.handle('brightness:read', () => 6);
    ipcMain.handle('color:read', () => ({ red: 12, green: 34, blue: 56, colourful: false }));
    ipcMain.handle('brightness:set', (_event, value) => {
      lightingWrites++;
      return value;
    });
    let mappingReads = 0;
    ipcMain.handle('mapping:read', () => {
      mappingReads++;
      return mappings;
    });
    ipcMain.handle('mapping:set', (_event, source, target) => {
      writes.push([source, target]);
      mappings = mappings.map((item) => (item.source === source ? { source, target } : item));
      return mappings;
    });
    const reloaded = new Promise((resolve) => window.webContents.once('did-finish-load', resolve));
    window.reload();
    await reloaded;
    await new Promise((resolve) => setTimeout(resolve, 150));
    const lightingUi = await window.webContents.executeJavaScript(`(async () => {
      const tick = () => new Promise(resolve => setTimeout(resolve, 80));
      await tick();
      const cap = document.querySelector('.lighting-visual .keyboard-key.has-color');
      const colorMatches = getComputedStyle(cap).getPropertyValue('--key-color').trim() === 'rgb(12, 34, 56)';
      const brightnessMatches = document.querySelector('#live-brightness').value === '6';
      const sections = document.querySelectorAll('.lighting-sections > section').length === 2;
      const noSimulatorControls = !document.querySelector('#preview-effect, #preview-color, #preview-brightness');
      const before = document.querySelector('.light-preview').style.getPropertyValue('--preview-opacity');
      const slider = document.querySelector('#live-brightness');
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(slider, '3'); slider.dispatchEvent(new Event('input', { bubbles: true })); await tick();
      const draftNotObserved = document.querySelector('.light-preview').style.getPropertyValue('--preview-opacity') === before;
      [...document.querySelectorAll('button')].find(button => button.textContent.trim() === 'Apply brightness').click(); await tick();
      const appliedObserved = Math.abs(Number(document.querySelector('.light-preview').style.getPropertyValue('--preview-opacity')) - 1 / 3) < 0.001;
      const material = getComputedStyle(cap.querySelector('.keyboard-keycap'));
      const light = getComputedStyle(cap, '::before');
      const frostedCap = material.backdropFilter.includes('blur(3px)') && material.backgroundImage.includes('rgba');
      const lightThroughCap = light.content !== 'none' && Number(light.opacity) > 0 && Number(light.opacity) <= 1 && light.backgroundImage.includes('radial-gradient');
      return { colorMatches, brightnessMatches, sections, noSimulatorControls, draftNotObserved, appliedObserved, frostedCap, lightThroughCap };
    })()`);
    assert.ok(Object.values(lightingUi).every(Boolean), JSON.stringify(lightingUi));
    assert.equal(lightingWrites, 1);
    assert.equal(lightingReads, 1, 'lighting is read automatically once on startup');
    const mappingUi = await window.webContents.executeJavaScript(`(async () => {
      const tick = () => new Promise(resolve => setTimeout(resolve, 60));
      [...document.querySelectorAll('nav button')].find(button => button.textContent === 'Remapping').click(); await tick();
      const panel = document.querySelector('[aria-labelledby="mapping-title"]');
      const button = text => [...panel.querySelectorAll('button')].find(item => item.textContent.trim() === text);
      const physical = name => panel.querySelector('.keyboard-key[aria-label^="' + name + '"]');
      physical('KeyA').click(); await tick();
      const beforeRead = button('Apply assignment').disabled;
      const autoRead = Boolean(button('Refresh assignments'));
      const tile = text => [...panel.querySelectorAll('.mapping-tile')].find(item => item.querySelector('span').textContent === text);
      const grid = panel.querySelector('.mapping-targets');
      const scrollable = grid.scrollHeight > grid.clientHeight;
      tile('B').click(); await tick();
      const draftOnly = !button('Apply assignment').disabled;
      button('Apply assignment').click(); await tick();
      const applied = panel.querySelector('[role=status]').textContent.includes('applied');
      const modifiersDisabled = physical('Fn').disabled && physical('Knob').disabled;
      const remainingModifiersEnabled = ['Meta Left', 'Alt Left', 'Control Right', 'Shift Right'].every(name => !physical(name).disabled);
      const standaloneTiles = ['Left Win', 'Left Alt', 'Right Ctrl', 'Right Shift'].every(name => Boolean(tile(name)));
      physical('KeyB').click(); await tick();
      const selectionReset = button('Apply assignment').disabled;
      physical('Digit1').click(); await tick();
      const ctrl = panel.querySelector('[aria-label="Shortcut modifiers"] button');
      ctrl.click(); await tick(); tile('Ctrl+C').click(); await tick();
      button('Apply assignment').click(); await tick();
      const shortcutApplied = panel.querySelector('[role=status]').textContent.includes('Ctrl+C');
      const leftModifiersEnabled = !physical('Control Left').disabled && !physical('Shift Left').disabled;
      return { autoRead, beforeRead, scrollable, draftOnly, applied, modifiersDisabled, remainingModifiersEnabled, standaloneTiles, selectionReset, shortcutApplied, leftModifiersEnabled };
    })()`);
    assert.ok(Object.values(mappingUi).every(Boolean), JSON.stringify(mappingUi));
    assert.equal(mappingReads, 1, 'assignments are read once on startup, not on navigation');
    assert.deepEqual(writes, [
      ['KeyA', 'KeyB'],
      ['Digit1', 'Ctrl+KeyC'],
    ]);
    console.log(
      JSON.stringify({
        passed: true,
        preloadBridge: observation.info,
        nodeExposed: false,
        rendererLoaded: true,
      }),
    );
    clearTimeout(timeout);
    window.destroy();
    app.quit();
  } catch (error) {
    console.error(error);
    clearTimeout(timeout);
    window?.destroy();
    app.exit(1);
  }
}
void run();
