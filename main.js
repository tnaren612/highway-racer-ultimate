/**
 * main.js — Highway Racer Ultimate entry point
 * Bootstraps modules, splash, registration, vehicle select, menu flow.
 * Gameplay/physics/rendering unchanged — menu flow polish only.
 */
(function () {
  'use strict';

  const Storage = window.HRUStorage;
  const AudioSys = window.HRUAudio;
  const UIFactory = window.HRUUI;
  const Garage = window.HRUGarage;
  const EngineFactory = window.HRUEngine;
  const Renderer = window.HRURenderer;

  if (!window.THREE) {
    console.error('Three.js failed to load. Check network / CDN.');
  }

  let ui = null;
  let engine = null;
  let garageCtrl = null;
  let selectCtrl = null;
  let menuBg = null;
  let firstSessionAfterRegister = false;
  /** 'first' | 'rename' — registration modal purpose */
  let registerMode = 'first';

  /* ============================================================
     Boot
     ============================================================ */
  async function boot() {
    // Migrate legacy saves that already have a name but no flag
    const save = Storage.get();
    if (!save.profileRegistered && save.playerName && String(save.playerName).trim()) {
      Storage.setPlayerName(String(save.playerName).trim().slice(0, 20));
    }

    ui = UIFactory.createUI({
      onScreenChange: handleScreenChange,
      onMenuAction: handleMenuAction,
      onEnter: onEnterGame,
      onBack: (screen) => {
        if (screen === 'main-menu') {
          garageCtrl?.close();
          selectCtrl?.close();
        }
      },
    });

    ui.bindNavigation();
    ui.setupTouchVisibility();
    AudioSys.applyFromSettings(Storage.get().settings);

    if (window.gsap) {
      gsap.from('.logo-line', {
        y: 40,
        opacity: 0,
        stagger: 0.12,
        duration: 0.8,
        ease: 'power3.out',
        delay: 0.2,
      });
    }

    const steps = [
      { p: 0.1, t: 'Loading core systems…' },
      { p: 0.25, t: 'Initializing audio engine…' },
      { p: 0.4, t: 'Building vehicle catalog…' },
      { p: 0.55, t: 'Preparing world renderer…' },
      { p: 0.7, t: 'Calibrating physics…' },
      { p: 0.85, t: 'Syncing save data…' },
      { p: 1.0, t: 'Ready.' },
    ];

    for (const step of steps) {
      ui.setLoadProgress(step.p, step.t);
      await wait(180 + Math.random() * 120);
    }

    Storage.save();

    engine = EngineFactory.createEngine({
      canvas: document.getElementById('game-canvas'),
      ui,
      storage: Storage,
      audio: AudioSys,
      garage: Garage,
    });

    garageCtrl = Garage.createGarageController(document.getElementById('garage-canvas'));
    selectCtrl = Garage.createGarageController(document.getElementById('select-canvas'));

    wireRegistration();
    wireVehicleSelect();
    wireGarage();
    wireSettings();
    wireProfile();
    wireDaily();
    wireGameOverlays();
    wireExit();

    ui.showEnterButton();
  }

  function wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  /* ============================================================
     ENTER GAME flow
     Name FIRST → then car select (never car before name)
     ============================================================ */
  function promptDriverName(mode = 'first') {
    registerMode = mode;
    const kicker = document.querySelector('.register-kicker');
    const title = document.querySelector('.register-card h2');
    const sub = document.querySelector('.register-sub');
    if (mode === 'rename') {
      if (kicker) kicker.textContent = 'CHANGE DRIVER NAME';
      if (title) title.textContent = 'Update Profile';
      if (sub) sub.textContent = 'Enter a new driver name (2–20 characters).';
    } else {
      if (kicker) kicker.textContent = 'DRIVER REGISTRATION';
      if (title) title.textContent = 'Enter Your Name';
      if (sub) {
        sub.textContent =
          'Enter your driver name to continue. You must register before choosing a car.';
      }
    }
    const keep = mode === 'rename';
    const input = document.getElementById('register-name');
    if (keep && input) input.value = Storage.get().playerName || '';
    ui.showRegisterModal(true, { keepValue: keep });
  }

  /** Blocks car/garage until a valid driver name exists in LocalStorage */
  function requireDriverNameThen(nextFn) {
    if (Storage.isProfileRegistered()) {
      nextFn();
      return false;
    }
    ui.toast('Enter your driver name first');
    promptDriverName('first');
    return true;
  }

  function onEnterGame() {
    AudioSys.resume();
    AudioSys.playClick();
    AudioSys.startMusic('menu');

    // Always: name first, then vehicle selection
    if (!Storage.isProfileRegistered()) {
      promptDriverName('first');
      return;
    }

    openVehicleSelect();
  }

  function enterMainMenu() {
    ui.showRegisterModal(false);
    ui.showScreen('main-menu');
    ui.refreshHeaderStats();
    startMenuBg();
  }

  function startMenuBg() {
    if (!menuBg) {
      menuBg = Renderer.createMenuBackground(document.getElementById('menu-bg-canvas'));
    }
    menuBg.start();
  }

  function stopMenuBg() {
    menuBg?.stop();
  }

  function handleScreenChange(id) {
    if (id === 'main-menu') {
      startMenuBg();
      ui.refreshHeaderStats();
    }
    if (id === 'game-screen' || id === 'garage-screen' || id === 'vehicle-select-screen') {
      stopMenuBg();
    }
    if (id !== 'vehicle-select-screen') {
      selectCtrl?.close();
    }
    if (id !== 'garage-screen') {
      garageCtrl?.close();
    }
  }

  function handleMenuAction(action) {
    switch (action) {
      case 'play':
        requireDriverNameThen(openVehicleSelect);
        break;
      case 'garage':
        requireDriverNameThen(openGarage);
        break;
      case 'profile':
        ui.renderProfile();
        ui.showScreen('profile-screen');
        break;
      case 'achievements':
        ui.renderAchievements();
        ui.showScreen('achievements-screen');
        break;
      case 'statistics':
        ui.renderStatistics();
        ui.showScreen('statistics-screen');
        break;
      case 'leaderboard':
        ui.renderLeaderboard();
        ui.showScreen('leaderboard-screen');
        break;
      case 'daily':
        ui.renderDaily();
        ui.showScreen('daily-screen');
        break;
      case 'settings':
        ui.bindSettings();
        ui.showScreen('settings-screen');
        break;
      case 'exit':
        ui.showExitModal(true);
        break;
      default:
        break;
    }
  }

  /* ============================================================
     Registration
     ============================================================ */
  function wireRegistration() {
    const input = document.getElementById('register-name');
    const btn = document.getElementById('btn-register-continue');

    input?.addEventListener('input', () => ui.updateRegisterValidity());
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && btn && !btn.disabled) {
        btn.click();
      }
    });

    btn?.addEventListener('click', () => {
      if (btn.disabled) return;
      AudioSys.playClick();
      const name = (input?.value || '').trim().slice(0, 20);
      if (name.length < 2) {
        ui.toast('Name must be at least 2 characters');
        return;
      }
      if (!Storage.setPlayerName(name)) {
        ui.toast('Enter a valid driver name');
        return;
      }
      ui.showRegisterModal(false);
      ui.refreshHeaderStats();

      if (registerMode === 'rename') {
        ui.toast(`Driver name set to ${name}`);
        ui.renderProfile();
        ui.refreshHeaderStats();
        // Renaming from settings stays in menus; from splash continues to cars
        if (ui.getScreen() === 'splash') {
          openVehicleSelect();
        }
        return;
      }

      // First-time / required registration → car select only after name is saved
      firstSessionAfterRegister = true;
      AudioSys.playUnlock();
      ui.toast(`Welcome, ${name}! Choose your car.`);
      openVehicleSelect();
    });
  }

  /* ============================================================
     Vehicle selection garage
     ============================================================ */
  function openVehicleSelect() {
    // Hard gate: no car UI without a saved driver name
    if (!Storage.isProfileRegistered()) {
      promptDriverName('first');
      return;
    }
    stopMenuBg();
    ui.showRegisterModal(false);
    ui.showScreen('vehicle-select-screen');
    const selected = Storage.get().selectedCar || 'sedan';
    selectCtrl.open(selected);
    const color = Storage.getSelectedColor();
    selectCtrl.setPaint(color);
    refreshSelectUI();
  }

  function refreshSelectUI() {
    const car = selectCtrl.current();
    const unlocked = Storage.isUnlocked(car.id);
    const isSelected = Storage.get().selectedCar === car.id;
    const color = Storage.getSelectedColor();
    const prog = Storage.getCarProgress(car.id);
    const paint = isSelected || unlocked ? color : prog.paint || 0;
    selectCtrl.setPaint(paint);

    // Auto-select unlocked vehicle when browsing
    if (unlocked && !isSelected) {
      Storage.selectCar(car.id);
    }

    const selectedNow = Storage.get().selectedCar === car.id;
    ui.renderSelectStats(car, unlocked);
    ui.renderSelectColors(paint);
    ui.renderSelectDots(selectCtrl.currentIndex(), Garage.CATALOG.length);
    ui.renderSelectClassRow(selectCtrl.currentIndex(), Garage.CATALOG, Storage);
    ui.updateSelectHeader(car, unlocked, selectedNow);

    const wrap = document.getElementById('select-preview-wrap');
    if (wrap) wrap.classList.toggle('is-selected', selectedNow && unlocked);
  }

  function wireVehicleSelect() {
    document.getElementById('select-next')?.addEventListener('click', () => {
      AudioSys.playClick();
      selectCtrl.next();
      refreshSelectUI();
    });
    document.getElementById('select-prev')?.addEventListener('click', () => {
      AudioSys.playClick();
      selectCtrl.prev();
      refreshSelectUI();
    });

    document.getElementById('select-class-row')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-car-index]');
      if (!btn) return;
      AudioSys.playClick();
      const idx = Number(btn.dataset.carIndex);
      const car = Garage.CATALOG[idx];
      if (!car) return;
      selectCtrl.showCar(car.id);
      refreshSelectUI();
    });

    document.getElementById('select-color-picker')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-paint]');
      if (!btn) return;
      AudioSys.playClick();
      const car = selectCtrl.current();
      const idx = Number(btn.dataset.paint);
      selectCtrl.setPaint(idx);
      // Live preview + save paint
      if (Storage.isUnlocked(car.id)) {
        Storage.selectCar(car.id);
        Storage.setSelectedColor(idx);
        Storage.setPaint(car.id, idx);
      }
      ui.renderSelectColors(idx);
      ui.updateSelectHeader(car, true, true);
    });

    document.getElementById('btn-select-unlock')?.addEventListener('click', () => {
      AudioSys.playClick();
      const car = selectCtrl.current();
      if (Storage.isUnlocked(car.id)) return;
      if (!Storage.spendCoins(car.price)) {
        ui.toast('Not enough coins');
        return;
      }
      Storage.unlockCar(car.id);
      Storage.selectCar(car.id);
      Storage.setSelectedColor(Storage.getSelectedColor());
      AudioSys.playUnlock();
      ui.toast(`Unlocked ${car.name}!`);
      refreshSelectUI();
    });

    document.getElementById('btn-start-race')?.addEventListener('click', () => {
      const car = selectCtrl.current();
      if (!Storage.isUnlocked(car.id)) {
        ui.toast('Unlock this vehicle first');
        return;
      }
      AudioSys.playClick();
      Storage.selectCar(car.id);
      const activeSwatch = document.querySelector('#select-color-picker .swatch.active');
      if (activeSwatch) {
        const paintIdx = Number(activeSwatch.dataset.paint);
        Storage.setSelectedColor(paintIdx);
        Storage.setPaint(car.id, paintIdx);
      }
      beginRaceFromSelect();
    });

    document.getElementById('btn-select-back')?.addEventListener('click', () => {
      AudioSys.playClick();
      selectCtrl.close();
      firstSessionAfterRegister = false;
      enterMainMenu();
    });
  }

  function beginRaceFromSelect() {
    firstSessionAfterRegister = false;
    const screen = document.getElementById('vehicle-select-screen');
    const start = () => {
      selectCtrl.close();
      engine.startRun();
    };
    // Fade out garage, then race intro (3-2-1-GO inside engine)
    if (window.gsap && screen) {
      gsap.to(screen, {
        opacity: 0,
        duration: 0.5,
        ease: 'power2.in',
        onComplete: () => {
          screen.style.opacity = '';
          start();
        },
      });
    } else {
      start();
    }
  }

  /* ============================================================
     Garage — always loads saved vehicle / paint / upgrades
     ============================================================ */
  function openGarage() {
    if (!Storage.isProfileRegistered()) {
      promptDriverName('first');
      return;
    }
    stopMenuBg();
    ui.showScreen('garage-screen');
    ui.refreshHeaderStats();
    // Always restore profile: selected vehicle + paint + upgrades
    const selected = Storage.get().selectedCar || 'sedan';
    const color = Storage.getSelectedColor();
    const prog = Storage.getCarProgress(selected);
    if (prog.paint !== color) {
      Storage.setPaint(selected, color);
    }
    garageCtrl.open(selected);
    garageCtrl.setPaint(color);
    if (prog.wheels != null) {
      garageCtrl.rebuildWheels(prog.wheels || 0);
      garageCtrl.setPaint(color);
    }
    refreshGarageUI();
  }

  function refreshGarageUI() {
    const car = garageCtrl.current();
    const prog = Storage.getCarProgress(car.id);
    const isActive = car.id === Storage.get().selectedCar;
    const color = isActive ? Storage.getSelectedColor() : prog.paint || 0;
    garageCtrl.setPaint(color);
    ui.renderGarageStats(car, prog.upgrades);
    ui.renderColorPicker(car, color);
    ui.renderWheelPicker(car, prog.wheels || 0);
    ui.renderUpgrades(car.id);
    ui.renderGarageDots(garageCtrl.currentIndex());
    ui.updateGarageActions(car);
    ui.refreshHeaderStats();
  }

  function wireGarage() {
    document.getElementById('garage-next')?.addEventListener('click', () => {
      AudioSys.playClick();
      garageCtrl.next();
      refreshGarageUI();
    });
    document.getElementById('garage-prev')?.addEventListener('click', () => {
      AudioSys.playClick();
      garageCtrl.prev();
      refreshGarageUI();
    });

    document.getElementById('color-picker')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-paint]');
      if (!btn) return;
      AudioSys.playClick();
      const car = garageCtrl.current();
      if (!Storage.isUnlocked(car.id)) {
        ui.toast('Unlock this vehicle first');
        return;
      }
      const idx = Number(btn.dataset.paint);
      Storage.setPaint(car.id, idx);
      if (car.id === Storage.get().selectedCar) {
        Storage.setSelectedColor(idx);
      }
      garageCtrl.setPaint(idx);
      ui.renderColorPicker(car, idx);
    });

    document.getElementById('wheel-picker')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-wheel]');
      if (!btn) return;
      AudioSys.playClick();
      const car = garageCtrl.current();
      if (!Storage.isUnlocked(car.id)) {
        ui.toast('Unlock this vehicle first');
        return;
      }
      const idx = Number(btn.dataset.wheel);
      Storage.setWheels(car.id, idx);
      garageCtrl.rebuildWheels(idx);
      ui.renderWheelPicker(car, idx);
    });

    document.getElementById('upgrade-list')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-upgrade]');
      if (!btn || btn.disabled) return;
      AudioSys.playClick();
      const car = garageCtrl.current();
      if (!Storage.isUnlocked(car.id)) {
        ui.toast('Unlock this vehicle first');
        return;
      }
      const key = btn.dataset.upgrade;
      const result = Storage.upgradeCar(car.id, key);
      if (!result.ok) {
        if (result.reason === 'coins') ui.toast(`Need ◆ ${result.cost}`);
        else if (result.reason === 'max') ui.toast('Already maxed');
        return;
      }
      AudioSys.playUnlock();
      ui.toast(`${Garage.UPGRADE_LABELS[key]} → Lv ${result.level}`);
      refreshGarageUI();
    });

    document.getElementById('btn-select-car')?.addEventListener('click', () => {
      AudioSys.playClick();
      const car = garageCtrl.current();
      if (Storage.selectCar(car.id)) {
        const prog = Storage.getCarProgress(car.id);
        Storage.setSelectedColor(prog.paint || 0);
        ui.toast(`${car.name} selected`);
        refreshGarageUI();
      }
    });

    document.getElementById('btn-buy-car')?.addEventListener('click', () => {
      AudioSys.playClick();
      const car = garageCtrl.current();
      if (Storage.isUnlocked(car.id)) return;
      if (!Storage.spendCoins(car.price)) {
        ui.toast('Not enough coins');
        return;
      }
      Storage.unlockCar(car.id);
      Storage.selectCar(car.id);
      AudioSys.playUnlock();
      ui.toast(`Unlocked ${car.name}!`);
      if (window.gsap) {
        gsap.fromTo(
          '#garage-car-name',
          { scale: 0.8 },
          { scale: 1, duration: 0.5, ease: 'back.out' }
        );
      }
      refreshGarageUI();
    });

    document.querySelectorAll('#garage-screen [data-back]').forEach((btn) => {
      btn.addEventListener('click', () => garageCtrl.close());
    });
  }

  /* ============================================================
     Settings
     ============================================================ */
  function wireSettings() {
    const bindVol = (id, labelId, apply) => {
      const el = document.getElementById(id);
      const lab = document.getElementById(labelId);
      el?.addEventListener('input', () => {
        const v = Number(el.value);
        if (lab) lab.textContent = `${v}%`;
        apply(v);
        const settings = {};
        if (id === 'vol-master') settings.masterVolume = v;
        if (id === 'vol-music') settings.musicVolume = v;
        if (id === 'vol-sfx') settings.sfxVolume = v;
        if (id === 'steer-sens') settings.steerSensitivity = v;
        Storage.updateSettings(settings);
      });
    };

    bindVol('vol-master', 'vol-master-val', (v) => AudioSys.setMasterVolume(v));
    bindVol('vol-music', 'vol-music-val', (v) => AudioSys.setMusicVolume(v));
    bindVol('vol-sfx', 'vol-sfx-val', (v) => AudioSys.setSfxVolume(v));
    bindVol('steer-sens', 'steer-sens-val', () => {});

    const toggle = (id, key, extra) => {
      document.getElementById(id)?.addEventListener('click', () => {
        AudioSys.playClick();
        const on = !ui.isToggleOn(id);
        ui.setToggle(id, on);
        if (key) Storage.updateSettings({ [key]: on });
        if (key === 'muted') AudioSys.setMuted(on);
        if (typeof extra === 'function') extra(on);
      });
    };
    toggle('mute-all', 'muted');
    toggle('show-fps', 'showFps');
    toggle('quality-high', 'highQuality');

    document.getElementById('toggle-fullscreen')?.addEventListener('click', async () => {
      AudioSys.playClick();
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
          ui.setToggle('toggle-fullscreen', true);
          Storage.updateSettings({ fullscreen: true });
        } else {
          await document.exitFullscreen();
          ui.setToggle('toggle-fullscreen', false);
          Storage.updateSettings({ fullscreen: false });
        }
      } catch (_) {
        ui.toast('Fullscreen not available');
      }
    });

    document.addEventListener('fullscreenchange', () => {
      ui.setToggle('toggle-fullscreen', !!document.fullscreenElement);
    });

    document.getElementById('btn-change-name')?.addEventListener('click', () => {
      AudioSys.playClick();
      promptDriverName('rename');
    });

    document.getElementById('btn-reset-save')?.addEventListener('click', () => {
      AudioSys.playClick();
      if (confirm('Reset ALL progress? This cannot be undone.')) {
        Storage.reset();
        AudioSys.applyFromSettings(Storage.get().settings);
        ui.bindSettings();
        ui.refreshHeaderStats();
        ui.toast('Progress reset — enter your name to continue');
        ui.showScreen('splash');
        promptDriverName('first');
      }
    });
  }

  /* ============================================================
     Profile
     ============================================================ */
  function wireProfile() {
    document.getElementById('btn-save-name')?.addEventListener('click', () => {
      AudioSys.playClick();
      const input = document.getElementById('player-name-input');
      const name = (input?.value || '').trim().slice(0, 20);
      if (name.length < 2) {
        ui.toast('Name must be at least 2 characters');
        return;
      }
      if (!Storage.setPlayerName(name)) {
        ui.toast('Enter a valid driver name');
        return;
      }
      ui.renderProfile();
      ui.refreshHeaderStats();
      ui.toast('Name saved');
    });
  }

  /* ============================================================
     Daily
     ============================================================ */
  function wireDaily() {
    document.getElementById('btn-claim-daily')?.addEventListener('click', () => {
      AudioSys.playClick();
      const result = Storage.claimDaily();
      if (!result.ok) {
        ui.toast('Already claimed today');
        return;
      }
      AudioSys.playCoin();
      ui.toast(`Claimed ◆ ${result.reward} · Streak ${result.streak}`);
      ui.renderDaily();
      ui.refreshHeaderStats();
    });
  }

  /* ============================================================
     Game overlays
     ============================================================ */
  function wireGameOverlays() {
    document.getElementById('btn-hud-pause')?.addEventListener('click', () => {
      if (!engine?.isRunning?.() || !engine.isControlsEnabled?.()) return;
      AudioSys.playClick();
      engine.togglePause();
    });

    document.getElementById('btn-resume')?.addEventListener('click', () => {
      AudioSys.playClick();
      engine.resume();
    });
    document.getElementById('btn-pause-settings')?.addEventListener('click', () => {
      AudioSys.playClick();
      ui.toast('Resume and open Settings from the main menu');
    });
    document.getElementById('btn-quit-run')?.addEventListener('click', () => {
      AudioSys.playClick();
      engine.quitToMenu();
      startMenuBg();
    });

    // CONTINUE → main menu
    document.getElementById('btn-go-continue')?.addEventListener('click', () => {
      AudioSys.playClick();
      engine.quitToMenu();
      startMenuBg();
    });

    // PLAY AGAIN → race with intro countdown
    document.getElementById('btn-retry')?.addEventListener('click', () => {
      AudioSys.playClick();
      engine.startRun();
    });

    document.getElementById('btn-go-garage')?.addEventListener('click', () => {
      AudioSys.playClick();
      engine.quitToMenu();
      openGarage();
    });

    document.getElementById('btn-go-menu')?.addEventListener('click', () => {
      AudioSys.playClick();
      engine.quitToMenu();
      startMenuBg();
    });
  }

  function wireExit() {
    document.getElementById('btn-exit-cancel')?.addEventListener('click', () => {
      AudioSys.playClick();
      ui.showExitModal(false);
    });
    document.getElementById('btn-exit-confirm')?.addEventListener('click', () => {
      AudioSys.playClick();
      ui.toast('Progress saved. You can close this tab.');
      ui.showExitModal(false);
      try {
        window.close();
      } catch (_) {
        /* ignore */
      }
    });
  }

  /* ============================================================
     Visibility / autosave
     ============================================================ */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      Storage.save();
      if (engine?.isRunning() && !engine.isPaused() && engine.isControlsEnabled?.()) {
        engine.togglePause();
      }
    }
  });

  window.addEventListener('beforeunload', () => {
    Storage.save();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
