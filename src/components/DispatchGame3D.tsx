import {
  ChevronDown,
  ChevronUp,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Trophy,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GameScoreEntry } from '../types/pulse';

type GamePhase = 'title' | 'playing' | 'paused' | 'victory' | 'gameover';

interface DispatchGame3DProps {
  topScores: GameScoreEntry[];
  isAuthenticated: boolean;
  onSignInPrompt: () => void;
  onSaveRunScore: (
    score: number,
    dispatchesCleared: number,
    durationSeconds: number
  ) => Promise<void> | void;
  onExitToMarketplace: () => void;
}

interface HudState {
  score: number;
  combo: number;
  dispatches: number;
  shields: number;
  timeLeft: number;
  boostCharge: number; // 0..100
  isBoosting: boolean;
}

interface ActiveEntity {
  kind: 'beacon' | 'priority-beacon' | 'sedan' | 'cone';
  lane: number; // 0, 1, 2
  z: number;
  active: boolean;
  group: THREE.Group;
  spinner?: THREE.Object3D;
}

interface ParticleSlot {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  active: boolean;
}

const LANE_X = [-4.2, 0, 4.2] as const;
const RUN_DURATION_SEC = 75;
const TARGET_DISPATCHES = 18;
const ROAD_SEGMENT_LEN = 40;
const ROAD_SEGMENT_COUNT = 5;

// Pre-allocated scratch helpers (zero GC inside frame loop)
const _scratchMatrix = new THREE.Matrix4();
const _scratchQuat = new THREE.Quaternion();
const _scratchScale = new THREE.Vector3(1, 1, 1);
const _scratchPos = new THREE.Vector3();
const _scratchColor = new THREE.Color();

function createSoundEngine() {
  let ctx: AudioContext | null = null;

  const ensureCtx = () => {
    if (typeof window === 'undefined') return null;
    if (!ctx) {
      const AudioCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtor) {
        ctx = new AudioCtor();
      }
    }
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume();
    }
    return ctx;
  };

  return {
    playTone(freq: number, duration: number, type: OscillatorType, gainPeak = 0.08, slideTo?: number) {
      const audio = ensureCtx();
      if (!audio) return;
      const now = audio.currentTime;
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (slideTo !== undefined) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), now + duration);
      }
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    },
    pickup(combo: number, priority: boolean) {
      const base = priority ? 660 : 520;
      const step = Math.min(8, combo) * 38;
      this.playTone(base + step, 0.14, 'triangle', 0.09, base + step + 180);
    },
    boost() {
      this.playTone(220, 0.22, 'sawtooth', 0.06, 540);
    },
    hit() {
      this.playTone(150, 0.26, 'square', 0.09, 55);
    },
    victory() {
      this.playTone(523.25, 0.14, 'triangle', 0.09, 659.25);
      window.setTimeout(() => this.playTone(783.99, 0.28, 'triangle', 0.09, 1046.5), 110);
    },
    dispose() {
      if (ctx) {
        void ctx.close();
        ctx = null;
      }
    },
  };
}

function createRoadTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const c = canvas.getContext('2d')!;

  // Rich slate asphalt base
  c.fillStyle = '#282538';
  c.fillRect(0, 0, 512, 512);

  // Subtle mineral aggregate speckles
  for (let i = 0; i < 1800; i++) {
    const x = (i * 73) % 512;
    const y = (i * 137) % 512;
    c.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(12,10,20,0.08)';
    c.fillRect(x, y, 2, 2);
  }

  // Outer violet-tinted curb shoulder lines
  c.fillStyle = '#8b73e8';
  c.fillRect(14, 0, 6, 512);
  c.fillRect(492, 0, 6, 512);

  // Dashed lane dividers (3 lanes -> dividers at 1/3 and 2/3)
  c.fillStyle = '#ede7ff';
  const div1 = Math.round(512 / 3);
  const div2 = Math.round((512 * 2) / 3);
  for (let y = 12; y < 512; y += 64) {
    c.fillRect(div1 - 3, y, 6, 34);
    c.fillRect(div2 - 3, y, 6, 34);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 3);
  tex.anisotropy = maxAniso;
  return tex;
}

function createSidewalkTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const c = canvas.getContext('2d')!;

  c.fillStyle = '#e7dff7';
  c.fillRect(0, 0, 256, 256);

  c.strokeStyle = '#d1c4f0';
  c.lineWidth = 3;
  for (let y = 0; y <= 256; y += 64) {
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(256, y);
    c.stroke();
  }
  for (let x = 0; x <= 256; x += 64) {
    c.beginPath();
    c.moveTo(x, 0);
    c.lineTo(x, 256);
    c.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 6);
  tex.anisotropy = maxAniso;
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const c = canvas.getContext('2d')!;
  const grad = c.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(20, 14, 42, 0.52)');
  grad.addColorStop(0.55, 'rgba(20, 14, 42, 0.22)');
  grad.addColorStop(1, 'rgba(20, 14, 42, 0)');
  c.fillStyle = grad;
  c.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createServiceVanGroup(shadowTex: THREE.CanvasTexture): {
  group: THREE.Group;
  wheels: THREE.Mesh[];
  boostGlow: THREE.Mesh;
} {
  const group = new THREE.Group();
  const wheels: THREE.Mesh[] = [];

  // Ground contact shadow (offset >= 0.02 on Y)
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 5.2),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
    })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.025;
  group.add(shadowPlane);

  // Materials with clear roughness/metalness contrast
  const chassisMat = new THREE.MeshStandardMaterial({
    color: 0x1d192a,
    roughness: 0.72,
    metalness: 0.22,
  });
  const bodyPaintMat = new THREE.MeshPhysicalMaterial({
    color: 0xfbf9ff,
    roughness: 0.24,
    metalness: 0.35,
    clearcoat: 0.85,
    clearcoatRoughness: 0.14,
  });
  const accentVioletMat = new THREE.MeshStandardMaterial({
    color: 0x6c3bff,
    roughness: 0.3,
    metalness: 0.55,
  });
  const alloyMat = new THREE.MeshStandardMaterial({
    color: 0xd6d2e8,
    roughness: 0.18,
    metalness: 0.9,
  });
  const rubberMat = new THREE.MeshStandardMaterial({
    color: 0x171520,
    roughness: 0.88,
    metalness: 0.05,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x201c3a,
    roughness: 0.08,
    metalness: 0.2,
    clearcoat: 1.0,
  });
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xfff3c4,
    emissiveIntensity: 1.8,
    roughness: 0.15,
  });
  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0xff3b5c,
    emissive: 0xff2950,
    emissiveIntensity: 1.4,
    roughness: 0.2,
  });
  const beaconBarMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    emissive: 0x10b981,
    emissiveIntensity: 1.5,
    roughness: 0.2,
  });

  // 1. Lower chassis apron
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.08, 0.36, 4.18), chassisMat);
  chassis.position.set(0, 0.52, 0);
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  group.add(chassis);

  // 2. Aerodynamic van profile via beveled ExtrudeGeometry
  const vanShape = new THREE.Shape();
  vanShape.moveTo(-2.0, 0.0);
  vanShape.lineTo(1.95, 0.0);
  vanShape.lineTo(1.95, 0.98);
  vanShape.lineTo(1.38, 1.44);
  vanShape.lineTo(-1.82, 1.44);
  vanShape.lineTo(-2.0, 1.24);
  vanShape.closePath();

  const bodyGeo = new THREE.ExtrudeGeometry(vanShape, {
    depth: 1.84,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.08,
    bevelSegments: 3,
  });
  bodyGeo.center();
  // Rotate so length runs along Z, facing -Z
  bodyGeo.rotateY(Math.PI / 2);
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyPaintMat);
  bodyMesh.position.set(0, 1.28, 0);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  group.add(bodyMesh);

  // 3. Signature PulsePro violet side band trim
  const sideBand = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.18, 3.65), accentVioletMat);
  sideBand.position.set(0, 0.92, 0.05);
  group.add(sideBand);

  // 4. Tinted wraparound windshield
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.56, 0.14), glassMat);
  windshield.position.set(0, 1.5, -1.52);
  windshield.rotation.x = 0.58;
  group.add(windshield);

  // 5. Roof telemetry rack + brushed rails
  const roofRack = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.08, 2.25), alloyMat);
  roofRack.position.set(0, 2.08, 0.35);
  roofRack.castShadow = true;
  group.add(roofRack);

  // 6. Roof active dispatch lightbar
  const lightBar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 0.24), beaconBarMat);
  lightBar.position.set(0, 2.16, -0.58);
  group.add(lightBar);

  // 7. Twin headlights (facing -Z forward)
  for (const sx of [-0.68, 0.68]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.08), headlightMat);
    hl.position.set(sx, 0.88, -2.06);
    group.add(hl);
  }

  // 8. Twin rear taillights (+Z rear)
  for (const sx of [-0.72, 0.72]) {
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.08), taillightMat);
    tl.position.set(sx, 0.95, 2.06);
    group.add(tl);
  }

  // 9. Rear boost thruster ring
  const boostGlow = new THREE.Mesh(
    new THREE.TorusGeometry(0.28, 0.06, 10, 20),
    new THREE.MeshStandardMaterial({
      color: 0x6c3bff,
      emissive: 0x8b5cf6,
      emissiveIntensity: 0.6,
      roughness: 0.2,
    })
  );
  boostGlow.position.set(0, 0.62, 2.08);
  group.add(boostGlow);

  // 10. Four grounded wheel assemblies (tire radius 0.38, centered at y = 0.38)
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 18);
  wheelGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.3, 12);
  rimGeo.rotateZ(Math.PI / 2);

  const wheelPositions: [number, number, number][] = [
    [-0.98, 0.38, -1.22],
    [0.98, 0.38, -1.22],
    [-0.98, 0.38, 1.25],
    [0.98, 0.38, 1.25],
  ];
  for (const [wx, wy, wz] of wheelPositions) {
    const tire = new THREE.Mesh(wheelGeo, rubberMat);
    tire.position.set(wx, wy, wz);
    tire.castShadow = true;
    const rim = new THREE.Mesh(rimGeo, alloyMat);
    tire.add(rim);
    group.add(tire);
    wheels.push(tire);
  }

  return { group, wheels, boostGlow };
}

function createDispatchBeaconGroup(
  isPriority: boolean,
  shadowTex: THREE.CanvasTexture
): { group: THREE.Group; spinner: THREE.Group } {
  const group = new THREE.Group();
  const accentHex = isPriority ? 0xf59e0b : 0x10b981;

  // Ground shadow
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.1, 2.1),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.4,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.025;
  group.add(shadow);

  // Base pedestal
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x26203b,
    roughness: 0.55,
    metalness: 0.4,
  });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.78, 0.22, 16), baseMat);
  base.position.y = 0.11;
  base.castShadow = true;
  group.add(base);

  // Brushed metallic collar
  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.5, 0.14, 16),
    new THREE.MeshStandardMaterial({
      color: 0xd6d2e8,
      roughness: 0.18,
      metalness: 0.9,
    })
  );
  collar.position.y = 0.28;
  group.add(collar);

  // Rotating crystal + halo ring
  const spinner = new THREE.Group();
  spinner.position.y = 1.05;

  const coreCrystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.54, 0),
    new THREE.MeshPhysicalMaterial({
      color: accentHex,
      emissive: accentHex,
      emissiveIntensity: 0.7,
      roughness: 0.14,
      metalness: 0.25,
      clearcoat: 1.0,
    })
  );
  coreCrystal.castShadow = true;
  spinner.add(coreCrystal);

  const haloRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.76, 0.06, 10, 24),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: accentHex,
      emissiveIntensity: 0.5,
      roughness: 0.2,
      metalness: 0.85,
    })
  );
  haloRing.rotation.x = Math.PI / 3;
  spinner.add(haloRing);

  group.add(spinner);
  return { group, spinner };
}

function createHazardSedanGroup(shadowTex: THREE.CanvasTexture): THREE.Group {
  const group = new THREE.Group();

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.0, 4.4),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.5,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.025;
  group.add(shadow);

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x3b3552,
    roughness: 0.35,
    metalness: 0.5,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x564e73,
    roughness: 0.28,
    metalness: 0.45,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x191526,
    roughness: 0.12,
    metalness: 0.3,
  });
  const brakeMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: 1.4,
    roughness: 0.2,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x15131e,
    roughness: 0.9,
    metalness: 0.05,
  });

  const lower = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.55, 3.6), bodyMat);
  lower.position.y = 0.58;
  lower.castShadow = true;
  lower.receiveShadow = true;
  group.add(lower);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.52, 1.9), roofMat);
  cabin.position.set(0, 1.08, 0.12);
  cabin.castShadow = true;
  group.add(cabin);

  const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.42, 0.14), glassMat);
  rearGlass.position.set(0, 1.05, 1.05);
  rearGlass.rotation.x = -0.35;
  group.add(rearGlass);

  for (const sx of [-0.68, 0.68]) {
    const brake = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.08), brakeMat);
    brake.position.set(sx, 0.68, 1.81);
    group.add(brake);
  }

  const wGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 14);
  wGeo.rotateZ(Math.PI / 2);
  for (const [wx, wz] of [
    [-0.92, -1.08],
    [0.92, -1.08],
    [-0.92, 1.08],
    [0.92, 1.08],
  ]) {
    const tire = new THREE.Mesh(wGeo, tireMat);
    tire.position.set(wx, 0.33, wz);
    group.add(tire);
  }

  return group;
}

function createTrafficConeGroup(shadowTex: THREE.CanvasTexture): THREE.Group {
  const group = new THREE.Group();

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 1.5),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.42,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.025;
  group.add(shadow);

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(0.95, 0.12, 0.95),
    new THREE.MeshStandardMaterial({ color: 0x221e30, roughness: 0.85, metalness: 0.08 })
  );
  base.position.y = 0.06;
  base.castShadow = true;
  group.add(base);

  const cone = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.38, 1.05, 14),
    new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.42, metalness: 0.08 })
  );
  cone.position.y = 0.62;
  cone.castShadow = true;
  group.add(cone);

  const stripe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.21, 0.29, 0.24, 14),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfef3c7,
      emissiveIntensity: 0.35,
      roughness: 0.22,
    })
  );
  stripe.position.y = 0.68;
  group.add(stripe);

  return group;
}

export const DispatchGame3D: React.FC<DispatchGame3DProps> = ({
  topScores,
  isAuthenticated,
  onSignInPrompt,
  onSaveRunScore,
  onExitToMarketplace,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [phase, setPhase] = useState<GamePhase>('title');
  const [hud, setHud] = useState<HudState>({
    score: 0,
    combo: 1,
    dispatches: 0,
    shields: 3,
    timeLeft: RUN_DURATION_SEC,
    boostCharge: 100,
    isBoosting: false,
  });
  const [isMuted, setIsMuted] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);

  // Refs synced cleanly without re-creating WebGLRenderer
  const phaseRef = useRef<GamePhase>('title');
  const isMutedRef = useRef(false);
  const scoreSubmittedRef = useRef(false);
  const targetLaneRef = useRef(1); // 0=left, 1=center, 2=right
  const boostRequestedRef = useRef(false);
  const resetRequestedRef = useRef(false);
  const saveScoreCbRef = useRef(onSaveRunScore);
  saveScoreCbRef.current = onSaveRunScore;

  const setSyncedPhase = useCallback((next: GamePhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const handleStartRun = useCallback(() => {
    scoreSubmittedRef.current = false;
    resetRequestedRef.current = true;
    targetLaneRef.current = 1;
    setHud({
      score: 0,
      combo: 1,
      dispatches: 0,
      shields: 3,
      timeLeft: RUN_DURATION_SEC,
      boostCharge: 100,
      isBoosting: false,
    });
    setSyncedPhase('playing');
  }, [setSyncedPhase]);

  const handleTogglePause = useCallback(() => {
    if (phaseRef.current === 'playing') {
      setSyncedPhase('paused');
    } else if (phaseRef.current === 'paused') {
      setSyncedPhase('playing');
    }
  }, [setSyncedPhase]);

  const handleSteerLeft = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    targetLaneRef.current = Math.max(0, targetLaneRef.current - 1);
  }, []);

  const handleSteerRight = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    targetLaneRef.current = Math.min(2, targetLaneRef.current + 1);
  }, []);

  const handleBoost = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    boostRequestedRef.current = true;
  }, []);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((prev) => !prev);
        return;
      }
      if (e.key === 'Escape') {
        if (phaseRef.current === 'playing' || phaseRef.current === 'paused') {
          handleTogglePause();
        }
        return;
      }
      if (phaseRef.current !== 'playing') return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        targetLaneRef.current = Math.max(0, targetLaneRef.current - 1);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        targetLaneRef.current = Math.min(2, targetLaneRef.current + 1);
      } else if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        boostRequestedRef.current = true;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleTogglePause]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Software WebGL Renderer Probe
    const isSoftwareGl = (() => {
      const probe = document.createElement('canvas').getContext('webgl2');
      if (!probe) return true;
      const ext = probe.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
      const gpu = String(probe.getParameter(param));
      probe.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || 560;
    renderer.setSize(width, height);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    // 2. Scene, Camera, Studio Environment Map, Warm/Cool 3-Point Rig & Horizon Fog
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xeae3ff);
    scene.fog = new THREE.FogExp2(0xeae3ff, 0.012);

    const camera = new THREE.PerspectiveCamera(56, width / height, 0.1, 220);
    camera.position.set(0, 6.2, 11.5);
    camera.lookAt(0, 1.4, -8);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    const hemiLight = new THREE.HemisphereLight(0xcbe0ff, 0x453470, 0.85);
    hemiLight.position.set(0, 35, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1d6, 1.65);
    keyLight.position.set(16, 28, 14);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 75;
    keyLight.shadow.camera.left = -20;
    keyLight.shadow.camera.right = 20;
    keyLight.shadow.camera.top = 20;
    keyLight.shadow.camera.bottom = -20;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xb8a3ff, 0.65);
    rimLight.position.set(-14, 12, -22);
    scene.add(rimLight);

    // 3. Procedural Textures & Grounded Neighborhood Environment
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const roadTex = createRoadTexture(maxAniso);
    const sidewalkTex = createSidewalkTexture(maxAniso);
    const shadowTex = createContactShadowTexture();

    // Extended outer terrain plane so world extends naturally to fog horizon
    const terrainPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(340, 340),
      new THREE.MeshStandardMaterial({
        color: 0xd9cef5,
        roughness: 0.92,
        metalness: 0.02,
      })
    );
    terrainPlane.rotation.x = -Math.PI / 2;
    terrainPlane.position.y = -0.04;
    terrainPlane.receiveShadow = true;
    scene.add(terrainPlane);

    // Scrolling road & sidewalk corridor segments
    const roadMat = new THREE.MeshStandardMaterial({
      map: roadTex,
      roughness: 0.82,
      metalness: 0.05,
    });
    const sidewalkMat = new THREE.MeshStandardMaterial({
      map: sidewalkTex,
      roughness: 0.78,
      metalness: 0.04,
    });
    const curbMat = new THREE.MeshStandardMaterial({
      color: 0xc2b5eb,
      roughness: 0.62,
      metalness: 0.1,
    });

    const roadSegments: THREE.Group[] = [];
    for (let i = 0; i < ROAD_SEGMENT_COUNT; i++) {
      const seg = new THREE.Group();
      const roadMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(14.6, ROAD_SEGMENT_LEN),
        roadMat
      );
      roadMesh.rotation.x = -Math.PI / 2;
      roadMesh.position.y = 0.0;
      roadMesh.receiveShadow = true;
      seg.add(roadMesh);

      for (const side of [-1, 1]) {
        const walk = new THREE.Mesh(
          new THREE.BoxGeometry(6.5, 0.16, ROAD_SEGMENT_LEN),
          sidewalkMat
        );
        walk.position.set(side * 10.55, 0.06, 0);
        walk.receiveShadow = true;
        seg.add(walk);

        const curb = new THREE.Mesh(
          new THREE.BoxGeometry(0.4, 0.22, ROAD_SEGMENT_LEN),
          curbMat
        );
        curb.position.set(side * 7.45, 0.11, 0);
        seg.add(curb);
      }

      seg.position.z = 20 - i * ROAD_SEGMENT_LEN;
      scene.add(seg);
      roadSegments.push(seg);
    }

    // Instanced Bay Area Townhomes & Street Cypress Trees along outer flanks
    const buildingCount = 36;
    const buildingGeo = new THREE.BoxGeometry(7.2, 9.5, 8.6);
    buildingGeo.translate(0, 4.75, 0);
    const buildingMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.72,
      metalness: 0.08,
    });
    const buildingsInstanced = new THREE.InstancedMesh(buildingGeo, buildingMat, buildingCount);
    buildingsInstanced.castShadow = !isSoftwareGl;
    buildingsInstanced.receiveShadow = true;

    const palette = [0xf6f0ff, 0xede5ff, 0xfdf7ff, 0xe4dafc, 0xf3ecff];
    for (let i = 0; i < buildingCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const row = Math.floor(i / 2);
      const xPos = side * (17.5 + (row % 3) * 1.4);
      const zPos = 15 - row * 10.5;
      const scaleY = 0.75 + ((i * 37) % 10) * 0.09;
      const scaleX = 0.9 + ((i * 19) % 5) * 0.06;
      _scratchPos.set(xPos, 0, zPos);
      _scratchScale.set(scaleX, scaleY, 0.95);
      _scratchMatrix.compose(_scratchPos, _scratchQuat, _scratchScale);
      buildingsInstanced.setMatrixAt(i, _scratchMatrix);
      _scratchColor.setHex(palette[i % palette.length]);
      buildingsInstanced.setColorAt(i, _scratchColor);
    }
    buildingsInstanced.instanceMatrix.needsUpdate = true;
    if (buildingsInstanced.instanceColor) buildingsInstanced.instanceColor.needsUpdate = true;
    buildingsInstanced.computeBoundingSphere();
    buildingsInstanced.frustumCulled = false;
    scene.add(buildingsInstanced);

    // Instanced tree crowns + trunks
    const treeCount = 24;
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.24, 1.8, 8);
    trunkGeo.translate(0, 0.9, 0);
    const trunkInst = new THREE.InstancedMesh(
      trunkGeo,
      new THREE.MeshStandardMaterial({ color: 0x5c4738, roughness: 0.88 }),
      treeCount
    );
    const crownGeo = new THREE.DodecahedronGeometry(1.15, 0);
    crownGeo.translate(0, 2.75, 0);
    const crownInst = new THREE.InstancedMesh(
      crownGeo,
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.76 }),
      treeCount
    );
    crownInst.castShadow = !isSoftwareGl;

    const treeGreens = [0x10b981, 0x059669, 0x34d399, 0x16a34a];
    for (let i = 0; i < treeCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const row = Math.floor(i / 2);
      const xPos = side * 9.8;
      const zPos = 12 - row * 15;
      const s = 0.85 + ((i * 13) % 4) * 0.1;
      _scratchPos.set(xPos, 0.12, zPos);
      _scratchScale.set(s, s, s);
      _scratchMatrix.compose(_scratchPos, _scratchQuat, _scratchScale);
      trunkInst.setMatrixAt(i, _scratchMatrix);
      crownInst.setMatrixAt(i, _scratchMatrix);
      _scratchColor.setHex(treeGreens[i % treeGreens.length]);
      crownInst.setColorAt(i, _scratchColor);
    }
    trunkInst.instanceMatrix.needsUpdate = true;
    crownInst.instanceMatrix.needsUpdate = true;
    if (crownInst.instanceColor) crownInst.instanceColor.needsUpdate = true;
    trunkInst.computeBoundingSphere();
    crownInst.computeBoundingSphere();
    trunkInst.frustumCulled = false;
    crownInst.frustumCulled = false;
    scene.add(trunkInst);
    scene.add(crownInst);

    // 4. Hero Service Van
    const { group: vanGroup, wheels: vanWheels, boostGlow } = createServiceVanGroup(shadowTex);
    vanGroup.position.set(0, 0, 2.2);
    scene.add(vanGroup);

    // 5. Pooled Entities (Beacons & Obstacles)
    const entityPool: ActiveEntity[] = [];
    for (let i = 0; i < 6; i++) {
      const priority = i % 3 === 0;
      const { group, spinner } = createDispatchBeaconGroup(priority, shadowTex);
      group.visible = false;
      scene.add(group);
      entityPool.push({
        kind: priority ? 'priority-beacon' : 'beacon',
        lane: 1,
        z: -100,
        active: false,
        group,
        spinner,
      });
    }
    for (let i = 0; i < 5; i++) {
      const group = createHazardSedanGroup(shadowTex);
      group.visible = false;
      scene.add(group);
      entityPool.push({
        kind: 'sedan',
        lane: 0,
        z: -100,
        active: false,
        group,
      });
    }
    for (let i = 0; i < 5; i++) {
      const group = createTrafficConeGroup(shadowTex);
      group.visible = false;
      scene.add(group);
      entityPool.push({
        kind: 'cone',
        lane: 2,
        z: -100,
        active: false,
        group,
      });
    }

    // 6. Pooled Burst Particles
    const particlePool: ParticleSlot[] = [];
    const particleGeo = new THREE.SphereGeometry(0.14, 8, 8);
    for (let i = 0; i < 24; i++) {
      const mesh = new THREE.Mesh(
        particleGeo,
        new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 1 })
      );
      mesh.visible = false;
      scene.add(mesh);
      particlePool.push({
        mesh,
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 0.45,
        active: false,
      });
    }

    const spawnBurst = (x: number, y: number, z: number, colorHex: number) => {
      let spawned = 0;
      for (let i = 0; i < particlePool.length && spawned < 8; i++) {
        const slot = particlePool[i];
        if (!slot.active) {
          slot.active = true;
          slot.life = 0;
          slot.maxLife = 0.42;
          slot.mesh.position.set(x, y, z);
          slot.mesh.scale.setScalar(1);
          slot.mesh.visible = true;
          (slot.mesh.material as THREE.MeshBasicMaterial).color.setHex(colorHex);
          (slot.mesh.material as THREE.MeshBasicMaterial).opacity = 1;
          const angle = (spawned / 8) * Math.PI * 2;
          slot.vel.set(Math.cos(angle) * 5.2, 3.8 + (spawned % 3) * 1.4, Math.sin(angle) * 5.2);
          spawned++;
        }
      }
    };

    const sound = createSoundEngine();
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Mutable simulation state
    const sim = {
      score: 0,
      combo: 1,
      dispatches: 0,
      shields: 3,
      timeLeft: RUN_DURATION_SEC,
      boostCharge: 100,
      boostTimer: 0,
      invulnTimer: 0,
      hitstopTimer: 0,
      shakeTimer: 0,
      spawnCooldown: 0.6,
      worldSpeed: 22,
      elapsedPlaying: 0,
      vanX: 0,
      vanRoll: 0,
      hudSyncAccum: 0,
    };

    const resetSimulation = () => {
      sim.score = 0;
      sim.combo = 1;
      sim.dispatches = 0;
      sim.shields = 3;
      sim.timeLeft = RUN_DURATION_SEC;
      sim.boostCharge = 100;
      sim.boostTimer = 0;
      sim.invulnTimer = 0;
      sim.hitstopTimer = 0;
      sim.shakeTimer = 0;
      sim.spawnCooldown = 0.45;
      sim.worldSpeed = 22;
      sim.elapsedPlaying = 0;
      sim.vanX = 0;
      sim.vanRoll = 0;
      for (const ent of entityPool) {
        ent.active = false;
        ent.group.visible = false;
      }
      for (const p of particlePool) {
        p.active = false;
        p.mesh.visible = false;
      }
    };

    const spawnWave = () => {
      const beaconSlot = entityPool.find((e) => !e.active && (e.kind === 'beacon' || e.kind === 'priority-beacon'));
      const hazardSlot = entityPool.find((e) => !e.active && (e.kind === 'sedan' || e.kind === 'cone'));

      const beaconLane = Math.floor(Math.random() * 3);
      if (beaconSlot) {
        beaconSlot.active = true;
        beaconSlot.lane = beaconLane;
        beaconSlot.z = -112;
        beaconSlot.group.position.set(LANE_X[beaconLane], 0, -112);
        beaconSlot.group.visible = true;
      }

      if (hazardSlot && Math.random() < 0.85) {
        const otherLanes = [0, 1, 2].filter((l) => l !== beaconLane);
        const hLane = otherLanes[Math.floor(Math.random() * otherLanes.length)];
        hazardSlot.active = true;
        hazardSlot.lane = hLane;
        hazardSlot.z = -112 - (Math.random() < 0.5 ? 8 : 0);
        hazardSlot.group.position.set(LANE_X[hLane], 0, hazardSlot.z);
        hazardSlot.group.visible = true;
      }
    };

    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const finalizeRun = (outcome: 'victory' | 'gameover') => {
      setSyncedPhase(outcome);
      if (!scoreSubmittedRef.current) {
        scoreSubmittedRef.current = true;
        const finalScore = Math.round(sim.score);
        const cleared = sim.dispatches;
        const duration = Math.max(1, Math.round(sim.elapsedPlaying));
        void saveScoreCbRef.current(finalScore, cleared, duration);
      }
      setHud({
        score: Math.round(sim.score),
        combo: sim.combo,
        dispatches: sim.dispatches,
        shields: sim.shields,
        timeLeft: Math.max(0, Math.ceil(sim.timeLeft)),
        boostCharge: Math.round(sim.boostCharge),
        isBoosting: false,
      });
    };

    const tick = () => {
      if (disposed) return;
      const rawDt = clock.getDelta();
      const dt = Math.min(rawDt, 0.05);
      const elapsed = clock.getElapsedTime();

      if (resetRequestedRef.current) {
        resetRequestedRef.current = false;
        resetSimulation();
      }

      const currentPhase = phaseRef.current;

      if (currentPhase === 'title') {
        // Live orbiting 3D showcase
        const orbitAngle = elapsed * 0.28;
        camera.position.set(
          Math.sin(orbitAngle) * 7.6,
          4.1 + Math.sin(elapsed * 0.6) * 0.35,
          2.2 + Math.cos(orbitAngle) * 7.8
        );
        camera.lookAt(0, 1.25, 1.8);
        vanGroup.position.set(0, Math.sin(elapsed * 2.2) * 0.03, 2.2);
        vanGroup.rotation.set(0, 0, 0);
        for (const w of vanWheels) w.rotation.x -= dt * 4.5;
      } else if (currentPhase === 'playing') {
        if (sim.hitstopTimer > 0) {
          sim.hitstopTimer = Math.max(0, sim.hitstopTimer - dt);
        } else {
          // Handle boost activation
          if (boostRequestedRef.current) {
            boostRequestedRef.current = false;
            if (sim.boostCharge >= 35 && sim.boostTimer <= 0) {
              sim.boostTimer = 1.6;
              sim.boostCharge = Math.max(0, sim.boostCharge - 45);
              if (!isMutedRef.current) sound.boost();
            }
          }

          if (sim.boostTimer > 0) {
            sim.boostTimer = Math.max(0, sim.boostTimer - dt);
          } else {
            sim.boostCharge = Math.min(100, sim.boostCharge + dt * 16);
          }

          if (sim.invulnTimer > 0) {
            sim.invulnTimer = Math.max(0, sim.invulnTimer - dt);
          }

          const isBoosting = sim.boostTimer > 0;
          const ramp = Math.min(14, sim.elapsedPlaying * 0.22);
          const targetSpeed = (23 + ramp) * (isBoosting ? 1.55 : 1.0);
          sim.worldSpeed = THREE.MathUtils.damp(sim.worldSpeed, targetSpeed, 6, dt);

          // Countdown timer & passive distance score
          sim.elapsedPlaying += dt;
          sim.timeLeft = Math.max(0, sim.timeLeft - dt);
          sim.score += dt * (isBoosting ? 24 : 12);

          // Steer van smoothly toward target lane
          const desiredX = LANE_X[targetLaneRef.current];
          const prevX = sim.vanX;
          sim.vanX = THREE.MathUtils.damp(sim.vanX, desiredX, 13, dt);
          const lateralVel = (sim.vanX - prevX) / Math.max(dt, 0.001);
          sim.vanRoll = THREE.MathUtils.damp(
            sim.vanRoll,
            THREE.MathUtils.clamp(-lateralVel * 0.018, -0.22, 0.22),
            12,
            dt
          );
          vanGroup.position.set(sim.vanX, 0, 2.2);
          vanGroup.rotation.z = sim.vanRoll;
          vanGroup.rotation.y = sim.vanRoll * 0.45;
          vanGroup.visible = sim.invulnTimer <= 0 || Math.floor(elapsed * 16) % 2 === 0;

          for (const w of vanWheels) {
            w.rotation.x -= dt * sim.worldSpeed * 0.72;
          }

          const glowMat = boostGlow.material as THREE.MeshStandardMaterial;
          glowMat.emissiveIntensity = isBoosting ? 3.2 : 0.7;

          // Scroll road corridor
          for (const seg of roadSegments) {
            seg.position.z += sim.worldSpeed * dt;
            if (seg.position.z > 40) {
              seg.position.z -= ROAD_SEGMENT_LEN * ROAD_SEGMENT_COUNT;
            }
          }

          // Spawn beacons & traffic obstacles
          sim.spawnCooldown -= dt;
          if (sim.spawnCooldown <= 0) {
            spawnWave();
            sim.spawnCooldown = Math.max(0.55, 1.15 - sim.elapsedPlaying * 0.006);
          }

          // Move entities & check collisions
          for (const ent of entityPool) {
            if (!ent.active) continue;
            const entSpeed =
              ent.kind === 'sedan' ? sim.worldSpeed * 0.72 : sim.worldSpeed;
            ent.z += entSpeed * dt;
            ent.group.position.z = ent.z;
            if (ent.spinner) {
              ent.spinner.rotation.y += dt * 2.8;
              ent.spinner.position.y = 1.05 + Math.sin(elapsed * 4 + ent.z) * 0.14;
            }

            // AABB / lane proximity check near van at z = 2.2
            const dz = Math.abs(ent.z - 2.2);
            const dx = Math.abs(LANE_X[ent.lane] - sim.vanX);
            if (dz < 1.95 && dx < 1.45) {
              if (ent.kind === 'beacon' || ent.kind === 'priority-beacon') {
                const isPriority = ent.kind === 'priority-beacon';
                const pts = (isPriority ? 250 : 100) * sim.combo;
                sim.score += pts;
                sim.dispatches += 1;
                sim.combo = Math.min(8, sim.combo + 1);
                sim.boostCharge = Math.min(100, sim.boostCharge + 14);
                spawnBurst(
                  LANE_X[ent.lane],
                  1.1,
                  ent.z,
                  isPriority ? 0xf59e0b : 0x10b981
                );
                if (!isMutedRef.current) sound.pickup(sim.combo, isPriority);
                ent.active = false;
                ent.group.visible = false;

                if (sim.dispatches >= TARGET_DISPATCHES) {
                  if (!isMutedRef.current) sound.victory();
                  finalizeRun('victory');
                }
              } else if (sim.invulnTimer <= 0 && !isBoosting) {
                sim.shields = Math.max(0, sim.shields - 1);
                sim.combo = 1;
                sim.invulnTimer = 1.5;
                sim.hitstopTimer = 0.075;
                sim.shakeTimer = 0.35;
                spawnBurst(sim.vanX, 1.0, 2.0, 0xef4444);
                if (!isMutedRef.current) sound.hit();
                ent.active = false;
                ent.group.visible = false;

                if (sim.shields <= 0) {
                  finalizeRun('gameover');
                }
              } else if (isBoosting) {
                // Boost slams safely through cones / clears path for bonus
                sim.score += 75;
                spawnBurst(LANE_X[ent.lane], 0.9, ent.z, 0x8b5cf6);
                ent.active = false;
                ent.group.visible = false;
              }
            }

            if (ent.z > 16) {
              ent.active = false;
              ent.group.visible = false;
            }
          }
        }

        // Camera follow with subtle FOV & impact shake
        let shakeX = 0;
        let shakeY = 0;
        if (sim.shakeTimer > 0) {
          sim.shakeTimer = Math.max(0, sim.shakeTimer - dt);
          const mag = sim.shakeTimer * 0.85;
          shakeX = Math.sin(elapsed * 55) * mag;
          shakeY = Math.cos(elapsed * 47) * mag * 0.6;
        }
        camera.position.x = THREE.MathUtils.damp(camera.position.x, sim.vanX * 0.45, 7, dt) + shakeX;
        camera.position.y = THREE.MathUtils.damp(camera.position.y, 5.85, 7, dt) + shakeY;
        camera.position.z = THREE.MathUtils.damp(
          camera.position.z,
          sim.boostTimer > 0 ? 12.6 : 11.4,
          6,
          dt
        );
        camera.lookAt(sim.vanX * 0.3, 1.35, -9);

        const targetFov = sim.boostTimer > 0 ? 64 : 56;
        if (Math.abs(camera.fov - targetFov) > 0.1) {
          camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 7, dt);
          camera.updateProjectionMatrix();
        }

        if (sim.timeLeft <= 0 && phaseRef.current === 'playing') {
          if (!isMutedRef.current) sound.victory();
          finalizeRun('victory');
        }

        sim.hudSyncAccum += dt;
        if (sim.hudSyncAccum >= 0.08 && phaseRef.current === 'playing') {
          sim.hudSyncAccum = 0;
          setHud({
            score: Math.round(sim.score),
            combo: sim.combo,
            dispatches: sim.dispatches,
            shields: sim.shields,
            timeLeft: Math.ceil(sim.timeLeft),
            boostCharge: Math.round(sim.boostCharge),
            isBoosting: sim.boostTimer > 0,
          });
        }
      }

      // Advance burst particles in any non-paused state
      if (currentPhase !== 'paused') {
        for (const p of particlePool) {
          if (!p.active) continue;
          p.life += dt;
          if (p.life >= p.maxLife) {
            p.active = false;
            p.mesh.visible = false;
            continue;
          }
          p.vel.y -= 11 * dt;
          p.mesh.position.addScaledVector(p.vel, dt);
          const t = 1 - p.life / p.maxLife;
          p.mesh.scale.setScalar(Math.max(0.1, t));
          (p.mesh.material as THREE.MeshBasicMaterial).opacity = t;
        }
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || 560;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      sound.dispose();

      roadTex.dispose();
      sidewalkTex.dispose();
      shadowTex.dispose();
      envTarget.dispose();

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.InstancedMesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });

      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [setSyncedPhase]);

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] min-h-[580px] overflow-hidden bg-[#eae3ff] select-none">
      {/* Isolated WebGL Canvas Container */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      {/* Minimal Top-Left Live HUD Strip (Active Gameplay) */}
      {phase !== 'title' && (
        <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2.5 pointer-events-none">
          <div className="rounded-xl bg-[#ffffff]/92 border border-[#6c3bff]/18 px-3.5 py-2 shadow-sm flex items-center gap-4 text-xs">
            <div>
              <span className="text-[#6e6a82] font-semibold">Score </span>
              <span className="font-extrabold text-[#1d192a] tabular-nums text-sm">
                {hud.score.toLocaleString('en-US')}
              </span>
            </div>
            <span className="text-[#cac3d9]">·</span>
            <div>
              <span className="text-[#6e6a82] font-semibold">Dispatches </span>
              <span className="font-extrabold text-[#5308e7] tabular-nums text-sm">
                {hud.dispatches}/{TARGET_DISPATCHES}
              </span>
            </div>
            <span className="text-[#cac3d9]">·</span>
            <div>
              <span className="text-[#6e6a82] font-semibold">Combo </span>
              <span className="font-extrabold text-[#005b3d] tabular-nums text-sm">
                {hud.combo}x
              </span>
            </div>
            <span className="text-[#cac3d9]">·</span>
            <div className="inline-flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-[#6c3bff]" />
              <span className="font-extrabold text-[#1d192a] tabular-nums">{hud.shields}</span>
            </div>
            <span className="text-[#cac3d9]">·</span>
            <span className="font-mono font-bold text-[#1d192a] tabular-nums">
              {hud.timeLeft}s
            </span>
          </div>
        </div>
      )}

      {/* Title Screen Overlay over Live 3D Orbiting Van Scene */}
      {phase === 'title' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-[#191526]/28">
          <div className="w-full max-w-lg rounded-3xl bg-white border border-[#6c3bff]/18 p-7 sm:p-8 shadow-2xl text-center space-y-6">
            {/* Bespoke Inline SVG Title Lockup */}
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#8b5cf6] to-[#5308e7] flex items-center justify-center shadow-lg shadow-[#6c3bff]/25">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M3 14h4l2.2-6 3.6 10 2.4-4H21"
                    stroke="#ffffff"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold tracking-[0.06em] uppercase text-[#5308e7]">
                  PulsePro 3D Interactive Arena
                </p>
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-[-0.03em] text-[#1d192a]">
                  Bay Area Dispatch Run
                </h1>
              </div>
              <p className="text-sm text-[#484456] max-w-md leading-relaxed">
                Pilot the PulsePro mobile service van through San Francisco corridors. Collect{' '}
                {TARGET_DISPATCHES} priority dispatch beacons before traffic slows your route.
              </p>
            </div>

            {topScores.length > 0 && (
              <div className="rounded-2xl bg-[#f8f1ff] border border-[#6c3bff]/12 p-4 text-left space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-[#5308e7]">
                  <span className="inline-flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-[#f59e0b]" />
                    Your Top Dispatch Runs
                  </span>
                  <span className="text-[#6e6a82] font-mono">Saved</span>
                </div>
                <div className="space-y-1">
                  {topScores.slice(0, 3).map((entry, idx) => (
                    <div
                      key={String(entry.id)}
                      className="flex items-center justify-between text-xs text-[#1d192a] tabular-nums"
                    >
                      <span className="font-semibold">
                        #{idx + 1} · {entry.dispatchesCleared} beacons
                      </span>
                      <span className="font-mono font-bold text-[#5308e7]">
                        {entry.score.toLocaleString('en-US')} pts
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                onClick={handleStartRun}
                className="w-full sm:flex-1 h-12 rounded-xl bg-gradient-to-r from-[#8b5cf6] to-[#6c3bff] hover:from-[#7c3aed] hover:to-[#5308e7] text-white text-sm font-bold shadow-md shadow-[#6c3bff]/25 inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                Start Dispatch Run
              </button>
              <button
                type="button"
                onClick={onExitToMarketplace}
                className="w-full sm:w-auto h-12 px-5 rounded-xl bg-white border border-[#6c3bff]/18 text-[#484456] hover:text-[#1d192a] text-sm font-semibold cursor-pointer"
              >
                Back to Marketplace
              </button>
            </div>

            <p className="text-xs font-medium text-[#6e6a82]">
              A/D or ←/→ Steer · Space Boost · Esc Pause · H Toggle Dock
            </p>
          </div>
        </div>
      )}

      {/* Pause Modal */}
      {phase === 'paused' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-[#191526]/45">
          <div className="w-full max-w-sm rounded-3xl bg-white border border-[#6c3bff]/18 p-7 shadow-2xl text-center space-y-5">
            <h2 className="text-2xl font-extrabold text-[#1d192a]">Dispatch Paused</h2>
            <p className="text-sm text-[#484456] tabular-nums">
              Score {hud.score.toLocaleString('en-US')} · {hud.dispatches}/{TARGET_DISPATCHES} beacons
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleTogglePause}
                className="h-11 rounded-xl bg-gradient-to-r from-[#8b5cf6] to-[#6c3bff] text-white text-sm font-bold cursor-pointer"
              >
                Resume Run
              </button>
              <button
                type="button"
                onClick={handleStartRun}
                className="h-11 rounded-xl bg-white border border-[#6c3bff]/18 text-[#5308e7] text-sm font-semibold cursor-pointer"
              >
                Restart Run
              </button>
              <button
                type="button"
                onClick={() => setSyncedPhase('title')}
                className="h-11 rounded-xl text-[#6e6a82] hover:text-[#1d192a] text-sm font-semibold cursor-pointer"
              >
                Return to Title
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Victory / Game Over Modal */}
      {(phase === 'victory' || phase === 'gameover') && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-[#191526]/45">
          <div className="w-full max-w-md rounded-3xl bg-white border border-[#6c3bff]/18 p-7 shadow-2xl text-center space-y-5">
            <div
              className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center ${
                phase === 'victory'
                  ? 'bg-[#10b981]/15 text-[#005b3d]'
                  : 'bg-[#ef4444]/12 text-[#ba1a1a]'
              }`}
            >
              {phase === 'victory' ? (
                <Trophy className="w-7 h-7" />
              ) : (
                <Shield className="w-7 h-7" />
              )}
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl font-extrabold text-[#1d192a]">
                {phase === 'victory' ? 'Route Shift Cleared!' : 'Service Van Disabled'}
              </h2>
              <p className="text-sm text-[#484456]">
                {phase === 'victory'
                  ? 'Every neighborhood priority dispatch reached on time.'
                  : 'Traffic impacts depleted van shields before shift completion.'}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 rounded-2xl bg-[#f8f1ff] p-4 text-center tabular-nums">
              <div>
                <p className="text-[11px] font-semibold text-[#6e6a82]">Final Score</p>
                <p className="text-lg font-extrabold text-[#5308e7]">
                  {hud.score.toLocaleString('en-US')}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#6e6a82]">Dispatches</p>
                <p className="text-lg font-extrabold text-[#1d192a]">
                  {hud.dispatches}/{TARGET_DISPATCHES}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#6e6a82]">Time Left</p>
                <p className="text-lg font-extrabold text-[#1d192a]">{hud.timeLeft}s</p>
              </div>
            </div>

            {!isAuthenticated && (
              <button
                type="button"
                onClick={onSignInPrompt}
                className="w-full h-10 rounded-xl bg-[#f2eaff] hover:bg-[#e7dff7] text-[#5308e7] text-xs font-bold cursor-pointer"
              >
                Sign in with Google to save scores across sessions
              </button>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleStartRun}
                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-[#8b5cf6] to-[#6c3bff] text-white text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Play Again
              </button>
              <button
                type="button"
                onClick={onExitToMarketplace}
                className="h-11 px-4 rounded-xl bg-white border border-[#6c3bff]/18 text-[#484456] text-sm font-semibold cursor-pointer"
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Collapsible Unified Bottom Control Dock (Zero backdrop-filter over WebGL) */}
      {phase !== 'title' && (
        <div
          className="absolute bottom-20 md:bottom-5 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center transition-transform duration-200"
          style={{
            maxWidth: 'min(940px, 94vw)',
            transform: dockCollapsed
              ? 'translate(-50%, calc(100% - 34px))'
              : 'translate(-50%, 0)',
          }}
        >
          <button
            type="button"
            onClick={() => setDockCollapsed((prev) => !prev)}
            className="h-8 px-3.5 rounded-t-xl bg-white border border-b-0 border-[#6c3bff]/18 text-xs font-semibold text-[#5308e7] inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            {dockCollapsed ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                Show Controls (H)
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                Hide Controls (H)
              </>
            )}
          </button>

          <div className="rounded-2xl bg-[#ffffff]/96 border border-[#6c3bff]/18 px-3.5 py-2.5 shadow-lg flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={handleSteerLeft}
              className="h-10 px-4 rounded-xl bg-[#f2eaff] hover:bg-[#e7dff7] text-[#1d192a] text-xs font-bold cursor-pointer"
            >
              ← Lane Left
            </button>
            <button
              type="button"
              onClick={handleSteerRight}
              className="h-10 px-4 rounded-xl bg-[#f2eaff] hover:bg-[#e7dff7] text-[#1d192a] text-xs font-bold cursor-pointer"
            >
              Lane Right →
            </button>

            <button
              type="button"
              onClick={handleBoost}
              disabled={hud.boostCharge < 35 || hud.isBoosting}
              className={`h-10 px-4 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                hud.isBoosting
                  ? 'bg-[#10b981] text-white'
                  : hud.boostCharge >= 35
                    ? 'bg-[#6c3bff] hover:bg-[#5308e7] text-white'
                    : 'bg-[#e7dff7] text-[#6e6a82] cursor-not-allowed'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              {hud.isBoosting ? 'Boosting!' : `Boost (${hud.boostCharge}%)`}
            </button>

            <button
              type="button"
              onClick={() => setIsMuted((m) => !m)}
              aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
              className="h-10 px-3 rounded-xl bg-white border border-[#6c3bff]/16 text-[#484456] hover:text-[#1d192a] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              {isMuted ? 'Muted' : 'Sound'}
            </button>

            <button
              type="button"
              onClick={handleTogglePause}
              className="h-10 px-3 rounded-xl bg-white border border-[#6c3bff]/16 text-[#5308e7] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Pause className="w-4 h-4" />
              Pause
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
