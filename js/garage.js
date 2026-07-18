/**
 * garage.js — Vehicle catalog, 3D previews, stats, paint, wheels, upgrades
 * All vehicles are original designs with unique stats and procedural meshes.
 */
(function (global) {
  'use strict';

  /** Shared professional paint palette (selection + garage) */
  const PAINT_PALETTE = [
    { name: 'White', hex: 0xf5f5f5 },
    { name: 'Black', hex: 0x1a1a1a },
    { name: 'Silver', hex: 0xc0c4c8 },
    { name: 'Gray', hex: 0x6b7280 },
    { name: 'Red', hex: 0xc0392b },
    { name: 'Orange', hex: 0xff6a00 },
    { name: 'Yellow', hex: 0xf1c40f },
    { name: 'Green', hex: 0x27ae60 },
    { name: 'Blue', hex: 0x2a6fdb },
    { name: 'Purple', hex: 0x8e44ad },
  ];

  const PAINT_HEXES = PAINT_PALETTE.map((p) => p.hex);

  /** Catalog order: Sedan → SUV → Sports → Truck → Electric */
  const CATALOG = [
    {
      id: 'sedan',
      name: 'Apex Sedan',
      class: 'sedan',
      price: 0,
      description: 'Balanced daily driver with reliable handling.',
      topSpeed: 195,
      acceleration: 72,
      handling: 78,
      braking: 75,
      nitro: 70,
      weight: 1350,
      durability: 100,
      paints: PAINT_HEXES,
      wheels: ['Stock', 'Sport', 'Chrome'],
      sound: 'sedan',
    },
    {
      id: 'suv',
      name: 'Trailforge SUV',
      class: 'suv',
      price: 2500,
      description: 'Heavy armor and high durability for long hauls.',
      topSpeed: 175,
      acceleration: 58,
      handling: 62,
      braking: 70,
      nitro: 65,
      weight: 1950,
      durability: 145,
      paints: PAINT_HEXES,
      wheels: ['All-Terrain', 'Urban', 'Heavy'],
      sound: 'suv',
    },
    {
      id: 'sports',
      name: 'Voltigeur GT',
      class: 'sports',
      price: 6000,
      description: 'Blistering speed and razor handling for experts.',
      topSpeed: 265,
      acceleration: 95,
      handling: 92,
      braking: 88,
      nitro: 95,
      weight: 1180,
      durability: 75,
      paints: PAINT_HEXES,
      wheels: ['Racing', 'Aero', 'Carbon'],
      sound: 'sports',
    },
    {
      id: 'truck',
      name: 'Ironhaul Rig',
      class: 'truck',
      price: 4000,
      description: 'Slow to push, unstoppable once rolling. Tank armor.',
      topSpeed: 155,
      acceleration: 42,
      handling: 48,
      braking: 55,
      nitro: 55,
      weight: 3200,
      durability: 180,
      paints: PAINT_HEXES,
      wheels: ['Hauler', 'Dual', 'Studded'],
      sound: 'truck',
    },
    {
      id: 'electric',
      name: 'Nimbus EV',
      class: 'electric',
      price: 8000,
      description: 'Instant torque, silent hum, efficient fuel (energy) use.',
      topSpeed: 230,
      acceleration: 98,
      handling: 85,
      braking: 90,
      nitro: 88,
      weight: 1600,
      durability: 95,
      paints: PAINT_HEXES,
      wheels: ['AeroDisc', 'Turbine', 'Minimal'],
      sound: 'electric',
    },
  ];

  const UPGRADE_LABELS = {
    engine: 'Engine',
    handling: 'Handling',
    nitro: 'Nitro',
    armor: 'Armor',
  };

  function getCar(id) {
    return CATALOG.find((c) => c.id === id) || CATALOG[0];
  }

  function getAll() {
    return CATALOG;
  }

  /**
   * Build a unique low-poly mesh per vehicle class
   */
  function buildCarMesh(car, paintIndex = 0, wheelIndex = 0) {
    const THREE = global.THREE;
    if (!THREE) return null;

    const color = car.paints[paintIndex % car.paints.length];
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color,
      metalness: car.class === 'electric' ? 0.8 : 0.6,
      roughness: car.class === 'truck' ? 0.55 : 0.32,
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x0a1520,
      metalness: 0.4,
      roughness: 0.15,
      transparent: true,
      opacity: 0.85,
    });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 });
    const wheelMat = new THREE.MeshStandardMaterial({
      color: wheelIndex === 2 ? 0xcccccc : 0x1a1a1a,
      metalness: wheelIndex === 2 ? 0.8 : 0.2,
      roughness: 0.6,
    });

    const cls = car.class;

    if (cls === 'sedan') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.55, 4.3), bodyMat);
      body.position.y = 0.55;
      body.castShadow = true;
      g.add(body);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.48, 1.9), glassMat);
      cabin.position.set(0, 1.0, -0.15);
      g.add(cabin);
      const hood = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 1.1), bodyMat);
      hood.position.set(0, 0.78, 1.35);
      g.add(hood);
    } else if (cls === 'suv') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.9, 4.5), bodyMat);
      body.position.y = 0.85;
      body.castShadow = true;
      g.add(body);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 2.4), glassMat);
      cabin.position.set(0, 1.5, -0.2);
      g.add(cabin);
    } else if (cls === 'sports') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.4, 4.4), bodyMat);
      body.position.y = 0.45;
      body.castShadow = true;
      g.add(body);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.35, 1.5), glassMat);
      cabin.position.set(0, 0.8, -0.1);
      g.add(cabin);
      // Spoiler
      const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.35), darkMat);
      spoiler.position.set(0, 0.85, -2.0);
      g.add(spoiler);
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.08), darkMat);
      [-0.7, 0.7].forEach((x) => {
        const p = wing.clone();
        p.position.set(x, 0.7, -2.0);
        g.add(p);
      });
    } else if (cls === 'truck') {
      const cab = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.1, 2.0), bodyMat);
      cab.position.set(0, 1.0, 1.2);
      cab.castShadow = true;
      g.add(cab);
      const bed = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.7, 3.0), darkMat);
      bed.position.set(0, 0.7, -1.2);
      g.add(bed);
      const glass = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 0.1), glassMat);
      glass.position.set(0, 1.35, 2.15);
      g.add(glass);
    } else if (cls === 'electric') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.5, 4.5), bodyMat);
      body.position.y = 0.5;
      body.castShadow = true;
      g.add(body);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 2.2), glassMat);
      cabin.position.set(0, 0.95, -0.1);
      g.add(cabin);
      // LED strip
      const led = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 0.06, 0.08),
        new THREE.MeshStandardMaterial({
          color: 0x00ffc8,
          emissive: 0x00ffaa,
          emissiveIntensity: 0.9,
        })
      );
      led.position.set(0, 0.55, 2.28);
      g.add(led);
    }

    // Wheels — size varies slightly by wheelIndex
    const wheelR = 0.32 + wheelIndex * 0.02;
    const wheelW = 0.22 + (wheelIndex === 1 ? 0.04 : 0);
    const wheelGeo = new THREE.CylinderGeometry(wheelR, wheelR, wheelW, 14);
    const zFront = cls === 'truck' ? 1.6 : 1.35;
    const zRear = cls === 'truck' ? -1.6 : -1.35;
    const xOff = cls === 'suv' || cls === 'truck' ? 0.95 : 0.88;
    [
      [-xOff, wheelR, zFront],
      [xOff, wheelR, zFront],
      [-xOff, wheelR, zRear],
      [xOff, wheelR, zRear],
    ].forEach((p) => {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(p[0], p[1], p[2]);
      w.castShadow = true;
      g.add(w);
    });

    // Headlights
    const hlMat = new THREE.MeshStandardMaterial({
      color: 0xffffee,
      emissive: 0xffffcc,
      emissiveIntensity: 0.6,
    });
    const hlGeo = new THREE.BoxGeometry(0.28, 0.14, 0.08);
    const hlZ = cls === 'truck' ? 2.25 : 2.2;
    [-0.55, 0.55].forEach((x) => {
      const h = new THREE.Mesh(hlGeo, hlMat);
      h.position.set(x, cls === 'sports' ? 0.45 : 0.55, hlZ);
      g.add(h);
    });

    // Taillights
    const tlMat = new THREE.MeshStandardMaterial({
      color: 0xff2222,
      emissive: 0xff0000,
      emissiveIntensity: 0.5,
    });
    [-0.55, 0.55].forEach((x) => {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.06), tlMat);
      t.position.set(x, 0.55, cls === 'truck' ? -2.7 : -2.15);
      g.add(t);
    });

    g.userData.bodyMat = bodyMat;
    g.userData.carId = car.id;
    return g;
  }

  /**
   * Effective stats after upgrades
   */
  function getEffectiveStats(car, upgrades = {}) {
    const u = {
      engine: upgrades.engine || 0,
      handling: upgrades.handling || 0,
      nitro: upgrades.nitro || 0,
      armor: upgrades.armor || 0,
    };
    return {
      topSpeed: Math.round(car.topSpeed * (1 + u.engine * 0.06)),
      acceleration: Math.round(car.acceleration * (1 + u.engine * 0.08)),
      handling: Math.round(car.handling * (1 + u.handling * 0.1)),
      braking: Math.round(car.braking * (1 + u.handling * 0.05)),
      nitro: Math.round(car.nitro * (1 + u.nitro * 0.12)),
      weight: Math.round(car.weight * (1 - u.engine * 0.02)),
      durability: Math.round(car.durability * (1 + u.armor * 0.15)),
    };
  }

  /**
   * Garage screen controller with carousel + Three.js preview
   */
  function createGarageController(canvas) {
    const THREE = global.THREE;
    let renderer = null;
    let scene = null;
    let camera = null;
    let carMesh = null;
    let raf = 0;
    let rotating = true;
    let index = 0;
    let active = false;

    function init() {
      if (!canvas || !THREE || renderer) return;
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
      camera.position.set(3.5, 2.2, 6.5);
      camera.lookAt(0, 0.6, 0);

      const amb = new THREE.AmbientLight(0x8899bb, 0.6);
      scene.add(amb);
      const dir = new THREE.DirectionalLight(0xffe0c0, 1.1);
      dir.position.set(5, 8, 4);
      scene.add(dir);
      const rim = new THREE.DirectionalLight(0x00d4ff, 0.4);
      rim.position.set(-4, 2, -3);
      scene.add(rim);

      // Floor disc
      const floor = new THREE.Mesh(
        new THREE.CircleGeometry(4, 48),
        new THREE.MeshStandardMaterial({
          color: 0x12182a,
          metalness: 0.6,
          roughness: 0.4,
        })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = 0;
      scene.add(floor);

      // Neon ring
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(3.2, 0.04, 8, 64),
        new THREE.MeshBasicMaterial({ color: 0x00d4ff })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.02;
      scene.add(ring);
    }

    function resize() {
      if (!renderer || !canvas) return;
      const w = canvas.clientWidth || 400;
      const h = canvas.clientHeight || 300;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }

    function showCar(carId) {
      init();
      const car = getCar(carId);
      index = CATALOG.findIndex((c) => c.id === carId);
      if (index < 0) index = 0;
      const storage = global.HRUStorage;
      const prog = storage ? storage.getCarProgress(car.id) : { paint: 0, wheels: 0 };
      // Prefer global selected paint for the active vehicle
      let paint = prog.paint || 0;
      if (storage && storage.get().selectedCar === car.id && storage.getSelectedColor) {
        paint = storage.getSelectedColor();
      }

      if (carMesh) {
        scene.remove(carMesh);
        carMesh = null;
      }
      carMesh = buildCarMesh(car, paint, prog.wheels || 0);
      if (carMesh) {
        carMesh.position.y = 0;
        scene.add(carMesh);
      }
      return car;
    }

    function setPaint(paintIndex) {
      if (!carMesh || !carMesh.userData.bodyMat) return;
      const car = CATALOG[index];
      const color = car.paints[paintIndex % car.paints.length];
      carMesh.userData.bodyMat.color.setHex(color);
    }

    function rebuildWheels(wheelIndex) {
      const car = CATALOG[index];
      const storage = global.HRUStorage;
      const prog = storage ? storage.getCarProgress(car.id) : { paint: 0 };
      let paint = prog.paint || 0;
      if (storage && storage.get().selectedCar === car.id && storage.getSelectedColor) {
        paint = storage.getSelectedColor();
      }
      if (carMesh) scene.remove(carMesh);
      carMesh = buildCarMesh(car, paint, wheelIndex);
      if (carMesh) scene.add(carMesh);
    }

    function loop() {
      if (!active) return;
      resize();
      if (carMesh && rotating) {
        carMesh.rotation.y += 0.012;
      }
      if (renderer && scene && camera) renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    }

    function open(carId) {
      active = true;
      showCar(carId || (global.HRUStorage && global.HRUStorage.get().selectedCar) || 'sedan');
      cancelAnimationFrame(raf);
      loop();
    }

    function close() {
      active = false;
      cancelAnimationFrame(raf);
    }

    function next() {
      index = (index + 1) % CATALOG.length;
      return showCar(CATALOG[index].id);
    }

    function prev() {
      index = (index - 1 + CATALOG.length) % CATALOG.length;
      return showCar(CATALOG[index].id);
    }

    function current() {
      return CATALOG[index];
    }

    function currentIndex() {
      return index;
    }

    return {
      open,
      close,
      next,
      prev,
      showCar,
      setPaint,
      rebuildWheels,
      current,
      currentIndex,
      buildCarMesh,
      getCar,
      getAll,
      getEffectiveStats,
      CATALOG,
      UPGRADE_LABELS,
    };
  }

  global.HRUGarage = {
    CATALOG,
    PAINT_PALETTE,
    PAINT_HEXES,
    UPGRADE_LABELS,
    getCar,
    getAll,
    buildCarMesh,
    getEffectiveStats,
    createGarageController,
  };
})(typeof window !== 'undefined' ? window : globalThis);
