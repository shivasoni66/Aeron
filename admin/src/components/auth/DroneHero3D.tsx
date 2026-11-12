import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface DroneHero3DProps {
  className?: string;
  onLoaded?: () => void;
  onError?: () => void;
}

export const DroneHero3D: React.FC<DroneHero3DProps> = ({
  className = '',
  onLoaded,
  onError
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const [hasWebGlError, setHasWebGlError] = useState(false);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Check prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Scene
    const scene = new THREE.Scene();

    // Camera: Telephoto low FOV (28 deg) from isometric perspective matching reference video
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;
    const camera = new THREE.PerspectiveCamera(28, width / height, 0.1, 100);
    // Reference video view: camera is looking from front-left slightly above, angled towards center
    camera.position.set(-2.6, 2.2, 7.4);
    camera.lookAt(0, -0.05, 0);

    // Renderer with transparent background and high performance antialiasing
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance'
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;
    } catch (e) {
      console.warn('WebGL initialization failed, falling back to 2D master asset:', e);
      setHasWebGlError(true);
      if (onError) onError();
      return;
    }

    // --- PROCEDURAL TEXTURES ---
    // 1. Carbon fiber micro-weave bump map
    const createCarbonTexture = () => {
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 128;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#222';
      ctx.fillRect(0, 0, 128, 128);
      const step = 8;
      for (let x = 0; x < 128; x += step) {
        for (let y = 0; y < 128; y += step) {
          const isCheck = ((x / step) % 2 === 0) !== ((y / step) % 2 === 0);
          ctx.fillStyle = isCheck ? '#444' : '#111';
          ctx.fillRect(x, y, step, step);
          ctx.fillStyle = 'rgba(255,255,255,0.08)';
          ctx.fillRect(x, y, step, 1);
        }
      }
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(16, 16);
      return tex;
    };
    const carbonTex = createCarbonTexture();

    // 2. High-speed propeller motion blur disc texture (radial gradient with electric-lime tip)
    const createPropBlurTexture = () => {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 256;
      const ctx = c.getContext('2d')!;
      const r = 128;
      const grad = ctx.createRadialGradient(r, r, 10, r, r, r);
      grad.addColorStop(0, 'rgba(191, 244, 46, 0.0)');
      grad.addColorStop(0.2, 'rgba(215, 235, 225, 0.08)');
      grad.addColorStop(0.55, 'rgba(235, 248, 240, 0.14)');
      grad.addColorStop(0.85, 'rgba(191, 244, 46, 0.22)');
      grad.addColorStop(0.96, 'rgba(191, 244, 46, 0.45)');
      grad.addColorStop(1.0, 'rgba(191, 244, 46, 0.0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(r, r, r, 0, Math.PI * 2);
      ctx.fill();
      const tex = new THREE.CanvasTexture(c);
      return tex;
    };
    const propBlurTex = createPropBlurTexture();

    // --- MATERIALS ---
    const carbonMat = new THREE.MeshStandardMaterial({
      color: 0x161a18,
      roughness: 0.35,
      metalness: 0.8,
      bumpMap: carbonTex,
      bumpScale: 0.015
    });

    const stealthMat = new THREE.MeshStandardMaterial({
      color: 0x0f1311,
      roughness: 0.22,
      metalness: 0.88
    });

    const titaniumMat = new THREE.MeshStandardMaterial({
      color: 0x3d4742,
      roughness: 0.25,
      metalness: 0.94
    });

    const silverMetalMat = new THREE.MeshStandardMaterial({
      color: 0x8a9990,
      roughness: 0.15,
      metalness: 0.98
    });

    const lensGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0x061118,
      roughness: 0.04,
      metalness: 0.92,
      transmission: 0.45,
      ior: 1.55,
      reflectivity: 0.88
    });

    const greenLedMat = new THREE.MeshBasicMaterial({
      color: 0xbff42e
    });

    const cyanLedMat = new THREE.MeshBasicMaterial({
      color: 0x35c6d8
    });

    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0x181c1a,
      roughness: 0.3,
      metalness: 0.75
    });

    const propBlurMat = new THREE.MeshBasicMaterial({
      map: propBlurTex,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    // --- LIGHTING RIG ---
    // Key Light: crisp upper-left aerospace spotlight
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
    keyLight.position.set(-3.5, 4.5, 3.5);
    scene.add(keyLight);

    // Rim Light: electric-lime / cool edge light highlighting upper silhouette
    const rimLight = new THREE.DirectionalLight(0xbff42e, 1.4);
    rimLight.position.set(1.5, 3.5, -4.0);
    scene.add(rimLight);

    // Fill Light: deep forest green bounce from below-right
    const fillLight = new THREE.DirectionalLight(0x1a2e22, 1.1);
    fillLight.position.set(4.0, -2.5, -1.0);
    scene.add(fillLight);

    // Ambient aerospace radiance
    const ambLight = new THREE.AmbientLight(0x0c1410, 0.85);
    scene.add(ambLight);

    // --- AIRCRAFT ROOT GROUP ---
    const droneRoot = new THREE.Group();
    // Reference orientation: pitched forward ~10 deg, banked ~14 deg, yawed ~30 deg
    droneRoot.rotation.x = 0.18;
    droneRoot.rotation.y = 0.52;
    droneRoot.rotation.z = -0.14;
    scene.add(droneRoot);

    // 1. FUSELAGE ASSEMBLY
    const fuselageGroup = new THREE.Group();
    droneRoot.add(fuselageGroup);

    // 1a. Central stealth contoured hull
    const hullGeo = new THREE.CylinderGeometry(0.38, 0.48, 1.6, 6);
    hullGeo.scale(1.15, 1.0, 0.38);
    hullGeo.rotateX(Math.PI / 2);
    const hullMesh = new THREE.Mesh(hullGeo, carbonMat);
    fuselageGroup.add(hullMesh);

    // 1b. Stealth upper canopy spine
    const spineGeo = new THREE.CylinderGeometry(0.18, 0.28, 1.3, 5);
    spineGeo.scale(1.1, 1.0, 0.35);
    spineGeo.rotateX(Math.PI / 2);
    const spineMesh = new THREE.Mesh(spineGeo, stealthMat);
    spineMesh.position.set(0, 0.16, -0.05);
    fuselageGroup.add(spineMesh);

    // 1c. Lower battery & avionics bay tray
    const trayGeo = new THREE.BoxGeometry(0.65, 0.2, 1.1);
    const trayMesh = new THREE.Mesh(trayGeo, titaniumMat);
    trayMesh.position.set(0, -0.14, 0);
    fuselageGroup.add(trayMesh);

    // 1d. Avionics cooling vents (silver fins)
    for (let f = -2; f <= 2; f++) {
      const finGeo = new THREE.BoxGeometry(0.42, 0.02, 0.04);
      const finMesh = new THREE.Mesh(finGeo, silverMetalMat);
      finMesh.position.set(0, 0.24, f * 0.12);
      fuselageGroup.add(finMesh);
    }

    // 1e. GPS Puck / Satcom Antenna on rear top deck
    const gpsPuckGeo = new THREE.CylinderGeometry(0.11, 0.13, 0.06, 16);
    const gpsPuckMesh = new THREE.Mesh(gpsPuckGeo, stealthMat);
    gpsPuckMesh.position.set(0, 0.25, -0.45);
    fuselageGroup.add(gpsPuckMesh);

    // 2. FORWARD 3-AXIS GIMBAL & OPTICAL TURRET
    const gimbalGroup = new THREE.Group();
    gimbalGroup.position.set(0, -0.15, 0.88);
    fuselageGroup.add(gimbalGroup);

    // Mount bracket
    const mountGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.1, 12);
    const mountMesh = new THREE.Mesh(mountGeo, titaniumMat);
    gimbalGroup.add(mountMesh);

    // Pitch yoke
    const yokeGeo = new THREE.TorusGeometry(0.16, 0.035, 8, 16, Math.PI);
    yokeGeo.rotateZ(Math.PI);
    const yokeMesh = new THREE.Mesh(yokeGeo, titaniumMat);
    yokeMesh.position.set(0, -0.06, 0);
    gimbalGroup.add(yokeMesh);

    // Camera sphere
    const camGeo = new THREE.SphereGeometry(0.14, 16, 16);
    const camMesh = new THREE.Mesh(camGeo, stealthMat);
    camMesh.position.set(0, -0.12, 0.04);
    gimbalGroup.add(camMesh);

    // Primary optical sensor lens
    const lensGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.05, 16);
    lensGeo.rotateX(Math.PI / 2);
    const lensMesh = new THREE.Mesh(lensGeo, lensGlassMat);
    lensMesh.position.set(0, -0.12, 0.17);
    gimbalGroup.add(lensMesh);

    // Micro green targeting indicator LED
    const laserGeo = new THREE.SphereGeometry(0.016, 8, 8);
    const laserMesh = new THREE.Mesh(laserGeo, greenLedMat);
    laserMesh.position.set(0.06, -0.15, 0.16);
    gimbalGroup.add(laserMesh);

    // 3. MOTOR ARMS & BRUSHLESS POWERPLANTS
    // Calibrated 4-rotor positions matching the isometric perspective of reference:
    // BL: Front-Left (x: -1.45, y: -0.15, z: 1.15)
    // TL: Rear-Left  (x: -1.35, y: 0.12, z: -1.15)
    // TR: Rear-Right (x: 1.35,  y: 0.12, z: -1.15)
    // BR: Front-Right(x: 1.45,  y: -0.15, z: 1.15)
    interface MotorSpec {
      id: string;
      x: number;
      y: number;
      z: number;
      dir: number; // 1: CW, -1: CCW
      isForward: boolean;
      isPort: boolean;
    }
    const MOTOR_SPECS: MotorSpec[] = [
      { id: 'BL', x: -1.48, y: -0.12, z: 1.18, dir: 1, isForward: true, isPort: true },
      { id: 'TL', x: -1.38, y: 0.14, z: -1.18, dir: -1, isForward: false, isPort: true },
      { id: 'TR', x: 1.38, y: 0.14, z: -1.18, dir: 1, isForward: false, isPort: false },
      { id: 'BR', x: 1.48, y: -0.12, z: 1.18, dir: -1, isForward: true, isPort: false }
    ];

    const rotorAnimGroups: { group: THREE.Group; dir: number }[] = [];

    MOTOR_SPECS.forEach((m) => {
      // 3a. Carbon Tubular Arm extending from fuselage to motor
      const armVec = new THREE.Vector3(m.x, m.y, m.z);
      const startVec = new THREE.Vector3(m.x * 0.22, m.y * 0.3, m.z * 0.22);
      const armLength = startVec.distanceTo(armVec);

      const armGeo = new THREE.CylinderGeometry(0.052, 0.058, armLength, 12);
      const armMesh = new THREE.Mesh(armGeo, carbonMat);

      // Position & orient arm along vector
      const midPoint = new THREE.Vector3().addVectors(startVec, armVec).multiplyScalar(0.5);
      armMesh.position.copy(midPoint);
      armMesh.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        armVec.clone().sub(startVec).normalize()
      );
      fuselageGroup.add(armMesh);

      // Titanium root bracket at fuselage joint
      const bracketGeo = new THREE.BoxGeometry(0.18, 0.16, 0.22);
      const bracketMesh = new THREE.Mesh(bracketGeo, titaniumMat);
      bracketMesh.position.copy(startVec);
      fuselageGroup.add(bracketMesh);

      // 3b. Motor Pod Assembly
      const motorPod = new THREE.Group();
      motorPod.position.set(m.x, m.y, m.z);
      fuselageGroup.add(motorPod);

      // Motor Base Mount Plate
      const basePlateGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.05, 16);
      const basePlateMesh = new THREE.Mesh(basePlateGeo, titaniumMat);
      motorPod.add(basePlateMesh);

      // Motor Bell Stator (black anodized)
      const motorBellGeo = new THREE.CylinderGeometry(0.155, 0.155, 0.14, 20);
      const motorBellMesh = new THREE.Mesh(motorBellGeo, stealthMat);
      motorBellMesh.position.y = 0.09;
      motorPod.add(motorBellMesh);

      // Machined Silver Cooling Chamfer Rings
      const chamferGeo = new THREE.CylinderGeometry(0.158, 0.158, 0.03, 20);
      const chamferMesh = new THREE.Mesh(chamferGeo, silverMetalMat);
      chamferMesh.position.y = 0.16;
      motorPod.add(chamferMesh);

      // Central Propeller Nut / Spinner
      const propNutGeo = new THREE.ConeGeometry(0.065, 0.1, 16);
      const propNutMesh = new THREE.Mesh(propNutGeo, titaniumMat);
      propNutMesh.position.y = 0.23;
      motorPod.add(propNutMesh);

      // Landing Gear Strut under motor pod
      const skidGeo = new THREE.CylinderGeometry(0.024, 0.02, 0.32, 8);
      const skidMesh = new THREE.Mesh(skidGeo, carbonMat);
      skidMesh.position.set(0, -0.17, 0);
      skidMesh.rotation.z = m.isPort ? 0.2 : -0.2;
      motorPod.add(skidMesh);

      // Tactical Navigation LED Beacon on outer motor edge
      const ledGeo = new THREE.SphereGeometry(0.032, 10, 10);
      const ledMat = m.isForward ? greenLedMat : (m.isPort ? cyanLedMat : greenLedMat);
      const ledMesh = new THREE.Mesh(ledGeo, ledMat);
      ledMesh.position.set(m.isPort ? -0.18 : 0.18, 0.05, 0);
      motorPod.add(ledMesh);

      // Localized point light on forward electric-lime LEDs
      if (m.isForward) {
        const ledLight = new THREE.PointLight(0xbff42e, 0.8, 1.8);
        ledLight.position.set(m.isPort ? -0.25 : 0.25, 0.1, 0);
        motorPod.add(ledLight);
      }

      // 3c. Propeller Blades & High-Speed Motion Blur Disc
      const rotorGroup = new THREE.Group();
      rotorGroup.position.y = 0.19;
      motorPod.add(rotorGroup);
      rotorAnimGroups.push({ group: rotorGroup, dir: m.dir });

      // 3 Carbon Fiber Propeller Blades
      const bladeRadius = 0.82;
      const bladeCount = 3;
      for (let b = 0; b < bladeCount; b++) {
        const bladeAngle = (b * Math.PI * 2) / bladeCount;
        const bladeWing = new THREE.Group();
        bladeWing.rotation.y = bladeAngle;

        // Aerodynamic tapered blade geometry
        const bladeGeo = new THREE.BoxGeometry(bladeRadius * 0.9, 0.012, 0.075);
        bladeGeo.translate(bladeRadius * 0.45, 0, 0);
        const bladeMesh = new THREE.Mesh(bladeGeo, bladeMat);
        bladeWing.add(bladeMesh);

        // Electric-lime tip highlight
        const tipGeo = new THREE.BoxGeometry(bladeRadius * 0.12, 0.014, 0.076);
        tipGeo.translate(bladeRadius * 0.88, 0, 0);
        const tipMesh = new THREE.Mesh(tipGeo, greenLedMat);
        bladeWing.add(tipMesh);

        rotorGroup.add(bladeWing);
      }

      // High-speed semi-transparent aerodynamic rotation blur disc
      const blurDiscGeo = new THREE.PlaneGeometry(bladeRadius * 2.1, bladeRadius * 2.1);
      blurDiscGeo.rotateX(-Math.PI / 2);
      const blurDiscMesh = new THREE.Mesh(blurDiscGeo, propBlurMat);
      blurDiscMesh.position.y = 0.01;
      motorPod.add(blurDiscMesh);
    });

    // Notify loaded
    if (onLoaded) {
      onLoaded();
    }

    // --- ANIMATION & RESIZE OBSERVER ---
    let isRunning = true;
    let clock = new THREE.Clock();

    const render = () => {
      if (!isRunning) return;

      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsedTime = clock.getElapsedTime();

      // Contra-rotating high-RPM propellers
      if (!prefersReducedMotion) {
        const rpmSpeed = 38.0; // Dynamic high-RPM visual spin
        rotorAnimGroups.forEach(({ group, dir }) => {
          group.rotation.y += dir * rpmSpeed * delta;
        });

        // Subtle realistic flight deck micro-hover physics
        // Natural attitude dampening and gentle floating
        droneRoot.position.y = Math.sin(elapsedTime * 1.4) * 0.038;
        droneRoot.position.x = Math.cos(elapsedTime * 0.9) * 0.016;
        droneRoot.rotation.z = -0.14 + Math.sin(elapsedTime * 1.1) * 0.012;
        droneRoot.rotation.x = 0.18 + Math.cos(elapsedTime * 1.3) * 0.008;
      }

      renderer.render(scene, camera);
      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    // Responsive Canvas Resize
    const handleResize = () => {
      if (!container || !renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(container);

    // Visibility throttle: pause render loop when browser tab is hidden
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      } else {
        clock.getDelta(); // reset delta
        animFrameRef.current = requestAnimationFrame(render);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // CLEANUP
    return () => {
      isRunning = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      resizeObserver.disconnect();

      // Dispose geometries & materials
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else if (obj.material) {
            obj.material.dispose();
          }
        }
      });
      carbonTex.dispose();
      propBlurTex.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [onLoaded]);

  if (hasWebGlError) {
    return null;
  }

  return (
    <div
      ref={mountRef}
      className={`relative w-full h-full pointer-events-none ${className}`}
      aria-label="AERON 3D Quadcopter Aircraft Render"
    />
  );
};
