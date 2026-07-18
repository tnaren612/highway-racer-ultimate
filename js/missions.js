/**
 * missions.js — Mission pool, progress tracking, rewards, combo system
 */
(function (global) {
  'use strict';

  const MISSION_TEMPLATES = [
    {
      id: 'distance_2',
      title: 'CRUISE CONTROL',
      desc: 'Travel {target} km',
      type: 'distance',
      target: 2,
      rewardCoins: 80,
      rewardXp: 40,
    },
    {
      id: 'distance_5',
      title: 'LONG HAUL',
      desc: 'Travel {target} km',
      type: 'distance',
      target: 5,
      rewardCoins: 200,
      rewardXp: 100,
    },
    {
      id: 'coins_50',
      title: 'POCKET CHANGE',
      desc: 'Collect {target} coins',
      type: 'coins',
      target: 50,
      rewardCoins: 60,
      rewardXp: 30,
    },
    {
      id: 'coins_150',
      title: 'TREASURE RUN',
      desc: 'Collect {target} coins',
      type: 'coins',
      target: 150,
      rewardCoins: 180,
      rewardXp: 80,
    },
    {
      id: 'near_5',
      title: 'PRECISION DRIVER',
      desc: 'Score {target} near misses',
      type: 'nearMiss',
      target: 5,
      rewardCoins: 100,
      rewardXp: 50,
    },
    {
      id: 'near_15',
      title: 'THREAD THE NEEDLE',
      desc: 'Score {target} near misses',
      type: 'nearMiss',
      target: 15,
      rewardCoins: 250,
      rewardXp: 120,
    },
    {
      id: 'speed_180',
      title: 'NEED FOR SPEED',
      desc: 'Reach {target} km/h',
      type: 'maxSpeed',
      target: 180,
      rewardCoins: 90,
      rewardXp: 45,
    },
    {
      id: 'nitro_5',
      title: 'BOOST JUNKIE',
      desc: 'Activate nitro {target} times',
      type: 'nitro',
      target: 5,
      rewardCoins: 70,
      rewardXp: 35,
    },
    {
      id: 'combo_8',
      title: 'CHAIN REACTION',
      desc: 'Reach a x{target} combo',
      type: 'combo',
      target: 8,
      rewardCoins: 150,
      rewardXp: 75,
    },
    {
      id: 'survive_police',
      title: 'FUGITIVE',
      desc: 'Escape a police chase',
      type: 'policeEscape',
      target: 1,
      rewardCoins: 200,
      rewardXp: 100,
    },
    {
      id: 'no_crash_3',
      title: 'CLEAN STREAK',
      desc: 'Drive {target} km without damage',
      type: 'cleanDistance',
      target: 3,
      rewardCoins: 160,
      rewardXp: 80,
    },
  ];

  function formatDesc(template) {
    return template.desc.replace('{target}', String(template.target));
  }

  function pickMission(excludeId) {
    const pool = MISSION_TEMPLATES.filter((m) => m.id !== excludeId);
    const t = pool[Math.floor(Math.random() * pool.length)];
    return {
      ...t,
      desc: formatDesc(t),
      progress: 0,
      completed: false,
      claimed: false,
    };
  }

  function createMissionSystem() {
    let current = pickMission();
    let completedCount = 0;
    let cleanDistance = 0;

    // Combo
    let combo = 1;
    let comboTimer = 0;
    let bestCombo = 1;
    const COMBO_WINDOW = 3.5;

    const runStats = {
      score: 0,
      coins: 0,
      distance: 0,
      nearMisses: 0,
      nitroUses: 0,
      maxSpeed: 0,
      crashes: 0,
      policeEscapes: 0,
      missionsCompleted: 0,
      bestCombo: 1,
    };

    let cleanStartKm = 0;

    function reset() {
      current = pickMission();
      completedCount = 0;
      cleanDistance = 0;
      cleanStartKm = 0;
      combo = 1;
      comboTimer = 0;
      bestCombo = 1;
      Object.keys(runStats).forEach((k) => {
        runStats[k] = k === 'bestCombo' ? 1 : 0;
      });
    }

    function bumpCombo() {
      combo = Math.min(25, combo + 1);
      comboTimer = COMBO_WINDOW;
      if (combo > bestCombo) bestCombo = combo;
      runStats.bestCombo = bestCombo;
      updateMission('combo', combo);
      return combo;
    }

    function tickCombo(dt) {
      if (combo <= 1) return combo;
      comboTimer -= dt;
      if (comboTimer <= 0) {
        combo = 1;
        comboTimer = 0;
      }
      return combo;
    }

    function addScore(base) {
      const pts = Math.floor(base * combo);
      runStats.score += pts;
      return pts;
    }

    function updateMission(type, value, mode = 'set') {
      if (!current || current.completed) return null;
      if (current.type !== type) return null;

      if (mode === 'add') {
        current.progress += value;
      } else {
        current.progress = Math.max(current.progress, value);
      }

      if (current.progress >= current.target) {
        current.progress = current.target;
        current.completed = true;
        completedCount += 1;
        runStats.missionsCompleted += 1;
        const reward = {
          coins: current.rewardCoins,
          xp: current.rewardXp,
          mission: { ...current },
        };
        // Next mission after short delay handled by engine
        return reward;
      }
      return null;
    }

    function onDistance(km, damaged) {
      runStats.distance = km;
      // Track continuous undamaged stretch (not lifetime distance)
      if (damaged) {
        cleanStartKm = km;
        cleanDistance = 0;
      } else {
        cleanDistance = Math.max(0, km - cleanStartKm);
      }

      let reward = updateMission('distance', km);
      if (!reward) reward = updateMission('cleanDistance', cleanDistance);
      return reward;
    }

    function onCoins(sessionTotal) {
      // Engine passes cumulative session coins — assign, do not accumulate again
      runStats.coins = Math.max(0, sessionTotal || 0);
      return updateMission('coins', runStats.coins);
    }

    function onNearMiss() {
      runStats.nearMisses += 1;
      bumpCombo();
      addScore(150);
      return updateMission('nearMiss', runStats.nearMisses);
    }

    function onSpeed(kmh) {
      if (kmh > runStats.maxSpeed) runStats.maxSpeed = kmh;
      return updateMission('maxSpeed', runStats.maxSpeed);
    }

    function onNitro() {
      runStats.nitroUses += 1;
      return updateMission('nitro', runStats.nitroUses);
    }

    function onPoliceEscape() {
      runStats.policeEscapes += 1;
      bumpCombo();
      addScore(500);
      return updateMission('policeEscape', runStats.policeEscapes);
    }

    function onCrash() {
      runStats.crashes += 1;
      combo = 1;
      comboTimer = 0;
      cleanStartKm = runStats.distance || 0;
      cleanDistance = 0;
    }

    function advanceMission() {
      current = pickMission(current?.id);
      return current;
    }

    function getProgress01() {
      if (!current) return 0;
      return Math.min(1, current.progress / current.target);
    }

    function getCurrent() {
      return current;
    }

    function getCombo() {
      return { combo, timer: comboTimer, best: bestCombo };
    }

    function getRunStats() {
      return { ...runStats, bestCombo };
    }

    return {
      reset,
      onDistance,
      onCoins,
      onNearMiss,
      onSpeed,
      onNitro,
      onPoliceEscape,
      onCrash,
      addScore,
      tickCombo,
      bumpCombo,
      advanceMission,
      getProgress01,
      getCurrent,
      getCombo,
      getRunStats,
      updateMission,
    };
  }

  global.HRUMissions = {
    MISSION_TEMPLATES,
    createMissionSystem,
    pickMission,
  };
})(typeof window !== 'undefined' ? window : globalThis);
