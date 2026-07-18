/**
 * weather.js — Cinematic day cycle + weather for Highway Racer Ultimate
 * Phases: sunrise, day, sunset, night
 * Weather: clear, rain, storm, fog, mist
 * Original lighting tables — no third-party skyboxes.
 */
(function (global) {
  'use strict';

  const PHASES = ['sunrise', 'day', 'sunset', 'night'];
  const WEATHERS = ['clear', 'rain', 'storm', 'fog', 'mist'];

  const SKY = {
    sunrise: {
      skyTop: 0xff6a3a,
      skyBot: 0xffd0a0,
      sunColor: 0xffb070,
      sunIntensity: 1.15,
      ambient: 0xffd0b8,
      ambientIntensity: 0.48,
      fogColor: 0xffd8b8,
      fogNear: 90,
      fogFar: 360,
      hemiSky: 0xffb090,
      hemiGround: 0x3d6040,
      fillIntensity: 0.28,
      bloomHint: 0.55,
    },
    day: {
      skyTop: 0x2f8fe8,
      skyBot: 0xc8e8ff,
      sunColor: 0xfff4d8,
      sunIntensity: 1.45,
      ambient: 0xb0d4f0,
      ambientIntensity: 0.58,
      fogColor: 0xc8e0f5,
      fogNear: 140,
      fogFar: 520,
      hemiSky: 0x90c4ff,
      hemiGround: 0x4a7a42,
      fillIntensity: 0.32,
      bloomHint: 0.35,
    },
    sunset: {
      skyTop: 0x2a1648,
      skyBot: 0xff6a35,
      sunColor: 0xff7030,
      sunIntensity: 1.05,
      ambient: 0xff8866,
      ambientIntensity: 0.42,
      fogColor: 0xe07850,
      fogNear: 75,
      fogFar: 300,
      hemiSky: 0xff8050,
      hemiGround: 0x3a3028,
      fillIntensity: 0.35,
      bloomHint: 0.7,
    },
    night: {
      skyTop: 0x040714,
      skyBot: 0x0c1830,
      sunColor: 0xc8dcff,
      sunIntensity: 0.18,
      ambient: 0x2a3a58,
      ambientIntensity: 0.28,
      fogColor: 0x0a1220,
      fogNear: 45,
      fogFar: 220,
      hemiSky: 0x1a2848,
      hemiGround: 0x0a1208,
      fillIntensity: 0.12,
      bloomHint: 0.15,
    },
  };

  function createWeatherSystem() {
    return {
      phase: 'day',
      weather: 'clear',
      phaseTime: 0,
      phaseDuration: 75,
      weatherTime: 0,
      weatherDuration: 40,
      transition: 1,
      prevPhase: 'day',
      rainIntensity: 0,
      stormIntensity: 0,
      fogDensity: 0,
      mistDensity: 0,
      wetness: 0,
      roadGrip: 1,
      thunderTimer: 0,
      rainbow: 0,
      cloudCover: 0.35,
      forced: null,
      biome: 'forest',
    };
  }

  function lerpColor(a, b, t) {
    const ar = (a >> 16) & 255,
      ag = (a >> 8) & 255,
      ab = a & 255;
    const br = (b >> 16) & 255,
      bg = (b >> 8) & 255,
      bb = b & 255;
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const bl = Math.round(ab + (bb - ab) * t);
    return (r << 16) | (g << 8) | bl;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function getBlendedLighting(sys) {
    const from = SKY[sys.prevPhase] || SKY.day;
    const to = SKY[sys.phase] || SKY.day;
    const t = sys.transition;
    const base = {
      skyTop: lerpColor(from.skyTop, to.skyTop, t),
      skyBot: lerpColor(from.skyBot, to.skyBot, t),
      sunColor: lerpColor(from.sunColor, to.sunColor, t),
      sunIntensity: lerp(from.sunIntensity, to.sunIntensity, t),
      ambient: lerpColor(from.ambient, to.ambient, t),
      ambientIntensity: lerp(from.ambientIntensity, to.ambientIntensity, t),
      fogColor: lerpColor(from.fogColor, to.fogColor, t),
      fogNear: lerp(from.fogNear, to.fogNear, t),
      fogFar: lerp(from.fogFar, to.fogFar, t),
      hemiSky: lerpColor(from.hemiSky, to.hemiSky, t),
      hemiGround: lerpColor(from.hemiGround, to.hemiGround, t),
      fillIntensity: lerp(from.fillIntensity || 0.25, to.fillIntensity || 0.25, t),
      bloomHint: lerp(from.bloomHint || 0.3, to.bloomHint || 0.3, t),
      isNight: sys.phase === 'night' || (sys.phase === 'sunset' && t > 0.75),
      rainbow: sys.rainbow || 0,
      cloudCover: sys.cloudCover || 0.3,
      stormFlash: sys._flash || 0,
    };

    const r = sys.rainIntensity || 0;
    const st = sys.stormIntensity || 0;
    const f = sys.fogDensity || 0;
    const m = sys.mistDensity || 0;

    if (r > 0.05 || st > 0.05) {
      const wet = Math.max(r, st);
      base.sunIntensity *= 1 - wet * 0.6;
      base.ambientIntensity *= 1 - wet * 0.18;
      base.fogNear = lerp(base.fogNear, 35, wet * 0.75);
      base.fogFar = lerp(base.fogFar, 160, wet * 0.75);
      base.fogColor = lerpColor(base.fogColor, 0x4a5568, wet * 0.55);
      base.skyTop = lerpColor(base.skyTop, 0x3a4558, wet * 0.65);
      base.skyBot = lerpColor(base.skyBot, 0x6a7588, wet * 0.55);
      base.cloudCover = Math.min(1, base.cloudCover + wet * 0.5);
      base.bloomHint *= 1 - wet * 0.3;
    }
    if (st > 0.2) {
      base.sunIntensity *= 0.7;
      base.fogColor = lerpColor(base.fogColor, 0x2a3040, st * 0.4);
      if (base.stormFlash > 0) {
        base.sunIntensity += base.stormFlash * 2.5;
        base.ambientIntensity += base.stormFlash * 0.8;
        base.skyTop = lerpColor(base.skyTop, 0xd0e0ff, base.stormFlash);
      }
    }
    if (f > 0.05) {
      base.fogNear = lerp(base.fogNear, 12, f);
      base.fogFar = lerp(base.fogFar, 85, f);
      base.sunIntensity *= 1 - f * 0.45;
      base.fogColor = lerpColor(base.fogColor, 0xa8b4c0, f * 0.75);
    }
    if (m > 0.05) {
      base.fogNear = lerp(base.fogNear, 40, m * 0.6);
      base.fogFar = lerp(base.fogFar, 200, m * 0.5);
      base.fogColor = lerpColor(base.fogColor, 0xd0dce8, m * 0.4);
      base.sunIntensity *= 1 - m * 0.15;
    }

    // Biome ground tint
    const biomeGround = {
      forest: 0x3a6a38,
      mountain: 0x5a6570,
      coastal: 0x3a6a58,
      countryside: 0x5a8a40,
      city: 0x4a5560,
      village: 0x4a7a3c,
    };
    if (biomeGround[sys.biome]) {
      base.hemiGround = lerpColor(base.hemiGround, biomeGround[sys.biome], 0.35);
    }

    return base;
  }

  function nextPhase(current) {
    const i = PHASES.indexOf(current);
    return PHASES[(i + 1) % PHASES.length];
  }

  function pickWeather(phase) {
    const roll = Math.random();
    // Countryside-biased: more sunny / light cloud / soft rain
    if (phase === 'night') {
      if (roll < 0.4) return 'clear';
      if (roll < 0.65) return 'mist';
      if (roll < 0.85) return 'fog';
      return 'rain';
    }
    if (phase === 'sunrise') {
      if (roll < 0.6) return 'clear';
      if (roll < 0.85) return 'mist';
      return 'rain';
    }
    if (roll < 0.52) return 'clear';
    if (roll < 0.7) return 'mist'; // soft cloudy feel
    if (roll < 0.88) return 'rain';
    if (roll < 0.96) return 'fog';
    return 'storm';
  }

  /** Highway biome from distance (km-ish meters / 1000) */
  function biomeFromDistance(meters) {
    const km = Math.max(0, meters) / 1000;
    const cycle = [
      'forest',
      'countryside',
      'village',
      'mountain',
      'coastal',
      'city',
    ];
    const idx = Math.floor(km / 1.6) % cycle.length;
    return cycle[idx];
  }

  function updateWeather(sys, dt, distanceMeters) {
    if (distanceMeters != null) {
      sys.biome = biomeFromDistance(distanceMeters);
    }

    sys._flash = Math.max(0, (sys._flash || 0) - dt * 3.5);

    if (!sys.forced) {
      sys.phaseTime += dt;
      sys.weatherTime += dt;

      const remaining = sys.phaseDuration - sys.phaseTime;
      if (remaining < 10) {
        sys.transition = Math.min(1, sys.transition + dt / 10);
      }

      if (sys.phaseTime >= sys.phaseDuration) {
        sys.prevPhase = sys.phase;
        sys.phase = nextPhase(sys.phase);
        sys.phaseTime = 0;
        sys.transition = 0;
      }

      if (sys.weatherTime >= sys.weatherDuration) {
        const prev = sys.weather;
        sys.weather = pickWeather(sys.phase);
        sys.weatherTime = 0;
        sys.weatherDuration = 30 + Math.random() * 45;
        // Rainbow chance after rain clears
        if ((prev === 'rain' || prev === 'storm') && sys.weather === 'clear') {
          sys.rainbow = 1;
        }
      }
    }

    const targetRain = sys.weather === 'rain' || sys.weather === 'storm' ? 1 : 0;
    const targetStorm = sys.weather === 'storm' ? 1 : 0;
    const targetFog = sys.weather === 'fog' ? 1 : 0;
    const targetMist = sys.weather === 'mist' ? 1 : 0;

    sys.rainIntensity += (targetRain - sys.rainIntensity) * Math.min(1, dt * 0.35);
    sys.stormIntensity += (targetStorm - sys.stormIntensity) * Math.min(1, dt * 0.3);
    sys.fogDensity += (targetFog - sys.fogDensity) * Math.min(1, dt * 0.3);
    sys.mistDensity += (targetMist - sys.mistDensity) * Math.min(1, dt * 0.28);

    const coverTarget =
      sys.weather === 'clear' ? 0.25 : sys.weather === 'storm' ? 0.95 : 0.65;
    sys.cloudCover += (coverTarget - sys.cloudCover) * Math.min(1, dt * 0.2);

    if (sys.rainIntensity > 0.35 || sys.stormIntensity > 0.3) {
      sys.wetness = Math.min(1, sys.wetness + dt * 0.18);
      sys.rainbow = Math.max(0, sys.rainbow - dt * 0.15);
    } else {
      sys.wetness = Math.max(0, sys.wetness - dt * 0.06);
      sys.rainbow = Math.max(0, sys.rainbow - dt * 0.08);
    }

    sys.roadGrip =
      1 - sys.wetness * 0.3 - sys.fogDensity * 0.08 - sys.stormIntensity * 0.05;

    if (sys.phaseTime > 10) {
      sys.transition = Math.min(1, sys.transition + dt * 0.45);
    }

    // Thunder
    if (sys.stormIntensity > 0.4) {
      sys.thunderTimer = (sys.thunderTimer || 0) - dt;
      if (sys.thunderTimer <= 0) {
        sys._flash = 0.85;
        sys.thunderTimer = 4 + Math.random() * 10;
        if (global.HRUAudio && global.HRUAudio.playThunder) {
          global.HRUAudio.playThunder();
        }
      }
    }

    sys._isNight = isNight(sys);
    return getBlendedLighting(sys);
  }

  function getLabel(sys) {
    const p = sys.phase.charAt(0).toUpperCase() + sys.phase.slice(1);
    const w = sys.weather.charAt(0).toUpperCase() + sys.weather.slice(1);
    const b = sys.biome
      ? sys.biome.charAt(0).toUpperCase() + sys.biome.slice(1)
      : '';
    return b ? `${p} · ${w} · ${b}` : `${p} · ${w}`;
  }

  function isNight(sys) {
    return sys.phase === 'night' || (sys.phase === 'sunset' && sys.transition > 0.7);
  }

  function forceWeather(sys, weather) {
    sys.forced = weather;
    sys.weather = weather;
  }

  function clearForce(sys) {
    sys.forced = null;
  }

  global.HRUWeather = {
    PHASES,
    WEATHERS,
    SKY,
    createWeatherSystem,
    updateWeather,
    getBlendedLighting,
    getLabel,
    isNight,
    forceWeather,
    clearForce,
    biomeFromDistance,
    lerpColor,
    lerp,
  };
})(typeof window !== 'undefined' ? window : globalThis);
