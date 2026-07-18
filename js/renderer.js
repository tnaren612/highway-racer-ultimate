/**
 * renderer.js — Three.js world: road, scenery, sky, vehicles, camera
 * All geometry is procedural original content (no external models required).
 */
(function (global) {
  'use strict';

  const ROAD = () => (global.HRUPhysics && global.HRUPhysics.ROAD) || {
    LANE_COUNT: 3,
    LANE_WIDTH: 3.6,
    ROAD_WIDTH: 12,
    SEGMENT_LENGTH: 20,
  };

  function createRenderer(canvas, options = {}) {
    const THREE = global.THREE;
    if (!THREE) throw new Error('Three.js required');

    const highQuality = options.highQuality !== false;
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: highQuality,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, highQuality ? 2 : 1.25));
    renderer.setClearColor(0x87b8e0);
    renderer.shadowMap.enabled = highQuality;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xc5daf0, 120, 450);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 600);
    camera.position.set(0, 4.2, 8.5);
    camera.lookAt(0, 0.5, -20);

    // Lights
    const ambient = new THREE.AmbientLight(0xa0c4e8, 0.55);
    scene.add(ambient);
    const hemi = new THREE.HemisphereLight(0x88bbff, 0x4a6a40, 0.45);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2d0, 1.35);
    sun.position.set(40, 60, 20);
    sun.castShadow = highQuality;
    if (highQuality) {
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.camera.near = 1;
      sun.shadow.camera.far = 200;
      sun.shadow.camera.left = -50;
      sun.shadow.camera.right = 50;
      sun.shadow.camera.top = 50;
      sun.shadow.camera.bottom = -50;
    }
    scene.add(sun);

    // Soft fill
    const fill = new THREE.DirectionalLight(0x6688cc, 0.25);
    fill.position.set(-30, 20, -10);
    scene.add(fill);

    // Sky dome
    const skyGeo = new THREE.SphereGeometry(500, 24, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x3a8fe8) },
        bottomColor: { value: new THREE.Color(0xb8dcf5) },
        offset: { value: 0 },
        exponent: { value: 0.7 },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + offset).y;
          float t = max(pow(max(h, 0.0), exponent), 0.0);
          gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
        }
      `,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    scene.add(sky);

    // Sun disc / moon
    const sunMesh = new THREE.Mesh(
      new THREE.SphereGeometry(6, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xfff2d0, fog: false })
    );
    sunMesh.position.copy(sun.position).normalize().multiplyScalar(400);
    scene.add(sunMesh);

    // Ground strips (grass fields) — segmented infinite
    const groundGroup = new THREE.Group();
    scene.add(groundGroup);
    const roadGroup = new THREE.Group();
    scene.add(roadGroup);
    const decorGroup = new THREE.Group();
    scene.add(decorGroup);
    const trafficGroup = new THREE.Group();
    scene.add(trafficGroup);
    const coinGroup = new THREE.Group();
    scene.add(coinGroup);

    const R = ROAD();
    const roadW = R.LANE_COUNT * R.LANE_WIDTH + 1.5;

    // Materials
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x2a2e35,
      roughness: 0.85,
      metalness: 0.1,
    });
    const roadWetMat = new THREE.MeshStandardMaterial({
      color: 0x1a1e24,
      roughness: 0.25,
      metalness: 0.55,
    });
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x3d6b35, roughness: 0.95 });
    const grassMat2 = new THREE.MeshStandardMaterial({ color: 0x4a7a3c, roughness: 0.95 });
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xf0f0e8 });
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5d76e });
    const shoulderMat = new THREE.MeshStandardMaterial({ color: 0x5a5348, roughness: 0.9 });

    // Build repeating road segments
    const SEGMENTS = 28;
    const SEG_LEN = R.SEGMENT_LENGTH;
    const segments = [];

    function makeRoadSegment(z) {
      const g = new THREE.Group();
      g.position.z = z;

      const road = new THREE.Mesh(
        new THREE.PlaneGeometry(roadW, SEG_LEN),
        roadMat
      );
      road.rotation.x = -Math.PI / 2;
      road.receiveShadow = true;
      g.add(road);

      // Shoulders
      [-1, 1].forEach((side) => {
        const sh = new THREE.Mesh(
          new THREE.PlaneGeometry(3.5, SEG_LEN),
          shoulderMat
        );
        sh.rotation.x = -Math.PI / 2;
        sh.position.x = side * (roadW / 2 + 1.75);
        sh.position.y = -0.01;
        g.add(sh);
      });

      // Grass
      [-1, 1].forEach((side) => {
        const grass = new THREE.Mesh(
          new THREE.PlaneGeometry(80, SEG_LEN),
          side > 0 ? grassMat : grassMat2
        );
        grass.rotation.x = -Math.PI / 2;
        grass.position.x = side * (roadW / 2 + 3.5 + 40);
        grass.position.y = -0.02;
        g.add(grass);
      });

      // Edge lines
      [-1, 1].forEach((side) => {
        const edge = new THREE.Mesh(
          new THREE.PlaneGeometry(0.15, SEG_LEN * 0.98),
          lineMat
        );
        edge.rotation.x = -Math.PI / 2;
        edge.position.set(side * (roadW / 2 - 0.3), 0.02, 0);
        g.add(edge);
      });

      // Lane dashes
      for (let lane = 1; lane < R.LANE_COUNT; lane++) {
        const x = -roadW / 2 + 0.75 + lane * R.LANE_WIDTH;
        const dashCount = 3;
        for (let d = 0; d < dashCount; d++) {
          const dash = new THREE.Mesh(
            new THREE.PlaneGeometry(0.12, 3.2),
            dashMat
          );
          dash.rotation.x = -Math.PI / 2;
          dash.position.set(x, 0.025, -SEG_LEN / 2 + 3 + d * 6.5);
          g.add(dash);
        }
      }

      // Center reflectors after rain (emissive strips)
      const refl = new THREE.Mesh(
        new THREE.PlaneGeometry(roadW * 0.9, SEG_LEN * 0.3),
        new THREE.MeshBasicMaterial({
          color: 0x6688aa,
          transparent: true,
          opacity: 0,
        })
      );
      refl.rotation.x = -Math.PI / 2;
      refl.position.y = 0.03;
      refl.name = 'wetReflect';
      g.add(refl);

      return { group: g, road, z };
    }

    for (let i = 0; i < SEGMENTS; i++) {
      const seg = makeRoadSegment(-i * SEG_LEN);
      roadGroup.add(seg.group);
      segments.push(seg);
    }

    // ---- Scenery builders (low-poly) ----
    function makeTree() {
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.25, 1.2, 6),
        new THREE.MeshStandardMaterial({ color: 0x5c3a1e, roughness: 1 })
      );
      trunk.position.y = 0.6;
      trunk.castShadow = true;
      g.add(trunk);
      const leafColors = [0x2d6b2e, 0x3a7a35, 0x256028, 0x4a8a40];
      const leaves = new THREE.Mesh(
        new THREE.ConeGeometry(1.1, 2.2, 7),
        new THREE.MeshStandardMaterial({
          color: leafColors[Math.floor(Math.random() * leafColors.length)],
          roughness: 0.9,
        })
      );
      leaves.position.y = 2.1;
      leaves.castShadow = true;
      g.add(leaves);
      return g;
    }

    function makeHouse() {
      const g = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 1.4, 1.8),
        new THREE.MeshStandardMaterial({ color: 0xe8dcc8, roughness: 0.9 })
      );
      body.position.y = 0.7;
      body.castShadow = true;
      g.add(body);
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(1.8, 1.0, 4),
        new THREE.MeshStandardMaterial({ color: 0xa04030, roughness: 0.85 })
      );
      roof.position.y = 1.9;
      roof.rotation.y = Math.PI / 4;
      g.add(roof);
      return g;
    }

    function makeTurbine() {
      const g = new THREE.Group();
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.2, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xd0d8e0, metalness: 0.4, roughness: 0.4 })
      );
      pole.position.y = 4;
      pole.castShadow = true;
      g.add(pole);
      const hub = new THREE.Group();
      hub.position.y = 8;
      const nacelle = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.4, 1.2),
        new THREE.MeshStandardMaterial({ color: 0xe8eef5, metalness: 0.5, roughness: 0.35 })
      );
      hub.add(nacelle);
      for (let i = 0; i < 3; i++) {
        const blade = new THREE.Mesh(
          new THREE.BoxGeometry(0.15, 3.5, 0.4),
          new THREE.MeshStandardMaterial({ color: 0xf5f8fc, roughness: 0.4 })
        );
        blade.position.y = 1.7;
        const pivot = new THREE.Group();
        pivot.rotation.z = (i * Math.PI * 2) / 3;
        pivot.add(blade);
        hub.add(pivot);
      }
      g.add(hub);
      g.userData.hub = hub;
      return g;
    }

    function makeMountain(scale) {
      const g = new THREE.Mesh(
        new THREE.ConeGeometry(18 * scale, 28 * scale, 5),
        new THREE.MeshStandardMaterial({ color: 0x5a6570, roughness: 0.95, flatShading: true })
      );
      g.position.y = 10 * scale;
      const snow = new THREE.Mesh(
        new THREE.ConeGeometry(8 * scale, 10 * scale, 5),
        new THREE.MeshStandardMaterial({ color: 0xeef4f8, roughness: 0.9, flatShading: true })
      );
      snow.position.y = 14 * scale;
      const group = new THREE.Group();
      group.add(g);
      group.add(snow);
      return group;
    }

    function makeSign() {
      const g = new THREE.Group();
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 2.2, 6),
        new THREE.MeshStandardMaterial({ color: 0x888888 })
      );
      post.position.y = 1.1;
      g.add(post);
      const board = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 0.9, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x1a6b3c, roughness: 0.6 })
      );
      board.position.y = 2.3;
      g.add(board);
      return g;
    }

    function makeCloud() {
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.85,
        roughness: 1,
      });
      for (let i = 0; i < 4; i++) {
        const c = new THREE.Mesh(new THREE.SphereGeometry(2 + Math.random() * 1.5, 8, 8), mat);
        c.position.set((Math.random() - 0.5) * 5, Math.random() * 1.2, (Math.random() - 0.5) * 2);
        g.add(c);
      }
      return g;
    }

    // Birds (simple)
    function makeBird() {
      const g = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.ConeGeometry(0.15, 0.5, 4),
        new THREE.MeshBasicMaterial({ color: 0x222222 })
      );
      body.rotation.z = Math.PI / 2;
      g.add(body);
      const wingL = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.05, 0.15),
        new THREE.MeshBasicMaterial({ color: 0x333333 })
      );
      wingL.position.set(0, 0, 0);
      g.add(wingL);
      g.userData.wing = wingL;
      return g;
    }

    // Place static distant mountains
    const mountains = [];
    for (let i = 0; i < 10; i++) {
      const m = makeMountain(0.8 + Math.random() * 1.4);
      const side = i % 2 === 0 ? -1 : 1;
      m.position.set(side * (60 + Math.random() * 80), 0, -40 - i * 40 - Math.random() * 30);
      scene.add(m);
      mountains.push(m);
    }

    // Scrolling decorations pool
    const decorPool = [];
    const DECOR_COUNT = 50;
    for (let i = 0; i < DECOR_COUNT; i++) {
      const type = i % 7;
      let mesh;
      if (type === 0 || type === 1) mesh = makeTree();
      else if (type === 2) mesh = makeHouse();
      else if (type === 3) mesh = makeTurbine();
      else if (type === 4) mesh = makeSign();
      else mesh = makeTree();
      const side = Math.random() > 0.5 ? 1 : -1;
      mesh.position.set(
        side * (roadW / 2 + 4 + Math.random() * 25),
        0,
        -Math.random() * SEGMENTS * SEG_LEN
      );
      mesh.userData.scroll = true;
      mesh.userData.turbine = type === 3;
      decorGroup.add(mesh);
      decorPool.push(mesh);
    }

    const clouds = [];
    for (let i = 0; i < 12; i++) {
      const c = makeCloud();
      c.position.set(
        (Math.random() - 0.5) * 200,
        30 + Math.random() * 25,
        -Math.random() * 300
      );
      c.scale.setScalar(1 + Math.random() * 1.5);
      scene.add(c);
      clouds.push(c);
    }

    const birds = [];
    for (let i = 0; i < 8; i++) {
      const b = makeBird();
      b.position.set((Math.random() - 0.5) * 40, 8 + Math.random() * 12, -20 - Math.random() * 80);
      scene.add(b);
      birds.push(b);
    }

    // Player car mesh (built by garage or simple default)
    let playerMesh = null;
    let playerBodyMat = null;

    function attachPlayerMesh(mesh, bodyMat) {
      if (playerMesh) scene.remove(playerMesh);
      playerMesh = mesh;
      playerBodyMat = bodyMat || null;
      playerMesh.position.set(0, 0, 0);
      playerMesh.castShadow = true;
      scene.add(playerMesh);
      return playerMesh;
    }

    // Simple default car if garage not ready
    function buildSimpleCar(color = 0xff6a00) {
      const g = new THREE.Group();
      const bodyMat = new THREE.MeshStandardMaterial({
        color,
        metalness: 0.65,
        roughness: 0.35,
      });
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 4.2), bodyMat);
      body.position.y = 0.55;
      body.castShadow = true;
      g.add(body);
      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 0.5, 1.8),
        new THREE.MeshStandardMaterial({ color: 0x111820, metalness: 0.4, roughness: 0.2 })
      );
      cabin.position.set(0, 1.0, -0.2);
      g.add(cabin);
      const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 12);
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 });
      const positions = [
        [-0.9, 0.35, 1.3],
        [0.9, 0.35, 1.3],
        [-0.9, 0.35, -1.3],
        [0.9, 0.35, -1.3],
      ];
      positions.forEach((p) => {
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        w.rotation.z = Math.PI / 2;
        w.position.set(p[0], p[1], p[2]);
        g.add(w);
      });
      // Lights
      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.15, 0.08),
        new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0xffffaa, emissiveIntensity: 0.5 })
      );
      [-0.55, 0.55].forEach((x) => {
        const h = head.clone();
        h.position.set(x, 0.55, 2.15);
        g.add(h);
      });
      g.userData.bodyMat = bodyMat;
      return g;
    }

    // Effects
    const effects = global.HRUEffects
      ? global.HRUEffects.createEffects(scene)
      : null;

    // Camera follow state
    const camState = {
      baseY: 4.2,
      baseZ: 8.5,
      lookZ: -18,
      fov: 60,
    };

    let distanceTravelled = 0;
    let roadOffset = 0;

    function scrollWorld(dz) {
      distanceTravelled += dz;
      roadOffset += dz;

      // Recycle road segments
      segments.forEach((seg) => {
        seg.group.position.z += dz;
        if (seg.group.position.z > SEG_LEN) {
          seg.group.position.z -= SEGMENTS * SEG_LEN;
        }
      });

      // Decor
      decorPool.forEach((d) => {
        d.position.z += dz;
        if (d.position.z > 20) {
          d.position.z -= SEGMENTS * SEG_LEN * 0.9;
          const side = Math.random() > 0.5 ? 1 : -1;
          d.position.x = side * (roadW / 2 + 4 + Math.random() * 28);
        }
        if (d.userData.turbine && d.userData.hub) {
          d.userData.hub.rotation.z += 0.02;
        }
      });

      // Mountains subtle
      mountains.forEach((m) => {
        m.position.z += dz * 0.15;
        if (m.position.z > 40) m.position.z -= 400;
      });

      clouds.forEach((c) => {
        c.position.z += dz * 0.05;
        c.position.x += Math.sin(distanceTravelled * 0.01 + c.position.y) * 0.01;
        if (c.position.z > 50) c.position.z = -300;
      });

      birds.forEach((b, i) => {
        b.position.z += dz * 0.3;
        b.position.x += Math.sin(distanceTravelled * 0.05 + i) * 0.04;
        b.position.y += Math.sin(distanceTravelled * 0.08 + i * 2) * 0.02;
        if (b.userData.wing) {
          b.userData.wing.rotation.z = Math.sin(distanceTravelled * 0.2 + i) * 0.5;
        }
        if (b.position.z > 15) {
          b.position.z = -80 - Math.random() * 40;
          b.position.x = (Math.random() - 0.5) * 50;
        }
      });
    }

    function applyLighting(light) {
      if (!light) return;
      ambient.color.setHex(light.ambient);
      ambient.intensity = light.ambientIntensity;
      hemi.color.setHex(light.hemiSky);
      hemi.groundColor.setHex(light.hemiGround);
      sun.color.setHex(light.sunColor);
      sun.intensity = light.sunIntensity;
      scene.fog.color.setHex(light.fogColor);
      scene.fog.near = light.fogNear;
      scene.fog.far = light.fogFar;
      renderer.setClearColor(light.fogColor);
      skyMat.uniforms.topColor.value.setHex(light.skyTop);
      skyMat.uniforms.bottomColor.value.setHex(light.skyBot);
      sunMesh.material.color.setHex(light.sunColor);
      // Sun position by intensity (night = moon high left)
      if (light.sunIntensity < 0.3) {
        sun.position.set(-30, 40, -40);
      } else if (light.sunIntensity < 1) {
        sun.position.set(50, 25, 10);
      } else {
        sun.position.set(40, 60, 20);
      }
      sunMesh.position.copy(sun.position).normalize().multiplyScalar(400);

      // Wet road
      const wet = options._wetness || 0;
      segments.forEach((seg) => {
        const refl = seg.group.getObjectByName('wetReflect');
        if (refl) refl.material.opacity = wet * 0.35;
        if (seg.road) {
          seg.road.material = wet > 0.4 ? roadWetMat : roadMat;
        }
      });
    }

    function updatePlayerVisual(vehicle) {
      if (!playerMesh || !vehicle) return;
      playerMesh.position.x = vehicle.x;
      playerMesh.position.y = 0;
      playerMesh.position.z = 0;
      playerMesh.rotation.y = vehicle.yaw || 0;
      playerMesh.rotation.z = vehicle.roll || 0;
      // Nitro glow
      if (vehicle.nitroActive && effects) {
        effects.nitroTrail(vehicle.x, 0.4, 2.2);
      }
    }

    function updateCamera(vehicle, dt, shake) {
      if (!vehicle) return;
      const speedT = Math.min(1, vehicle.speedKmh / 220);
      const targetFov = 58 + speedT * 14 + (vehicle.nitroActive ? 6 : 0);
      camState.fov += (targetFov - camState.fov) * Math.min(1, dt * 3);
      camera.fov = camState.fov;
      camera.updateProjectionMatrix();

      const targetX = vehicle.x * 0.35;
      const targetY = camState.baseY - speedT * 0.4;
      const targetZ = camState.baseZ - speedT * 1.2;
      camera.position.x += (targetX - camera.position.x) * Math.min(1, dt * 5);
      camera.position.y += (targetY - camera.position.y) * Math.min(1, dt * 4);
      camera.position.z += (targetZ - camera.position.z) * Math.min(1, dt * 4);

      if (shake) {
        camera.position.x += shake.x;
        camera.position.y += shake.y;
      }

      camera.lookAt(vehicle.x * 0.5, 0.6, camState.lookZ);
    }

    function resize() {
      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      if (canvas.width !== w || canvas.height !== h) {
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
    }

    function render() {
      resize();
      renderer.render(scene, camera);
    }

    function setWetness(w) {
      options._wetness = w;
    }

    function setQuality(high) {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, high ? 2 : 1));
      renderer.shadowMap.enabled = high;
    }

    function dispose() {
      if (effects) effects.dispose();
      renderer.dispose();
    }

    // Init default car
    attachPlayerMesh(buildSimpleCar(0xff6a00));

    return {
      renderer,
      scene,
      camera,
      sun,
      ambient,
      effects,
      trafficGroup,
      coinGroup,
      playerMesh: () => playerMesh,
      attachPlayerMesh,
      buildSimpleCar,
      scrollWorld,
      applyLighting,
      updatePlayerVisual,
      updateCamera,
      setWetness,
      setQuality,
      render,
      dispose,
      getDistance: () => distanceTravelled,
      resetDistance() {
        distanceTravelled = 0;
        roadOffset = 0;
      },
    };
  }

  /**
   * Lightweight animated menu background (2D canvas gradient + particles)
   */
  function createMenuBackground(canvas) {
    if (!canvas) return { start() {}, stop() {} };
    const ctx = canvas.getContext('2d');
    let raf = 0;
    let t = 0;
    const particles = Array.from({ length: 40 }, () => ({
      x: Math.random(),
      y: Math.random(),
      s: 0.5 + Math.random() * 2,
      v: 0.05 + Math.random() * 0.15,
    }));

    function resize() {
      canvas.width = window.innerWidth * (window.devicePixelRatio || 1);
      canvas.height = window.innerHeight * (window.devicePixelRatio || 1);
      canvas.style.width = '100%';
      canvas.style.height = '100%';
    }

    function frame(now) {
      t = now * 0.001;
      const w = canvas.width;
      const h = canvas.height;
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, `hsl(${210 + Math.sin(t * 0.2) * 10}, 45%, 12%)`);
      g.addColorStop(0.5, `hsl(${25 + Math.sin(t * 0.15) * 8}, 60%, 18%)`);
      g.addColorStop(1, `hsl(${200}, 50%, 8%)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // Horizon glow
      const hg = ctx.createRadialGradient(w * 0.5, h * 0.55, 0, w * 0.5, h * 0.55, w * 0.5);
      hg.addColorStop(0, 'rgba(255,120,40,0.25)');
      hg.addColorStop(0.4, 'rgba(0,180,255,0.08)');
      hg.addColorStop(1, 'transparent');
      ctx.fillStyle = hg;
      ctx.fillRect(0, 0, w, h);

      // Road perspective lines
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 2;
      for (let i = -4; i <= 4; i++) {
        ctx.beginPath();
        ctx.moveTo(w * 0.5 + i * 8, h * 0.55);
        ctx.lineTo(w * 0.5 + i * w * 0.15, h);
        ctx.stroke();
      }

      particles.forEach((p) => {
        p.y -= p.v * 0.002;
        if (p.y < 0) p.y = 1;
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, p.s * (window.devicePixelRatio || 1), 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,212,255,0.35)';
        ctx.fill();
      });

      raf = requestAnimationFrame(frame);
    }

    return {
      start() {
        resize();
        window.addEventListener('resize', resize);
        raf = requestAnimationFrame(frame);
      },
      stop() {
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', resize);
      },
    };
  }

  global.HRURenderer = {
    createRenderer,
    createMenuBackground,
  };
})(typeof window !== 'undefined' ? window : globalThis);
