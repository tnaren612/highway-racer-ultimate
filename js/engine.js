/**
 * engine.js — Core game loop, input (keyboard / touch / gamepad), run lifecycle
 */
(function (global) {
  'use strict';

  function createEngine(deps) {
    const {
      canvas,
      ui,
      storage,
      audio,
      garage,
    } = deps;

    let world = null;
    let traffic = null;
    let weather = null;
    let missions = null;
    let vehicle = null;
    let running = false;
    let paused = false;
    let gameOver = false;
    let raf = 0;
    let lastTime = 0;
    let fps = 60;
    let fpsAccum = 0;
    let fpsFrames = 0;
    let playTime = 0;
    let difficulty = 1;
    let sessionCoins = 0;
    let sessionXp = 0;
    let runDistanceKm = 0;
    let lastDamage = false;
    let nitroPressed = false;
    let lastNitroLatch = false;
    let controlsEnabled = false;
    let introActive = false;
    let introTime = 0;
    let introPhase = 'camera'; // camera | driveout | countdown | live
    let countdownStep = -1;
    let introIgnitionPlayed = false;

    // Input state
    const keys = Object.create(null);
    const input = {
      throttle: 0,
      brake: 0,
      steer: 0,
      nitro: false,
    };
    const touch = { active: false, x: 0, y: 0, brake: false, nitro: false };

    function setCountdownVisible(show, text, isGo) {
      const overlay = document.getElementById('countdown-overlay');
      const el = document.getElementById('countdown-text');
      if (!overlay || !el) return;
      overlay.classList.toggle('hidden', !show);
      if (show && text != null) {
        el.textContent = text;
        el.classList.toggle('go', !!isGo);
        // retrigger animation
        el.style.animation = 'none';
        void el.offsetWidth;
        el.style.animation = '';
      }
    }

    function setHudIntroHidden(hidden) {
      document.getElementById('hud')?.classList.toggle('intro-hidden', !!hidden);
    }

    function bindInput() {
      window.addEventListener('keydown', (e) => {
        keys[e.code] = true;
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
          e.preventDefault();
        }
        if ((e.code === 'KeyP' || e.code === 'Escape') && running && !gameOver && controlsEnabled) {
          togglePause();
        }
      });
      window.addEventListener('keyup', (e) => {
        keys[e.code] = false;
      });

      // Touch pad
      const pad = document.getElementById('touch-pad');
      const stick = document.getElementById('touch-stick');
      if (pad) {
        const onTouch = (clientX, clientY) => {
          const rect = pad.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          let dx = (clientX - cx) / (rect.width / 2);
          let dy = (clientY - cy) / (rect.height / 2);
          const mag = Math.hypot(dx, dy);
          if (mag > 1) {
            dx /= mag;
            dy /= mag;
          }
          touch.active = true;
          touch.x = dx;
          touch.y = dy;
          if (stick) {
            stick.style.transform = `translate(${dx * 36}px, ${dy * 36}px)`;
          }
        };
        const endTouch = () => {
          touch.active = false;
          touch.x = 0;
          touch.y = 0;
          if (stick) stick.style.transform = 'translate(0,0)';
        };
        pad.addEventListener('touchstart', (e) => {
          e.preventDefault();
          onTouch(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: false });
        pad.addEventListener('touchmove', (e) => {
          e.preventDefault();
          onTouch(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: false });
        pad.addEventListener('touchend', endTouch);
        pad.addEventListener('touchcancel', endTouch);
      }

      document.getElementById('touch-nitro')?.addEventListener('touchstart', (e) => {
        e.preventDefault();
        touch.nitro = true;
      }, { passive: false });
      document.getElementById('touch-nitro')?.addEventListener('touchend', () => {
        touch.nitro = false;
      });
      document.getElementById('touch-brake')?.addEventListener('touchstart', (e) => {
        e.preventDefault();
        touch.brake = true;
      }, { passive: false });
      document.getElementById('touch-brake')?.addEventListener('touchend', () => {
        touch.brake = false;
      });
    }

    function pollGamepad() {
      const gps = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const gp of gps) {
        if (!gp) continue;
        const ax = gp.axes[0] || 0;
        const ay = gp.axes[1] || 0;
        if (Math.abs(ax) > 0.15) input.steer = ax;
        if (ay < -0.15) input.throttle = Math.max(input.throttle, -ay);
        if (ay > 0.15) input.brake = Math.max(input.brake, ay);
        // Buttons: 0=A throttle, 1=B brake, 2=X nitro, 9=pause
        if (gp.buttons[0]?.pressed) input.throttle = 1;
        if (gp.buttons[1]?.pressed) input.brake = 1;
        if (gp.buttons[2]?.pressed || gp.buttons[7]?.pressed) input.nitro = true;
        if (gp.buttons[9]?.pressed && running && !gameOver && controlsEnabled) {
          if (!gp._pauseLatch) {
            gp._pauseLatch = true;
            togglePause();
          }
        } else if (gp) {
          gp._pauseLatch = false;
        }
        break;
      }
    }

    function readInput() {
      input.throttle = 0;
      input.brake = 0;
      input.steer = 0;
      input.nitro = false;

      if (!controlsEnabled) {
        return;
      }

      if (keys.KeyW || keys.ArrowUp) input.throttle = 1;
      if (keys.KeyS || keys.ArrowDown) input.brake = 1;
      if (keys.KeyA || keys.ArrowLeft) input.steer -= 1;
      if (keys.KeyD || keys.ArrowRight) input.steer += 1;
      if (keys.Space) input.nitro = true;

      if (touch.active) {
        input.steer = touch.x;
        if (touch.y < -0.2) input.throttle = Math.min(1, -touch.y);
        if (touch.y > 0.25) input.brake = Math.min(1, touch.y);
      }
      if (touch.brake) input.brake = 1;
      if (touch.nitro) input.nitro = true;

      pollGamepad();
    }

    function initWorld() {
      if (world) {
        world.dispose?.();
      }
      const settings = storage.get().settings || {};
      const gq =
        settings.graphicsQuality ||
        (settings.highQuality === false ? 'medium' : 'high');
      world = global.HRURenderer.createRenderer(canvas, {
        highQuality: settings.highQuality !== false,
        quality: gq,
      });
      traffic = global.HRUTraffic.createTrafficSystem(
        world.scene,
        world.trafficGroup,
        world.coinGroup
      );
      weather = global.HRUWeather.createWeatherSystem();
      missions = global.HRUMissions.createMissionSystem();

      // Attach selected car mesh (paint from profile / garage)
      const carId = storage.get().selectedCar;
      const car = global.HRUGarage.getCar(carId);
      const prog = storage.getCarProgress(carId);
      const paintIdx =
        storage.getSelectedColor != null
          ? storage.getSelectedColor()
          : prog.paint || 0;
      const mesh = global.HRUGarage.buildCarMesh(
        car,
        paintIdx,
        prog.wheels || 0
      );
      if (mesh) world.attachPlayerMesh(mesh, mesh.userData.bodyMat);

      vehicle = global.HRUPhysics.createVehicleState(car, prog.upgrades || {});
      vehicle.speed = 0;
      vehicle.fuel = 100;
      vehicle.nitro = 100;
      // Garage exit: off to the right shoulder, back from camera
      vehicle.x = 6.5;
      vehicle.z = 0;
    }

    function startRun() {
      initWorld();
      missions.reset();
      traffic.reset();
      weather.phase = ['sunrise', 'day', 'sunset', 'night'][Math.floor(Math.random() * 4)];
      weather.prevPhase = weather.phase;
      weather.transition = 1;

      running = true;
      paused = false;
      gameOver = false;
      controlsEnabled = false;
      introActive = true;
      introTime = 0;
      introPhase = 'camera';
      countdownStep = -1;
      introIgnitionPlayed = false;
      playTime = 0;
      difficulty = 1;
      sessionCoins = 0;
      sessionXp = 0;
      runDistanceKm = 0;
      lastDamage = false;
      nitroPressed = false;
      lastNitroLatch = false;

      ui.hideGameOver();
      ui.showPause(false);
      setCountdownVisible(false);
      setHudIntroHidden(true);
      ui.showScreen('game-screen');

      // Wide cinematic open: camera high/back, looking down the highway
      if (world && world.camera) {
        world.camera.position.set(8, 9.5, 22);
        world.camera.fov = 72;
        world.camera.updateProjectionMatrix();
        world.camera.lookAt(0, 0.4, -30);
      }

      // Place mesh at garage side before drive-out
      const mesh0 = world.playerMesh && world.playerMesh();
      if (mesh0) {
        mesh0.position.set(6.5, 0, 10);
        mesh0.rotation.y = -0.35;
      }

      const car = global.HRUGarage.getCar(storage.get().selectedCar);
      audio.stopMusic();
      audio.startMusic('race');
      audio.startAmbientWind();
      audio.startEnvironment?.(weather.biome || 'forest');
      // Engine ignition delayed until drive-out for cinematic beat

      const m = missions.getCurrent();
      ui.updateHUD({
        missionTitle: m.title,
        missionDesc: m.desc,
        missionProgress: 0,
        speed: 0,
        gear: 'N',
        score: 0,
        distance: 0,
        coins: 0,
        xp: storage.get().xp,
        fuel: 100,
        nitro: 100,
        armor: vehicle.maxDurability,
        maxArmor: vehicle.maxDurability,
      });

      lastTime = performance.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    }

    function finishIntro() {
      introActive = false;
      introPhase = 'live';
      controlsEnabled = true;
      setCountdownVisible(false);
      setHudIntroHidden(false);
      // Soft HUD reveal
      const hud = document.getElementById('hud');
      if (hud && global.gsap) {
        global.gsap.fromTo(
          hud,
          { opacity: 0 },
          { opacity: 1, duration: 0.55, ease: 'power2.out' }
        );
      }
      vehicle.x = 0;
      vehicle.yaw = 0;
      vehicle.roll = 0;
      vehicle.speed = 18;
      vehicle.speedKmh = vehicle.speed * 3.6;
      world.updatePlayerVisual(vehicle);
      const m = missions.getCurrent();
      if (m) ui.notify(m.desc, 'mission');
      audio.playWhoosh();
    }

    /**
     * Cinematic garage → highway intro + 3-2-1-GO
     * Presentation only — does not alter physics/AI after controls enable.
     */
    function updateIntro(dt) {
      introTime += dt;
      const mesh = world.playerMesh && world.playerMesh();
      const car = global.HRUGarage.getCar(storage.get().selectedCar);

      // --- Phase 1: Camera slowly pushes toward the highway ---
      if (introPhase === 'camera') {
        const t = Math.min(1, introTime / 1.8);
        const ease = t * t * (3 - 2 * t); // smoothstep
        if (world.camera) {
          const cam = world.camera;
          cam.position.x = 8 + (1.2 - 8) * ease;
          cam.position.y = 9.5 + (5.2 - 9.5) * ease;
          cam.position.z = 22 + (12 - 22) * ease;
          cam.fov = 72 + (62 - 72) * ease;
          cam.updateProjectionMatrix();
          cam.lookAt(2.5 * (1 - ease), 0.5, -25);
        }
        if (mesh) {
          mesh.position.set(6.5, 0, 10 - ease * 2);
          mesh.rotation.y = -0.35;
        }
        vehicle.x = 6.5;
        vehicle.speed = 0;
        vehicle.speedKmh = 0;
        world.scrollWorld(dt * 2);

        if (t >= 1) {
          introPhase = 'driveout';
          introTime = 0;
        }
        return;
      }

      // --- Phase 2: Vehicle drives out of garage, aligns center lane ---
      if (introPhase === 'driveout') {
        if (!introIgnitionPlayed) {
          introIgnitionPlayed = true;
          audio.startEngine(car.sound || car.class);
          audio.playWhoosh();
        }

        const t = Math.min(1, introTime / 2.4);
        const ease = 1 - Math.pow(1 - t, 3);
        // From shoulder (x=6.5) → center lane (x=0)
        vehicle.x = 6.5 + (0 - 6.5) * ease;
        vehicle.speed = 6 + 12 * ease;
        vehicle.yaw = -0.25 * (1 - ease);
        vehicle.speedKmh = vehicle.speed * 3.6;

        if (world.camera) {
          const cam = world.camera;
          const targetX = vehicle.x * 0.35;
          cam.position.x += (targetX - cam.position.x) * Math.min(1, dt * 2.5);
          cam.position.y += (4.4 - cam.position.y) * Math.min(1, dt * 2.2);
          cam.position.z += (9.2 - cam.position.z) * Math.min(1, dt * 2.2);
          cam.fov += (60 - cam.fov) * Math.min(1, dt * 2);
          cam.updateProjectionMatrix();
          cam.lookAt(vehicle.x * 0.45, 0.55, -18);
        }

        if (mesh) {
          // Z: come forward from garage depth into race position
          mesh.position.x = vehicle.x;
          mesh.position.y = 0;
          mesh.position.z = 8 * (1 - ease);
          mesh.rotation.y = vehicle.yaw;
          mesh.rotation.z = -vehicle.yaw * 0.4;
        }

        audio.updateEngine(Math.min(1, vehicle.speedKmh / 180), 0.35 + ease * 0.4, false);
        world.scrollWorld(vehicle.speed * dt * 0.65);

        if (t >= 1) {
          introPhase = 'countdown';
          introTime = 0;
          countdownStep = -1;
          vehicle.x = 0;
          vehicle.yaw = 0;
          vehicle.speed = 14;
          vehicle.speedKmh = vehicle.speed * 3.6;
          if (mesh) {
            mesh.position.set(0, 0, 0);
            mesh.rotation.set(0, 0, 0);
          }
        }
        return;
      }

      // --- Phase 3: Cinematic countdown 3-2-1-GO ---
      if (introPhase === 'countdown') {
        vehicle.speed = 14;
        vehicle.speedKmh = vehicle.speed * 3.6;
        vehicle.x = 0;
        world.scrollWorld(vehicle.speed * dt * 0.45);
        world.updatePlayerVisual(vehicle);
        world.updateCamera(vehicle, dt, { x: 0, y: 0 });
        audio.updateEngine(0.35, 0.55, false);

        const steps = [
          { at: 0.08, text: '3', go: false },
          { at: 1.05, text: '2', go: false },
          { at: 2.0, text: '1', go: false },
          { at: 2.95, text: 'GO!', go: true },
        ];
        for (let i = steps.length - 1; i >= 0; i--) {
          if (introTime >= steps[i].at && countdownStep < i) {
            countdownStep = i;
            setCountdownVisible(true, steps[i].text, steps[i].go);
            if (steps[i].go) audio.playUnlock();
            else audio.playClick();
            break;
          }
        }

        if (introTime >= 3.65) {
          finishIntro();
        }
      }
    }

    function togglePause() {
      if (!running || gameOver || !controlsEnabled) return;
      paused = !paused;
      ui.showPause(paused);
      if (paused) {
        audio.playClick();
      } else {
        lastTime = performance.now();
        audio.playClick();
      }
    }

    function endRun(reason) {
      if (gameOver) return;
      gameOver = true;
      running = false;
      paused = false;
      controlsEnabled = false;
      introActive = false;
      setCountdownVisible(false);
      setHudIntroHidden(false);
      ui.showPause(false);

      audio.stopEngine();
      audio.stopAmbientWind();
      audio.stopRain();
      audio.stopEnvironment?.();
      if (reason === 'busted') {
        audio.playWhoosh();
      } else {
        audio.playCrash();
      }

      const stats = missions.getRunStats();
      const dist = runDistanceKm;
      const score = stats.score + Math.floor(dist * 100) + sessionCoins * 2;
      stats.score = score;
      stats.distance = dist;
      stats.coins = sessionCoins;

      // Rewards
      const coinGain = sessionCoins + Math.floor(dist * 15);
      const xpGain = Math.floor(dist * 20 + stats.nearMisses * 5 + stats.missionsCompleted * 40);
      storage.addCoins(coinGain);
      const xpResult = storage.addXp(xpGain);
      sessionXp = xpGain;

      storage.recordRun({
        score,
        distance: dist,
        crashes: stats.crashes + (reason === 'crash' && stats.crashes === 0 ? 1 : 0),
        nearMisses: stats.nearMisses,
        nitroUses: stats.nitroUses,
        playTime,
        missionsCompleted: stats.missionsCompleted,
        policeEscape: stats.policeEscapes > 0,
        maxSpeed: stats.maxSpeed,
        bestCombo: stats.bestCombo,
        wasNight: global.HRUWeather.isNight(weather),
      });

      if (xpResult.leveled) {
        audio.playLevelUp();
        ui.toast(`LEVEL UP! Now level ${xpResult.level}`);
      }

      audio.stopMusic();
      audio.startMusic('menu');

      const titles = {
        crash: 'WRECKED',
        busted: 'BUSTED',
        fuel: 'OUT OF FUEL',
      };
      const titleEl = document.getElementById('gameover-title');
      if (titleEl) titleEl.textContent = titles[reason] || 'RUN ENDED';

      ui.showGameOver({
        score,
        distance: dist,
        coins: coinGain,
        xp: xpGain,
        bestCombo: stats.bestCombo,
        nearMisses: stats.nearMisses,
      });
    }

    function quitToMenu() {
      running = false;
      gameOver = false;
      paused = false;
      controlsEnabled = false;
      introActive = false;
      cancelAnimationFrame(raf);
      setCountdownVisible(false);
      setHudIntroHidden(false);
      audio.stopEngine();
      audio.stopAmbientWind();
      audio.stopRain();
      audio.stopEnvironment?.();
      audio.stopMusic();
      audio.startMusic('menu');
      ui.showPause(false);
      ui.hideGameOver();
      ui.showScreen('main-menu');
      ui.refreshHeaderStats();
      if (world) world.dispose?.();
      world = null;
    }

    function handleMissionReward(reward) {
      if (!reward) return;
      audio.playMissionComplete();
      ui.notify(`MISSION COMPLETE · +${reward.coins} ◆`, 'mission');
      sessionCoins += reward.coins;
      storage.addCoins(reward.coins);
      storage.addXp(reward.xp);
      missions.addScore(reward.coins * 2);
      setTimeout(() => {
        if (!running || gameOver) return;
        const next = missions.advanceMission();
        ui.notify(next.desc, 'mission');
      }, 1200);
    }

    function loop(now) {
      if (!running && !gameOver) return;
      raf = requestAnimationFrame(loop);

      const dtRaw = Math.min(0.05, (now - lastTime) / 1000 || 0.016);
      lastTime = now;

      // FPS
      fpsFrames += 1;
      fpsAccum += dtRaw;
      if (fpsAccum >= 0.5) {
        fps = fpsFrames / fpsAccum;
        fpsFrames = 0;
        fpsAccum = 0;
      }

      if (paused || gameOver) {
        if (world) world.render();
        return;
      }

      const dt = dtRaw;
      const settings = storage.get().settings;

      // Intro sequence: no full gameplay until GO
      if (introActive) {
        updateIntro(dt);
        const light = global.HRUWeather.updateWeather(
          weather,
          dt,
          world.getDistance ? world.getDistance() : 0
        );
        world.setWetness(weather.wetness);
        world.applyLighting(light);
        // Engine SFX only after ignition (driveout+); avoid update before startEngine
        if (introPhase !== 'camera') {
          audio.updateEngine(
            Math.min(1, vehicle.speedKmh / 220),
            0.4 + Math.min(0.4, vehicle.speedKmh / 300),
            false
          );
        }
        audio.updateWind(Math.min(1, vehicle.speedKmh / 220));
        world.effects?.update(dt, weather, vehicle.speed);
        world.render();
        return;
      }

      playTime += dt;
      readInput();

      // Physics
      global.HRUPhysics.stepVehicle(vehicle, input, dt, {
        rainGrip: weather.roadGrip,
        fuelDrain: vehicle.specs.class === 'electric' ? 0.75 : 1.1,
        steerSensitivity: settings.steerSensitivity,
        speedMult: 1,
      });

      // Nitro SFX latch
      if (vehicle.nitroActive && !lastNitroLatch) {
        audio.playNitro();
        missions.onNitro();
        lastNitroLatch = true;
      }
      if (!vehicle.nitroActive) lastNitroLatch = false;

      if (input.brake > 0.5 && vehicle.speedKmh > 40 && Math.random() < dt * 3) {
        audio.playBrake();
      }

      // World scroll
      const dz = vehicle.speed * dt;
      world.scrollWorld(dz);
      runDistanceKm = world.getDistance() / 1000;

      // Difficulty ramp
      difficulty = 1 + runDistanceKm * 0.35 + playTime * 0.01;
      traffic.setDifficulty(difficulty);

      // Weather / lighting (biome from distance)
      const light = global.HRUWeather.updateWeather(
        weather,
        dt,
        world.getDistance ? world.getDistance() : runDistanceKm * 1000
      );
      world.setWetness(weather.wetness);
      world.applyLighting(light);
      if (world.getBiome) weather.biome = world.getBiome();

      const wetHeavy = Math.max(weather.rainIntensity || 0, weather.stormIntensity || 0);
      if (wetHeavy > 0.3) audio.startRain();
      else audio.stopRain();
      if (audio.updateEnvironment) {
        audio.updateEnvironment(weather, weather.biome || world.getBiome?.());
      }

      // Traffic
      const tResult = traffic.update(dt, vehicle, { difficulty });

      // Coins
      if (tResult.collectedCoins.length) {
        tResult.collectedCoins.forEach((c) => {
          sessionCoins += c.value;
          audio.playCoin();
          world.effects?.coinPop(c.x, 1.2, 0);
          missions.addScore(c.value * 10);
          const r = missions.onCoins(sessionCoins);
          handleMissionReward(r);
        });
      }

      // Near misses
      tResult.nearMisses.forEach(() => {
        audio.playNearMiss();
        ui.notify('NEAR MISS!', 'bonus');
        const r = missions.onNearMiss();
        handleMissionReward(r);
      });

      // Hits
      tResult.hits.forEach((h) => {
        if (vehicle.invuln > 0) return;
        global.HRUPhysics.applyDamage(vehicle, h.damage);
        audio.playCrash();
        world.effects?.crash(vehicle.x, 0.5, 0);
        missions.onCrash();
        lastDamage = true;
        ui.notify('IMPACT!', 'danger');
        if (vehicle.crashed || vehicle.durability <= 0) {
          endRun('crash');
        }
      });

      // Police
      if (tResult.policeEscaped) {
        const r = missions.onPoliceEscape();
        handleMissionReward(r);
        ui.notify('ESCAPED POLICE!', 'bonus');
      }
      if (tResult.policeHit) {
        endRun('busted');
        ui.notify('BUSTED!', 'danger');
      }

      // Missions distance / speed
      handleMissionReward(missions.onDistance(runDistanceKm, lastDamage));
      lastDamage = false;
      handleMissionReward(missions.onSpeed(vehicle.speedKmh));

      // Passive score
      missions.addScore(vehicle.speedKmh * dt * 0.15);
      missions.tickCombo(dt);

      // Fuel empty soft end
      if (vehicle.fuel <= 0 && vehicle.speedKmh < 5) {
        endRun('fuel');
      }

      // Audio engine
      const speedNorm = Math.min(1, vehicle.speedKmh / 220);
      const rpmNorm = Math.min(1, (vehicle.throttle * 0.6 + speedNorm * 0.5));
      audio.updateEngine(speedNorm, rpmNorm, vehicle.nitroActive);
      audio.updateWind(speedNorm);

      // Visuals
      world.updatePlayerVisual(vehicle);
      const shake = world.effects?.getShakeOffset() || { x: 0, y: 0 };
      world.effects?.update(dt, weather, vehicle.speed);
      world.updateCamera(vehicle, dt, shake);
      world.render();

      // HUD
      const m = missions.getCurrent();
      const combo = missions.getCombo();
      const showFps = settings.showFps;
      document.getElementById('fps-counter')?.classList.toggle('hidden', !showFps);

      ui.updateHUD({
        speed: vehicle.speedKmh,
        gear: vehicle.gear,
        score: missions.getRunStats().score,
        distance: runDistanceKm,
        coins: sessionCoins,
        xp: storage.get().xp,
        fuel: vehicle.fuel,
        nitro: vehicle.nitro,
        armor: vehicle.durability,
        maxArmor: vehicle.maxDurability,
        weather: global.HRUWeather.getLabel(weather),
        missionTitle: m?.title || 'MISSION',
        missionDesc: m?.desc || '',
        missionProgress: missions.getProgress01(),
        combo: combo.combo,
        police: traffic.isPoliceActive(),
        fps: showFps ? fps : null,
      });
    }

    bindInput();

    return {
      startRun,
      togglePause,
      endRun,
      quitToMenu,
      isRunning: () => running,
      isPaused: () => paused,
      isControlsEnabled: () => controlsEnabled,
      resume() {
        if (paused) togglePause();
      },
      getVehicle: () => vehicle,
      getWorld: () => world,
    };
  }

  global.HRUEngine = { createEngine };
})(typeof window !== 'undefined' ? window : globalThis);
