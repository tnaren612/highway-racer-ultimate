/**
 * storage.js — LocalStorage persistence for Highway Racer Ultimate
 * Saves coins, XP, unlocked cars, settings, achievements, stats, high scores.
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'hru_save_v1';
  const SAVE_VERSION = 1;

  /** Default vehicle catalog IDs that start unlocked */
  const STARTER_CARS = ['sedan'];

  /** Achievement definitions (progress tracked in save) */
  const ACHIEVEMENT_DEFS = [
    { id: 'first_km', name: 'First Mile', desc: 'Travel 1 km in a single run', icon: '🏁', target: 1 },
    { id: 'speed_demon', name: 'Speed Demon', desc: 'Reach 200 km/h', icon: '⚡', target: 200 },
    { id: 'coin_hunter', name: 'Coin Hunter', desc: 'Collect 500 coins total', icon: '◆', target: 500 },
    { id: 'survivor', name: 'Survivor', desc: 'Survive 5 km without crashing out', icon: '🛡', target: 5 },
    { id: 'near_miss_10', name: 'Close Call', desc: 'Score 10 near misses in one run', icon: '💨', target: 10 },
    { id: 'nitro_ace', name: 'Nitro Ace', desc: 'Use nitro 25 times', icon: '🔥', target: 25 },
    { id: 'collector', name: 'Collector', desc: 'Unlock 3 vehicles', icon: '▣', target: 3 },
    { id: 'full_garage', name: 'Full Garage', desc: 'Own every vehicle', icon: '🏎', target: 5 },
    { id: 'high_roller', name: 'High Roller', desc: 'Score 50,000 in one run', icon: '★', target: 50000 },
    { id: 'night_owl', name: 'Night Owl', desc: 'Complete a night-time run of 3 km', icon: '🌙', target: 3 },
    { id: 'streak_3', name: 'Loyal Racer', desc: 'Claim 3 daily rewards', icon: '☀', target: 3 },
    { id: 'combo_king', name: 'Combo King', desc: 'Reach a x10 combo', icon: '✖', target: 10 },
  ];

  function defaultSave() {
    return {
      version: SAVE_VERSION,
      playerName: '',
      profileRegistered: false,
      coins: 500,
      xp: 0,
      level: 1,
      selectedCar: 'sedan',
      selectedColor: 0,
      unlockedCars: [...STARTER_CARS],
      carProgress: {
        sedan: { paint: 0, wheels: 0, upgrades: { engine: 0, handling: 0, nitro: 0, armor: 0 } },
      },
      settings: {
        masterVolume: 80,
        musicVolume: 60,
        sfxVolume: 85,
        muted: false,
        showFps: true,
        highQuality: true,
        graphicsQuality: 'high',
        fullscreen: false,
        steerSensitivity: 100,
      },
      achievements: {},
      stats: {
        totalDistance: 0,
        totalRuns: 0,
        totalCoinsCollected: 0,
        totalCrashes: 0,
        totalNearMisses: 0,
        totalNitroUses: 0,
        bestScore: 0,
        bestDistance: 0,
        bestCombo: 1,
        totalPlayTime: 0,
        missionsCompleted: 0,
        policeEscapes: 0,
      },
      leaderboard: [],
      daily: {
        lastClaim: null,
        streak: 0,
        claimedDays: [],
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultSave();
      const data = JSON.parse(raw);
      const base = defaultSave();
      // Merge shallow + nested defaults for forward compatibility
      const loadedName = data.playerName != null ? String(data.playerName).trim().slice(0, 20) : '';
      const nameOk = loadedName.length >= 2;
      const merged = {
        ...base,
        ...data,
        playerName: nameOk ? loadedName : '',
        // Require a real name (2+ chars); short/blank names force re-registration
        profileRegistered: !!(nameOk && (data.profileRegistered || loadedName)),
        selectedColor: data.selectedColor != null ? data.selectedColor : 0,
        settings: { ...base.settings, ...(data.settings || {}) },
        stats: { ...base.stats, ...(data.stats || {}) },
        daily: { ...base.daily, ...(data.daily || {}) },
        carProgress: { ...base.carProgress, ...(data.carProgress || {}) },
        achievements: { ...(data.achievements || {}) },
        unlockedCars: Array.isArray(data.unlockedCars) ? data.unlockedCars : base.unlockedCars,
        leaderboard: Array.isArray(data.leaderboard) ? data.leaderboard : [],
      };
      return merged;
    } catch (e) {
      console.warn('[Storage] Load failed, using defaults', e);
      return defaultSave();
    }
  }

  let state = load();

  function save() {
    try {
      state.updatedAt = Date.now();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      console.warn('[Storage] Save failed', e);
      return false;
    }
  }

  function get() {
    return state;
  }

  function reset() {
    state = defaultSave();
    save();
    return state;
  }

  function addCoins(n) {
    state.coins = Math.max(0, Math.floor(state.coins + n));
    if (n > 0) state.stats.totalCoinsCollected += n;
    save();
    return state.coins;
  }

  function spendCoins(n) {
    if (state.coins < n) return false;
    state.coins -= n;
    save();
    return true;
  }

  /** XP curve: level N requires N * 100 XP from previous */
  function xpForLevel(level) {
    return level * 100;
  }

  function addXp(n) {
    state.xp += Math.floor(n);
    let leveled = false;
    while (state.xp >= xpForLevel(state.level)) {
      state.xp -= xpForLevel(state.level);
      state.level += 1;
      leveled = true;
      addCoins(100 + state.level * 25);
    }
    save();
    return { level: state.level, xp: state.xp, leveled };
  }

  function unlockCar(carId) {
    if (!state.unlockedCars.includes(carId)) {
      state.unlockedCars.push(carId);
      if (!state.carProgress[carId]) {
        state.carProgress[carId] = {
          paint: 0,
          wheels: 0,
          upgrades: { engine: 0, handling: 0, nitro: 0, armor: 0 },
        };
      }
      save();
      checkAchievementProgress('collector', state.unlockedCars.length);
      checkAchievementProgress('full_garage', state.unlockedCars.length);
    }
  }

  function isUnlocked(carId) {
    return state.unlockedCars.includes(carId);
  }

  function selectCar(carId) {
    if (!isUnlocked(carId)) return false;
    state.selectedCar = carId;
    save();
    return true;
  }

  function getCarProgress(carId) {
    if (!state.carProgress[carId]) {
      state.carProgress[carId] = {
        paint: 0,
        wheels: 0,
        upgrades: { engine: 0, handling: 0, nitro: 0, armor: 0 },
      };
    }
    return state.carProgress[carId];
  }

  function setPaint(carId, index) {
    getCarProgress(carId).paint = index;
    save();
  }

  function setWheels(carId, index) {
    getCarProgress(carId).wheels = index;
    save();
  }

  function upgradeCar(carId, stat) {
    const prog = getCarProgress(carId);
    const level = prog.upgrades[stat] || 0;
    if (level >= 5) return { ok: false, reason: 'max' };
    const cost = 150 * (level + 1);
    if (!spendCoins(cost)) return { ok: false, reason: 'coins', cost };
    prog.upgrades[stat] = level + 1;
    save();
    return { ok: true, level: level + 1, cost };
  }

  function updateSettings(partial) {
    Object.assign(state.settings, partial);
    save();
  }

  function setPlayerName(name) {
    const cleaned = String(name || '').trim().slice(0, 20);
    // Require at least 2 characters so blank/placeholder names cannot skip registration
    if (cleaned.length < 2) return false;
    state.playerName = cleaned;
    state.profileRegistered = true;
    save();
    return true;
  }

  function isProfileRegistered() {
    const n = state.playerName && String(state.playerName).trim();
    return !!(state.profileRegistered && n && n.length >= 2);
  }

  function setSelectedColor(index) {
    const i = Math.max(0, Math.min(9, Math.floor(Number(index) || 0)));
    state.selectedColor = i;
    const carId = state.selectedCar;
    const prog = getCarProgress(carId);
    prog.paint = i;
    save();
  }

  function getSelectedColor() {
    return state.selectedColor != null ? state.selectedColor : 0;
  }

  function unlockAchievement(id) {
    if (state.achievements[id]?.unlocked) return false;
    state.achievements[id] = {
      unlocked: true,
      at: Date.now(),
      progress: ACHIEVEMENT_DEFS.find((a) => a.id === id)?.target || 1,
    };
    addCoins(75);
    addXp(50);
    save();
    return true;
  }

  function checkAchievementProgress(id, value) {
    const def = ACHIEVEMENT_DEFS.find((a) => a.id === id);
    if (!def) return false;
    if (state.achievements[id]?.unlocked) return false;
    const prev = state.achievements[id]?.progress || 0;
    const progress = Math.max(prev, value);
    state.achievements[id] = { unlocked: false, progress };
    if (progress >= def.target) {
      return unlockAchievement(id);
    }
    save();
    return false;
  }

  function recordRun(result) {
    const s = state.stats;
    s.totalRuns += 1;
    s.totalDistance += result.distance || 0;
    s.totalCrashes += result.crashes || 0;
    s.totalNearMisses += result.nearMisses || 0;
    s.totalNitroUses += result.nitroUses || 0;
    s.totalPlayTime += result.playTime || 0;
    s.missionsCompleted += result.missionsCompleted || 0;
    if (result.policeEscape) s.policeEscapes += 1;
    if ((result.score || 0) > s.bestScore) s.bestScore = result.score;
    if ((result.distance || 0) > s.bestDistance) s.bestDistance = result.distance;
    if ((result.bestCombo || 1) > s.bestCombo) s.bestCombo = result.bestCombo;

    // Leaderboard (local top 10)
    state.leaderboard.push({
      name: state.playerName,
      score: result.score || 0,
      distance: result.distance || 0,
      date: Date.now(),
    });
    state.leaderboard.sort((a, b) => b.score - a.score);
    state.leaderboard = state.leaderboard.slice(0, 10);

    // Achievements
    checkAchievementProgress('first_km', result.distance || 0);
    checkAchievementProgress('survivor', result.distance || 0);
    checkAchievementProgress('speed_demon', result.maxSpeed || 0);
    checkAchievementProgress('high_roller', result.score || 0);
    checkAchievementProgress('near_miss_10', result.nearMisses || 0);
    checkAchievementProgress('combo_king', result.bestCombo || 1);
    checkAchievementProgress('coin_hunter', s.totalCoinsCollected);
    checkAchievementProgress('nitro_ace', s.totalNitroUses);
    if (result.wasNight && (result.distance || 0) >= 3) {
      checkAchievementProgress('night_owl', result.distance || 0);
    }

    save();
  }

  /** Daily reward: 7-day cycle, streak based */
  const DAILY_REWARDS = [100, 150, 200, 300, 400, 500, 1000];

  function getDailyState() {
    const today = new Date().toISOString().slice(0, 10);
    const last = state.daily.lastClaim;
    let canClaim = last !== today;
    let streak = state.daily.streak || 0;

    if (last) {
      const lastDate = new Date(last + 'T12:00:00');
      const todayDate = new Date(today + 'T12:00:00');
      const diffDays = Math.round((todayDate - lastDate) / 86400000);
      if (diffDays > 1) {
        streak = 0;
        state.daily.streak = 0;
      }
    }

    const dayIndex = streak % 7;
    return {
      canClaim,
      streak,
      dayIndex,
      reward: DAILY_REWARDS[dayIndex],
      rewards: DAILY_REWARDS,
      today,
    };
  }

  function claimDaily() {
    const ds = getDailyState();
    if (!ds.canClaim) return { ok: false, reason: 'already' };
    const reward = ds.reward;
    state.daily.lastClaim = ds.today;
    state.daily.streak = ds.streak + 1;
    addCoins(reward);
    checkAchievementProgress('streak_3', state.daily.streak);
    save();
    return { ok: true, reward, streak: state.daily.streak };
  }

  global.HRUStorage = {
    ACHIEVEMENT_DEFS,
    DAILY_REWARDS,
    get,
    save,
    reset,
    addCoins,
    spendCoins,
    addXp,
    xpForLevel,
    unlockCar,
    isUnlocked,
    selectCar,
    getCarProgress,
    setPaint,
    setWheels,
    upgradeCar,
    updateSettings,
    setPlayerName,
    isProfileRegistered,
    setSelectedColor,
    getSelectedColor,
    unlockAchievement,
    checkAchievementProgress,
    recordRun,
    getDailyState,
    claimDaily,
  };
})(typeof window !== 'undefined' ? window : globalThis);
