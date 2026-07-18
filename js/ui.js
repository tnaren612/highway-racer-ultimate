/**
 * ui.js — Screen management, HUD, menus, notifications, GSAP transitions
 */
(function (global) {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  function createUI(hooks = {}) {
    const screens = {
      splash: $('#splash'),
      'main-menu': $('#main-menu'),
      'vehicle-select-screen': $('#vehicle-select-screen'),
      'garage-screen': $('#garage-screen'),
      'profile-screen': $('#profile-screen'),
      'achievements-screen': $('#achievements-screen'),
      'statistics-screen': $('#statistics-screen'),
      'leaderboard-screen': $('#leaderboard-screen'),
      'daily-screen': $('#daily-screen'),
      'settings-screen': $('#settings-screen'),
      'game-screen': $('#game-screen'),
    };

    let currentScreen = 'splash';
    let toastTimer = 0;
    let viewportBound = false;

    /** Keep layout stable across mobile browser chrome / soft keyboard */
    function updateViewportVars() {
      const root = document.documentElement;
      const h = Math.round(
        (global.visualViewport && global.visualViewport.height) ||
          global.innerHeight ||
          root.clientHeight ||
          800
      );
      const offsetTop =
        global.visualViewport && typeof global.visualViewport.offsetTop === 'number'
          ? global.visualViewport.offsetTop
          : 0;
      root.style.setProperty('--app-height', `${Math.round(global.innerHeight || h)}px`);
      root.style.setProperty('--vv-height', `${h}px`);
      // Extra bottom inset when keyboard shrinks visual viewport
      const kb = Math.max(0, (global.innerHeight || h) - h - offsetTop);
      root.style.setProperty('--vv-offset', `${Math.round(kb)}px`);
      document.body?.classList.toggle('kb-open', kb > 80);
    }

    function bindViewport() {
      if (viewportBound) return;
      viewportBound = true;
      updateViewportVars();
      const onResize = () => {
        updateViewportVars();
        if (hooks.onViewportChange) hooks.onViewportChange();
      };
      global.addEventListener('resize', onResize, { passive: true });
      global.addEventListener('orientationchange', () => {
        setTimeout(onResize, 120);
        setTimeout(onResize, 360);
      });
      if (global.visualViewport) {
        global.visualViewport.addEventListener('resize', onResize);
        global.visualViewport.addEventListener('scroll', onResize);
      }
    }

    function isCoarsePointer() {
      try {
        return (
          global.matchMedia('(pointer: coarse)').matches ||
          'ontouchstart' in global ||
          (navigator.maxTouchPoints || 0) > 0
        );
      } catch (_) {
        return false;
      }
    }

    function setOnboardingStep(step) {
      document.querySelectorAll('.onboarding-steps:not(.compact) .onboard-step').forEach((el) => {
        const n = Number(el.dataset.step);
        el.classList.toggle('active', n === step);
        el.classList.toggle('done', n < step);
      });
    }

    function showScreen(id) {
      const next = screens[id];
      if (!next) return;
      Object.entries(screens).forEach(([key, el]) => {
        if (!el) return;
        const active = key === id;
        el.classList.toggle('active', active);
        el.setAttribute('aria-hidden', active ? 'false' : 'true');
        // Clear leftover GSAP transforms that can break fixed layouts
        if (!active && el.style) {
          el.style.opacity = '';
          el.style.transform = '';
        }
      });
      currentScreen = id;
      updateViewportVars();

      if (id === 'splash') setOnboardingStep(1);
      if (id === 'vehicle-select-screen') setOnboardingStep(3);
      if (id === 'game-screen') setOnboardingStep(4);
      if (id === 'main-menu') setOnboardingStep(1);

      const reduceMotion =
        global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (global.gsap && next && !reduceMotion) {
        gsap.fromTo(
          next,
          { opacity: 0 },
          { opacity: 1, duration: 0.32, ease: 'power2.out', overwrite: 'auto' }
        );
        const frame = next.querySelector('.panel-frame, .menu-nav, .splash-content');
        if (frame) {
          gsap.fromTo(
            frame,
            { y: 12, opacity: 0.9 },
            {
              y: 0,
              opacity: 1,
              duration: 0.36,
              ease: 'power3.out',
              overwrite: 'auto',
              clearProps: 'transform',
            }
          );
        }
      }
      if (hooks.onScreenChange) hooks.onScreenChange(id);
    }

    function getScreen() {
      return currentScreen;
    }

    /* ---- Splash loading ---- */
    function setLoadProgress(p, text) {
      const bar = $('#load-bar');
      const label = $('#load-text');
      if (bar) bar.style.width = `${Math.min(100, p * 100)}%`;
      if (label && text) label.textContent = text;
    }

    function showEnterButton() {
      const btn = $('#btn-enter');
      const label = $('#load-text');
      if (label) label.textContent = 'Systems online';
      if (btn) {
        btn.classList.remove('hidden');
        if (global.gsap) {
          gsap.fromTo(btn, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'back.out(1.4)' });
        }
      }
    }

    /* ---- Registration modal ---- */
    function showRegisterModal(show, opts = {}) {
      const el = $('#register-modal');
      if (!el) return;
      el.classList.toggle('hidden', !show);
      el.setAttribute('aria-hidden', show ? 'false' : 'true');
      updateViewportVars();
      if (show) {
        setOnboardingStep(2);
        const input = $('#register-name');
        if (input) {
          if (!opts.keepValue) input.value = '';
          updateRegisterValidity();
          // Desktop: auto-focus. Mobile: avoid keyboard jump until user taps.
          const focusDelay = isCoarsePointer() ? 0 : 100;
          if (!isCoarsePointer()) {
            setTimeout(() => {
              try {
                input.focus({ preventScroll: true });
                input.select?.();
              } catch (_) {
                input.focus();
              }
              updateRegisterValidity();
            }, focusDelay);
          }
        }
        updateRegisterValidity();
        // Scroll card into view (keyboard-safe)
        requestAnimationFrame(() => {
          const card = el.querySelector('.register-card');
          card?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
        });
        const reduceMotion =
          global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (global.gsap && !reduceMotion) {
          gsap.fromTo(
            '.register-card',
            { y: 20, opacity: 0, scale: 0.98 },
            {
              y: 0,
              opacity: 1,
              scale: 1,
              duration: 0.38,
              ease: 'power3.out',
              clearProps: 'transform',
            }
          );
        }
      } else {
        document.body?.classList.remove('kb-open');
      }
    }

    function updateRegisterValidity() {
      const input = $('#register-name');
      const btn = $('#btn-register-continue');
      const count = $('#register-count');
      if (!input || !btn) return;
      const name = input.value.trim();
      // Require at least 2 characters for a real driver name (matches Storage.setPlayerName)
      const valid = name.length >= 2 && name.length <= 20;
      btn.disabled = !valid;
      btn.setAttribute('aria-disabled', valid ? 'false' : 'true');
      if (count) {
        count.textContent = String(input.value.length);
        count.classList.toggle('invalid', name.length > 0 && name.length < 2);
      }
    }

    /* ---- Vehicle select UI ---- */
    function renderSelectStats(car, unlocked) {
      const el = $('#select-stat-cards');
      if (!el || !car) return;
      const selected = global.HRUStorage?.get()?.selectedCar === car.id;
      const rows = [
        ['Top Speed', `${car.topSpeed}`, ''],
        ['Acceleration', `${car.acceleration}`, ''],
        ['Handling', `${car.handling}`, ''],
        ['Nitro', `${car.nitro}`, ''],
        ['Braking', `${car.braking}`, ''],
        ['Price', car.price <= 0 ? 'FREE' : `◆ ${car.price.toLocaleString()}`, 'price'],
        ['Status', !unlocked ? 'LOCKED' : selected ? 'SELECTED' : 'UNLOCKED', 'status'],
      ];
      el.innerHTML = rows
        .map(([label, value, cls]) => {
          let valCls = 'ss-value';
          if (cls === 'status') {
            if (!unlocked) valCls = 'ss-value locked';
            else if (selected) valCls = 'ss-value unlocked';
            else valCls = 'ss-value unlocked';
          }
          return `<div class="select-stat ${cls}${selected && unlocked ? ' is-selected-car' : ''}">
            <span class="ss-label">${label}</span>
            <span class="${valCls}">${value}</span>
          </div>`;
        })
        .join('');
    }

    function renderSelectColors(selectedIndex) {
      const el = $('#select-color-picker');
      const palette = global.HRUGarage?.PAINT_PALETTE || [];
      if (!el) return;
      el.innerHTML = palette
        .map((p, i) => {
          const css = `#${p.hex.toString(16).padStart(6, '0')}`;
          return `<button type="button" class="swatch ${i === selectedIndex ? 'active' : ''}" data-paint="${i}" title="${p.name}" style="background:${css};color:${css}" aria-label="${p.name}"></button>`;
        })
        .join('');
    }

    function renderSelectDots(index, total) {
      const el = $('#select-dots');
      if (!el) return;
      el.innerHTML = Array.from({ length: total }, (_, i) =>
        `<span class="${i === index ? 'active' : ''}"></span>`
      ).join('');
    }

    function renderSelectClassRow(activeIndex, catalog, storage) {
      const el = $('#select-class-row');
      if (!el || !catalog) return;
      const selectedId = storage?.get()?.selectedCar;
      el.innerHTML = catalog
        .map((car, i) => {
          const unlocked = storage?.isUnlocked(car.id);
          const selected = car.id === selectedId;
          const labels = {
            sedan: 'Sedan',
            suv: 'SUV',
            sports: 'Sports',
            truck: 'Truck',
            electric: 'Electric',
          };
          const cls = [
            'select-class-chip',
            i === activeIndex ? 'viewing' : '',
            selected ? 'selected' : '',
            unlocked ? '' : 'locked',
          ]
            .filter(Boolean)
            .join(' ');
          return `<button type="button" class="${cls}" data-car-index="${i}">${labels[car.class] || car.name}</button>`;
        })
        .join('');
    }

    function updateSelectHeader(car, unlocked, isSelected) {
      setText('select-car-name', car?.name || '—');
      const lock = $('#select-lock-badge');
      const selBadge = $('#select-selected-badge');
      if (lock) lock.classList.toggle('hidden', !!unlocked);
      if (selBadge) selBadge.classList.toggle('hidden', !(unlocked && isSelected));
      const start = $('#btn-start-race');
      const unlockBtn = $('#btn-select-unlock');
      if (start && unlockBtn) {
        if (unlocked) {
          start.classList.remove('hidden');
          start.disabled = false;
          unlockBtn.classList.add('hidden');
        } else {
          start.classList.add('hidden');
          unlockBtn.classList.remove('hidden');
          unlockBtn.textContent = `UNLOCK · ◆ ${(car?.price || 0).toLocaleString()}`;
        }
      }
      const s = global.HRUStorage?.get();
      if (s) {
        setText('select-coins', s.coins.toLocaleString());
        setText('select-player-name', s.playerName || 'Driver');
      }
    }

    /* ---- Toast ---- */
    function toast(msg, ms = 2400) {
      const el = $('#toast');
      if (!el) return;
      el.textContent = msg;
      el.classList.remove('hidden');
      el.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        el.classList.remove('show');
        setTimeout(() => el.classList.add('hidden'), 300);
      }, ms);
    }

    /* ---- Notifications in-game ---- */
    function notify(text, type = '') {
      const stack = $('#notify-stack');
      if (!stack) return;
      const el = document.createElement('div');
      el.className = `notify ${type}`;
      el.textContent = text;
      stack.appendChild(el);
      if (global.gsap) {
        gsap.fromTo(el, { y: 16, opacity: 0, scale: 0.9 }, { y: 0, opacity: 1, scale: 1, duration: 0.3 });
      }
      setTimeout(() => {
        if (global.gsap) {
          gsap.to(el, {
            opacity: 0,
            y: -10,
            duration: 0.3,
            onComplete: () => el.remove(),
          });
        } else {
          el.remove();
        }
      }, 1800);
    }

    /* ---- Menu currency ---- */
    function refreshHeaderStats() {
      const s = global.HRUStorage?.get();
      if (!s) return;
      const coins = s.coins.toLocaleString();
      const level = s.level;
      ['menu-coins', 'garage-coins'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.textContent = coins;
      });
      const ml = $('#menu-level');
      if (ml) ml.textContent = level;
    }

    /* ---- Profile ---- */
    function renderProfile() {
      const s = global.HRUStorage?.get();
      if (!s) return;
      const titles = ['Rookie', 'Driver', 'Racer', 'Speedster', 'Apex Predator', 'Legend'];
      const title = titles[Math.min(titles.length - 1, Math.floor(s.level / 3))];
      const nextXp = global.HRUStorage.xpForLevel(s.level);
      setText('profile-name', s.playerName || 'Pilot');
      setText('profile-level', s.level);
      setText('profile-title', title);
      setText('profile-xp', s.xp);
      setText('profile-xp-next', nextXp);
      setText('profile-best', s.stats.bestScore.toLocaleString());
      setText('profile-distance', `${s.stats.totalDistance.toFixed(1)} km`);
      setText('profile-cars', s.unlockedCars.length);
      const achCount = Object.values(s.achievements).filter((a) => a.unlocked).length;
      setText('profile-achs', `${achCount}/${global.HRUStorage.ACHIEVEMENT_DEFS.length}`);
      const bar = $('#profile-xp-bar');
      if (bar) bar.style.width = `${Math.min(100, (s.xp / nextXp) * 100)}%`;
      const input = $('#player-name-input');
      if (input) input.value = s.playerName;
    }

    /* ---- Achievements ---- */
    function renderAchievements() {
      const grid = $('#achievements-grid');
      if (!grid) return;
      const s = global.HRUStorage?.get();
      const defs = global.HRUStorage?.ACHIEVEMENT_DEFS || [];
      grid.innerHTML = defs
        .map((d) => {
          const st = s?.achievements[d.id];
          const unlocked = st?.unlocked;
          const prog = st?.progress || 0;
          return `
          <div class="ach-card ${unlocked ? 'unlocked' : 'locked'}">
            <div class="ach-icon">${d.icon}</div>
            <div>
              <div class="ach-title">${d.name}</div>
              <div class="ach-desc">${d.desc}</div>
              <div class="ach-desc" style="margin-top:4px;color:var(--cyan)">${unlocked ? 'UNLOCKED' : `${Math.min(prog, d.target)} / ${d.target}`}</div>
            </div>
          </div>`;
        })
        .join('');
    }

    /* ---- Statistics ---- */
    function renderStatistics() {
      const grid = $('#statistics-grid');
      if (!grid) return;
      const st = global.HRUStorage?.get()?.stats || {};
      const rows = [
        ['Best Score', st.bestScore?.toLocaleString() || '0'],
        ['Best Distance', `${(st.bestDistance || 0).toFixed(2)} km`],
        ['Total Distance', `${(st.totalDistance || 0).toFixed(1)} km`],
        ['Total Runs', st.totalRuns || 0],
        ['Coins Collected', st.totalCoinsCollected?.toLocaleString() || '0'],
        ['Crashes', st.totalCrashes || 0],
        ['Near Misses', st.totalNearMisses || 0],
        ['Nitro Uses', st.totalNitroUses || 0],
        ['Best Combo', `x${st.bestCombo || 1}`],
        ['Missions Done', st.missionsCompleted || 0],
        ['Police Escapes', st.policeEscapes || 0],
        ['Play Time', formatTime(st.totalPlayTime || 0)],
      ];
      grid.innerHTML = rows
        .map(
          ([label, value]) => `
        <div class="stat-tile">
          <div class="st-label">${label}</div>
          <div class="st-value">${value}</div>
        </div>`
        )
        .join('');
    }

    function formatTime(sec) {
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = Math.floor(sec % 60);
      if (h > 0) return `${h}h ${m}m`;
      return `${m}m ${s}s`;
    }

    /* ---- Leaderboard ---- */
    function renderLeaderboard() {
      const list = $('#leaderboard-list');
      if (!list) return;
      const board = global.HRUStorage?.get()?.leaderboard || [];
      if (!board.length) {
        list.innerHTML = `<p class="muted center" style="padding:2rem">No scores yet. Complete a run to claim the top spot.</p>`;
        return;
      }
      list.innerHTML = board
        .map((row, i) => {
          const rankClass = i < 3 ? `rank-${i + 1}` : '';
          return `
          <div class="lb-row ${rankClass}">
            <div class="lb-rank">#${i + 1}</div>
            <div class="lb-name">${escapeHtml(row.name)}</div>
            <div class="lb-score">${row.score.toLocaleString()}</div>
          </div>`;
        })
        .join('');
    }

    /* ---- Daily ---- */
    function renderDaily() {
      const grid = $('#daily-grid');
      const status = $('#daily-status');
      const btn = $('#btn-claim-daily');
      if (!grid) return;
      const ds = global.HRUStorage.getDailyState();
      const rewards = ds.rewards;
      grid.innerHTML = rewards
        .map((r, i) => {
          const claimed = i < ds.streak;
          const today = i === ds.dayIndex && ds.canClaim;
          return `
          <div class="daily-day ${claimed ? 'claimed' : ''} ${today ? 'today' : ''}">
            <span>Day ${i + 1}</span>
            <span class="d-reward">◆ ${r}</span>
          </div>`;
        })
        .join('');
      if (btn) {
        btn.disabled = !ds.canClaim;
        btn.textContent = ds.canClaim ? 'CLAIM REWARD' : 'ALREADY CLAIMED';
        btn.classList.toggle('btn-primary', ds.canClaim);
      }
      if (status) {
        status.textContent = ds.canClaim
          ? `Streak: ${ds.streak} · Today: ◆ ${ds.reward}`
          : `Come back tomorrow · Streak: ${ds.streak}`;
      }
    }

    /* ---- Settings bind ---- */
    function bindSettings() {
      const s = global.HRUStorage?.get()?.settings;
      if (!s) return;
      const setRange = (id, val, labelId) => {
        const el = document.getElementById(id);
        const lab = document.getElementById(labelId);
        if (el) el.value = val;
        if (lab) lab.textContent = `${val}%`;
      };
      setRange('vol-master', s.masterVolume, 'vol-master-val');
      setRange('vol-music', s.musicVolume, 'vol-music-val');
      setRange('vol-sfx', s.sfxVolume, 'vol-sfx-val');
      setRange('steer-sens', s.steerSensitivity, 'steer-sens-val');
      setToggle('mute-all', s.muted);
      setToggle('show-fps', s.showFps);
      setToggle('quality-high', s.highQuality !== false);
      setToggle('toggle-fullscreen', !!document.fullscreenElement || !!s.fullscreen);
      const gq = document.getElementById('graphics-quality');
      const gqLab = document.getElementById('graphics-quality-val');
      const quality = s.graphicsQuality || (s.highQuality === false ? 'medium' : 'high');
      if (gq) gq.value = quality;
      if (gqLab) {
        gqLab.textContent = quality.charAt(0).toUpperCase() + quality.slice(1);
      }
    }

    function setToggle(id, on) {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.toggle('on', !!on);
      el.setAttribute('aria-pressed', on ? 'true' : 'false');
    }

    function isToggleOn(id) {
      return document.getElementById(id)?.classList.contains('on');
    }

    /* ---- Garage UI ---- */
    function renderGarageStats(car, upgrades) {
      const statsEl = $('#garage-stats');
      if (!statsEl || !global.HRUGarage) return;
      const eff = global.HRUGarage.getEffectiveStats(car, upgrades);
      const rows = [
        ['Top Speed', eff.topSpeed, 280],
        ['Accel', eff.acceleration, 100],
        ['Handling', eff.handling, 100],
        ['Braking', eff.braking, 100],
        ['Nitro', eff.nitro, 100],
        ['Weight', eff.weight, 3500, true],
        ['Durability', eff.durability, 200],
      ];
      statsEl.innerHTML = rows
        .map(([name, val, max, invert]) => {
          const pct = invert ? Math.max(5, 100 - (val / max) * 100) : (val / max) * 100;
          return `
          <div class="stat-row">
            <span class="s-name">${name}</span>
            <div class="stat-bar"><i style="width:${Math.min(100, pct)}%"></i></div>
            <span class="s-val">${val}</span>
          </div>`;
        })
        .join('');

      // Animate bars
      requestAnimationFrame(() => {
        statsEl.querySelectorAll('.stat-bar > i').forEach((bar) => {
          const w = bar.style.width;
          bar.style.width = '0%';
          requestAnimationFrame(() => {
            bar.style.width = w;
          });
        });
      });
    }

    function renderColorPicker(car, selected) {
      const el = $('#color-picker');
      if (!el) return;
      const palette = global.HRUGarage?.PAINT_PALETTE;
      if (palette) {
        el.innerHTML = palette
          .map((p, i) => {
            const css = `#${p.hex.toString(16).padStart(6, '0')}`;
            return `<button type="button" class="swatch ${i === selected ? 'active' : ''}" data-paint="${i}" title="${p.name}" style="background:${css};color:${css}" aria-label="${p.name}"></button>`;
          })
          .join('');
        return;
      }
      el.innerHTML = car.paints
        .map((hex, i) => {
          const css = `#${hex.toString(16).padStart(6, '0')}`;
          return `<button type="button" class="swatch ${i === selected ? 'active' : ''}" data-paint="${i}" style="background:${css};color:${css}" aria-label="Paint ${i + 1}"></button>`;
        })
        .join('');
    }

    function renderWheelPicker(car, selected) {
      const el = $('#wheel-picker');
      if (!el) return;
      el.innerHTML = car.wheels
        .map(
          (name, i) =>
            `<button type="button" class="wheel-opt ${i === selected ? 'active' : ''}" data-wheel="${i}">${name}</button>`
        )
        .join('');
    }

    function renderUpgrades(carId) {
      const el = $('#upgrade-list');
      if (!el || !global.HRUStorage) return;
      const prog = global.HRUStorage.getCarProgress(carId);
      const labels = global.HRUGarage.UPGRADE_LABELS;
      el.innerHTML = Object.keys(labels)
        .map((key) => {
          const lvl = prog.upgrades[key] || 0;
          const cost = 150 * (lvl + 1);
          const maxed = lvl >= 5;
          return `
          <div class="upgrade-row">
            <div class="u-info">
              <div class="u-name">${labels[key]}</div>
              <div class="u-lvl">Level ${lvl}/5</div>
            </div>
            <button type="button" class="btn btn-secondary" data-upgrade="${key}" ${maxed ? 'disabled' : ''}>
              ${maxed ? 'MAX' : `◆ ${cost}`}
            </button>
          </div>`;
        })
        .join('');
    }

    function renderGarageDots(index) {
      const el = $('#garage-dots');
      if (!el || !global.HRUGarage) return;
      const n = global.HRUGarage.CATALOG.length;
      el.innerHTML = Array.from({ length: n }, (_, i) =>
        `<span class="${i === index ? 'active' : ''}"></span>`
      ).join('');
    }

    function updateGarageActions(car) {
      const unlocked = global.HRUStorage.isUnlocked(car.id);
      const selected = global.HRUStorage.get().selectedCar === car.id;
      const buy = $('#btn-buy-car');
      const sel = $('#btn-select-car');
      if (buy && sel) {
        if (unlocked) {
          buy.classList.add('hidden');
          sel.classList.remove('hidden');
          sel.textContent = selected ? 'SELECTED' : 'SELECT VEHICLE';
          sel.disabled = selected;
        } else {
          sel.classList.add('hidden');
          buy.classList.remove('hidden');
          buy.textContent = `PURCHASE · ◆ ${car.price.toLocaleString()}`;
        }
      }
      setText('garage-car-name', car.name + (unlocked ? '' : ' 🔒'));
    }

    /* ---- HUD ---- */
    function updateHUD(data) {
      setText('hud-speed', Math.round(data.speed || 0));
      setText('hud-gear', data.gear ?? 'N');
      setText('hud-score', Math.floor(data.score || 0).toLocaleString());
      setText('hud-dist', `${(data.distance || 0).toFixed(2)} km`);
      setText('hud-coins', Math.floor(data.coins || 0));
      setText('hud-xp', Math.floor(data.xp || 0));
      setText('hud-weather', data.weather || 'Clear');
      setFill('fuel-fill', data.fuel ?? 100);
      setFill('nitro-fill', data.nitro ?? 100);
      setFill('armor-fill', data.armor ?? 100, data.maxArmor || 100);
      setFill('mission-bar', (data.missionProgress || 0) * 100, 100, true);
      if (data.missionTitle) setText('mission-title', data.missionTitle);
      if (data.missionDesc) setText('mission-desc', data.missionDesc);

      const comboEl = $('#combo-display');
      if (comboEl) {
        if ((data.combo || 1) > 1) {
          comboEl.classList.remove('hidden');
          setText('combo-mult', `x${data.combo}`);
        } else {
          comboEl.classList.add('hidden');
        }
      }

      const police = $('#police-banner');
      if (police) police.classList.toggle('hidden', !data.police);

      const fpsEl = $('#fps-counter');
      const hudFps = $('#hud-fps');
      if (data.fps != null) {
        if (fpsEl) fpsEl.textContent = String(Math.round(data.fps));
        if (hudFps) hudFps.textContent = `${Math.round(data.fps)} FPS`;
      }

      if (global.HRUEffects && data.speed != null) {
        global.HRUEffects.drawSpeedometer($('#speedo-canvas'), data.speed, 280);
      }
    }

    function setFill(id, value, max = 100, isPercentAlready = false) {
      const el = document.getElementById(id);
      if (!el) return;
      const pct = isPercentAlready ? value : (value / max) * 100;
      el.style.width = `${Math.max(0, Math.min(100, pct))}%`;
    }

    function setText(id, text) {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    }

    function escapeHtml(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    /* ---- Pause / Game over ---- */
    function showPause(show) {
      const el = $('#pause-menu');
      if (!el) return;
      el.classList.toggle('hidden', !show);
    }

    function showGameOver(stats) {
      const el = $('#gameover-menu');
      if (!el) return;
      el.classList.remove('hidden');
      setText('go-score', Math.floor(stats.score || 0).toLocaleString());
      setText('go-dist', `${(stats.distance || 0).toFixed(2)} km`);
      setText('go-coins', Math.floor(stats.coins || 0));
      setText('go-xp', Math.floor(stats.xp || 0));
      setText('go-combo', `x${stats.bestCombo || 1}`);
      setText('go-nearmiss', stats.nearMisses || 0);
      if (global.gsap) {
        gsap.fromTo('.gameover-card', { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(1.2)' });
      }
    }

    function hideGameOver() {
      $('#gameover-menu')?.classList.add('hidden');
    }

    function showExitModal(show) {
      $('#exit-modal')?.classList.toggle('hidden', !show);
    }

    /* ---- Touch ---- */
    function setupTouchVisibility() {
      const touch = $('#touch-controls');
      if (!touch) return;
      const coarse = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
      touch.classList.toggle('hidden', !coarse);
    }

    /* ---- Wire static buttons ---- */
    function bindNavigation() {
      $$('.menu-btn[data-action]').forEach((btn) => {
        btn.addEventListener('click', () => {
          global.HRUAudio?.playClick();
          const action = btn.dataset.action;
          if (hooks.onMenuAction) hooks.onMenuAction(action);
        });
      });

      $$('[data-back]').forEach((btn) => {
        btn.addEventListener('click', () => {
          global.HRUAudio?.playClick();
          showScreen(btn.dataset.back);
          if (hooks.onBack) hooks.onBack(btn.dataset.back);
        });
      });

      $('#btn-enter')?.addEventListener('click', () => {
        global.HRUAudio?.resume();
        global.HRUAudio?.playClick();
        if (hooks.onEnter) hooks.onEnter();
      });
    }

    // Init viewport as soon as UI is created
    bindViewport();

    return {
      showScreen,
      getScreen,
      setLoadProgress,
      showEnterButton,
      showRegisterModal,
      updateRegisterValidity,
      renderSelectStats,
      renderSelectColors,
      renderSelectDots,
      renderSelectClassRow,
      updateSelectHeader,
      toast,
      notify,
      refreshHeaderStats,
      renderProfile,
      renderAchievements,
      renderStatistics,
      renderLeaderboard,
      renderDaily,
      bindSettings,
      setToggle,
      isToggleOn,
      renderGarageStats,
      renderColorPicker,
      renderWheelPicker,
      renderUpgrades,
      renderGarageDots,
      updateGarageActions,
      updateHUD,
      showPause,
      showGameOver,
      hideGameOver,
      showExitModal,
      setupTouchVisibility,
      bindNavigation,
      bindViewport,
      updateViewportVars,
      setOnboardingStep,
      isCoarsePointer,
      $,
      $$,
    };
  }

  global.HRUUI = { createUI };
})(typeof window !== 'undefined' ? window : globalThis);
