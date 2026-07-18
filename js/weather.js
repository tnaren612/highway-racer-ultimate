/**
 * weather.js — Dynamic day cycle, weather states, lighting parameters
 * Modes: sunrise, day, sunset, night + clear / rain / fog
 */
(function (global) {
  'use strict';

  const PHASES = ['sunrise', 'day', 'sunset', 'night'];
  const WEATHERS = ['clear', 'rain', 'fog'];

  const SKY = {
    sunrise: {
      skyTop: 0xff7a4a,
      skyBot: 0xffc98a,
      sunColor: 0xffaa66,
      sunIntensity: 1.1,
      ambient: 0xffccaa,
      ambientIntensity: 0.45,
      fogColor: 0xffd0b0,
      fogNear: 80,
      fogFar: 320,
      hemiSky: 0xffb080,
      hemiGround: 0x3a5030,
    },
    day: {
      skyTop: 0x3a8fe8,
      skyBot: 0xb8dcf5,
      sunColor: 0xfff2d0,
      sunIntensity: 1.35,
      ambient: 0xa0c4e8,
      ambientIntensity: 0.55,
      fogColor: 0xc5daf0,
      fogNear: 120,
      fogFar: 450,
      hemiSky: 0x88bbff,
      hemiGround: 0x4a6a40,
    },
    sunset: {
      skyTop: 0x2a1848,
      skyBot: 0xff6a3a,
      sunColor: 0xff6633,
      sunIntensity: 0.95,
      ambient: 0xff8866,
      ambientIntensity: 0.4,
      fogColor: 0xd87850,
      fogNear: 70,
      fogFar: 280,
      hemiSky: 0xff8050,
      hemiGround: 0x3a3028,
    },
    night: {
      skyTop: 0x050818,
      skyBot: 0x0c1830,
      sunColor: 0xaaccff,
      sunIntensity: 0.15,
      ambient: 0x334466,
      ambientIntensity: 0.25,
      fogColor: 0x0a1220,
      fogNear: 40,
      fogFar: 200,
      hemiSky: 0x1a2848,
      hemiGround: 0x0a1008,
    },
  };

  function createWeatherSystem() {
    return {
      phase: 'day',
      weather: 'clear',
      phaseTime: 0,
      phaseDuration: 90, // seconds per phase
      weatherTime: 0,
      weatherDuration: 45,
      transition: 1,
      prevPhase: 'day',
      rainIntensity: 0,
      fogDensity: 0,
      wetness: 0, // road reflections
      roadGrip: 1,
      forced: null,
    };
  }

  function lerpColor(a, b, t) {
    const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
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
    };

    // Weather modifiers
    if (sys.weather === 'rain' || sys.rainIntensity > 0.05) {
      const r = sys.rainIntensity;
      base.sunIntensity *= 1 - r * 0.55;
      base.ambientIntensity *= 1 - r * 0.2;
      base.fogNear = lerp(base.fogNear, 40, r * 0.7);
      base.fogFar = lerp(base.fogFar, 180, r * 0.7);
      base.fogColor = lerpColor(base.fogColor, 0x4a5568, r * 0.5);
      base.skyTop = lerpColor(base.skyTop, 0x3a4555, r * 0.6);
      base.skyBot = lerpColor(base.skyBot, 0x6a7585, r * 0.5);
    }
    if (sys.weather === 'fog' || sys.fogDensity > 0.05) {
      const f = sys.fogDensity;
      base.fogNear = lerp(base.fogNear, 15, f);
      base.fogFar = lerp(base.fogFar, 90, f);
      base.sunIntensity *= 1 - f * 0.4;
      base.fogColor = lerpColor(base.fogColor, 0x9aa8b8, f * 0.7);
    }

    return base;
  }

  function nextPhase(current) {
    const i = PHASES.indexOf(current);
    return PHASES[(i + 1) % PHASES.length];
  }

  function pickWeather(phase) {
    const roll = Math.random();
    if (phase === 'night') {
      if (roll < 0.35) return 'clear';
      if (roll < 0.65) return 'fog';
      return 'rain';
    }
    if (roll < 0.55) return 'clear';
    if (roll < 0.8) return 'rain';
    return 'fog';
  }

  function updateWeather(sys, dt) {
    if (sys.forced) {
      // still update wetness
    } else {
      sys.phaseTime += dt;
      sys.weatherTime += dt;

      // Smooth phase transition in last 8 seconds
      const remaining = sys.phaseDuration - sys.phaseTime;
      if (remaining < 8) {
        sys.transition = Math.min(1, sys.transition + dt / 8);
      }

      if (sys.phaseTime >= sys.phaseDuration) {
        sys.prevPhase = sys.phase;
        sys.phase = nextPhase(sys.phase);
        sys.phaseTime = 0;
        sys.transition = 0;
      }

      if (sys.weatherTime >= sys.weatherDuration) {
        sys.weather = pickWeather(sys.phase);
        sys.weatherTime = 0;
        sys.weatherDuration = 35 + Math.random() * 40;
      }
    }

    const targetRain = sys.weather === 'rain' ? 1 : 0;
    const targetFog = sys.weather === 'fog' ? 1 : 0;
    sys.rainIntensity += (targetRain - sys.rainIntensity) * Math.min(1, dt * 0.4);
    sys.fogDensity += (targetFog - sys.fogDensity) * Math.min(1, dt * 0.35);

    // Wetness builds in rain, dries slowly
    if (sys.rainIntensity > 0.3) {
      sys.wetness = Math.min(1, sys.wetness + dt * 0.15);
    } else {
      sys.wetness = Math.max(0, sys.wetness - dt * 0.05);
    }

    sys.roadGrip = 1 - sys.wetness * 0.28 - sys.fogDensity * 0.08;

    // Ease transition toward 1 during stable phase
    if (sys.phaseTime > 8) {
      sys.transition = Math.min(1, sys.transition + dt * 0.5);
    }

    return getBlendedLighting(sys);
  }

  function getLabel(sys) {
    const p = sys.phase.charAt(0).toUpperCase() + sys.phase.slice(1);
    const w = sys.weather.charAt(0).toUpperCase() + sys.weather.slice(1);
    return `${p} · ${w}`;
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
    lerpColor,
    lerp,
  };
})(typeof window !== 'undefined' ? window : globalThis);
