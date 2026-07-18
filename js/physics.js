/**
 * physics.js — Vehicle dynamics, lanes, collisions helpers
 * Lightweight arcade physics tuned for smooth 60 FPS highway racing.
 */
(function (global) {
  'use strict';

  /** Road geometry constants (world units) */
  const ROAD = {
    LANE_COUNT: 3,
    LANE_WIDTH: 3.6,
    ROAD_WIDTH: 3.6 * 3 + 1.2, // lanes + shoulders
    MARKING_LENGTH: 4,
    MARKING_GAP: 6,
    SEGMENT_LENGTH: 20,
  };

  /** Convert lane index 0..2 to world X */
  function laneToX(lane) {
    const center = (ROAD.LANE_COUNT - 1) / 2;
    return (lane - center) * ROAD.LANE_WIDTH;
  }

  function xToLane(x) {
    const center = (ROAD.LANE_COUNT - 1) / 2;
    const lane = Math.round(x / ROAD.LANE_WIDTH + center);
    return Math.max(0, Math.min(ROAD.LANE_COUNT - 1, lane));
  }

  /**
   * Vehicle runtime state factory
   * @param {object} specs - from garage catalog
   * @param {object} upgrades - { engine, handling, nitro, armor } 0-5
   */
  function createVehicleState(specs, upgrades = {}) {
    const u = {
      engine: upgrades.engine || 0,
      handling: upgrades.handling || 0,
      nitro: upgrades.nitro || 0,
      armor: upgrades.armor || 0,
    };

    const topSpeed = specs.topSpeed * (1 + u.engine * 0.06);
    const accel = specs.acceleration * (1 + u.engine * 0.08);
    const handling = specs.handling * (1 + u.handling * 0.1);
    const braking = specs.braking * (1 + u.handling * 0.05);
    const nitroPower = specs.nitro * (1 + u.nitro * 0.12);
    const maxDurability = specs.durability * (1 + u.armor * 0.15);
    const weight = specs.weight * (1 - u.engine * 0.02);

    return {
      specs,
      upgrades: u,
      // derived
      topSpeed,
      accel,
      handling,
      braking,
      nitroPower,
      maxDurability,
      weight,
      // runtime
      x: 0,
      z: 0,
      lane: 1,
      targetLane: 1,
      speed: 0, // m/s world
      speedKmh: 0,
      gear: 1,
      throttle: 0,
      brake: 0,
      steer: 0,
      nitro: 100,
      nitroActive: false,
      fuel: 100,
      durability: maxDurability,
      maxFuel: 100,
      maxNitro: 100,
      yaw: 0,
      roll: 0,
      invuln: 0,
      crashed: false,
    };
  }

  /**
   * Step vehicle physics
   * @param {object} v vehicle state
   * @param {object} input { throttle, brake, steer, nitro }
   * @param {number} dt seconds
   * @param {object} opts { fuelDrain, rainGrip, policeDrag }
   */
  function stepVehicle(v, input, dt, opts = {}) {
    if (v.crashed) {
      v.speed = Math.max(0, v.speed - 18 * dt);
      v.speedKmh = v.speed * 3.6;
      return v;
    }

    const rainGrip = opts.rainGrip != null ? opts.rainGrip : 1;
    const sens = (opts.steerSensitivity || 100) / 100;

    // Nitro
    if (input.nitro && v.nitro > 0 && v.speed > 5) {
      if (!v.nitroActive) {
        v.nitroActive = true;
      }
      v.nitro = Math.max(0, v.nitro - 28 * dt);
      if (v.nitro <= 0) v.nitroActive = false;
    } else {
      v.nitroActive = false;
      // slow regen
      v.nitro = Math.min(v.maxNitro, v.nitro + 4 * dt);
    }

    // Throttle / brake — mild cruise assist when not braking (arcade highway feel)
    let throttle = Math.max(0, Math.min(1, input.throttle || 0));
    const brake = Math.max(0, Math.min(1, input.brake || 0));
    if (throttle < 0.05 && brake < 0.05 && v.fuel > 0) {
      throttle = 0.55; // auto cruise
    }
    v.throttle = throttle;
    v.brake = brake;

    const nitroBoost = v.nitroActive ? 1 : 0;
    const topMs =
      (v.topSpeed * (1 + (v.nitroActive ? 0.22 : 0)) * (opts.speedMult || 1)) / 3.6;

    // Weight affects accel slightly
    const massFactor = 1400 / Math.max(900, v.weight);
    const accelRate = (v.accel / 12) * massFactor + nitroBoost * (v.nitroPower / 40);
    const brakeRate = (v.braking / 8) * 12;

    // Quadratic drag toward top speed
    const speedRatio = topMs > 0 ? v.speed / topMs : 0;
    const drag = 2.5 + speedRatio * speedRatio * 18;

    if (v.fuel <= 0) {
      v.speed = Math.max(0, v.speed - 8 * dt);
    } else if (brake > 0.05) {
      v.speed = Math.max(0, v.speed - brakeRate * brake * dt);
    } else {
      const net = accelRate * throttle - drag * 0.15;
      v.speed = Math.max(0, Math.min(topMs, v.speed + net * dt));
      v.fuel = Math.max(
        0,
        v.fuel - (opts.fuelDrain || 0.9) * (0.35 + throttle * 0.65) * dt * (v.nitroActive ? 1.7 : 1)
      );
    }

    v.speedKmh = v.speed * 3.6;

    // Gears (visual)
    if (v.speedKmh < 5) v.gear = 'N';
    else if (v.speedKmh < 40) v.gear = 1;
    else if (v.speedKmh < 80) v.gear = 2;
    else if (v.speedKmh < 120) v.gear = 3;
    else if (v.speedKmh < 160) v.gear = 4;
    else if (v.speedKmh < 200) v.gear = 5;
    else v.gear = 6;

    // Steering — lane change + free lateral
    const steer = Math.max(-1, Math.min(1, (input.steer || 0) * sens));
    v.steer = steer;
    const grip = Math.max(0.4, rainGrip);
    const handleFactor = (v.handling / 100) * grip;
    const maxLateral = 12 * handleFactor + v.speed * 0.08 * handleFactor;
    const lateralVel = steer * maxLateral;

    // Soft lane assist toward nearest lane when little steer
    let targetX = v.x + lateralVel * dt;
    if (Math.abs(steer) < 0.15 && v.speed > 2) {
      const nearest = laneToX(xToLane(v.x));
      targetX += (nearest - v.x) * Math.min(1, 2.5 * handleFactor * dt);
    }

    const halfRoad = (ROAD.LANE_COUNT * ROAD.LANE_WIDTH) / 2 - 0.6;
    v.x = Math.max(-halfRoad, Math.min(halfRoad, targetX));
    v.lane = xToLane(v.x);

    // Visual lean
    v.yaw = steer * 0.12 * grip;
    v.roll = -steer * 0.08 * grip;

    // Forward
    v.z += v.speed * dt;

    if (v.invuln > 0) v.invuln -= dt;

    return v;
  }

  /** AABB collision in XZ plane (lane space) */
  function boxesOverlap(a, b) {
    return (
      Math.abs(a.x - b.x) < (a.hw + b.hw) &&
      Math.abs(a.z - b.z) < (a.hd + b.hd)
    );
  }

  /**
   * Collision response between player and traffic car
   * Returns { hit, nearMiss, damage }
   */
  function resolveTrafficCollision(player, traffic, dt) {
    const pBox = {
      x: player.x,
      z: 0, // player at camera origin z=0 in relative space
      hw: 0.95,
      hd: 2.1,
    };
    // traffic.z is relative to player (positive = ahead)
    const tBox = {
      x: traffic.x,
      z: traffic.relZ,
      hw: traffic.hw || 1.0,
      hd: traffic.hd || 2.2,
    };

    const dx = Math.abs(pBox.x - tBox.x);
    const dz = Math.abs(pBox.z - tBox.z);
    const nearX = (pBox.hw + tBox.hw) + 0.85;
    const nearZ = (pBox.hd + tBox.hd) + 1.2;

    if (dx < pBox.hw + tBox.hw && dz < pBox.hd + tBox.hd) {
      if (player.invuln > 0) return { hit: false, nearMiss: false, damage: 0 };
      const speedFactor = Math.min(1.5, player.speedKmh / 120);
      const damage = (12 + speedFactor * 18) * (100 / Math.max(40, player.maxDurability));
      return { hit: true, nearMiss: false, damage };
    }

    // Near miss: lateral close, longitudinal close, not overlapping
    if (dx < nearX && dz < nearZ && dx > pBox.hw + tBox.hw * 0.7 && player.speedKmh > 40) {
      if (!traffic._nearMissed) {
        traffic._nearMissed = true;
        return { hit: false, nearMiss: true, damage: 0 };
      }
    }
    if (dz > nearZ + 5) traffic._nearMissed = false;

    return { hit: false, nearMiss: false, damage: 0 };
  }

  function applyDamage(player, damage) {
    player.durability = Math.max(0, player.durability - damage);
    player.invuln = 1.1;
    player.speed *= 0.55;
    if (player.durability <= 0) {
      player.crashed = true;
      player.speed *= 0.3;
    }
    return player;
  }

  /** Simple object pool */
  function createPool(factory, size) {
    const free = [];
    const active = [];
    for (let i = 0; i < size; i++) free.push(factory());
    return {
      acquire() {
        const obj = free.pop() || factory();
        active.push(obj);
        return obj;
      },
      release(obj) {
        const i = active.indexOf(obj);
        if (i >= 0) active.splice(i, 1);
        free.push(obj);
      },
      releaseAll() {
        while (active.length) free.push(active.pop());
      },
      getActive() {
        return active;
      },
    };
  }

  global.HRUPhysics = {
    ROAD,
    laneToX,
    xToLane,
    createVehicleState,
    stepVehicle,
    boxesOverlap,
    resolveTrafficCollision,
    applyDamage,
    createPool,
  };
})(typeof window !== 'undefined' ? window : globalThis);
