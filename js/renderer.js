/**
 * renderer.js — Countryside highway environment (original procedural art)
 * Visual-only world: rolling hills, asymmetric roadside life, nature.
 * Gameplay APIs unchanged (player/traffic/physics not modified here).
 */
(function (global) {
  'use strict';

  const ROAD = () =>
    (global.HRUPhysics && global.HRUPhysics.ROAD) || {
      LANE_COUNT: 3,
      LANE_WIDTH: 3.6,
      ROAD_WIDTH: 12,
      SEGMENT_LENGTH: 20,
    };

  /** Visual road is painted wider (4-lane look) while driveable width stays physics-driven */
  const VISUAL_LANES = 4;
  const VISUAL_LANE_W = 3.55;

  const QUALITY = {
    low: { dpr: 1, shadows: false, shadowMap: 512, antialias: false, decor: 36, far: 300, birds: 5, clouds: 7, butterflies: 4, hills: 8 },
    medium: { dpr: 1.25, shadows: false, shadowMap: 512, antialias: true, decor: 56, far: 400, birds: 9, clouds: 11, butterflies: 8, hills: 12 },
    high: { dpr: 1.75, shadows: true, shadowMap: 1024, antialias: true, decor: 80, far: 500, birds: 14, clouds: 15, butterflies: 12, hills: 16 },
    ultra: { dpr: 2, shadows: true, shadowMap: 2048, antialias: true, decor: 110, far: 580, birds: 18, clouds: 18, butterflies: 16, hills: 20 },
  };

  function resolveQuality(options) {
    if (options.quality && QUALITY[options.quality]) return QUALITY[options.quality];
    return options.highQuality === false ? QUALITY.medium : QUALITY.high;
  }

  function createRenderer(canvas, options = {}) {
    const THREE = global.THREE;
    if (!THREE) throw new Error('Three.js required');

    let q = resolveQuality(options);
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: q.antialias,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.dpr));
    renderer.setClearColor(0x87c8f0);
    renderer.shadowMap.enabled = q.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (renderer.outputEncoding !== undefined) {
      renderer.outputEncoding = THREE.sRGBEncoding;
    }

    const scene = new THREE.Scene();
    // Soft countryside atmospheric fog
    scene.fog = new THREE.Fog(0xc8e4f5, 90, q.far);

    const camera = new THREE.PerspectiveCamera(58, width / height, 0.1, q.far + 100);
    camera.position.set(0, 4.4, 9);
    camera.lookAt(0, 0.6, -22);

    // --- Bright countryside lighting ---
    const ambient = new THREE.AmbientLight(0xd0e8ff, 0.52);
    scene.add(ambient);
    const hemi = new THREE.HemisphereLight(0xa8d8ff, 0x4a8a40, 0.62);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2d0, 1.5);
    sun.position.set(45, 70, 25);
    sun.castShadow = q.shadows;
    if (q.shadows) {
      sun.shadow.mapSize.set(q.shadowMap, q.shadowMap);
      sun.shadow.camera.near = 2;
      sun.shadow.camera.far = 240;
      sun.shadow.camera.left = -60;
      sun.shadow.camera.right = 60;
      sun.shadow.camera.top = 60;
      sun.shadow.camera.bottom = -60;
      sun.shadow.bias = -0.00025;
    }
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x88b0e0, 0.28);
    fill.position.set(-40, 25, -15);
    scene.add(fill);
    const warm = new THREE.DirectionalLight(0xffcc88, 0.18);
    warm.position.set(20, 12, -30);
    scene.add(warm);

    // Sky
    const skyGeo = new THREE.SphereGeometry(Math.min(540, q.far + 50), q.dpr > 1.5 ? 28 : 16, q.dpr > 1.5 ? 18 : 12);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x3a9aef) },
        bottomColor: { value: new THREE.Color(0xd8f0ff) },
        offset: { value: 0 },
        exponent: { value: 0.55 },
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
    scene.add(new THREE.Mesh(skyGeo, skyMat));

    const sunMesh = new THREE.Mesh(
      new THREE.SphereGeometry(8, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xfff4d0, fog: false })
    );
    sunMesh.position.copy(sun.position).normalize().multiplyScalar(400);
    scene.add(sunMesh);

    // Stars (night fade)
    const starCount = q.dpr > 1.4 ? 160 : 60;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.random() * Math.PI * 0.4;
      const r = 320;
      starPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      starPos[i * 3 + 1] = r * Math.cos(ph) * 0.65 + 50;
      starPos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th) - 60;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.1,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
    });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // Rainbow
    const rainbow = new THREE.Mesh(
      new THREE.TorusGeometry(95, 2.4, 8, 48, Math.PI),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        fog: false,
      })
    );
    rainbow.rotation.x = Math.PI * 0.55;
    rainbow.position.set(20, 28, -140);
    scene.add(rainbow);

    const roadGroup = new THREE.Group();
    scene.add(roadGroup);
    const decorGroup = new THREE.Group();
    scene.add(decorGroup);
    const hillGroup = new THREE.Group();
    scene.add(hillGroup);
    const trafficGroup = new THREE.Group();
    scene.add(trafficGroup);
    const coinGroup = new THREE.Group();
    scene.add(coinGroup);
    const lifeGroup = new THREE.Group();
    scene.add(lifeGroup);

    const R = ROAD();
    // Visual asphalt width (4-lane highway look)
    const roadW = VISUAL_LANES * VISUAL_LANE_W + 1.6;
    // Physics road is narrower; decorations stay outside visual shoulders

    // Materials — vibrant countryside palette
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x2e323a,
      roughness: 0.86,
      metalness: 0.06,
    });
    const roadWetMat = new THREE.MeshStandardMaterial({
      color: 0x1c2028,
      roughness: 0.2,
      metalness: 0.62,
    });
    const grassA = new THREE.MeshStandardMaterial({ color: 0x3f9a42, roughness: 0.94 });
    const grassB = new THREE.MeshStandardMaterial({ color: 0x4aab48, roughness: 0.94 });
    const grassC = new THREE.MeshStandardMaterial({ color: 0x348a38, roughness: 0.94 });
    const grassDeep = new THREE.MeshStandardMaterial({ color: 0x2a7030, roughness: 0.95 });
    const grassHill = [
      new THREE.MeshStandardMaterial({ color: 0x45a044, roughness: 0.96, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: 0x3a8a38, roughness: 0.96, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: 0x52b04a, roughness: 0.96, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: 0x2f7a34, roughness: 0.96, flatShading: true }),
    ];
    const shoulderMat = new THREE.MeshStandardMaterial({ color: 0x6a6458, roughness: 0.9 });
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x2a88b8,
      roughness: 0.12,
      metalness: 0.5,
      transparent: true,
      opacity: 0.88,
    });
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xf5f5ee });
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5d76e });
    const centerMat = new THREE.MeshBasicMaterial({ color: 0xf0e8a0 });

    const SEGMENTS = q.dpr > 1.5 ? 30 : 24;
    const SEG_LEN = R.SEGMENT_LENGTH;
    const segments = [];

    function makeRoadSegment(z) {
      const g = new THREE.Group();
      g.position.z = z;

      // Slight vertical undulation for gentle hills feel (visual only)
      const undulation = Math.sin(z * 0.04) * 0.15;
      g.position.y = undulation;

      const road = new THREE.Mesh(new THREE.PlaneGeometry(roadW, SEG_LEN), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.receiveShadow = true;
      g.add(road);

      // Wide shoulders
      [-1, 1].forEach((side) => {
        const sh = new THREE.Mesh(new THREE.PlaneGeometry(5.5, SEG_LEN), shoulderMat);
        sh.rotation.x = -Math.PI / 2;
        sh.position.x = side * (roadW / 2 + 2.75);
        sh.position.y = -0.01;
        sh.receiveShadow = true;
        g.add(sh);
      });

      // Endless grass fields
      [-1, 1].forEach((side, si) => {
        const grass = new THREE.Mesh(
          new THREE.PlaneGeometry(100, SEG_LEN),
          si === 0 ? grassA : grassB
        );
        grass.rotation.x = -Math.PI / 2;
        grass.position.x = side * (roadW / 2 + 5.5 + 50);
        grass.position.y = -0.025;
        grass.receiveShadow = true;
        g.add(grass);

        // Flower strip near road
        if (Math.random() < 0.55) {
          const strip = new THREE.Mesh(
            new THREE.PlaneGeometry(2.2, SEG_LEN * 0.9),
            new THREE.MeshStandardMaterial({
              color: [0x66cc55, 0x88dd44, 0xaadd66][(Math.random() * 3) | 0],
              roughness: 0.9,
            })
          );
          strip.rotation.x = -Math.PI / 2;
          strip.position.set(side * (roadW / 2 + 4.2), -0.015, 0);
          g.add(strip);
        }
      });

      // Edge lines
      [-1, 1].forEach((side) => {
        const edge = new THREE.Mesh(new THREE.PlaneGeometry(0.18, SEG_LEN * 0.98), lineMat);
        edge.rotation.x = -Math.PI / 2;
        edge.position.set(side * (roadW / 2 - 0.4), 0.02, 0);
        g.add(edge);
      });

      // 4 visual lane dashes
      for (let lane = 1; lane < VISUAL_LANES; lane++) {
        const x = -roadW / 2 + 0.85 + lane * VISUAL_LANE_W;
        const isCenter = lane === VISUAL_LANES / 2;
        for (let d = 0; d < 3; d++) {
          const dash = new THREE.Mesh(
            new THREE.PlaneGeometry(isCenter ? 0.14 : 0.11, isCenter ? 4 : 3.2),
            isCenter ? centerMat : dashMat
          );
          dash.rotation.x = -Math.PI / 2;
          dash.position.set(x, 0.025, -SEG_LEN / 2 + 2.5 + d * 6.5);
          g.add(dash);
        }
      }

      // Wet reflection strip
      const refl = new THREE.Mesh(
        new THREE.PlaneGeometry(roadW * 0.94, SEG_LEN * 0.4),
        new THREE.MeshBasicMaterial({ color: 0x88b0d0, transparent: true, opacity: 0 })
      );
      refl.rotation.x = -Math.PI / 2;
      refl.position.y = 0.035;
      refl.name = 'wetReflect';
      g.add(refl);

      // Puddles
      if (Math.random() < 0.3) {
        const puddle = new THREE.Mesh(
          new THREE.CircleGeometry(0.5 + Math.random() * 0.9, 10),
          new THREE.MeshStandardMaterial({
            color: 0x3a5870,
            roughness: 0.12,
            metalness: 0.75,
            transparent: true,
            opacity: 0,
          })
        );
        puddle.rotation.x = -Math.PI / 2;
        puddle.position.set((Math.random() - 0.5) * roadW * 0.55, 0.04, (Math.random() - 0.5) * SEG_LEN * 0.35);
        puddle.name = 'puddle';
        g.add(puddle);
      }

      return { group: g, road, z };
    }

    for (let i = 0; i < SEGMENTS; i++) {
      const seg = makeRoadSegment(-i * SEG_LEN);
      roadGroup.add(seg.group);
      segments.push(seg);
    }

    // ========== Vegetation & buildings ==========
    function makeTree(kind) {
      const g = new THREE.Group();
      const trunkH = kind === 'pine' ? 2.0 : kind === 'palm' || kind === 'coconut' ? 2.6 : kind === 'bamboo' ? 2.8 : kind === 'mango' ? 1.5 : 1.35;
      const trunkCol = kind === 'bamboo' ? 0x6a9a40 : 0x5c3a1e;
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(kind === 'palm' ? 0.11 : kind === 'bamboo' ? 0.07 : 0.18, 0.24, trunkH, 6),
        new THREE.MeshStandardMaterial({ color: trunkCol, roughness: 1 })
      );
      trunk.position.y = trunkH * 0.5;
      trunk.castShadow = q.shadows;
      g.add(trunk);

      if (kind === 'pine') {
        [0, 0.75, 1.4].forEach((y, i) => {
          const leaves = new THREE.Mesh(
            new THREE.ConeGeometry(1.4 - i * 0.3, 1.6, 7),
            new THREE.MeshStandardMaterial({ color: 0x1e6a36, roughness: 0.9, flatShading: true })
          );
          leaves.position.y = 1.5 + y;
          leaves.castShadow = q.shadows;
          g.add(leaves);
        });
      } else if (kind === 'palm' || kind === 'coconut') {
        for (let i = 0; i < 6; i++) {
          const frond = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, 0.07, 2.4),
            new THREE.MeshStandardMaterial({ color: 0x2d9a42, roughness: 0.85 })
          );
          frond.position.set(0, trunkH + 0.1, 0);
          frond.rotation.y = (i / 6) * Math.PI * 2;
          frond.rotation.x = 0.5 + Math.random() * 0.15;
          frond.castShadow = q.shadows;
          g.add(frond);
        }
        if (kind === 'coconut') {
          const nut = new THREE.Mesh(
            new THREE.SphereGeometry(0.16, 6, 6),
            new THREE.MeshStandardMaterial({ color: 0x6b4423 })
          );
          nut.position.set(0.3, trunkH - 0.15, 0.1);
          g.add(nut);
        }
      } else if (kind === 'bamboo') {
        for (let i = 0; i < 4; i++) {
          const stalk = new THREE.Mesh(
            new THREE.CylinderGeometry(0.05, 0.06, trunkH * (0.85 + Math.random() * 0.2), 5),
            new THREE.MeshStandardMaterial({ color: 0x5a9a38, roughness: 0.85 })
          );
          stalk.position.set((Math.random() - 0.5) * 0.5, trunkH * 0.45, (Math.random() - 0.5) * 0.5);
          g.add(stalk);
        }
      } else if (kind === 'mango') {
        const leaves = new THREE.Mesh(
          new THREE.SphereGeometry(1.35, 8, 7),
          new THREE.MeshStandardMaterial({ color: 0x2f8a35, roughness: 0.88 })
        );
        leaves.position.y = trunkH + 0.55;
        leaves.scale.set(1.25, 0.9, 1.2);
        leaves.castShadow = q.shadows;
        g.add(leaves);
        // fruit
        for (let i = 0; i < 3; i++) {
          const fruit = new THREE.Mesh(
            new THREE.SphereGeometry(0.1, 5, 5),
            new THREE.MeshStandardMaterial({ color: 0xe8a020 })
          );
          fruit.position.set((Math.random() - 0.5) * 0.8, trunkH + 0.2, (Math.random() - 0.5) * 0.8);
          g.add(fruit);
        }
      } else {
        // oak / large tree
        const colors = [0x2f8a38, 0x3a9a40, 0x268a32, 0x48aa45, 0x1e7a2c];
        const leaves = new THREE.Mesh(
          new THREE.SphereGeometry(kind === 'large' ? 1.6 : 1.2, 8, 7),
          new THREE.MeshStandardMaterial({
            color: colors[(Math.random() * colors.length) | 0],
            roughness: 0.88,
          })
        );
        leaves.position.y = trunkH + (kind === 'large' ? 0.9 : 0.7);
        leaves.scale.set(1.15, 0.95, 1.15);
        leaves.castShadow = q.shadows;
        g.add(leaves);
      }
      g.userData.sway = Math.random() * Math.PI * 2;
      g.userData.kind = 'tree';
      return g;
    }

    function makeBush() {
      const g = new THREE.Group();
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 6, 5),
        new THREE.MeshStandardMaterial({ color: 0x3a8a38, roughness: 0.95 })
      );
      m.position.y = 0.4;
      m.scale.set(1.3, 0.7, 1.1);
      g.add(m);
      return g;
    }

    function makeFlowerField() {
      const g = new THREE.Group();
      const n = 6 + ((Math.random() * 5) | 0);
      for (let i = 0; i < n; i++) {
        const stem = new THREE.Mesh(
          new THREE.CylinderGeometry(0.02, 0.02, 0.4, 4),
          new THREE.MeshStandardMaterial({ color: 0x2a7a30 })
        );
        stem.position.set((Math.random() - 0.5) * 1.4, 0.2, (Math.random() - 0.5) * 1.4);
        g.add(stem);
        const bloom = new THREE.Mesh(
          new THREE.SphereGeometry(0.11, 5, 5),
          new THREE.MeshStandardMaterial({
            color: [0xff4466, 0xffdd44, 0xff88cc, 0x66ddff, 0xff9933, 0xee66ff][(Math.random() * 6) | 0],
          })
        );
        bloom.position.copy(stem.position);
        bloom.position.y = 0.42;
        g.add(bloom);
      }
      return g;
    }

    function makeFence() {
      const g = new THREE.Group();
      const wood = new THREE.MeshStandardMaterial({ color: 0x8a6a40, roughness: 0.9 });
      for (let i = 0; i < 4; i++) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 0.1), wood);
        post.position.set(i * 1.1 - 1.65, 0.45, 0);
        g.add(post);
      }
      const rail = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.08, 0.08), wood);
      rail.position.y = 0.55;
      g.add(rail);
      const rail2 = rail.clone();
      rail2.position.y = 0.3;
      g.add(rail2);
      return g;
    }

    function makeRock() {
      const g = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.6 + Math.random() * 0.7, 0),
        new THREE.MeshStandardMaterial({ color: 0x6a7278, roughness: 0.95, flatShading: true })
      );
      g.position.y = 0.3;
      g.rotation.set(Math.random(), Math.random(), 0);
      g.castShadow = q.shadows;
      return g;
    }

    function makeHouse(style) {
      const g = new THREE.Group();
      const wallColors = {
        colorful: [0xff8866, 0x66aadd, 0xffdd66, 0x88cc88, 0xee99cc],
        cabin: [0x8a5a30, 0x6a4020],
        farm: [0xe8dcc0, 0xd8c8a8],
        small: [0xf5f0e0, 0xe0d8c8],
      };
      const palette = wallColors[style] || wallColors.small;
      const w = style === 'farm' ? 2.6 : 2.0;
      const h = style === 'cabin' ? 1.3 : 1.5;
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, style === 'farm' ? 2.2 : 1.8),
        new THREE.MeshStandardMaterial({ color: palette[(Math.random() * palette.length) | 0], roughness: 0.88 })
      );
      body.position.y = h * 0.5;
      body.castShadow = q.shadows;
      g.add(body);
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(w * 0.75, 0.95, 4),
        new THREE.MeshStandardMaterial({
          color: style === 'cabin' ? 0x4a3020 : 0xa84838,
          roughness: 0.85,
        })
      );
      roof.position.y = h + 0.4;
      roof.rotation.y = Math.PI / 4;
      g.add(roof);
      // door
      const door = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.7, 0.06),
        new THREE.MeshStandardMaterial({ color: 0x5a3a20 })
      );
      door.position.set(0, 0.35, w * 0.35);
      g.add(door);
      return g;
    }

    function makeFarm() {
      const g = makeHouse('farm');
      const barn = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 1.2, 1.5),
        new THREE.MeshStandardMaterial({ color: 0xb04030, roughness: 0.9 })
      );
      barn.position.set(2.5, 0.6, 0);
      g.add(barn);
      return g;
    }

    function makePetrol() {
      const g = new THREE.Group();
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 0.12, 2.4),
        new THREE.MeshStandardMaterial({ color: 0x454850 })
      );
      base.position.y = 0.06;
      g.add(base);
      const canopy = new THREE.Mesh(
        new THREE.BoxGeometry(3.8, 0.1, 2.8),
        new THREE.MeshStandardMaterial({ color: 0xe8a820, metalness: 0.3, roughness: 0.5 })
      );
      canopy.position.y = 2.3;
      g.add(canopy);
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 2.2, 6),
        new THREE.MeshStandardMaterial({ color: 0x888888 })
      );
      post.position.y = 1.1;
      g.add(post);
      return g;
    }

    function makeBusStop() {
      const g = new THREE.Group();
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 2.1, 0.1),
        new THREE.MeshStandardMaterial({ color: 0x777777 })
      );
      post.position.y = 1.05;
      g.add(post);
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(1.7, 0.08, 1.1),
        new THREE.MeshStandardMaterial({ color: 0x2a7ab8 })
      );
      roof.position.set(0.45, 2.05, 0);
      g.add(roof);
      const bench = new THREE.Mesh(
        new THREE.BoxGeometry(1.3, 0.1, 0.4),
        new THREE.MeshStandardMaterial({ color: 0x6a5040 })
      );
      bench.position.set(0.45, 0.45, 0);
      g.add(bench);
      return g;
    }

    function makeStreetLight() {
      const g = new THREE.Group();
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.07, 4.0, 6),
        new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.5, roughness: 0.4 })
      );
      pole.position.y = 2.0;
      g.add(pole);
      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 0.07, 0.07),
        new THREE.MeshStandardMaterial({ color: 0x555555 })
      );
      arm.position.set(0.45, 3.95, 0);
      g.add(arm);
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 8, 8),
        new THREE.MeshStandardMaterial({
          color: 0xfff0c0,
          emissive: 0xffcc66,
          emissiveIntensity: 0.35,
        })
      );
      lamp.position.set(0.95, 3.85, 0);
      lamp.name = 'lamp';
      g.add(lamp);
      g.userData.hasLamp = true;
      return g;
    }

    function makeSign() {
      const g = new THREE.Group();
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6),
        new THREE.MeshStandardMaterial({ color: 0x888888 })
      );
      post.position.y = 1.1;
      g.add(post);
      const board = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 0.9, 0.08),
        new THREE.MeshStandardMaterial({
          color: [0x1a8a40, 0x1a5aaa, 0xc84820][(Math.random() * 3) | 0],
          roughness: 0.55,
        })
      );
      board.position.y = 2.3;
      g.add(board);
      return g;
    }

    function makeTurbine() {
      const g = new THREE.Group();
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.2, 9, 8),
        new THREE.MeshStandardMaterial({ color: 0xd8e0e8, metalness: 0.45, roughness: 0.4 })
      );
      pole.position.y = 4.5;
      pole.castShadow = q.shadows;
      g.add(pole);
      const hub = new THREE.Group();
      hub.position.y = 9;
      hub.add(
        new THREE.Mesh(
          new THREE.BoxGeometry(0.65, 0.4, 1.2),
          new THREE.MeshStandardMaterial({ color: 0xeef2f8, metalness: 0.5, roughness: 0.35 })
        )
      );
      for (let i = 0; i < 3; i++) {
        const blade = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 3.8, 0.4),
          new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 })
        );
        blade.position.y = 1.85;
        const pivot = new THREE.Group();
        pivot.rotation.z = (i * Math.PI * 2) / 3;
        pivot.add(blade);
        hub.add(pivot);
      }
      g.add(hub);
      g.userData.hub = hub;
      g.userData.turbine = true;
      return g;
    }

    function makeLake() {
      const g = new THREE.Group();
      const water = new THREE.Mesh(
        new THREE.CircleGeometry(4 + Math.random() * 4, 18),
        waterMat
      );
      water.rotation.x = -Math.PI / 2;
      water.position.y = 0.02;
      water.userData.water = true;
      g.add(water);
      // bank
      const bank = new THREE.Mesh(
        new THREE.RingGeometry(4.2, 5.2, 18),
        grassC
      );
      bank.rotation.x = -Math.PI / 2;
      bank.position.y = 0.01;
      g.add(bank);
      return g;
    }

    function makeRiver() {
      const g = new THREE.Group();
      const water = new THREE.Mesh(
        new THREE.PlaneGeometry(3.5, 18),
        waterMat
      );
      water.rotation.x = -Math.PI / 2;
      water.position.y = 0.02;
      water.userData.water = true;
      water.userData.flow = true;
      g.add(water);
      return g;
    }

    function makeBridgeSmall() {
      const g = new THREE.Group();
      const deck = new THREE.Mesh(
        new THREE.BoxGeometry(3, 0.2, 5),
        new THREE.MeshStandardMaterial({ color: 0x6a5a48, roughness: 0.85 })
      );
      deck.position.y = 0.5;
      g.add(deck);
      [-1, 1].forEach((s) => {
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, 0.5, 5),
          new THREE.MeshStandardMaterial({ color: 0x5a4a38 })
        );
        rail.position.set(s * 1.4, 0.8, 0);
        g.add(rail);
      });
      return g;
    }

    function makeWaterfall() {
      const g = new THREE.Group();
      const cliff = new THREE.Mesh(
        new THREE.BoxGeometry(4, 6, 2),
        new THREE.MeshStandardMaterial({ color: 0x6a7078, roughness: 0.95, flatShading: true })
      );
      cliff.position.y = 3;
      g.add(cliff);
      const fall = new THREE.Mesh(
        new THREE.PlaneGeometry(1.2, 5.5),
        new THREE.MeshStandardMaterial({
          color: 0xa8d8f0,
          transparent: true,
          opacity: 0.55,
          side: THREE.DoubleSide,
        })
      );
      fall.position.set(0, 2.8, 1.1);
      fall.userData.waterfall = true;
      g.add(fall);
      return g;
    }

    function makeGarden() {
      const g = new THREE.Group();
      const bed = new THREE.Mesh(
        new THREE.CircleGeometry(1.5, 10),
        new THREE.MeshStandardMaterial({ color: 0x4a3a28, roughness: 0.95 })
      );
      bed.rotation.x = -Math.PI / 2;
      bed.position.y = 0.02;
      g.add(bed);
      g.add(makeFlowerField());
      return g;
    }

    function makeButterfly() {
      const g = new THREE.Group();
      const col = [0xff6688, 0xffcc33, 0x66aaff, 0xff88ee][(Math.random() * 4) | 0];
      const wingL = new THREE.Mesh(
        new THREE.PlaneGeometry(0.35, 0.25),
        new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
      );
      wingL.position.x = -0.12;
      const wingR = wingL.clone();
      wingR.position.x = 0.12;
      g.add(wingL);
      g.add(wingR);
      g.userData.wingL = wingL;
      g.userData.wingR = wingR;
      g.userData.butterfly = true;
      g.userData.phase = Math.random() * Math.PI * 2;
      return g;
    }

    function makeBird() {
      const g = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.ConeGeometry(0.1, 0.4, 4),
        new THREE.MeshBasicMaterial({ color: 0x2a2a2a })
      );
      body.rotation.z = Math.PI / 2;
      g.add(body);
      const wing = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.04, 0.12),
        new THREE.MeshBasicMaterial({ color: 0x333333 })
      );
      g.add(wing);
      g.userData.wing = wing;
      return g;
    }

    function makeCloud() {
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.88,
        roughness: 1,
      });
      for (let i = 0; i < 5; i++) {
        const c = new THREE.Mesh(new THREE.SphereGeometry(2.2 + Math.random() * 1.8, 8, 8), mat);
        c.position.set((Math.random() - 0.5) * 6, Math.random() * 1.4, (Math.random() - 0.5) * 2.5);
        g.add(c);
      }
      return g;
    }

    function makeMountain(scale, green) {
      const group = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.ConeGeometry(18 * scale, 24 * scale, 5),
        new THREE.MeshStandardMaterial({
          color: green ? 0x4a7a48 : 0x5a6570,
          roughness: 0.96,
          flatShading: true,
        })
      );
      body.position.y = 8 * scale;
      group.add(body);
      if (!green) {
        const snow = new THREE.Mesh(
          new THREE.ConeGeometry(7 * scale, 8 * scale, 5),
          new THREE.MeshStandardMaterial({ color: 0xeef4f8, roughness: 0.9, flatShading: true })
        );
        snow.position.y = 13 * scale;
        group.add(snow);
      }
      return group;
    }

    // ---- Rolling hills (layered) ----
    const hills = [];
    for (let i = 0; i < q.hills; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const layer = (i / q.hills);
      const hill = new THREE.Mesh(
        new THREE.SphereGeometry(12 + Math.random() * 18, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
        grassHill[i % grassHill.length]
      );
      hill.scale.set(1.4 + Math.random() * 0.8, 0.35 + layer * 0.25, 1.2 + Math.random() * 0.6);
      hill.position.set(
        side * (35 + layer * 40 + Math.random() * 25),
        -0.5,
        -20 - i * 28 - Math.random() * 20
      );
      hill.receiveShadow = true;
      hillGroup.add(hill);
      hills.push(hill);
    }

    // Far mountains
    const mountains = [];
    for (let i = 0; i < 10; i++) {
      const m = makeMountain(0.9 + Math.random() * 1.3, i % 3 !== 0);
      const side = i % 2 === 0 ? -1 : 1;
      m.position.set(side * (90 + Math.random() * 70), 0, -50 - i * 48);
      scene.add(m);
      mountains.push(m);
    }

    // LEFT side types: grass life, farms, villages, lakes, fences, flowers
    const LEFT_TYPES = [
      'large', 'tree', 'tree', 'flower', 'bush', 'fence', 'lake', 'farm', 'house', 'garden', 'mango', 'bamboo', 'rock', 'sign', 'busstop',
    ];
    // RIGHT side types: hills, dense forest, palms, pines, windmills, rivers, cabins
    const RIGHT_TYPES = [
      'pine', 'pine', 'palm', 'coconut', 'tree', 'cabin', 'colorful', 'turbine', 'river', 'bridge', 'garden', 'waterfall', 'rock', 'streetlight', 'petrol',
    ];

    function buildDecor(type) {
      switch (type) {
        case 'large':
          return makeTree('large');
        case 'tree':
          return makeTree('oak');
        case 'pine':
          return makeTree('pine');
        case 'palm':
          return makeTree('palm');
        case 'coconut':
          return makeTree('coconut');
        case 'mango':
          return makeTree('mango');
        case 'bamboo':
          return makeTree('bamboo');
        case 'bush':
          return makeBush();
        case 'flower':
          return makeFlowerField();
        case 'fence':
          return makeFence();
        case 'rock':
          return makeRock();
        case 'farm':
          return makeFarm();
        case 'house':
          return makeHouse('small');
        case 'colorful':
          return makeHouse('colorful');
        case 'cabin':
          return makeHouse('cabin');
        case 'petrol':
          return makePetrol();
        case 'busstop':
          return makeBusStop();
        case 'streetlight':
          return makeStreetLight();
        case 'sign':
          return makeSign();
        case 'turbine':
          return makeTurbine();
        case 'lake':
          return makeLake();
        case 'river':
          return makeRiver();
        case 'bridge':
          return makeBridgeSmall();
        case 'waterfall':
          return makeWaterfall();
        case 'garden':
          return makeGarden();
        default:
          return makeTree('oak');
      }
    }

    function placeX(side, type) {
      // Keep clear of traffic lanes
      const min = roadW / 2 + 5.5;
      if (type === 'lake' || type === 'river' || type === 'waterfall') {
        return side * (min + 12 + Math.random() * 28);
      }
      if (type === 'turbine' || type === 'farm') {
        return side * (min + 10 + Math.random() * 22);
      }
      return side * (min + 1 + Math.random() * 26);
    }

    const decorPool = [];
    for (let i = 0; i < q.decor; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const types = side < 0 ? LEFT_TYPES : RIGHT_TYPES;
      const type = types[(Math.random() * types.length) | 0];
      const mesh = buildDecor(type);
      mesh.position.set(placeX(side, type), 0, -Math.random() * SEGMENTS * SEG_LEN);
      mesh.userData.side = side;
      mesh.userData.decorType = type;
      mesh.userData.scroll = true;
      // Scale variety
      if (mesh.userData.kind === 'tree') {
        const s = 0.75 + Math.random() * 0.7;
        mesh.scale.setScalar(s);
      }
      decorGroup.add(mesh);
      decorPool.push(mesh);
    }

    // Butterflies (near flowers / gardens)
    const butterflies = [];
    for (let i = 0; i < q.butterflies; i++) {
      const b = makeButterfly();
      const side = Math.random() > 0.5 ? 1 : -1;
      b.position.set(side * (roadW / 2 + 6 + Math.random() * 15), 0.8 + Math.random(), -Math.random() * 200);
      lifeGroup.add(b);
      butterflies.push(b);
    }

    // Birds
    const birds = [];
    for (let i = 0; i < q.birds; i++) {
      const b = makeBird();
      b.position.set((Math.random() - 0.5) * 60, 10 + Math.random() * 16, -20 - Math.random() * 100);
      scene.add(b);
      birds.push(b);
    }

    // Clouds
    const clouds = [];
    for (let i = 0; i < q.clouds; i++) {
      const c = makeCloud();
      c.position.set((Math.random() - 0.5) * 240, 30 + Math.random() * 28, -Math.random() * 340);
      c.scale.setScalar(1.1 + Math.random() * 1.5);
      scene.add(c);
      clouds.push(c);
    }

    // Player
    let playerMesh = null;
    let playerBodyMat = null;

    function attachPlayerMesh(mesh, bodyMat) {
      if (playerMesh) scene.remove(playerMesh);
      playerMesh = mesh;
      playerBodyMat = bodyMat || null;
      playerMesh.position.set(0, 0, 0);
      playerMesh.castShadow = q.shadows;
      scene.add(playerMesh);
      return playerMesh;
    }

    function buildSimpleCar(color = 0xff6a00) {
      const g = new THREE.Group();
      const bodyMat = new THREE.MeshStandardMaterial({
        color,
        metalness: 0.7,
        roughness: 0.28,
      });
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 4.2), bodyMat);
      body.position.y = 0.55;
      body.castShadow = q.shadows;
      g.add(body);
      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 0.5, 1.8),
        new THREE.MeshStandardMaterial({ color: 0x111820, metalness: 0.4, roughness: 0.2 })
      );
      cabin.position.set(0, 1.0, -0.2);
      g.add(cabin);
      g.userData.bodyMat = bodyMat;
      return g;
    }

    const effects = global.HRUEffects ? global.HRUEffects.createEffects(scene) : null;
    const camState = { baseY: 4.4, baseZ: 9, lookZ: -20, fov: 58 };
    let distanceTravelled = 0;
    let animT = 0;

    function recycleDecor(d) {
      d.position.z -= SEGMENTS * SEG_LEN * 0.88;
      const side = d.userData.side || (Math.random() > 0.5 ? 1 : -1);
      d.userData.side = side;
      d.position.x = placeX(side, d.userData.decorType || 'tree');
      d.position.y = 0;
    }

    function scrollWorld(dz) {
      distanceTravelled += dz;
      animT += dz * 0.025;

      segments.forEach((seg) => {
        seg.group.position.z += dz;
        if (seg.group.position.z > SEG_LEN) {
          seg.group.position.z -= SEGMENTS * SEG_LEN;
          // Refresh undulation
          seg.group.position.y = Math.sin(seg.group.position.z * 0.04 + distanceTravelled * 0.01) * 0.18;
        }
      });

      decorPool.forEach((d) => {
        d.position.z += dz;
        if (d.position.z > 28) recycleDecor(d);

        // Wind sway on trees / bamboo
        if (d.userData.kind === 'tree' || d.userData.sway != null) {
          d.rotation.z = Math.sin(animT * 1.2 + (d.userData.sway || 0)) * 0.04;
          d.rotation.x = Math.cos(animT * 0.9 + (d.userData.sway || 0)) * 0.015;
        }
        if (d.userData.turbine && d.userData.hub) {
          d.userData.hub.rotation.z += 0.028;
        }
        // Water flow UV-ish shift via rotation
        d.traverse((ch) => {
          if (ch.userData && ch.userData.flow) {
            ch.position.z = Math.sin(animT * 2) * 0.15;
          }
          if (ch.userData && ch.userData.waterfall) {
            ch.material.opacity = 0.45 + Math.sin(animT * 8) * 0.12;
          }
        });
      });

      // Grass-like hill bob
      hills.forEach((h, i) => {
        h.position.z += dz * (0.08 + (i % 3) * 0.02);
        if (h.position.z > 40) h.position.z -= 400;
        h.position.y = -0.5 + Math.sin(animT * 0.3 + i) * 0.08;
      });

      mountains.forEach((m) => {
        m.position.z += dz * 0.1;
        if (m.position.z > 60) m.position.z -= 480;
      });

      clouds.forEach((c) => {
        c.position.z += dz * 0.035;
        c.position.x += Math.sin(distanceTravelled * 0.006 + c.position.y) * 0.015;
        if (c.position.z > 70) c.position.z = -350;
      });

      birds.forEach((b, i) => {
        b.position.z += dz * 0.25;
        b.position.x += Math.sin(distanceTravelled * 0.05 + i) * 0.06;
        b.position.y += Math.sin(distanceTravelled * 0.1 + i) * 0.03;
        if (b.userData.wing) {
          b.userData.wing.rotation.z = Math.sin(distanceTravelled * 0.3 + i) * 0.6;
        }
        if (b.position.z > 20) {
          b.position.z = -100 - Math.random() * 40;
          b.position.x = (Math.random() - 0.5) * 70;
        }
      });

      butterflies.forEach((b, i) => {
        b.position.z += dz;
        const ph = animT * 2 + b.userData.phase;
        b.position.x += Math.sin(ph) * 0.04;
        b.position.y = 0.7 + Math.abs(Math.sin(ph * 1.5)) * 1.2;
        if (b.userData.wingL) b.userData.wingL.rotation.y = Math.sin(ph * 8) * 0.7;
        if (b.userData.wingR) b.userData.wingR.rotation.y = -Math.sin(ph * 8) * 0.7;
        if (b.position.z > 25) {
          b.position.z -= SEGMENTS * SEG_LEN * 0.9;
          const side = Math.random() > 0.5 ? 1 : -1;
          b.position.x = side * (roadW / 2 + 6 + Math.random() * 15);
        }
      });
    }

    function applyLighting(light) {
      if (!light) return;
      ambient.color.setHex(light.ambient);
      ambient.intensity = Math.max(0.45, light.ambientIntensity);
      hemi.color.setHex(light.hemiSky);
      hemi.groundColor.setHex(light.hemiGround || 0x4a8a40);
      sun.color.setHex(light.sunColor);
      sun.intensity = light.sunIntensity;
      fill.intensity = light.fillIntensity != null ? light.fillIntensity : 0.28;
      warm.intensity = (light.bloomHint || 0.3) * 0.3;

      scene.fog.color.setHex(light.fogColor);
      scene.fog.near = Math.max(70, light.fogNear * 0.9);
      scene.fog.far = Math.min(light.fogFar, q.far);
      renderer.setClearColor(light.fogColor);
      skyMat.uniforms.topColor.value.setHex(light.skyTop);
      skyMat.uniforms.bottomColor.value.setHex(light.skyBot);
      sunMesh.material.color.setHex(light.sunColor);

      if (light.isNight || light.sunIntensity < 0.35) {
        sun.position.set(-30, 40, -30);
        starMat.opacity = 0.8;
        sunMesh.scale.setScalar(0.5);
      } else if (light.sunIntensity < 1.05) {
        // golden sunset / sunrise
        sun.position.set(55, 22, 15);
        starMat.opacity = 0.1;
        sunMesh.scale.setScalar(1.1);
        warm.intensity = 0.4;
      } else {
        sun.position.set(45, 70, 25);
        starMat.opacity = 0;
        sunMesh.scale.setScalar(1);
      }
      sunMesh.position.copy(sun.position).normalize().multiplyScalar(400);

      rainbow.material.opacity = (light.rainbow || 0) * 0.5;

      const wet = options._wetness || 0;
      segments.forEach((seg) => {
        const refl = seg.group.getObjectByName('wetReflect');
        if (refl) refl.material.opacity = wet * 0.45;
        const puddle = seg.group.getObjectByName('puddle');
        if (puddle) puddle.material.opacity = wet * 0.7;
        if (seg.road) seg.road.material = wet > 0.35 ? roadWetMat : roadMat;
      });

      decorPool.forEach((d) => {
        if (!d.userData.hasLamp) return;
        d.traverse((ch) => {
          if (ch.name === 'lamp' && ch.material) {
            ch.material.emissiveIntensity = light.isNight ? 1.3 : 0.2;
          }
        });
      });

      if (playerBodyMat) {
        playerBodyMat.metalness = 0.65 + wet * 0.15;
        playerBodyMat.roughness = Math.max(0.16, 0.3 - wet * 0.12);
      }
    }

    function updatePlayerVisual(vehicle) {
      if (!playerMesh || !vehicle) return;
      playerMesh.position.x = vehicle.x;
      playerMesh.position.y = 0;
      playerMesh.position.z = 0;
      playerMesh.rotation.y = vehicle.yaw || 0;
      playerMesh.rotation.z = vehicle.roll || 0;
      if (vehicle.nitroActive && effects) {
        effects.nitroTrail(vehicle.x, 0.4, 2.2);
      }
    }

    function updateCamera(vehicle, dt, shake) {
      if (!vehicle) return;
      const speedT = Math.min(1, vehicle.speedKmh / 220);
      const targetFov = 56 + speedT * 12 + (vehicle.nitroActive ? 5 : 0);
      camState.fov += (targetFov - camState.fov) * Math.min(1, dt * 3);
      camera.fov = camState.fov;
      camera.updateProjectionMatrix();

      const targetX = vehicle.x * 0.32;
      const targetY = camState.baseY - speedT * 0.35;
      const targetZ = camState.baseZ - speedT * 1.1;
      camera.position.x += (targetX - camera.position.x) * Math.min(1, dt * 5);
      camera.position.y += (targetY - camera.position.y) * Math.min(1, dt * 4);
      camera.position.z += (targetZ - camera.position.z) * Math.min(1, dt * 4);
      if (shake) {
        camera.position.x += shake.x;
        camera.position.y += shake.y;
      }
      camera.lookAt(vehicle.x * 0.45, 0.7, camState.lookZ);
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
      // Frustum-style culling by Z distance
      const fogFar = scene.fog ? scene.fog.far : 400;
      decorPool.forEach((d) => {
        d.visible = d.position.z > -fogFar && d.position.z < 45;
      });
      butterflies.forEach((b) => {
        b.visible = b.position.z > -120 && b.position.z < 30;
      });
      renderer.render(scene, camera);
    }

    function setWetness(w) {
      options._wetness = w;
    }

    function setQuality(levelOrHigh) {
      if (typeof levelOrHigh === 'boolean') {
        q = levelOrHigh ? QUALITY.high : QUALITY.medium;
      } else if (QUALITY[levelOrHigh]) {
        q = QUALITY[levelOrHigh];
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.dpr));
      renderer.shadowMap.enabled = q.shadows;
      sun.castShadow = q.shadows;
    }

    function getBiome() {
      return 'countryside';
    }

    function dispose() {
      if (effects) effects.dispose();
      renderer.dispose();
    }

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
      getBiome,
      render,
      dispose,
      getDistance: () => distanceTravelled,
      resetDistance() {
        distanceTravelled = 0;
      },
    };
  }

  function createMenuBackground(canvas) {
    if (!canvas) return { start() {}, stop() {} };
    const ctx = canvas.getContext('2d');
    let raf = 0;
    let t = 0;
    const particles = Array.from({ length: 36 }, () => ({
      x: Math.random(),
      y: Math.random(),
      s: 0.5 + Math.random() * 2,
      v: 0.04 + Math.random() * 0.12,
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
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, `hsl(${200 + Math.sin(t * 0.15) * 8}, 55%, 42%)`);
      g.addColorStop(0.45, `hsl(${95}, 40%, 38%)`);
      g.addColorStop(0.7, `hsl(${110}, 35%, 28%)`);
      g.addColorStop(1, '#0a1208');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      // Hills
      ctx.fillStyle = 'rgba(40,110,50,0.55)';
      ctx.beginPath();
      ctx.moveTo(0, h * 0.7);
      for (let x = 0; x <= w; x += 20) {
        ctx.lineTo(x, h * 0.65 + Math.sin(x * 0.01 + t * 0.3) * h * 0.04);
      }
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.fill();
      particles.forEach((p) => {
        p.y -= p.v * 0.0015;
        if (p.y < 0) p.y = 1;
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h * 0.5, p.s * (window.devicePixelRatio || 1), 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
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
    QUALITY,
  };
})(typeof window !== 'undefined' ? window : globalThis);
