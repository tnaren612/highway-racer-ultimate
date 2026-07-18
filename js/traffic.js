/**
 * traffic.js — Traffic AI, coin spawns, police chase, object pooling
 */
(function (global) {
  'use strict';

  const VEHICLE_TYPES = [
    { id: 'compact', color: 0x4a90d9, hw: 0.9, hd: 1.9, speed: 0.55, weight: 1 },
    { id: 'sedan_ai', color: 0xc0c4c8, hw: 0.95, hd: 2.1, speed: 0.65, weight: 1.1 },
    { id: 'suv_ai', color: 0x2d5a3d, hw: 1.05, hd: 2.3, speed: 0.5, weight: 1.4 },
    { id: 'van', color: 0xe8e0d0, hw: 1.1, hd: 2.5, speed: 0.45, weight: 1.5 },
    { id: 'sport_ai', color: 0xcc2233, hw: 0.9, hd: 2.0, speed: 0.85, weight: 0.9 },
    { id: 'truck_ai', color: 0x556070, hw: 1.2, hd: 3.2, speed: 0.35, weight: 2.2 },
    { id: 'bus_ai', color: 0xf0c040, hw: 1.15, hd: 3.8, speed: 0.4, weight: 2.4 },
    { id: 'moto_ai', color: 0x222222, hw: 0.45, hd: 1.4, speed: 0.95, weight: 0.4 },
    { id: 'ambulance', color: 0xffffff, hw: 1.05, hd: 2.6, speed: 0.75, weight: 1.3, emergency: true },
    { id: 'tractor', color: 0x2d6b2e, hw: 1.15, hd: 2.0, speed: 0.28, weight: 2.0 },
  ];

  function buildTrafficMesh(THREE, type) {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: type.color,
      metalness: type.id === 'moto_ai' ? 0.7 : 0.5,
      roughness: 0.42,
    });
    const len = type.hd * 1.9;

    if (type.id === 'moto_ai') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.35, len * 0.85), bodyMat);
      body.position.y = 0.55;
      body.castShadow = true;
      g.add(body);
      const rider = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0x334455 })
      );
      rider.position.set(0, 0.95, -0.1);
      g.add(rider);
      const wMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
      const wGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.12, 10);
      [len * 0.28, -len * 0.28].forEach((z) => {
        const w = new THREE.Mesh(wGeo, wMat);
        w.rotation.z = Math.PI / 2;
        w.position.set(0, 0.28, z);
        g.add(w);
      });
      return g;
    }

    const bodyH = type.id === 'bus_ai' ? 1.1 : type.id === 'truck_ai' ? 0.7 : 0.5;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(type.hw * 1.85, bodyH, len),
      bodyMat
    );
    body.position.y = bodyH * 0.55 + 0.25;
    body.castShadow = true;
    g.add(body);

    if (type.id === 'bus_ai') {
      const windows = new THREE.Mesh(
        new THREE.BoxGeometry(type.hw * 1.7, 0.45, len * 0.7),
        new THREE.MeshStandardMaterial({ color: 0x88ccee, metalness: 0.3, roughness: 0.2, transparent: true, opacity: 0.7 })
      );
      windows.position.set(0, 1.35, 0);
      g.add(windows);
    } else if (type.id !== 'tractor') {
      const cabinH = type.id === 'truck_ai' ? 0.7 : 0.45;
      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(type.hw * 1.5, cabinH, len * 0.4),
        new THREE.MeshStandardMaterial({ color: 0x1a222c, metalness: 0.3, roughness: 0.25 })
      );
      cabin.position.set(0, 0.85 + cabinH * 0.2, type.id === 'truck_ai' ? len * 0.15 : -len * 0.05);
      g.add(cabin);
    }

    if (type.emergency) {
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(1.0, 0.14, 0.3),
        new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff0000, emissiveIntensity: 0.7 })
      );
      bar.position.set(0, 1.45, 0);
      g.add(bar);
    }

    if (type.id === 'tractor') {
      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(type.hw * 1.2, 0.9, len * 0.35),
        new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.2, roughness: 0.6 })
      );
      cabin.position.set(0, 1.2, len * 0.15);
      g.add(cabin);
    }

    const wMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const wR = type.id === 'tractor' ? 0.42 : 0.3;
    const wGeo = new THREE.CylinderGeometry(wR, wR, 0.22, 10);
    [
      [-type.hw * 0.9, wR, len * 0.3],
      [type.hw * 0.9, wR, len * 0.3],
      [-type.hw * 0.9, wR, -len * 0.3],
      [type.hw * 0.9, wR, -len * 0.3],
    ].forEach((p) => {
      const w = new THREE.Mesh(wGeo, wMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(p[0], p[1], p[2]);
      g.add(w);
    });

    return g;
  }

  function buildPoliceMesh(THREE) {
    const type = { id: 'police', color: 0x1a1a2e, hw: 1.0, hd: 2.15, speed: 0.9, weight: 1.1 };
    const g = buildTrafficMesh(THREE, type);
    // Light bar
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.15, 0.35),
      new THREE.MeshStandardMaterial({
        color: 0xeeeeee,
        emissive: 0x0022ff,
        emissiveIntensity: 0.8,
      })
    );
    bar.position.set(0, 1.35, 0);
    g.add(bar);
    g.userData.lightBar = bar;
    g.userData.isPolice = true;
    return g;
  }

  function buildCoinMesh(THREE) {
    const g = new THREE.Group();
    const coin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 0.08, 16),
      new THREE.MeshStandardMaterial({
        color: 0xffb020,
        metalness: 0.85,
        roughness: 0.25,
        emissive: 0xff8800,
        emissiveIntensity: 0.25,
      })
    );
    coin.rotation.x = Math.PI / 2;
    g.add(coin);
    g.userData.spin = coin;
    return g;
  }

  function createTrafficSystem(scene, trafficGroup, coinGroup) {
    const THREE = global.THREE;
    const Physics = global.HRUPhysics;
    const laneToX = Physics ? Physics.laneToX : (l) => (l - 1) * 3.6;

    const vehicles = [];
    const coins = [];
    const meshPool = [];
    const coinPool = [];
    let spawnTimer = 0;
    let coinTimer = 0;
    let difficulty = 1;
    let policeActive = false;
    let policeTimer = 0;
    let policeCooldown = 60;
    let policeMesh = null;
    let policeState = null;

    function acquireMesh(type) {
      let entry = meshPool.find((m) => !m.inUse && m.typeId === type.id);
      if (!entry) {
        const mesh = buildTrafficMesh(THREE, type);
        trafficGroup.add(mesh);
        entry = { mesh, typeId: type.id, inUse: false };
        meshPool.push(entry);
      }
      entry.inUse = true;
      entry.mesh.visible = true;
      return entry;
    }

    function releaseMesh(entry) {
      if (!entry) return;
      entry.inUse = false;
      entry.mesh.visible = false;
    }

    function spawnVehicle(ahead = true) {
      const type = VEHICLE_TYPES[Math.floor(Math.random() * VEHICLE_TYPES.length)];
      const lane = Math.floor(Math.random() * 3);
      const entry = acquireMesh(type);
      const relZ = ahead
        ? -40 - Math.random() * 80 - difficulty * 5
        : 25 + Math.random() * 20;

      // Avoid stacking same lane near same z
      for (const v of vehicles) {
        if (v.lane === lane && Math.abs(v.relZ - relZ) < 12) {
          releaseMesh(entry);
          return;
        }
      }

      const car = {
        type,
        lane,
        x: laneToX(lane),
        targetX: laneToX(lane),
        relZ,
        speed: type.speed * (0.7 + Math.random() * 0.4), // fraction of player ref
        baseSpeed: 18 + type.speed * 25, // m/s absolute-ish
        hw: type.hw,
        hd: type.hd,
        meshEntry: entry,
        laneChangeTimer: 3 + Math.random() * 8,
        _nearMissed: false,
      };
      entry.mesh.position.set(car.x, 0, car.relZ);
      vehicles.push(car);
    }

    function spawnCoin() {
      let mesh = coinPool.find((c) => !c.inUse);
      if (!mesh) {
        const m = buildCoinMesh(THREE);
        coinGroup.add(m);
        mesh = { mesh: m, inUse: false };
        coinPool.push(mesh);
      }
      mesh.inUse = true;
      mesh.mesh.visible = true;
      const lane = Math.floor(Math.random() * 3);
      const coin = {
        x: laneToX(lane),
        relZ: -50 - Math.random() * 40,
        meshEntry: mesh,
        value: 5 + Math.floor(Math.random() * 3) * 5,
      };
      mesh.mesh.position.set(coin.x, 1.2, coin.relZ);
      coins.push(coin);
    }

    function startPolice() {
      if (policeActive) return;
      policeActive = true;
      policeTimer = 25 + Math.random() * 15;
      if (!policeMesh) {
        policeMesh = buildPoliceMesh(THREE);
        trafficGroup.add(policeMesh);
      }
      policeMesh.visible = true;
      policeState = {
        x: laneToX(1),
        relZ: 18,
        lane: 1,
        hw: 1.0,
        hd: 2.15,
        catchProgress: 0,
      };
      policeMesh.position.set(policeState.x, 0, policeState.relZ);
    }

    function endPolice() {
      policeActive = false;
      policeCooldown = 45 + Math.random() * 40;
      if (policeMesh) policeMesh.visible = false;
      policeState = null;
    }

    function update(dt, player, opts = {}) {
      difficulty = opts.difficulty || 1;
      const playerSpeed = player.speed || 0;
      const spawnRate = Math.max(0.6, 2.2 - difficulty * 0.25);

      spawnTimer -= dt;
      if (spawnTimer <= 0 && vehicles.length < 8 + Math.floor(difficulty)) {
        spawnVehicle(true);
        if (Math.random() < 0.3) spawnVehicle(true);
        spawnTimer = spawnRate * (0.7 + Math.random() * 0.6);
      }

      coinTimer -= dt;
      if (coinTimer <= 0 && coins.length < 12) {
        spawnCoin();
        coinTimer = 1.2 + Math.random() * 1.5;
      }

      // Traffic movement relative to player
      for (let i = vehicles.length - 1; i >= 0; i--) {
        const v = vehicles[i];
        // Relative: player moves forward, so traffic drifts toward camera based on speed diff
        const trafficWorldSpeed = v.baseSpeed * (0.85 + difficulty * 0.05);
        v.relZ += (playerSpeed - trafficWorldSpeed) * dt;

        // Simple AI lane change
        v.laneChangeTimer -= dt;
        if (v.laneChangeTimer <= 0) {
          v.laneChangeTimer = 4 + Math.random() * 10;
          if (Math.random() < 0.4) {
            const dir = Math.random() > 0.5 ? 1 : -1;
            v.lane = Math.max(0, Math.min(2, v.lane + dir));
            v.targetX = laneToX(v.lane);
          }
        }
        v.x += (v.targetX - v.x) * Math.min(1, dt * 2.5);

        if (v.meshEntry) {
          v.meshEntry.mesh.position.set(v.x, 0, v.relZ);
          v.meshEntry.mesh.rotation.y = (v.targetX - v.x) * 0.05;
        }

        // Despawn
        if (v.relZ > 30 || v.relZ < -160) {
          releaseMesh(v.meshEntry);
          vehicles.splice(i, 1);
        }
      }

      // Coins
      const collected = [];
      for (let i = coins.length - 1; i >= 0; i--) {
        const c = coins[i];
        c.relZ += playerSpeed * dt;
        if (c.meshEntry) {
          c.meshEntry.mesh.position.set(c.x, 1.2 + Math.sin(performance.now() * 0.005 + i) * 0.15, c.relZ);
          if (c.meshEntry.mesh.userData.spin) {
            c.meshEntry.mesh.userData.spin.rotation.z += dt * 4;
          }
        }
        // Collect
        if (Math.abs(c.x - player.x) < 1.4 && Math.abs(c.relZ) < 2.2) {
          collected.push(c);
          c.meshEntry.inUse = false;
          c.meshEntry.mesh.visible = false;
          coins.splice(i, 1);
          continue;
        }
        if (c.relZ > 20 || c.relZ < -150) {
          c.meshEntry.inUse = false;
          c.meshEntry.mesh.visible = false;
          coins.splice(i, 1);
        }
      }

      // Police
      policeCooldown -= dt;
      if (!policeActive && policeCooldown <= 0 && player.speedKmh > 100 && difficulty > 1.2) {
        if (Math.random() < dt * 0.15) startPolice();
      }

      let policeHit = false;
      let escaped = false;
      if (policeActive && policeState) {
        policeTimer -= dt;
        // Chase player lane
        policeState.lane = player.lane;
        const tx = player.x;
        policeState.x += (tx - policeState.x) * Math.min(1, dt * 1.8);
        // Close distance if player slow
        const closeRate = player.speedKmh < 140 ? 4 : player.speedKmh > 180 ? -2 : 1;
        policeState.relZ += closeRate * dt;
        policeState.relZ = Math.max(4, Math.min(22, policeState.relZ));

        if (policeMesh) {
          policeMesh.position.set(policeState.x, 0, policeState.relZ);
          if (policeMesh.userData.lightBar) {
            const flash = Math.sin(performance.now() * 0.02) > 0;
            policeMesh.userData.lightBar.material.emissive.setHex(flash ? 0x0022ff : 0xff0000);
          }
        }

        // Catch if too close and aligned
        if (Math.abs(policeState.x - player.x) < 1.5 && policeState.relZ < 7 && player.speedKmh < 90) {
          policeHit = true;
        }

        if (policeTimer <= 0 || player.speedKmh > 200) {
          escaped = true;
          endPolice();
        }
      }

      // Collisions
      const hits = [];
      const nearMisses = [];
      if (Physics) {
        for (const v of vehicles) {
          const result = Physics.resolveTrafficCollision(player, v, dt);
          if (result.hit) hits.push({ vehicle: v, damage: result.damage });
          if (result.nearMiss) nearMisses.push(v);
        }
      }

      return {
        collectedCoins: collected,
        hits,
        nearMisses,
        policeActive,
        policeHit,
        policeEscaped: escaped,
        vehicleCount: vehicles.length,
      };
    }

    function reset() {
      vehicles.forEach((v) => releaseMesh(v.meshEntry));
      vehicles.length = 0;
      coins.forEach((c) => {
        c.meshEntry.inUse = false;
        c.meshEntry.mesh.visible = false;
      });
      coins.length = 0;
      spawnTimer = 1;
      coinTimer = 2;
      difficulty = 1;
      endPolice();
      policeCooldown = 50;
    }

    function setDifficulty(d) {
      difficulty = d;
    }

    return {
      update,
      reset,
      setDifficulty,
      startPolice,
      endPolice,
      isPoliceActive: () => policeActive,
      getVehicles: () => vehicles,
    };
  }

  global.HRUTraffic = {
    VEHICLE_TYPES,
    createTrafficSystem,
    buildTrafficMesh,
    buildPoliceMesh,
  };
})(typeof window !== 'undefined' ? window : globalThis);
