/**
 * main.js — Highway Racer Ultimate entry point
 * Bootstraps modules, splash, registration, vehicle select, menu flow.
 * Gameplay/physics/rendering unchanged — premium main menu UI + backdrop only.
 */
(function () {
  'use strict';

  const Storage = window.HRUStorage;
  const AudioSys = window.HRUAudio;
  const UIFactory = window.HRUUI;
  const Garage = window.HRUGarage;
  const EngineFactory = window.HRUEngine;
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
      onViewportChange: () => {
        // Re-fit 3D previews when device rotates or browser chrome changes
        try {
          selectCtrl?.resize?.();
          garageCtrl?.resize?.();
        } catch (_) {
          /* ignore */
        }
      },
      onBack: (screen) => {
        if (screen === 'main-menu') {
          garageCtrl?.close();
          selectCtrl?.close();
        }
      },
    });

    ui.bindNavigation();
    ui.setupTouchVisibility();
    ui.updateViewportVars?.();
    ui.setOnboardingStep?.(1);
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
    wireMenuRipples();

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
    ui.updateViewportVars?.();

    // Always: name first, then vehicle selection
    if (!Storage.isProfileRegistered()) {
      ui.setOnboardingStep?.(2);
      promptDriverName('first');
      return;
    }

    openVehicleSelect();
  }

  function enterMainMenu() {
    ui.showRegisterModal(false);
    ui.showScreen('main-menu');
    ui.refreshHeaderStats();
    refreshPremiumMenuStats();
    startMenuBg();
  }

  /** Sync trophy / coins / awards / level / name on premium card */
  function refreshPremiumMenuStats() {
    const s = Storage.get();
    if (!s) return;
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.textContent = v;
    };
    set('menu-coins', Number(s.coins || 0).toLocaleString());
    set('menu-level', String(s.level || 1));
    set('menu-trophy', Number(s.stats?.bestScore || 0).toLocaleString());
    const unlocked = Object.values(s.achievements || {}).filter((a) => a.unlocked).length;
    const total =
      (Storage.ACHIEVEMENT_DEFS && Storage.ACHIEVEMENT_DEFS.length) ||
      (window.HRUStorage && window.HRUStorage.ACHIEVEMENT_DEFS
        ? window.HRUStorage.ACHIEVEMENT_DEFS.length
        : 12);
    set('menu-awards', String(unlocked));
    set('menu-awards-total', String(total));
    set('menu-player-name', (s.playerName && String(s.playerName).trim()) || 'Driver');
  }

  /**
   * Original 2D menu backdrop: sky, mountains, road, lighting, particles.
   * Lightweight canvas path — targets ~60 FPS; respects reduced motion.
   */
  function createPremiumMenuBackground(canvas) {
    if (!canvas) return { start() {}, stop() {} };
    const ctx = canvas.getContext('2d', { alpha: false });
    let raf = 0;
    let running = false;
    let t0 = 0;
    let last = 0;
    const reduceMotion =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const stars = Array.from({ length: 48 }, () => ({
      x: Math.random(),
      y: Math.random() * 0.48,
      r: 0.4 + Math.random() * 1.4,
      a: 0.25 + Math.random() * 0.55,
      tw: Math.random() * Math.PI * 2,
    }));
    const cars = Array.from({ length: 3 }, (_, i) => ({
      lane: i - 1,
      z: 0.2 + i * 0.25,
      speed: 0.08 + i * 0.03,
      hue: 20 + i * 40,
    }));

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, window.innerWidth || 1);
      const h = Math.max(1, window.innerHeight || 1);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function drawMountains(w, h, baseY, color, amp, seed) {
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(0, baseY);
      for (let x = 0; x <= w; x += 12) {
        const n =
          Math.sin(x * 0.008 + seed) * amp +
          Math.sin(x * 0.02 + seed * 1.7) * amp * 0.45 +
          Math.sin(x * 0.045 + seed) * amp * 0.2;
        ctx.lineTo(x, baseY - n);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    }

    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      // Cap work near 60 FPS
      if (now - last < 15) return;
      last = now;
      const t = reduceMotion ? 0 : (now - t0) * 0.001;
      const w = window.innerWidth || canvas.clientWidth;
      const h = window.innerHeight || canvas.clientHeight;

      // Sky gradient — dynamic day/dusk lighting
      const phase = (Math.sin(t * 0.12) + 1) * 0.5;
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, `hsl(${215 + phase * 12}, 55%, ${10 + phase * 6}%)`);
      sky.addColorStop(0.45, `hsl(${28 + phase * 10}, 70%, ${14 + phase * 8}%)`);
      sky.addColorStop(0.62, `hsl(${18}, 55%, ${12 + phase * 4}%)`);
      sky.addColorStop(1, '#05080f');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      // Sun / glow
      const sx = w * (0.72 + Math.sin(t * 0.08) * 0.04);
      const sy = h * (0.38 - phase * 0.06);
      const sun = ctx.createRadialGradient(sx, sy, 0, sx, sy, w * 0.35);
      sun.addColorStop(0, `rgba(255,${170 + phase * 40 | 0},80,${0.35 + phase * 0.15})`);
      sun.addColorStop(0.35, `rgba(255,120,40,${0.12 + phase * 0.08})`);
      sun.addColorStop(1, 'transparent');
      ctx.fillStyle = sun;
      ctx.fillRect(0, 0, w, h);

      // Stars (dimmer at “day”)
      stars.forEach((s) => {
        const tw = 0.35 + Math.sin(t * 1.5 + s.tw) * 0.25;
        ctx.globalAlpha = s.a * tw * (1 - phase * 0.65);
        ctx.fillStyle = '#dff6ff';
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // Far mountains
      const horizon = h * 0.55;
      drawMountains(w, h, horizon + 8, 'rgba(18, 28, 48, 0.95)', h * 0.09, t * 0.05 + 1);
      drawMountains(w, h, horizon + 28, 'rgba(12, 18, 32, 0.98)', h * 0.07, t * 0.08 + 3);

      // Ground plane
      const ground = ctx.createLinearGradient(0, horizon, 0, h);
      ground.addColorStop(0, '#1a1420');
      ground.addColorStop(0.35, '#0c1018');
      ground.addColorStop(1, '#05070c');
      ctx.fillStyle = ground;
      ctx.fillRect(0, horizon, w, h - horizon);

      // Road
      const roadTop = horizon + 2;
      const roadHalfTop = w * 0.06;
      const roadHalfBot = w * 0.55;
      ctx.beginPath();
      ctx.moveTo(w * 0.5 - roadHalfTop, roadTop);
      ctx.lineTo(w * 0.5 + roadHalfTop, roadTop);
      ctx.lineTo(w * 0.5 + roadHalfBot, h);
      ctx.lineTo(w * 0.5 - roadHalfBot, h);
      ctx.closePath();
      const roadGrad = ctx.createLinearGradient(0, roadTop, 0, h);
      roadGrad.addColorStop(0, '#2a2f3a');
      roadGrad.addColorStop(1, '#12151c');
      ctx.fillStyle = roadGrad;
      ctx.fill();

      // Road edge lines
      ctx.strokeStyle = 'rgba(255, 200, 80, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(w * 0.5 - roadHalfTop, roadTop);
      ctx.lineTo(w * 0.5 - roadHalfBot, h);
      ctx.moveTo(w * 0.5 + roadHalfTop, roadTop);
      ctx.lineTo(w * 0.5 + roadHalfBot, h);
      ctx.stroke();

      // Center dashes scrolling
      const scroll = (t * 90) % 40;
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 3;
      ctx.setLineDash([14, 22]);
      ctx.lineDashOffset = -scroll;
      ctx.beginPath();
      ctx.moveTo(w * 0.5, roadTop);
      ctx.lineTo(w * 0.5, h);
      ctx.stroke();
      ctx.setLineDash([]);

      // Distant traffic blips
      if (!reduceMotion) {
        cars.forEach((c) => {
          c.z += c.speed * 0.008;
          if (c.z > 1) c.z = 0.05;
          const p = c.z * c.z;
          const y = roadTop + (h - roadTop) * p;
          const half = roadHalfTop + (roadHalfBot - roadHalfTop) * p;
          const x = w * 0.5 + c.lane * half * 0.35;
          const size = 4 + p * 18;
          ctx.fillStyle = `hsla(${c.hue},70%,55%,${0.35 + p * 0.5})`;
          ctx.fillRect(x - size * 0.6, y - size * 0.35, size * 1.2, size * 0.55);
        });
      }

      // Horizon haze
      const haze = ctx.createLinearGradient(0, horizon - 40, 0, horizon + 60);
      haze.addColorStop(0, 'transparent');
      haze.addColorStop(0.5, `rgba(255,140,60,${0.08 + phase * 0.06})`);
      haze.addColorStop(1, 'transparent');
      ctx.fillStyle = haze;
      ctx.fillRect(0, horizon - 40, w, 100);
    }

    function onResize() {
      resize();
    }

    return {
      start() {
        if (running) return;
        running = true;
        t0 = performance.now();
        last = 0;
        resize();
        window.addEventListener('resize', onResize, { passive: true });
        window.addEventListener('orientationchange', onResize, { passive: true });
        raf = requestAnimationFrame(frame);
      },
      stop() {
        running = false;
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', onResize);
        window.removeEventListener('orientationchange', onResize);
      },
    };
  }

  function startMenuBg() {
    if (!menuBg) {
      const canvas = document.getElementById('menu-bg-canvas');
      menuBg = createPremiumMenuBackground(canvas);
    }
    menuBg.start();
  }

  function stopMenuBg() {
    menuBg?.stop();
  }

  function wireMenuRipples() {
    const nav = document.querySelector('#main-menu .menu-nav');
    if (!nav || nav.dataset.rippleBound) return;
    nav.dataset.rippleBound = '1';
    nav.addEventListener(
      'pointerdown',
      (e) => {
        const btn = e.target.closest('.menu-btn');
        if (!btn || !nav.contains(btn)) return;
        const rect = btn.getBoundingClientRect();
        btn.style.setProperty('--ripple-x', `${e.clientX - rect.left}px`);
        btn.style.setProperty('--ripple-y', `${e.clientY - rect.top}px`);
        btn.classList.remove('rippling');
        // reflow to restart animation
        void btn.offsetWidth;
        btn.classList.add('rippling');
        setTimeout(() => btn.classList.remove('rippling'), 560);
      },
      { passive: true }
    );
  }

  function handleScreenChange(id) {
    if (id === 'main-menu') {
      startMenuBg();
      ui.refreshHeaderStats();
      refreshPremiumMenuStats();
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
    ui.setOnboardingStep?.(3);
    ui.updateViewportVars?.();
    ui.showScreen('vehicle-select-screen');
    const selected = Storage.get().selectedCar || 'sedan';
    // Defer open one frame so CSS grid/flex has real canvas size
    requestAnimationFrame(() => {
      selectCtrl.open(selected);
      const color = Storage.getSelectedColor();
      selectCtrl.setPaint(color);
      refreshSelectUI();
      // Second settle after fonts/layout on mobile
      setTimeout(() => {
        selectCtrl?.resize?.();
        refreshSelectUI();
      }, 80);
    });
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
    ui.updateViewportVars?.();
    ui.showScreen('garage-screen');
    ui.refreshHeaderStats();
    // Always restore profile: selected vehicle + paint + upgrades
    const selected = Storage.get().selectedCar || 'sedan';
    const color = Storage.getSelectedColor();
    const prog = Storage.getCarProgress(selected);
    if (prog.paint !== color) {
      Storage.setPaint(selected, color);
    }
    requestAnimationFrame(() => {
      garageCtrl.open(selected);
      garageCtrl.setPaint(color);
      if (prog.wheels != null) {
        garageCtrl.rebuildWheels(prog.wheels || 0);
        garageCtrl.setPaint(color);
      }
      refreshGarageUI();
      setTimeout(() => garageCtrl?.resize?.(), 80);
    });
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

    document.getElementById('graphics-quality')?.addEventListener('change', (e) => {
      AudioSys.playClick();
      const val = e.target.value || 'high';
      Storage.updateSettings({
        graphicsQuality: val,
        highQuality: val === 'high' || val === 'ultra',
      });
      const lab = document.getElementById('graphics-quality-val');
      if (lab) lab.textContent = val.charAt(0).toUpperCase() + val.slice(1);
      ui.setToggle('quality-high', val === 'high' || val === 'ultra');
      ui.toast(`Graphics: ${val.toUpperCase()} (applies next race)`);
    });

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
