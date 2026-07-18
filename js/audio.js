/**
 * audio.js — Procedural Web Audio API engine
 * Generates engine, nitro, brakes, crash, coin, UI, rain, wind, and music
 * without external sound files (fully original, no copyrighted assets).
 */
(function (global) {
  'use strict';

  let ctx = null;
  let masterGain = null;
  let musicGain = null;
  let sfxGain = null;
  let muted = false;
  let masterVol = 0.8;
  let musicVol = 0.6;
  let sfxVol = 0.85;

  // Engine loop state
  let engineNodes = null;
  let engineRunning = false;
  let musicNodes = null;
  let musicPlaying = false;
  let ambientNodes = null;
  let rainNodes = null;

  function ensureContext() {
    if (ctx) return ctx;
    const AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    masterGain = ctx.createGain();
    musicGain = ctx.createGain();
    sfxGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    musicGain.connect(masterGain);
    sfxGain.connect(masterGain);
    applyVolumes();
    return ctx;
  }

  function resume() {
    const c = ensureContext();
    if (c && c.state === 'suspended') c.resume();
  }

  function applyVolumes() {
    if (!masterGain) return;
    const m = muted ? 0 : 1;
    masterGain.gain.setTargetAtTime(masterVol * m, ctx.currentTime, 0.05);
    musicGain.gain.setTargetAtTime(musicVol, ctx.currentTime, 0.05);
    sfxGain.gain.setTargetAtTime(sfxVol, ctx.currentTime, 0.05);
  }

  function setMasterVolume(v) {
    masterVol = Math.max(0, Math.min(1, v / 100));
    applyVolumes();
  }

  function setMusicVolume(v) {
    musicVol = Math.max(0, Math.min(1, v / 100));
    applyVolumes();
  }

  function setSfxVolume(v) {
    sfxVol = Math.max(0, Math.min(1, v / 100));
    applyVolumes();
  }

  function setMuted(m) {
    muted = !!m;
    applyVolumes();
  }

  function noiseBuffer(seconds = 1) {
    const c = ensureContext();
    const len = Math.floor(c.sampleRate * seconds);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** One-shot filtered noise burst */
  function playNoiseBurst({ duration = 0.2, filterFreq = 800, type = 'lowpass', gain = 0.3, dest = null }) {
    const c = ensureContext();
    if (!c) return;
    resume();
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(Math.max(duration, 0.05));
    const filter = c.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    src.connect(filter);
    filter.connect(g);
    g.connect(dest || sfxGain);
    src.start();
    src.stop(c.currentTime + duration + 0.05);
  }

  function playTone({ freq = 440, duration = 0.15, type = 'sine', gain = 0.2, slideTo = null }) {
    const c = ensureContext();
    if (!c) return;
    resume();
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo != null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), c.currentTime + duration);
    }
    g.gain.setValueAtTime(gain, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    osc.connect(g);
    g.connect(sfxGain);
    osc.start();
    osc.stop(c.currentTime + duration + 0.02);
  }

  function playClick() {
    playTone({ freq: 880, duration: 0.06, type: 'triangle', gain: 0.12, slideTo: 1200 });
  }

  function playCoin() {
    playTone({ freq: 988, duration: 0.08, type: 'square', gain: 0.1, slideTo: 1319 });
    setTimeout(() => playTone({ freq: 1319, duration: 0.1, type: 'sine', gain: 0.08 }), 60);
  }

  function playCrash() {
    playNoiseBurst({ duration: 0.45, filterFreq: 400, type: 'lowpass', gain: 0.55 });
    playNoiseBurst({ duration: 0.25, filterFreq: 2000, type: 'bandpass', gain: 0.3 });
    playTone({ freq: 80, duration: 0.4, type: 'sawtooth', gain: 0.2, slideTo: 30 });
  }

  function playBrake() {
    playNoiseBurst({ duration: 0.35, filterFreq: 1800, type: 'highpass', gain: 0.18 });
  }

  function playNitro() {
    playNoiseBurst({ duration: 0.5, filterFreq: 600, type: 'bandpass', gain: 0.25 });
    playTone({ freq: 120, duration: 0.4, type: 'sawtooth', gain: 0.12, slideTo: 280 });
  }

  function playUnlock() {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => playTone({ freq: f, duration: 0.15, type: 'triangle', gain: 0.12 }), i * 90);
    });
  }

  function playLevelUp() {
    [392, 523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => playTone({ freq: f, duration: 0.18, type: 'sine', gain: 0.1 }), i * 80);
    });
  }

  function playMissionComplete() {
    [659, 784, 988].forEach((f, i) => {
      setTimeout(() => playTone({ freq: f, duration: 0.2, type: 'triangle', gain: 0.12 }), i * 100);
    });
  }

  function playNearMiss() {
    playTone({ freq: 1400, duration: 0.08, type: 'sine', gain: 0.08, slideTo: 900 });
  }

  function playWhoosh() {
    playNoiseBurst({ duration: 0.3, filterFreq: 1200, type: 'bandpass', gain: 0.15 });
  }

  /** Unique engine character per vehicle class */
  const ENGINE_PROFILES = {
    sedan: { base: 55, harmonics: [1, 2, 3], noise: 0.04, rasp: 0.15 },
    suv: { base: 42, harmonics: [1, 1.5, 2], noise: 0.06, rasp: 0.2 },
    sports: { base: 70, harmonics: [1, 2, 3, 4], noise: 0.05, rasp: 0.35 },
    truck: { base: 32, harmonics: [1, 1.5, 2, 2.5], noise: 0.08, rasp: 0.25 },
    electric: { base: 90, harmonics: [1, 2], noise: 0.02, rasp: 0.05 },
  };

  function startEngine(profileKey = 'sedan') {
    const c = ensureContext();
    if (!c || engineRunning) return;
    resume();
    const profile = ENGINE_PROFILES[profileKey] || ENGINE_PROFILES.sedan;
    const oscs = [];
    const mix = c.createGain();
    mix.gain.value = 0;
    mix.connect(sfxGain);

    profile.harmonics.forEach((h, i) => {
      const osc = c.createOscillator();
      osc.type = i === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.value = profile.base * h;
      const g = c.createGain();
      g.gain.value = 0.12 / (i + 1);
      osc.connect(g);
      g.connect(mix);
      osc.start();
      oscs.push({ osc, g, mult: h });
    });

    // Rasp / exhaust noise
    const noise = c.createBufferSource();
    noise.buffer = noiseBuffer(2);
    noise.loop = true;
    const nf = c.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = 400;
    nf.Q.value = 0.8;
    const ng = c.createGain();
    ng.gain.value = profile.noise;
    noise.connect(nf);
    nf.connect(ng);
    ng.connect(mix);
    noise.start();

    engineNodes = { mix, oscs, noise, ng, nf, profile, profileKey };
    engineRunning = true;
    mix.gain.linearRampToValueAtTime(0.35, c.currentTime + 0.3);
  }

  function updateEngine(speedNorm, rpmNorm, nitroActive) {
    if (!engineRunning || !engineNodes || !ctx) return;
    const { oscs, mix, ng, nf, profile } = engineNodes;
    const t = ctx.currentTime;
    const base = profile.base * (0.7 + rpmNorm * 1.8 + speedNorm * 0.4);
    oscs.forEach(({ osc, mult }) => {
      osc.frequency.setTargetAtTime(base * mult * (nitroActive ? 1.15 : 1), t, 0.05);
    });
    const vol = 0.15 + speedNorm * 0.35 + (nitroActive ? 0.15 : 0);
    mix.gain.setTargetAtTime(vol * (muted ? 0 : 1), t, 0.08);
    if (ng) ng.gain.setTargetAtTime(profile.noise * (0.5 + speedNorm), t, 0.1);
    if (nf) nf.frequency.setTargetAtTime(300 + speedNorm * 900, t, 0.1);
  }

  function stopEngine() {
    if (!engineRunning || !engineNodes || !ctx) return;
    const { mix, oscs, noise } = engineNodes;
    const t = ctx.currentTime;
    mix.gain.linearRampToValueAtTime(0.001, t + 0.25);
    setTimeout(() => {
      try {
        oscs.forEach(({ osc }) => osc.stop());
        noise.stop();
      } catch (_) { /* already stopped */ }
      engineNodes = null;
      engineRunning = false;
    }, 300);
  }

  /** Ambient procedural music bed for menus / gameplay */
  function startMusic(mode = 'menu') {
    const c = ensureContext();
    if (!c) return;
    resume();
    stopMusic();

    const root = mode === 'race' ? 55 : 65.4;
    const intervals = mode === 'race' ? [0, 3, 5, 7, 10] : [0, 4, 7, 11, 14];
    const oscs = [];
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    lfo.frequency.value = mode === 'race' ? 0.15 : 0.08;
    lfoGain.gain.value = 0.03;
    lfo.connect(lfoGain);

    const mix = c.createGain();
    mix.gain.value = 0;
    mix.connect(musicGain);

    intervals.forEach((semi, i) => {
      const osc = c.createOscillator();
      osc.type = i % 2 === 0 ? 'sine' : 'triangle';
      const f = root * Math.pow(2, semi / 12);
      osc.frequency.value = f;
      const g = c.createGain();
      g.gain.value = 0.06 / (i + 1);
      lfoGain.connect(g.gain);
      osc.connect(g);
      g.connect(mix);
      osc.start();
      oscs.push(osc);
    });

    // Soft pulse bass
    const bass = c.createOscillator();
    bass.type = 'sine';
    bass.frequency.value = root / 2;
    const bg = c.createGain();
    bg.gain.value = 0.08;
    bass.connect(bg);
    bg.connect(mix);
    bass.start();
    oscs.push(bass);
    lfo.start();

    mix.gain.linearRampToValueAtTime(0.55, c.currentTime + 1.2);
    musicNodes = { mix, oscs, lfo, mode };
    musicPlaying = true;
  }

  function stopMusic() {
    if (!musicPlaying || !musicNodes || !ctx) return;
    const { mix, oscs, lfo } = musicNodes;
    mix.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    setTimeout(() => {
      try {
        oscs.forEach((o) => o.stop());
        lfo.stop();
      } catch (_) { /* noop */ }
      musicNodes = null;
      musicPlaying = false;
    }, 450);
  }

  function startAmbientWind() {
    const c = ensureContext();
    if (!c || ambientNodes) return;
    resume();
    const noise = c.createBufferSource();
    noise.buffer = noiseBuffer(3);
    noise.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 500;
    f.Q.value = 0.5;
    const g = c.createGain();
    g.gain.value = 0.04;
    noise.connect(f);
    f.connect(g);
    g.connect(sfxGain);
    noise.start();
    ambientNodes = { noise, g, f };
  }

  function updateWind(speedNorm) {
    if (!ambientNodes || !ctx) return;
    ambientNodes.g.gain.setTargetAtTime(0.02 + speedNorm * 0.08, ctx.currentTime, 0.2);
    ambientNodes.f.frequency.setTargetAtTime(400 + speedNorm * 800, ctx.currentTime, 0.2);
  }

  function stopAmbientWind() {
    if (!ambientNodes) return;
    try { ambientNodes.noise.stop(); } catch (_) { /* noop */ }
    ambientNodes = null;
  }

  function startRain() {
    const c = ensureContext();
    if (!c || rainNodes) return;
    resume();
    const noise = c.createBufferSource();
    noise.buffer = noiseBuffer(2);
    noise.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 3000;
    const g = c.createGain();
    g.gain.value = 0.06;
    noise.connect(f);
    f.connect(g);
    g.connect(sfxGain);
    noise.start();
    rainNodes = { noise, g };
  }

  function stopRain() {
    if (!rainNodes) return;
    try { rainNodes.noise.stop(); } catch (_) { /* noop */ }
    rainNodes = null;
  }

  function playThunder() {
    playNoiseBurst({ duration: 0.9, filterFreq: 180, type: 'lowpass', gain: 0.55 });
    setTimeout(() => {
      playNoiseBurst({ duration: 0.5, filterFreq: 120, type: 'lowpass', gain: 0.35 });
    }, 80);
    playTone({ freq: 55, duration: 0.7, type: 'sine', gain: 0.18, slideTo: 28 });
  }

  /** Soft layered nature ambience (birds / forest / ocean / village) */
  let envNodes = null;
  let envBiome = '';

  function stopEnvironment() {
    if (!envNodes) return;
    if (envNodes.chirpTimer) clearTimeout(envNodes.chirpTimer);
    try {
      envNodes.sources.forEach((s) => s.stop());
    } catch (_) {
      /* noop */
    }
    envNodes = null;
    envBiome = '';
  }

  function startEnvironment(biome = 'forest') {
    const c = ensureContext();
    if (!c) return;
    resume();
    if (envNodes && envBiome === biome) return;
    stopEnvironment();
    envBiome = biome;

    const sources = [];
    const mix = c.createGain();
    mix.gain.value = 0.045;
    mix.connect(sfxGain);

    // Base air / nature noise
    const noise = c.createBufferSource();
    noise.buffer = noiseBuffer(2.5);
    noise.loop = true;
    const f = c.createBiquadFilter();
    f.type = biome === 'coastal' ? 'lowpass' : biome === 'city' ? 'highpass' : 'bandpass';
    f.frequency.value =
      biome === 'coastal' ? 600 : biome === 'city' ? 1800 : biome === 'forest' ? 2200 : 900;
    f.Q.value = 0.6;
    noise.connect(f);
    f.connect(mix);
    noise.start();
    sources.push(noise);

    // Bird-like peeps for nature biomes
    if (biome === 'forest' || biome === 'countryside' || biome === 'village') {
      const chirp = () => {
        if (!envNodes) return;
        playTone({
          freq: 1400 + Math.random() * 900,
          duration: 0.07,
          type: 'sine',
          gain: 0.025,
          slideTo: 1800 + Math.random() * 400,
        });
        envNodes.chirpTimer = setTimeout(chirp, 900 + Math.random() * 2200);
      };
      envNodes = { sources, mix, f, chirpTimer: setTimeout(chirp, 400) };
      return;
    }

    envNodes = { sources, mix, f, chirpTimer: 0 };
  }

  function updateEnvironment(weather, biome) {
    if (!weather) return;
    const b = biome || weather.biome || 'forest';
    startEnvironment(b);
    if (!envNodes || !ctx) return;
    const rain = Math.max(weather.rainIntensity || 0, weather.stormIntensity || 0);
    const night = weather.phase === 'night' || weather._isNight;
    // Quieter birds/ambience in heavy rain or night
    const target = (night ? 0.025 : 0.05) * (1 - rain * 0.55);
    envNodes.mix.gain.setTargetAtTime(target, ctx.currentTime, 0.4);
    if (envNodes.f) {
      const base =
        b === 'coastal' ? 500 : b === 'city' ? 1600 : b === 'mountain' ? 700 : 2000;
      envNodes.f.frequency.setTargetAtTime(base + rain * 400, ctx.currentTime, 0.5);
    }
  }

  function applyFromSettings(settings) {
    if (!settings) return;
    setMasterVolume(settings.masterVolume ?? 80);
    setMusicVolume(settings.musicVolume ?? 60);
    setSfxVolume(settings.sfxVolume ?? 85);
    setMuted(!!settings.muted);
  }

  global.HRUAudio = {
    ensureContext,
    resume,
    setMasterVolume,
    setMusicVolume,
    setSfxVolume,
    setMuted,
    applyFromSettings,
    playClick,
    playCoin,
    playCrash,
    playBrake,
    playNitro,
    playUnlock,
    playLevelUp,
    playMissionComplete,
    playNearMiss,
    playWhoosh,
    playThunder,
    startEngine,
    updateEngine,
    stopEngine,
    startMusic,
    stopMusic,
    startAmbientWind,
    updateWind,
    stopAmbientWind,
    startRain,
    stopRain,
    startEnvironment,
    updateEnvironment,
    stopEnvironment,
    ENGINE_PROFILES,
  };
})(typeof window !== 'undefined' ? window : globalThis);
