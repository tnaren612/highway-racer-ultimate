/**
 * Static verification for Highway Racer Ultimate
 * Run: node verify.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = __dirname;

const required = [
  'index.html',
  'style.css',
  'main.js',
  'js/storage.js',
  'js/audio.js',
  'js/physics.js',
  'js/weather.js',
  'js/effects.js',
  'js/renderer.js',
  'js/traffic.js',
  'js/missions.js',
  'js/garage.js',
  'js/ui.js',
  'js/engine.js',
];

const results = { ok: [], fail: [], warn: [] };

function checkExists(rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) {
    results.fail.push(`Missing file: ${rel}`);
    return false;
  }
  results.ok.push(`Present: ${rel}`);
  return true;
}

function checkSyntax(rel) {
  const code = fs.readFileSync(path.join(root, rel), 'utf8');
  try {
    // Wrap IIFE modules as scripts
    new vm.Script(code, { filename: rel });
    results.ok.push(`Syntax OK: ${rel}`);
    return true;
  } catch (e) {
    results.fail.push(`Syntax error ${rel}: ${e.message}`);
    return false;
  }
}

function checkHtmlIds() {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const ids = [
    'btn-enter',
    'register-modal',
    'register-name',
    'btn-register-continue',
    'vehicle-select-screen',
    'select-canvas',
    'select-color-picker',
    'btn-start-race',
    'countdown-overlay',
    'countdown-text',
    'btn-hud-pause',
    'btn-change-name',
    'toggle-fullscreen',
    'btn-reset-save',
    'garage-canvas',
    'game-canvas',
    'hud-speed',
    'hud-gear',
    'hud-dist',
    'hud-coins',
    'hud-xp',
    'fuel-fill',
    'nitro-fill',
    'mission-tracker',
    'fps-counter',
  ];
  for (const id of ids) {
    if (!html.includes(`id="${id}"`)) results.fail.push(`HTML missing id=${id}`);
    else results.ok.push(`HTML id=${id}`);
  }

  // Flow hooks
  if (!html.includes('Driver Name') && !html.includes('register-name')) {
    results.warn.push('Driver name field may be missing');
  }
  if (!html.includes('START RACE')) results.fail.push('START RACE button text missing');
  else results.ok.push('START RACE present');
  if (!html.includes('ENTER GAME')) results.fail.push('ENTER GAME button missing');
  else results.ok.push('ENTER GAME present');
  if (!html.includes('Narendra Thodeti')) results.fail.push('Designer watermark missing');
  else results.ok.push('Designer watermark present');
  if (!html.includes('register-name')) results.fail.push('Driver name field missing');
  else results.ok.push('Driver name field present');
}

function checkStorageApi() {
  const code = fs.readFileSync(path.join(root, 'js/storage.js'), 'utf8');
  for (const name of [
    'isProfileRegistered',
    'setPlayerName',
    'setSelectedColor',
    'getSelectedColor',
    'selectCar',
    'getCarProgress',
    'recordRun',
  ]) {
    if (!code.includes(name)) results.fail.push(`storage missing ${name}`);
    else results.ok.push(`storage has ${name}`);
  }
}

function checkEngineIntro() {
  const code = fs.readFileSync(path.join(root, 'js/engine.js'), 'utf8');
  for (const token of [
    'controlsEnabled',
    'introPhase',
    'countdown',
    'finishIntro',
    'driveout',
    'camera',
    "text: '3'",
    "text: 'GO!'",
  ]) {
    if (!code.includes(token)) results.fail.push(`engine missing ${token}`);
    else results.ok.push(`engine has ${token}`);
  }
}

function checkMainFlow() {
  const code = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
  for (const token of [
    'onEnterGame',
    'openVehicleSelect',
    'beginRaceFromSelect',
    'btn-start-race',
    'isProfileRegistered',
    'openGarage',
    'btn-change-name',
    'Name must be at least 2 characters',
  ]) {
    if (!code.includes(token)) results.fail.push(`main missing ${token}`);
    else results.ok.push(`main has ${token}`);
  }
}

function checkMissionsLogic() {
  const code = fs.readFileSync(path.join(root, 'js/missions.js'), 'utf8');
  for (const token of ['cleanStartKm', 'sessionTotal', 'runStats.coins =']) {
    if (!code.includes(token)) results.fail.push(`missions missing ${token}`);
    else results.ok.push(`missions has ${token}`);
  }
}

function checkCss() {
  const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
  for (const token of [
    'register-card',
    'btn-start-race',
    'countdown-text',
    'vehicle-select-screen',
    'btn-hud-pause',
    'glass-panel',
  ]) {
    if (!css.includes(token)) results.fail.push(`CSS missing .${token}`);
    else results.ok.push(`CSS has ${token}`);
  }
}

// Run
console.log('=== Highway Racer Ultimate — Static Verification ===\n');

for (const f of required) checkExists(f);

const jsFiles = required.filter((f) => f.endsWith('.js'));
for (const f of jsFiles) {
  if (fs.existsSync(path.join(root, f))) checkSyntax(f);
}

checkHtmlIds();
checkStorageApi();
checkEngineIntro();
checkMainFlow();
checkMissionsLogic();
checkCss();

console.log('\n--- PASS ---');
results.ok.forEach((m) => console.log('  ✔', m));
if (results.warn.length) {
  console.log('\n--- WARN ---');
  results.warn.forEach((m) => console.log('  ⚠', m));
}
if (results.fail.length) {
  console.log('\n--- FAIL ---');
  results.fail.forEach((m) => console.log('  ✖', m));
  process.exitCode = 1;
} else {
  console.log('\nAll static checks passed.');
  process.exitCode = 0;
}

console.log(`\nSummary: ${results.ok.length} ok, ${results.warn.length} warn, ${results.fail.length} fail`);
