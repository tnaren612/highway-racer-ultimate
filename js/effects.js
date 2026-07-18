/**
 * effects.js — Particles, screen shake, coin pop, nitro trails, rain, dust, smoke
 * Uses Three.js object pools where available; 2D canvas helpers for HUD FX.
 */
(function (global) {
  'use strict';

  function createEffects(scene) {
    const THREE = global.THREE;
    if (!THREE) {
      return createNullEffects();
    }

    const particles = [];
    const maxParticles = 400;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(maxParticles * 3);
    const colors = new Float32Array(maxParticles * 3);
    const sizes = new Float32Array(maxParticles);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.PointsMaterial({
      size: 0.35,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    scene.add(points);

    // Pool of particle state objects
    const pool = [];
    for (let i = 0; i < maxParticles; i++) {
      pool.push({
        alive: false,
        x: 0, y: 0, z: 0,
        vx: 0, vy: 0, vz: 0,
        life: 0, maxLife: 1,
        r: 1, g: 1, b: 1,
        size: 0.3,
        gravity: 0,
      });
    }

    function spawn(opts) {
      let p = pool.find((q) => !q.alive);
      if (!p) p = pool[Math.floor(Math.random() * pool.length)];
      p.alive = true;
      p.x = opts.x || 0;
      p.y = opts.y || 0;
      p.z = opts.z || 0;
      p.vx = opts.vx || 0;
      p.vy = opts.vy || 0;
      p.vz = opts.vz || 0;
      p.life = opts.life || 0.8;
      p.maxLife = p.life;
      p.r = opts.r != null ? opts.r : 1;
      p.g = opts.g != null ? opts.g : 1;
      p.b = opts.b != null ? opts.b : 1;
      p.size = opts.size || 0.3;
      p.gravity = opts.gravity != null ? opts.gravity : -2;
      return p;
    }

    function burst(origin, count, style) {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 2 + Math.random() * 6;
        const conf = {
          x: origin.x + (Math.random() - 0.5) * 0.5,
          y: origin.y + (Math.random() - 0.5) * 0.5,
          z: origin.z + (Math.random() - 0.5) * 0.5,
          vx: Math.cos(a) * s * 0.3,
          vy: Math.random() * s * 0.5,
          vz: Math.sin(a) * s * 0.3 - (style === 'nitro' ? 8 : 2),
          life: 0.4 + Math.random() * 0.6,
          size: 0.2 + Math.random() * 0.4,
        };
        if (style === 'crash') {
          conf.r = 1; conf.g = 0.4 + Math.random() * 0.3; conf.b = 0.1;
          conf.vy = Math.random() * 4;
          conf.gravity = -6;
        } else if (style === 'nitro') {
          conf.r = 0.2; conf.g = 0.6; conf.b = 1;
          conf.x += (Math.random() - 0.5) * 1.2;
          conf.y += Math.random() * 0.4;
          conf.vz = -12 - Math.random() * 8;
          conf.life = 0.25 + Math.random() * 0.2;
        } else if (style === 'coin') {
          conf.r = 1; conf.g = 0.8; conf.b = 0.2;
          conf.vy = 3 + Math.random() * 2;
          conf.vz = (Math.random() - 0.5) * 2;
        } else if (style === 'dust') {
          conf.r = 0.55; conf.g = 0.5; conf.b = 0.4;
          conf.vy = 0.5; conf.gravity = -0.5;
          conf.size = 0.4;
        } else if (style === 'smoke') {
          conf.r = 0.4; conf.g = 0.4; conf.b = 0.45;
          conf.vy = 1 + Math.random();
          conf.vx = (Math.random() - 0.5) * 0.5;
          conf.life = 1 + Math.random();
          conf.size = 0.5 + Math.random() * 0.5;
          conf.gravity = 0.2;
        }
        spawn(conf);
      }
    }

    // Rain as separate line-ish particles for performance
    const rainCount = 600;
    const rainGeo = new THREE.BufferGeometry();
    const rainPos = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
      rainPos[i * 3] = (Math.random() - 0.5) * 60;
      rainPos[i * 3 + 1] = Math.random() * 40;
      rainPos[i * 3 + 2] = -Math.random() * 120;
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    const rainMat = new THREE.PointsMaterial({
      color: 0xaaccff,
      size: 0.15,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const rain = new THREE.Points(rainGeo, rainMat);
    rain.frustumCulled = false;
    scene.add(rain);

    let shake = 0;
    let shakeDecay = 4;

    function addShake(amount) {
      shake = Math.min(2.5, shake + amount);
    }

    function getShakeOffset() {
      if (shake < 0.01) return { x: 0, y: 0 };
      return {
        x: (Math.random() - 0.5) * shake * 0.4,
        y: (Math.random() - 0.5) * shake * 0.3,
      };
    }

    function update(dt, weather, playerSpeed) {
      // Particles
      let idx = 0;
      for (let i = 0; i < pool.length; i++) {
        const p = pool[i];
        if (!p.alive) continue;
        p.life -= dt;
        if (p.life <= 0) {
          p.alive = false;
          continue;
        }
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        const t = p.life / p.maxLife;
        positions[idx * 3] = p.x;
        positions[idx * 3 + 1] = p.y;
        positions[idx * 3 + 2] = p.z;
        colors[idx * 3] = p.r * t;
        colors[idx * 3 + 1] = p.g * t;
        colors[idx * 3 + 2] = p.b * t;
        sizes[idx] = p.size * (0.5 + t);
        idx++;
        if (idx >= maxParticles) break;
      }
      // Hide rest
      for (let i = idx; i < maxParticles; i++) {
        positions[i * 3 + 1] = -999;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;

      // Rain
      const rainI = weather ? weather.rainIntensity : 0;
      rainMat.opacity = rainI * 0.65;
      if (rainI > 0.05) {
        const arr = rainGeo.attributes.position.array;
        const fall = (18 + playerSpeed * 0.5) * dt;
        for (let i = 0; i < rainCount; i++) {
          arr[i * 3 + 1] -= fall;
          arr[i * 3 + 2] += playerSpeed * dt * 0.8;
          if (arr[i * 3 + 1] < 0) {
            arr[i * 3] = (Math.random() - 0.5) * 60;
            arr[i * 3 + 1] = 15 + Math.random() * 25;
            arr[i * 3 + 2] = -Math.random() * 100;
          }
          if (arr[i * 3 + 2] > 10) arr[i * 3 + 2] = -100;
        }
        rainGeo.attributes.position.needsUpdate = true;
      }

      // Dust when fast and dry
      if (playerSpeed > 20 && rainI < 0.2 && Math.random() < dt * 8) {
        burst({ x: (Math.random() - 0.5) * 2, y: 0.1, z: 1.5 }, 2, 'dust');
      }

      shake = Math.max(0, shake - shakeDecay * dt);
    }

    function nitroTrail(x, y, z) {
      burst({ x, y, z }, 6, 'nitro');
    }

    function crash(x, y, z) {
      burst({ x, y, z }, 40, 'crash');
      burst({ x, y, z }, 15, 'smoke');
      addShake(1.2);
    }

    function coinPop(x, y, z) {
      burst({ x, y, z }, 12, 'coin');
    }

    function dispose() {
      scene.remove(points);
      scene.remove(rain);
      geo.dispose();
      mat.dispose();
      rainGeo.dispose();
      rainMat.dispose();
    }

    return {
      spawn,
      burst,
      update,
      addShake,
      getShakeOffset,
      nitroTrail,
      crash,
      coinPop,
      dispose,
    };
  }

  function createNullEffects() {
    const noop = () => {};
    return {
      spawn: noop,
      burst: noop,
      update: noop,
      addShake: noop,
      getShakeOffset: () => ({ x: 0, y: 0 }),
      nitroTrail: noop,
      crash: noop,
      coinPop: noop,
      dispose: noop,
    };
  }

  /** 2D speedometer painter */
  function drawSpeedometer(canvas, speedKmh, maxKmh = 280) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const r = w * 0.42;
    ctx.clearRect(0, 0, w, h);

    // Arc background
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI * 0.75, Math.PI * 2.25);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Speed arc
    const t = Math.min(1, speedKmh / maxKmh);
    const start = Math.PI * 0.75;
    const end = start + t * Math.PI * 1.5;
    const grad = ctx.createLinearGradient(0, h, w, 0);
    grad.addColorStop(0, '#00d4ff');
    grad.addColorStop(0.6, '#ff9a1f');
    grad.addColorStop(1, '#ff3d00');
    ctx.beginPath();
    ctx.arc(cx, cy, r, start, end);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 10;
    ctx.stroke();

    // Ticks
    ctx.lineWidth = 2;
    for (let i = 0; i <= 10; i++) {
      const a = start + (i / 10) * Math.PI * 1.5;
      const r0 = r - 14;
      const r1 = r - 6;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.stroke();
    }

    // Needle
    const na = start + t * Math.PI * 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(na) * (r - 18), cy + Math.sin(na) * (r - 18));
    ctx.strokeStyle = '#ff9a1f';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#00d4ff';
    ctx.fill();
  }

  global.HRUEffects = {
    createEffects,
    drawSpeedometer,
  };
})(typeof window !== 'undefined' ? window : globalThis);
