import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { LunarAction, SimulationState } from '../types/simulation';

interface Props {
  simState: SimulationState;
  showSmokeClouds: boolean;
  cameraMode: 'reference' | 'free' | 'follow';
  liveObsRef?: React.MutableRefObject<[number, number, number, number, number, number, number, number]>;
  liveActionRef?: React.MutableRefObject<LunarAction>;
  // Who is flying right now (computed in App): e.g. "TRAINED · LANDER",
  // "SERVER · LANDER", "HEURISTIC · LANDER (WEIGHTS FAILED)", "MANUAL"…
  pilot?: string;
}

// Display scale: 1 sim unit = 45 m (spawn ≈ 60 m alt, touchdown at 0)
const M = 45;
// World mapping (tuned so the whole descent stays framed)
const X_SCALE = 10.0;
const Y_SCALE = 30.0;
// Accurate surface elevations
const PAD_SURFACE_Y = 0.10;
const APRON_SURFACE_Y = 0.02;
const GROUND_SURFACE_Y = 0.0;

function getSurfaceY(x: number): number {
  if (Math.abs(x) <= 7.0) return PAD_SURFACE_Y;
  if (Math.abs(x) <= 30.0) return APRON_SURFACE_Y;
  return GROUND_SURFACE_Y;
}

function getBoosterBottomOffset(angle: number): number {
  const sinA = Math.abs(Math.sin(angle));
  const cosA = Math.abs(Math.cos(angle));
  // The 4 legs are at radius 1.75 at 45 deg, so X-distance is 1.75 * SQRT1_2 ≈ 1.237
  const legDrop = 1.237 * sinA;
  // If tilted heavily or tipped over on ground, prevent rocket body cylinder (radius 0.95) from clipping
  const bodyDrop = Math.max(0, 0.95 * cosA + 4.5 * sinA - 4.5);
  return Math.max(legDrop, bodyDrop);
}

export const SimulationCanvas: React.FC<Props> = ({
  simState,
  showSmokeClouds,
  cameraMode,
  liveObsRef,
  liveActionRef,
  pilot = '',
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [event, setEvent] = useState<'landed' | 'crashed' | null>(null);

  const smoothRef = useRef({ x: 0, y: 1.4, angle: 0, action: 0 as LunarAction });
  const targetRef = useRef({ x: 0, y: 1.4, angle: 0, action: 0 as LunarAction });
  const snapRef = useRef({ ep: 1, done: false, crashed: false, landed: false, perfect: false });
  const showSmokeRef = useRef(showSmokeClouds);
  const cameraModeRef = useRef(cameraMode);
  cameraModeRef.current = cameraMode;
  showSmokeRef.current = showSmokeClouds;
  const eventEpRef = useRef<number>(-1);

  const isDraggingRef = useRef(false);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const cameraAngleRef = useRef({ theta: 0.5, phi: 0.22, radius: 42 });

  // Latch touchdown / loss badges per episode (clears on replay too)
  useEffect(() => {
    if (simState.ep !== eventEpRef.current) {
      eventEpRef.current = simState.ep;
      setEvent(null);
    } else if (simState.crashed) {
      setEvent((e) => (e === 'crashed' ? e : 'crashed'));
    } else if (simState.landed) {
      setEvent((e) => (e === 'landed' ? e : 'landed'));
    } else {
      setEvent((e) => (e === null ? e : null));
    }
  }, [simState.ep, simState.crashed, simState.landed]);

  // Cheap ref sync every render — smoothing happens in the rAF loop
  useEffect(() => {
    const o = liveObsRef?.current ?? simState.obs;
    const a = liveActionRef?.current ?? simState.action;
    targetRef.current.x = o[0];
    targetRef.current.y = Math.max(0, o[1]);
    targetRef.current.angle = o[4];
    targetRef.current.action = a;
    snapRef.current.ep = simState.ep;
    snapRef.current.done = simState.done;
    snapRef.current.crashed = simState.crashed;
    snapRef.current.landed = simState.landed;
    snapRef.current.perfect = simState.perfect;
  });

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // ── Renderer / scene / camera ─────────────────────────────
    const scene = new THREE.Scene();
    const HORIZON = new THREE.Color(0xc8d8e8);
    scene.fog = new THREE.Fog(HORIZON, 90, 420);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1500);
    camera.position.set(14, 10, 40);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);

    // ── Sky dome (gradient + sun) ─────────────────────────────
    const sunDir = new THREE.Vector3(0.62, 0.3, 0.35).normalize();
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(700, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          top: { value: new THREE.Color(0x2f6bb3) },
          horizon: { value: HORIZON.clone() },
          sunDir: { value: sunDir },
        },
        vertexShader: `
          varying vec3 vDir;
          void main() {
            vDir = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: `
          varying vec3 vDir;
          uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir;
          void main() {
            vec3 d = normalize(vDir);
            float h = clamp(d.y, -1.0, 1.0);
            vec3 col = mix(horizon, top, pow(max(h, 0.0), 0.5));
            if (h < 0.0) col = mix(horizon, horizon * 0.72, clamp(-h * 4.0, 0.0, 1.0));
            float s = max(dot(d, normalize(sunDir)), 0.0);
            col += vec3(1.0, 0.93, 0.8) * pow(s, 1200.0) * 4.0;
            col += vec3(1.0, 0.9, 0.75) * pow(s, 10.0) * 0.12;
            gl_FragColor = vec4(col, 1.0);
          }`,
      })
    );
    scene.add(sky);
    const skyMat = sky.material as THREE.ShaderMaterial;
    // Day ↔ space palette, driven by altitude each frame
    const DAY_TOP = new THREE.Color(0x2f6bb3);
    const SPACE_TOP = new THREE.Color(0x01030a);
    const DAY_HOR = HORIZON.clone();
    const SPACE_HOR = new THREE.Color(0x182040);

    // ── Lights ────────────────────────────────────────────────
    const sun = new THREE.DirectionalLight(0xfff2df, 3.0);
    sun.position.copy(sunDir).multiplyScalar(120);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 20;
    sun.shadow.camera.far = 300;
    const SB = 55;
    sun.shadow.camera.left = -SB;
    sun.shadow.camera.right = SB;
    sun.shadow.camera.top = SB;
    sun.shadow.camera.bottom = -SB;
    sun.shadow.bias = -0.0004;
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(0xbdd3ee, 0x4a5548, 0.85));

    // ── Canvas-texture helpers ────────────────────────────────
    const canvasTex = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      draw(c.getContext('2d')!);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      return t;
    };
    const softDot = canvasTex(128, 128, (g) => {
      const r = g.createRadialGradient(64, 64, 4, 64, 64, 62);
      r.addColorStop(0, 'rgba(255,255,255,1)');
      r.addColorStop(0.55, 'rgba(255,255,255,0.45)');
      r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r;
      g.fillRect(0, 0, 128, 128);
    });

    // ── Ground: grass field + concrete apron + painted pad ────
    const groundTex = canvasTex(1024, 1024, (g) => {
      g.fillStyle = '#5a6b46';
      g.fillRect(0, 0, 1024, 1024);
      for (let i = 0; i < 9000; i++) {
        g.fillStyle = `rgba(${60 + Math.random() * 40},${90 + Math.random() * 40},${50 + Math.random() * 25},0.5)`;
        g.fillRect(Math.random() * 1024, Math.random() * 1024, 5, 5);
      }
      g.fillStyle = '#6f6f6a';
      g.fillRect(0, 700, 1024, 90);
      g.fillStyle = '#d8d8d2';
      for (let x = 0; x < 1024; x += 46) g.fillRect(x, 741, 24, 4);
    });
    groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
    groundTex.repeat.set(10, 10);
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(500, 48),
      new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1, metalness: 0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const concreteTex = canvasTex(512, 512, (g) => {
      g.fillStyle = '#9a9a96';
      g.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 2600; i++) {
        const v = Math.floor(120 + Math.random() * 60);
        g.fillStyle = `rgba(${v},${v},${v - 4},0.5)`;
        g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
      }
      g.strokeStyle = 'rgba(70,70,68,0.8)';
      g.lineWidth = 2;
      for (let i = 0; i <= 4; i++) {
        g.beginPath(); g.moveTo((i * 512) / 4, 0); g.lineTo((i * 512) / 4, 512); g.stroke();
        g.beginPath(); g.moveTo(0, (i * 512) / 4); g.lineTo(512, (i * 512) / 4); g.stroke();
      }
    });
    concreteTex.wrapS = concreteTex.wrapT = THREE.RepeatWrapping;
    concreteTex.repeat.set(4, 4);
    const apron = new THREE.Mesh(
      new THREE.CircleGeometry(30, 48),
      new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.95 })
    );
    apron.rotation.x = -Math.PI / 2;
    apron.position.y = 0.02;
    apron.receiveShadow = true;
    scene.add(apron);

    // Landing pad disc + painted rings
    const pad = new THREE.Mesh(
      new THREE.CircleGeometry(7, 48),
      new THREE.MeshStandardMaterial({ color: 0x3c3f43, roughness: 0.9 })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = PAD_SURFACE_Y - 0.02;
    pad.receiveShadow = true;
    scene.add(pad);
    const paintMat = new THREE.MeshBasicMaterial({ color: 0xe8e8e2 });
    const ring1 = new THREE.Mesh(new THREE.RingGeometry(5.4, 5.8, 64), paintMat);
    ring1.rotation.x = -Math.PI / 2;
    ring1.position.y = PAD_SURFACE_Y;
    scene.add(ring1);
    const ring2 = new THREE.Mesh(new THREE.RingGeometry(2.2, 2.45, 48), paintMat);
    ring2.rotation.x = -Math.PI / 2;
    ring2.position.y = PAD_SURFACE_Y;
    scene.add(ring2);

    // Scorch mark from previous landings
    const scorchTex = canvasTex(256, 256, (g) => {
      const r = g.createRadialGradient(128, 128, 8, 128, 128, 126);
      r.addColorStop(0, 'rgba(15,14,13,0.85)');
      r.addColorStop(0.5, 'rgba(20,19,17,0.45)');
      r.addColorStop(1, 'rgba(20,19,17,0)');
      g.fillStyle = r;
      g.fillRect(0, 0, 256, 256);
    });
    const scorch = new THREE.Mesh(
      new THREE.CircleGeometry(2.6, 32),
      new THREE.MeshBasicMaterial({ map: scorchTex, transparent: true, depthWrite: false })
    );
    scorch.rotation.x = -Math.PI / 2;
    scorch.position.y = PAD_SURFACE_Y + 0.005;
    scene.add(scorch);

    // Perimeter fence around the apron
    const fenceGroup = new THREE.Group();
    const postGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.7, 6);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x8a9097, roughness: 0.5, metalness: 0.7 });
    const FENCE_R = 30;
    const FENCE_N = 44;
    const wireFencePts: THREE.Vector3[] = [];
    let prevTop: THREE.Vector3 | null = null;
    let prevMid: THREE.Vector3 | null = null;
    for (let i = 0; i <= FENCE_N; i++) {
      const a = (i / FENCE_N) * Math.PI * 2;
      // gap for the service road (south side)
      if (i < FENCE_N) {
        const px = Math.cos(a) * FENCE_R;
        const pz = Math.sin(a) * FENCE_R;
        if (!(pz > 12 && Math.abs(px) < 6)) {
          const post = new THREE.Mesh(postGeo, postMat);
          post.position.set(px, 0.85, pz);
          fenceGroup.add(post);
        }
      }
      const wx = Math.cos(a) * FENCE_R;
      const wz = Math.sin(a) * FENCE_R;
      const top = new THREE.Vector3(wx, 1.6, wz);
      const mid = new THREE.Vector3(wx, 1.0, wz);
      if (prevTop) wireFencePts.push(prevTop, top);
      if (prevMid) wireFencePts.push(prevMid, mid);
      prevTop = top;
      prevMid = mid;
    }
    fenceGroup.add(new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(wireFencePts),
      new THREE.LineBasicMaterial({ color: 0x555a60 })
    ));
    scene.add(fenceGroup);

    // Floodlight poles
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const lx = Math.cos(a) * 25;
      const lz = Math.sin(a) * 25;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 12, 8), postMat);
      pole.position.set(lx, 6, lz);
      pole.castShadow = true;
      scene.add(pole);
      const head = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 0.4),
        new THREE.MeshStandardMaterial({ color: 0x2c2f34, roughness: 0.6 }));
      head.position.set(lx, 12.1, lz);
      head.lookAt(0, 0, 0);
      scene.add(head);
    }

    // Fuel farm: white spheres on saddles
    const siteWhite = new THREE.MeshStandardMaterial({ color: 0xd8dce0, roughness: 0.6, metalness: 0.2 });
    for (let i = 0; i < 3; i++) {
      const fx = -32 - i * 7;
      const fz = 24 + (i % 2) * 4;
      const saddle = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.2, 3.4),
        new THREE.MeshStandardMaterial({ color: 0x7c828a, roughness: 0.8 }));
      saddle.position.set(fx, 0.6, fz);
      saddle.castShadow = true;
      scene.add(saddle);
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(2.6, 24, 18), siteWhite);
      sphere.position.set(fx, 3.4, fz);
      sphere.castShadow = true;
      scene.add(sphere);
    }

    // Second warehouse
    const warehouse = new THREE.Mesh(new THREE.BoxGeometry(16, 6, 10),
      new THREE.MeshStandardMaterial({ color: 0xa8adb4, roughness: 0.85 }));
    warehouse.position.set(38, 3, -34);
    warehouse.castShadow = true;
    scene.add(warehouse);

    // Bangladesh flag on a pole near the pad (waving)
    const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 9, 10), siteWhite);
    flagPole.position.set(11, 4.5, 9);
    flagPole.castShadow = true;
    scene.add(flagPole);
    const bdTex = canvasTex(240, 144, (g) => {
      g.fillStyle = '#006a4e';
      g.fillRect(0, 0, 240, 144);
      g.fillStyle = '#f42a41';
      g.beginPath();
      g.arc(108, 72, 44, 0, Math.PI * 2);
      g.fill();
    });
    const flagGeo = new THREE.PlaneGeometry(3.4, 2.0, 20, 8);
    flagGeo.translate(1.7, 0, 0); // hoist edge at x=0
    const flagMesh = new THREE.Mesh(flagGeo,
      new THREE.MeshStandardMaterial({ map: bdTex, side: THREE.DoubleSide, roughness: 0.9 }));
    flagMesh.position.set(11.1, 7.7, 9);
    flagMesh.rotation.y = -Math.PI / 5;
    flagMesh.castShadow = true;
    scene.add(flagMesh);
    const flagBase = flagGeo.attributes.position.array.slice();

    // ── Site props ────────────────────────────────────────────
    const steelDark = new THREE.MeshStandardMaterial({ color: 0x4a5058, roughness: 0.55, metalness: 0.75 });
    const whitePaint = new THREE.MeshStandardMaterial({ color: 0xd8dce0, roughness: 0.6, metalness: 0.2 });
    const mastGroup = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const mx = Math.cos(a) * 20;
      const mz = Math.sin(a) * 20;
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, 30, 8), steelDark);
      mast.position.set(mx, 15, mz);
      mast.castShadow = true;
      mastGroup.add(mast);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 3.2), steelDark);
      arm.position.set(mx, 29.4, mz);
      arm.rotation.y = -a;
      mastGroup.add(arm);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), whitePaint);
      tip.position.set(mx, 30.1, mz);
      mastGroup.add(tip);
    }
    const wirePts: THREE.Vector3[] = [];
    for (let i = 0; i < 4; i++) {
      const a1 = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const a2 = ((i + 1) / 4) * Math.PI * 2 + Math.PI / 4;
      const p1 = new THREE.Vector3(Math.cos(a1) * 20, 29.4, Math.sin(a1) * 20);
      const p2 = new THREE.Vector3(Math.cos(a2) * 20, 29.4, Math.sin(a2) * 20);
      let prev: THREE.Vector3 | null = null;
      for (let sgm = 0; sgm <= 8; sgm++) {
        const tt = sgm / 8;
        const p = p1.clone().lerp(p2, tt);
        p.y -= Math.sin(tt * Math.PI) * 1.6;
        if (prev) wirePts.push(prev, p);
        prev = p;
      }
    }
    mastGroup.add(new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(wirePts),
      new THREE.LineBasicMaterial({ color: 0x222222 })
    ));
    scene.add(mastGroup);

    const hangar = new THREE.Mesh(
      new THREE.BoxGeometry(26, 9, 14),
      new THREE.MeshStandardMaterial({ color: 0xb9bfc6, roughness: 0.8 })
    );
    hangar.position.set(-52, 4.5, -58);
    hangar.castShadow = true;
    scene.add(hangar);
    const hangarRoof = new THREE.Mesh(
      new THREE.CylinderGeometry(7, 7, 26, 16, 1, false, 0, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x8f959c, roughness: 0.7 })
    );
    hangarRoof.rotation.z = Math.PI / 2;
    hangarRoof.rotation.y = Math.PI / 2;
    hangarRoof.position.set(-52, 9, -58);
    scene.add(hangarRoof);
    const towerLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 16, 8), steelDark);
    towerLeg.position.set(44, 8, -52);
    scene.add(towerLeg);
    const tank = new THREE.Mesh(new THREE.SphereGeometry(4.4, 20, 14), whitePaint);
    tank.position.set(44, 19, -52);
    tank.castShadow = true;
    scene.add(tank);

    const treeMat = new THREE.MeshStandardMaterial({ color: 0x2e4429, roughness: 1 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3b2c, roughness: 1 });
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 150 + Math.random() * 90;
      const h = 9 + Math.random() * 9;
      const tree = new THREE.Mesh(new THREE.ConeGeometry(2.6 + Math.random() * 2, h, 7), treeMat);
      tree.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
      scene.add(tree);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 3, 6), trunkMat);
      trunk.position.set(tree.position.x, 1.5, tree.position.z);
      scene.add(trunk);
    }

    const clouds: THREE.Sprite[] = [];
    for (let i = 0; i < 9; i++) {
      const m = new THREE.SpriteMaterial({ map: softDot, color: 0xffffff, transparent: true, opacity: 0.5 + Math.random() * 0.3, depthWrite: false, fog: false });
      const sp = new THREE.Sprite(m);
      const sc = 60 + Math.random() * 90;
      sp.scale.set(sc, sc * 0.32, 1);
      sp.position.set((Math.random() - 0.5) * 700, 90 + Math.random() * 70, -120 - Math.random() * 250);
      scene.add(sp);
      clouds.push(sp);
    }

    // Starfield (fades in with altitude — invisible from the pad)
    const starGeo = new THREE.BufferGeometry();
    {
      const N = 900;
      const arr = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        const a = Math.random() * Math.PI * 2;
        const e = Math.asin(Math.random() * 0.98 + 0.02); // upper hemisphere
        const r = 640;
        arr[i * 3] = Math.cos(a) * Math.cos(e) * r;
        arr[i * 3 + 1] = Math.sin(e) * r;
        arr[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
      }
      starGeo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    }
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff, size: 1.7, sizeAttenuation: false,
      transparent: true, opacity: 0, fog: false, depthWrite: false,
    });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // ── Booster (~10 m, group origin at feet) ─────────────────
    const booster = new THREE.Group();
    const BODY_R = 0.95;
    const BODY_H = 8.2;
    const LEG_H = 1.15;

    const livery = canvasTex(256, 1024, (g) => {
      g.fillStyle = '#eef0f2';
      g.fillRect(0, 0, 256, 1024);
      g.strokeStyle = 'rgba(120,128,138,0.5)';
      g.lineWidth = 2;
      for (let y = 130; y < 1024; y += 86) {
        g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke();
      }
      g.fillStyle = '#17181c';
      g.fillRect(0, 0, 256, 130);
      // Bangladesh flag (green field, red disc toward the hoist)
      g.fillStyle = '#006a4e';
      g.fillRect(40, 300, 66, 40);
      g.fillStyle = '#f42a41';
      g.beginPath();
      g.arc(40 + 66 * 0.45, 320, 12, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#22262b';
      g.font = 'bold 44px Arial';
      g.save();
      g.translate(150, 640);
      g.rotate(-Math.PI / 2);
      g.fillText('RKT-1', 0, 0);
      g.restore();
      const grad = g.createLinearGradient(0, 800, 0, 1024);
      grad.addColorStop(0, 'rgba(60,60,62,0)');
      grad.addColorStop(1, 'rgba(60,60,62,0.55)');
      g.fillStyle = grad;
      g.fillRect(0, 800, 256, 224);
    });
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(BODY_R, BODY_R, BODY_H, 32),
      new THREE.MeshStandardMaterial({ map: livery, roughness: 0.42, metalness: 0.25 })
    );
    body.position.y = LEG_H + 0.7 + BODY_H / 2;
    body.castShadow = true;
    booster.add(body);
    const TOP_Y = LEG_H + 0.7 + BODY_H;

    const engMat = new THREE.MeshStandardMaterial({ color: 0x2b2e33, roughness: 0.5, metalness: 0.8 });
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(BODY_R, BODY_R * 0.98, 0.7, 32), engMat);
    skirt.position.y = LEG_H + 0.35;
    skirt.castShadow = true;
    booster.add(skirt);
    const bellGeo = new THREE.CylinderGeometry(0.13, 0.24, 0.55, 14, 1, true);
    for (let ix = -1; ix <= 1; ix++) {
      for (let iz = -1; iz <= 1; iz++) {
        const bell = new THREE.Mesh(bellGeo, engMat);
        bell.position.set(ix * 0.38, LEG_H - 0.15, iz * 0.38);
        booster.add(bell);
      }
    }

    const finMat = new THREE.MeshStandardMaterial({ color: 0x3a3e44, roughness: 0.6, metalness: 0.6 });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.7), finMat);
      fin.position.set(Math.cos(a) * (BODY_R + 0.3), TOP_Y - 0.9, Math.sin(a) * (BODY_R + 0.3));
      fin.rotation.y = -a;
      fin.castShadow = true;
      booster.add(fin);
    }

    const legMat = new THREE.MeshStandardMaterial({ color: 0xd5d8dc, roughness: 0.45, metalness: 0.5 });
    const legDark = new THREE.MeshStandardMaterial({ color: 0x33363b, roughness: 0.6, metalness: 0.6 });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const dx = Math.cos(a);
      const dz = Math.sin(a);
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 2.6, 10), legMat);
      strut.position.set(dx * 1.05, LEG_H + 0.8, dz * 1.05);
      strut.rotation.z = dx * 0.62;
      strut.rotation.x = -dz * 0.62;
      strut.castShadow = true;
      booster.add(strut);
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.18, 10), legDark);
      foot.position.set(dx * 1.75, 0.09, dz * 1.75);
      foot.castShadow = true;
      booster.add(foot);
    }

    const rcsMat = new THREE.MeshStandardMaterial({ color: 0x24272c, roughness: 0.6, metalness: 0.5 });
    const rcsL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.5), rcsMat);
    rcsL.position.set(-BODY_R - 0.1, TOP_Y - 2.2, 0);
    booster.add(rcsL);
    const rcsR = rcsL.clone();
    rcsR.position.x = BODY_R + 0.1;
    booster.add(rcsR);
    scene.add(booster);

    // ── Exhaust plume ─────────────────────────────────────────
    const plume = new THREE.Group();
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0xff7a1e, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
    });
    const outer = new THREE.Mesh(new THREE.ConeGeometry(0.85, 5.2, 20, 1, true), outerMat);
    outer.rotation.x = Math.PI;
    outer.position.y = -2.6;
    plume.add(outer);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0xfff3d0, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
    });
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.42, 3.1, 16, 1, true), innerMat);
    inner.rotation.x = Math.PI;
    inner.position.y = -1.55;
    plume.add(inner);
    const glowMat = new THREE.SpriteMaterial({ map: softDot, color: 0xffc37a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const glow = new THREE.Sprite(glowMat);
    glow.scale.set(3.2, 3.2, 1);
    glow.position.y = -0.7;
    plume.add(glow);
    plume.position.y = LEG_H - 0.4;
    plume.visible = false;
    booster.add(plume);

    const engineLight = new THREE.PointLight(0xff8a30, 0, 80, 1.8);
    engineLight.position.y = LEG_H - 1;
    booster.add(engineLight);

    const rcsAnchorL = new THREE.Object3D();
    rcsAnchorL.position.set(-BODY_R - 0.35, TOP_Y - 2.2, 0);
    booster.add(rcsAnchorL);
    const rcsAnchorR = new THREE.Object3D();
    rcsAnchorR.position.set(BODY_R + 0.35, TOP_Y - 2.2, 0);
    booster.add(rcsAnchorR);

    // ── Particle pools ────────────────────────────────────────
    interface Puff {
      s: THREE.Sprite;
      vel: THREE.Vector3;
      life: number;
      maxLife: number;
      grow: number;
      baseOp: number;
    }
    const smokes: Puff[] = [];
    const fires: Puff[] = [];
    const smokeGroup = new THREE.Group();
    const fireGroup = new THREE.Group();
    scene.add(smokeGroup, fireGroup);
    for (let i = 0; i < 90; i++) {
      const m = new THREE.SpriteMaterial({ map: softDot, color: 0xcfc9bd, transparent: true, opacity: 0, depthWrite: false });
      const sp = new THREE.Sprite(m);
      sp.visible = false;
      smokeGroup.add(sp);
      smokes.push({ s: sp, vel: new THREE.Vector3(), life: 0, maxLife: 1, grow: 1, baseOp: 0.55 });
    }
    for (let i = 0; i < 30; i++) {
      const m = new THREE.SpriteMaterial({ map: softDot, color: 0xffa030, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
      const sp = new THREE.Sprite(m);
      sp.visible = false;
      fireGroup.add(sp);
      fires.push({ s: sp, vel: new THREE.Vector3(), life: 0, maxLife: 1, grow: 1, baseOp: 1 });
    }
    const spawn = (
      pool: Puff[], pos: THREE.Vector3, vel: THREE.Vector3,
      life: number, size: number, grow: number, color?: number, op?: number
    ) => {
      const p = pool.find((q) => q.life <= 0);
      if (!p) return;
      p.life = p.maxLife = life * (0.7 + Math.random() * 0.6);
      p.vel.copy(vel);
      p.grow = grow;
      p.baseOp = op ?? 0.55;
      p.s.visible = true;
      p.s.position.copy(pos);
      p.s.scale.set(size, size, 1);
      if (color !== undefined) (p.s.material as THREE.SpriteMaterial).color.setHex(color);
    };
    const tmpV = new THREE.Vector3();
    const tmpP = new THREE.Vector3();

    const boomLight = new THREE.PointLight(0xff6a00, 0, 120, 1.7);
    boomLight.position.set(0, 3, 0);
    scene.add(boomLight);
    let boomEnergy = 0;
    let lastDone = false;

    // ── Free-camera mouse ─────────────────────────────────────
    const onMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      mousePosRef.current = { x: e.clientX, y: e.clientY };
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - mousePosRef.current.x;
      const dy = e.clientY - mousePosRef.current.y;
      mousePosRef.current = { x: e.clientX, y: e.clientY };
      cameraAngleRef.current.theta -= dx * 0.006;
      cameraAngleRef.current.phi = Math.max(0.05, Math.min(Math.PI / 2 - 0.05, cameraAngleRef.current.phi - dy * 0.006));
    };
    const onMouseUp = () => { isDraggingRef.current = false; };
    const onWheel = (e: WheelEvent) => {
      cameraAngleRef.current.radius = Math.max(14, Math.min(110, cameraAngleRef.current.radius + e.deltaY * 0.04));
    };
    const dom = renderer.domElement;
    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    dom.addEventListener('wheel', onWheel);

    // ── Main loop ─────────────────────────────────────────────
    const camPos = new THREE.Vector3(14, 10, 40);
    const camLook = new THREE.Vector3(0, 7, 0);
    let animationId = 0;
    const clock = new THREE.Clock();
    let throttle = 0;
    let rcsAcc = 0;
    let smokeAcc = 0;
    let lastEp = -1;

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const dt = Math.min(0.05, clock.getDelta());
      const time = clock.elapsedTime;
      const tg = targetRef.current;
      const s = smoothRef.current;
      const snap = snapRef.current;

      let bx = s.x * X_SCALE;
      let surfY = getSurfaceY(bx);
      let bottomOffset = getBoosterBottomOffset(s.angle);
      let altWorld = Math.max(0, s.y) * Y_SCALE;
      let feetY = surfY + bottomOffset + altWorld;

      // New episode: hard cut to the spawn point. Interpolating the
      // pad→sky teleport is what made it look like the rocket "flies to
      // space and comes back" after every landing.
      if (snap.ep !== lastEp) {
        lastEp = snap.ep;
        s.x = tg.x;
        s.y = tg.y;
        s.angle = tg.angle;
        s.action = tg.action;
        throttle = 0;
        smokeAcc = 0;
        boomEnergy = 0;
        boomLight.intensity = 0;
      }
      // Fresh run after a latched finish (mission replay: ep stays 1,
      // done flips true→false) — same hard cut. Finishes (false→true)
      // fire the touchdown / crash bursts right here.
      if (snap.done !== lastDone) {
        const finishing = snap.done && !lastDone;
        lastDone = snap.done;
        if (!snap.done) {
          s.x = tg.x;
          s.y = tg.y;
          s.angle = tg.angle;
          s.action = tg.action;
          throttle = 0;
          smokeAcc = 0;
          boomEnergy = 0;
          boomLight.intensity = 0;
          booster.visible = true;
        } else if (finishing) {
          if (snap.crashed) {
            boomEnergy = 1;
            booster.visible = false;
            plume.visible = false;
            for (let i = 0; i < 26; i++) {
              const a = Math.random() * Math.PI * 2;
              tmpV.set(Math.cos(a) * (4 + Math.random() * 14), 3 + Math.random() * 12, Math.sin(a) * (4 + Math.random() * 14));
              tmpP.set(bx, surfY + 0.5, 0);
              spawn(fires, tmpP, tmpV, 0.5 + Math.random() * 0.7, 2 + Math.random() * 3, 2.5, Math.random() < 0.5 ? 0xffd050 : 0xff6a10, 1);
            }
            for (let i = 0; i < 34; i++) {
              const a = Math.random() * Math.PI * 2;
              tmpV.set(Math.cos(a) * (3 + Math.random() * 9), 1.5 + Math.random() * 5, Math.sin(a) * (3 + Math.random() * 9));
              tmpP.set(bx, surfY + 0.5, 0);
              spawn(smokes, tmpP, tmpV, 2 + Math.random() * 2, 3 + Math.random() * 3, 3.5, 0x3a3a3a, 0.75);
            }
          } else if (snap.landed) {
            for (let i = 0; i < 30; i++) {
              const a = Math.random() * Math.PI * 2;
              tmpV.set(Math.cos(a) * (4 + Math.random() * 8), 0.6 + Math.random() * 1.4, Math.sin(a) * (4 + Math.random() * 8));
              tmpP.set(bx + Math.cos(a) * 2, surfY + 0.1, Math.sin(a) * 2);
              spawn(smokes, tmpP, tmpV, 1.4 + Math.random(), 1.6 + Math.random() * 1.6, 3.4, 0xd8cfae, 0.6);
            }
          }
        }
      }

      const k = 1 - Math.exp(-dt * 12);
      s.x += (tg.x - s.x) * k;
      s.y += (tg.y - s.y) * k;
      let dA = tg.angle - s.angle;
      while (dA > Math.PI) dA -= 2 * Math.PI;
      while (dA < -Math.PI) dA += 2 * Math.PI;
      s.angle += dA * k;
      s.action = tg.action;

      const want = s.action === 2 ? 1 : 0;
      throttle += Math.max(-dt * 7, Math.min(dt * 5, want - throttle));

      bx = s.x * X_SCALE;
      surfY = getSurfaceY(bx);
      bottomOffset = getBoosterBottomOffset(s.angle);
      altWorld = Math.max(0, s.y) * Y_SCALE;
      feetY = surfY + bottomOffset + altWorld;

      booster.position.set(bx, feetY, 0);
      booster.rotation.z = s.angle;

      // Space factor: pad = daylight, apogee (~220) = full space
      const spaceF = Math.max(0, Math.min(1, (altWorld - 35) / 160));
      skyMat.uniforms.top.value.copy(DAY_TOP).lerp(SPACE_TOP, spaceF);
      skyMat.uniforms.horizon.value.copy(DAY_HOR).lerp(SPACE_HOR, spaceF);
      (scene.fog as THREE.Fog).color.copy(DAY_HOR).lerp(SPACE_HOR, spaceF);
      starMat.opacity = spaceF;
      stars.rotation.y = time * 0.004;

      plume.visible = throttle > 0.02;
      if (plume.visible) {
        const fl = 1 + 0.07 * Math.sin(time * 33) + 0.04 * Math.sin(time * 61 + 1.7);
        // Vacuum expansion: plume blooms wider + longer with altitude
        const vac = 1 + spaceF * 1.1;
        plume.scale.set(fl * vac, (0.55 + throttle * 0.75) * fl * (1 + spaceF * 0.3), fl * vac);
        outerMat.opacity = 0.5 * throttle * (1 - 0.25 * spaceF);
        innerMat.opacity = 0.9 * throttle * (1 - 0.2 * spaceF);
        glowMat.opacity = 0.85 * throttle;
        engineLight.intensity = 130 * throttle;
      } else {
        engineLight.intensity = 0;
      }

      const groundFx = Math.max(0, 1.4 - altWorld / 30);
      if (showSmokeRef.current && throttle > 0.05 && (groundFx > 0.02 || altWorld < 60)) {
        smokeAcc += dt * (8 + 40 * throttle * Math.max(0.25, groundFx));
        while (smokeAcc >= 1) {
          smokeAcc -= 1;
          const a = Math.random() * Math.PI * 2;
          const r = 1.5 + Math.random() * 3.5;
          tmpV.set(Math.cos(a) * (3 + Math.random() * 6), 0.8 + Math.random() * 2.2, Math.sin(a) * (3 + Math.random() * 6));
          tmpP.set(bx + Math.cos(a) * r, surfY + 0.2, Math.sin(a) * r);
          spawn(smokes, tmpP, tmpV, 1.6 + Math.random() * 1.6, 2 + Math.random() * 2, 3.2,
            Math.random() < 0.3 ? 0xd8cfae : 0xcfc9bd, 0.5);
        }
      }

      rcsAcc += dt;
      if ((s.action === 1 || s.action === 3) && rcsAcc > 0.07) {
        rcsAcc = 0;
        (s.action === 1 ? rcsAnchorL : rcsAnchorR).getWorldPosition(tmpP);
        tmpV.set(s.action === 1 ? -6 : 6, 1.2, 0);
        spawn(smokes, tmpP.clone(), tmpV, 0.4, 0.5, 2.5, 0xffffff, 0.7);
      }

      if (!snap.crashed && !snap.landed) booster.visible = true;
      if (!snap.crashed && !snap.landed) booster.visible = true;
      if (boomEnergy > 0) {
        boomEnergy = Math.max(0, boomEnergy - dt * 1.2);
        boomLight.intensity = 400 * boomEnergy;
        boomLight.position.set(bx, feetY - 2, 0);
      } else {
        boomLight.intensity = 0;
      }

      for (const p of smokes) {
        if (p.life <= 0) continue;
        p.life -= dt;
        if (p.life <= 0) { p.s.visible = false; continue; }
        p.s.position.addScaledVector(p.vel, dt);
        p.vel.multiplyScalar(1 - dt * 1.1);
        p.vel.y += dt * 0.7;
        const f = 1 - p.life / p.maxLife;
        const sc = p.s.scale.x + p.grow * dt;
        p.s.scale.set(sc, sc, 1);
        (p.s.material as THREE.SpriteMaterial).opacity = p.baseOp * (1 - f);
      }
      for (const p of fires) {
        if (p.life <= 0) continue;
        p.life -= dt;
        if (p.life <= 0) { p.s.visible = false; continue; }
        p.s.position.addScaledVector(p.vel, dt);
        p.vel.multiplyScalar(1 - dt * 2);
        const f = 1 - p.life / p.maxLife;
        const sc = p.s.scale.x + p.grow * dt;
        p.s.scale.set(sc, sc, 1);
        (p.s.material as THREE.SpriteMaterial).opacity = 1 - f;
      }

      for (const c of clouds) {
        c.position.x += dt * 0.7;
        if (c.position.x > 400) c.position.x = -400;
      }

      // Bangladesh flag wave
      {
        const pos = flagGeo.attributes.position as THREE.BufferAttribute;
        const arr = pos.array as unknown as number[];
        for (let i = 0; i < pos.count; i++) {
          const x0 = (flagBase as unknown as number[])[i * 3];
          const y0 = (flagBase as unknown as number[])[i * 3 + 1];
          arr[i * 3 + 2] = Math.sin(x0 * 1.8 - time * 6) * 0.14 * (x0 / 3.4)
            + Math.sin(y0 * 2.2 + time * 3.1) * 0.03 * (x0 / 3.4);
        }
        pos.needsUpdate = true;
        flagGeo.computeVertexNormals();
      }

      const cm = cameraModeRef.current;
      const cp = new THREE.Vector3();
      const cl = new THREE.Vector3();
      const sway = Math.sin(time * 0.3) * 0.5;
      if (cm === 'reference') {
        if (altWorld < 9) {
          // Landing zoom: push in close for the final metres
          const lz = 1 - altWorld / 9; // 0 high → 1 touchdown
          cp.set(bx * (0.55 - 0.25 * lz) + 4, 4.5 + feetY * 0.5, 30 - 10 * lz);
          cl.set(bx * 0.7, 1 + feetY * 0.5, 0);
        } else {
          // Full-altitude tracking: pad → space and back, booster framed
          cp.set(bx * 0.3 + 12 + sway * (1 - spaceF), 7 + feetY * 0.45, 32 + altWorld * 0.62);
          cl.set(bx * 0.5, 1 + feetY * 0.6, 0);
        }
      } else if (cm === 'follow') {
        cp.set(bx + 7, feetY + 3.5, 20);
        cl.set(bx, feetY - 2, 0);
      } else {
        const { theta, phi, radius } = cameraAngleRef.current;
        cp.set(
          bx + radius * Math.sin(theta) * Math.cos(phi),
          Math.max(2, feetY - 3 + radius * Math.sin(phi)),
          radius * Math.cos(theta) * Math.cos(phi)
        );
        cl.set(bx, feetY - 3, 0);
      }
      const ck = 1 - Math.exp(-dt * 4);
      camPos.lerp(cp, ck);
      camLook.lerp(cl, ck);
      camera.position.copy(camPos);
      camera.lookAt(camLook);

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 600;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    window.addEventListener('resize', handleResize);
    setTimeout(handleResize, 50);

    return () => {
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      dom.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      dom.removeEventListener('wheel', onWheel);
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isMission = simState.mission;
  const obsV = Math.hypot(simState.obs[2], simState.obs[3]);
  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-black" ref={mountRef}>
      <div className="absolute top-0 left-0 right-0 z-10 flex items-start justify-between px-4 pt-3 pointer-events-none">
        <div className="flex items-center gap-2.5 bg-black/30 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/[0.08]">
          <span className="inline-block w-2 h-2 rounded-full bg-white/80 animate-pulse" />
          <span className="text-[12px] font-semibold tracking-[0.16em] text-white/95">
            {isMission ? 'RKT-1 · HIGH-ALTITUDE HOP TEST' : 'RKT-1 · BOOSTER LANDING TEST'}
          </span>
          <span className="text-[12px] tabular-nums text-zinc-400">
            T+{Math.floor(simState.step / 50 / 60)}:{String(Math.floor((simState.step / 50) % 60)).padStart(2, '0')}
          </span>
          {pilot && (
            <span className="text-[10px] font-semibold tracking-[0.12em] px-2 py-0.5 rounded-full border border-white/15 bg-white/10 text-zinc-200">
              PILOT · {pilot}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-[12px] tabular-nums text-white/90 bg-black/30 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/[0.08]">
          {isMission ? (
            <>
              <span><span className="text-zinc-500 text-[10px] tracking-widest mr-1.5">ALT</span>{Math.max(0, simState.obs[1] * 1.5).toFixed(2)} km</span>
              <span><span className="text-zinc-500 text-[10px] tracking-widest mr-1.5">VEL</span>{(obsV * 500).toFixed(0)} m/s</span>
            </>
          ) : (
            <>
              <span><span className="text-zinc-500 text-[10px] tracking-widest mr-1.5">ALT</span>{Math.max(0, simState.obs[1] * M).toFixed(1)} m</span>
              <span><span className="text-zinc-500 text-[10px] tracking-widest mr-1.5">V-SPD</span>{(simState.obs[3] * M).toFixed(1)} m/s</span>
              <span><span className="text-zinc-500 text-[10px] tracking-widest mr-1.5">H-SPD</span>{(simState.obs[2] * M).toFixed(1)} m/s</span>
            </>
          )}
        </div>
      </div>

      {/* Mission phase chip */}
      {isMission && simState.phase && simState.phase !== 'COMPLETE' && simState.phase !== 'ABORT' && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="px-4 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/15 text-white/90 text-[11px] font-semibold tracking-[0.3em]">
            {simState.phase === 'BURN' ? 'LANDING BURN' : simState.phase}
          </div>
        </div>
      )}

      {event === 'landed' && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="px-5 py-2 rounded-full bg-black/60 backdrop-blur-md border border-white/25 text-white text-[12px] font-semibold tracking-[0.25em] shadow-lg">
            {simState.perfect ? 'PERFECT TOUCHDOWN' : 'TOUCHDOWN'}
          </div>
        </div>
      )}
      {event === 'crashed' && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="px-5 py-2 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-zinc-300 text-[12px] font-semibold tracking-[0.25em] shadow-lg">
            VEHICLE LOST
          </div>
        </div>
      )}

      <div className="absolute bottom-3 right-4 z-10 pointer-events-none text-[11px] tracking-wider text-white/40">
        DRAG TO ORBIT · SCROLL TO ZOOM
      </div>
    </div>
  );
};
