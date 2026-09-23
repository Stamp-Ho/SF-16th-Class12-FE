// components/DiceArena.tsx
'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import {
  createHighQualityDiceTemplate,
  getPreciseDiceScore,
  DiceTemplate,
} from '../utils/diceFactory';
import { generateBoardTiles, createTileTexture, BoardTile } from '../utils/board';

interface DiceItem {
  mesh: THREE.Group;
  body: CANNON.Body;
  isSleeping: boolean;
  lastValue: number;
}

export default function DiceArena() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 보드 규격 설정 (M x N)
  const [boardSize] = useState<{ rows: number; cols: number }>({ rows: 6, cols: 8 });

  // 상태 관리
  const [diceCount, setDiceCount] = useState<number>(2);
  const [scores, setScores] = useState<number[]>([]);
  const [viewMode, setViewMode] = useState<'2.5d' | 'top'>('2.5d');
  const [isRolling, setIsRolling] = useState<boolean>(false);
  const [playerTileIndex, setPlayerTileIndex] = useState<number>(0);
  const [isMovingPawn, setIsMovingPawn] = useState<boolean>(false);

  // 3D & 런타임 Refs
  const runtimeRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    world: CANNON.World;
    diceList: DiceItem[];
    diceTemplate: DiceTemplate;
    boardTiles: BoardTile[];
    pawnMesh: THREE.Group;
    tileMeshGroup: THREE.Group;
    reqId: number | null;
    orbit: {
      isDragging: boolean;
      prevX: number;
      prevY: number;
      theta: number;
      phi: number;
      radius: number;
      targetTheta: number;
      targetPhi: number;
      targetRadius: number;
    };
  } | null>(null);

  // 말(Pawn)의 칸별 이동 애니메이션
  const movePawnSteps = useCallback((steps: number) => {
    if (!runtimeRef.current) return;
    const { pawnMesh, boardTiles } = runtimeRef.current;
    if (!boardTiles.length) return;

    setIsMovingPawn(true);

    let currentStep = 0;
    setPlayerTileIndex((prevIndex) => {
      let targetIdx = prevIndex;

      const stepInterval = setInterval(() => {
        currentStep++;
        targetIdx = (targetIdx + 1) % boardTiles.length;
        setPlayerTileIndex(targetIdx);

        const targetTile = boardTiles[targetIdx];
        const startPos = pawnMesh.position.clone();
        const endPos = new THREE.Vector3(targetTile.x, 1.2, targetTile.z);

        // 부드러운 호를 그리며 다음 타일로 점프
        let progress = 0;
        const jumpAnim = () => {
          progress += 0.12;
          if (progress <= 1) {
            pawnMesh.position.lerpVectors(startPos, endPos, progress);
            pawnMesh.position.y = 1.2 + Math.sin(progress * Math.PI) * 1.0;
            requestAnimationFrame(jumpAnim);
          } else {
            pawnMesh.position.copy(endPos);
          }
        };
        jumpAnim();

        if (currentStep >= steps) {
          clearInterval(stepInterval);
          setIsMovingPawn(false);
        }
      }, 280);

      return prevIndex;
    });
  }, []);

  // 주사위 굴리기
  const rollDice = useCallback(() => {
    if (!runtimeRef.current || isMovingPawn) return;
    const { diceList, orbit } = runtimeRef.current;

    setIsRolling(true);
    setScores([]);

    const forwardX = -Math.sin(orbit.theta);
    const forwardZ = -Math.cos(orbit.theta);

    diceList.forEach((dice, idx) => {
      dice.body.wakeUp();
      dice.isSleeping = false;

      // 중앙 주사위 링 구역으로 드롭
      dice.body.position.set((Math.random() - 0.5) * 2, 6 + idx * 1.5, (Math.random() - 0.5) * 2);
      dice.body.velocity.setZero();
      dice.body.angularVelocity.setZero();

      dice.body.quaternion.setFromEuler(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      );

      const force = 5.5 + Math.random() * 4;
      dice.body.applyImpulse(
        new CANNON.Vec3(
          forwardX * force + (Math.random() - 0.5) * 3,
          -4 - Math.random() * 3,
          forwardZ * force + (Math.random() - 0.5) * 3
        ),
        new CANNON.Vec3((Math.random() - 0.5) * 0.3, 0.4, (Math.random() - 0.5) * 0.3)
      );

      dice.body.angularVelocity.set(
        (Math.random() - 0.5) * 25,
        (Math.random() - 0.5) * 25,
        (Math.random() - 0.5) * 25
      );
    });
  }, [isMovingPawn]);

  // 뷰 전환 (2.5D <-> 탑뷰)
  const switchView = (mode: '2.5d' | 'top') => {
    if (!runtimeRef.current) return;
    const { orbit } = runtimeRef.current;
    setViewMode(mode);

    if (mode === 'top') {
      orbit.targetPhi = 0.001;
      orbit.targetRadius = 32;
    } else {
      orbit.targetPhi = Math.PI / 3.4;
      orbit.targetRadius = 34;
    }
  };

  // 주사위 개수 변경
  const syncDiceCount = (count: number) => {
    if (!runtimeRef.current) return;
    const { scene, world, diceList, diceTemplate } = runtimeRef.current;

    while (diceList.length > count) {
      const removed = diceList.pop();
      if (removed) {
        scene.remove(removed.mesh);
        world.removeBody(removed.body);
      }
    }

    const boxShape = new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5));
    while (diceList.length < count) {
      const mesh = diceTemplate.group.clone(true);
      scene.add(mesh);

      const body = new CANNON.Body({
        mass: 1.0,
        shape: boxShape,
        sleepTimeLimit: 0.1,
        sleepSpeedLimit: 0.15,
      });

      body.position.set((Math.random() - 0.5) * 2, 5 + diceList.length * 1.2, (Math.random() - 0.5) * 2);
      world.addBody(body);

      diceList.push({
        mesh,
        body,
        isSleeping: false,
        lastValue: 1,
      });
    }

    setDiceCount(count);
    setTimeout(rollDice, 50);
  };

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090d16);

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 150);
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 조명
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
    dirLight.position.set(16, 30, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 70;
    dirLight.shadow.camera.left = -20;
    dirLight.shadow.camera.right = 20;
    dirLight.shadow.camera.top = 20;
    dirLight.shadow.camera.bottom = -20;
    scene.add(dirLight);

    // 2. 물리 세계
    const world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -42, 0),
      allowSleep: true,
    });
    world.defaultContactMaterial.friction = 0.4;
    world.defaultContactMaterial.restitution = 0.3;

    // 물리 바닥
    const floorBody = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Plane(),
    });
    floorBody.quaternion.setFromAxisAngle(new CANNON.Vec3(-1, 0, 0), Math.PI * 0.5);
    world.addBody(floorBody);

    // 3. M * N 주루마블 외곽 타일 빌드 부분
    const tileSize = 2.4;
    const boardTiles = generateBoardTiles(boardSize.rows, boardSize.cols, tileSize, 0.15);
    const tileMeshGroup = new THREE.Group();

    const boxGeo = new THREE.BoxGeometry(tileSize, 0.4, tileSize);

    boardTiles.forEach((tile) => {
    const topTexture = createTileTexture(tile.index, tile.isCorner);
    const sideMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });
    const topMat = new THREE.MeshStandardMaterial({ map: topTexture, roughness: 0.3 });

    // Material 순서: [right, left, top, bottom, front, back]
    const materials = [sideMat, sideMat, topMat, sideMat, sideMat, sideMat];
    const mesh = new THREE.Mesh(boxGeo, materials);
    mesh.position.set(tile.x, 0.2, tile.z);

    // ★ 핵심: 타일 상단이 중심을 향하도록 Y축 회전 적용
    mesh.rotation.y = tile.rotationY;

    mesh.receiveShadow = true;
    tileMeshGroup.add(mesh);
    });
    scene.add(tileMeshGroup);

    // 4. 중앙 주사위 투척 구역 (펠트 필드 + 반투명 아크릴 안전 가벽)
    const step = tileSize + 0.15;
    const innerW = (boardSize.cols - 2) * step;
    const innerH = (boardSize.rows - 2) * step;

    // 중앙 바닥 펠트
    const centerFloorGeo = new THREE.PlaneGeometry(innerW, innerH);
    const centerFloorMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.9,
    });
    const centerFloor = new THREE.Mesh(centerFloorGeo, centerFloorMat);
    centerFloor.rotation.x = -Math.PI / 2;
    centerFloor.position.y = 0.02;
    centerFloor.receiveShadow = true;
    scene.add(centerFloor);

    // 중앙 물리 가벽 4면 (주사위가 테두리 말이나 밖으로 튀는 것 방지)
    const wallHeight = 2.5;
    const wallThick = 0.4;
    const halfInnerW = innerW / 2;
    const halfInnerH = innerH / 2;

    const wallsData = [
      { x: 0, z: -halfInnerH, w: innerW, d: wallThick },
      { x: 0, z: halfInnerH, w: innerW, d: wallThick },
      { x: -halfInnerW, z: 0, w: wallThick, d: innerH },
      { x: halfInnerW, z: 0, w: wallThick, d: innerH },
    ];

    wallsData.forEach(({ x, z, w, d }) => {
      const wallBody = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: new CANNON.Box(new CANNON.Vec3(w / 2, wallHeight / 2, d / 2)),
      });
      wallBody.position.set(x, wallHeight / 2, z);
      world.addBody(wallBody);

      // 반투명 아크릴 시각 메시
      const wallGeo = new THREE.BoxGeometry(w, wallHeight, d);
      const wallMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.18,
        roughness: 0.1,
      });
      const wallMesh = new THREE.Mesh(wallGeo, wallMat);
      wallMesh.position.set(x, wallHeight / 2, z);
      scene.add(wallMesh);
    });

    // 5. 플레이어 3D 말 (Pawn) 생성
    const pawnMesh = new THREE.Group();
    const pawnBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.75, 0.3, 32),
      new THREE.MeshStandardMaterial({ color: 0xe11d48, metalness: 0.3, roughness: 0.2 })
    );
    const pawnBody = new THREE.Mesh(
      new THREE.ConeGeometry(0.55, 1.2, 32),
      new THREE.MeshStandardMaterial({ color: 0xf43f5e, metalness: 0.2, roughness: 0.3 })
    );
    pawnBody.position.y = 0.7;
    const pawnHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 32, 32),
      new THREE.MeshStandardMaterial({ color: 0xffe4e6, roughness: 0.1, metalness: 0.1 })
    );
    pawnHead.position.y = 1.45;

    pawnMesh.add(pawnBase, pawnBody, pawnHead);
    pawnMesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
      }
    });

    // 시작 타일 위치(0번)에 배치
    pawnMesh.position.set(boardTiles[0].x, 1.2, boardTiles[0].z);
    scene.add(pawnMesh);

    // 6. 주사위 템플릿 및 Orbit 상태 설정
    const diceTemplate = createHighQualityDiceTemplate();
    const orbitState = {
      isDragging: false,
      prevX: 0,
      prevY: 0,
      theta: Math.PI / 4,
      phi: Math.PI / 3.4,
      radius: 34,
      targetTheta: Math.PI / 4,
      targetPhi: Math.PI / 3.4,
      targetRadius: 34,
    };

    runtimeRef.current = {
      scene,
      camera,
      renderer,
      world,
      diceList: [],
      diceTemplate,
      boardTiles,
      pawnMesh,
      tileMeshGroup,
      reqId: null,
      orbit: orbitState,
    };

    syncDiceCount(2);

    // 7. 애니메이션 & 렌더 루프
    let lastCallTime = performance.now();
    let hasTriggeredMove = false;

    const animate = () => {
      const time = performance.now();
      const dt = (time - lastCallTime) / 1000;
      lastCallTime = time;

      world.step(1 / 60, dt, 3);

      // 카메라 Orbit Lerp 보간
      orbitState.theta += (orbitState.targetTheta - orbitState.theta) * 0.1;
      orbitState.phi += (orbitState.targetPhi - orbitState.phi) * 0.1;
      orbitState.radius += (orbitState.targetRadius - orbitState.radius) * 0.1;

      camera.position.x = orbitState.radius * Math.sin(orbitState.phi) * Math.sin(orbitState.theta);
      camera.position.y = orbitState.radius * Math.cos(orbitState.phi);
      camera.position.z = orbitState.radius * Math.sin(orbitState.phi) * Math.cos(orbitState.theta);
      camera.lookAt(0, 0, 0);

      // 주사위 물리 동기화 및 정지 판정
      let allSleeping = true;
      const currentValues: number[] = [];

      runtimeRef.current?.diceList.forEach((dice) => {
        dice.mesh.position.copy(dice.body.position as unknown as THREE.Vector3);
        dice.mesh.quaternion.copy(dice.body.quaternion as unknown as THREE.Quaternion);

        const v = dice.body.velocity.length();
        const av = dice.body.angularVelocity.length();

        if (v < 0.12 && av < 0.12) {
          dice.isSleeping = true;
          dice.lastValue = getPreciseDiceScore(dice.body);
        } else {
          allSleeping = false;
        }
        currentValues.push(dice.lastValue);
      });

      if (allSleeping && runtimeRef.current?.diceList.length) {
        setIsRolling(false);
        setScores(currentValues);

        // 주사위가 멈추었을 때 1회 말 이동 트리거
        if (!hasTriggeredMove) {
          hasTriggeredMove = true;
          const sum = currentValues.reduce((a, b) => a + b, 0);
          movePawnSteps(sum);
        }
      } else {
        hasTriggeredMove = false;
      }

      renderer.render(scene, camera);
      runtimeRef.current!.reqId = requestAnimationFrame(animate);
    };

    runtimeRef.current.reqId = requestAnimationFrame(animate);

    // 8. 이벤트 바인딩
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      orbitState.isDragging = true;
      orbitState.prevX = clientX;
      orbitState.prevY = clientY;
    };

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (!orbitState.isDragging) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      const deltaX = clientX - orbitState.prevX;
      const deltaY = clientY - orbitState.prevY;
      orbitState.prevX = clientX;
      orbitState.prevY = clientY;

      orbitState.targetTheta -= deltaX * 0.007;
      orbitState.targetPhi = Math.max(0.001, Math.min(Math.PI / 2.1, orbitState.targetPhi - deltaY * 0.007));
    };

    const handlePointerUp = () => {
      orbitState.isDragging = false;
    };

    const handleWheel = (e: WheelEvent) => {
      orbitState.targetRadius = Math.max(16, Math.min(55, orbitState.targetRadius + e.deltaY * 0.025));
    };

    const el = canvasRef.current;
    el.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    el.addEventListener('touchstart', handlePointerDown);
    window.addEventListener('touchmove', handlePointerMove);
    window.addEventListener('touchend', handlePointerUp);
    el.addEventListener('wheel', handleWheel, { passive: true });

    return () => {
      window.removeEventListener('resize', handleResize);
      el.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      el.removeEventListener('touchstart', handlePointerDown);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
      el.removeEventListener('wheel', handleWheel);

      if (runtimeRef.current?.reqId) {
        cancelAnimationFrame(runtimeRef.current.reqId);
      }
      diceTemplate.dispose();
      renderer.dispose();
    };
  }, [boardSize, movePawnSteps]);

  const totalScore = scores.reduce((acc, cur) => acc + cur, 0);
  const totalTilesCount = (boardSize.rows + boardSize.cols) * 2 - 4;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[700px] md:h-[840px] overflow-hidden rounded-3xl bg-slate-950 border border-slate-800 shadow-2xl select-none"
    >
      {/* 3D 뷰포트 */}
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-grab active:cursor-grabbing outline-none"
      />

      {/* 상단 컨트롤 툴바 */}
      <div className="absolute top-4 inset-x-4 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* 카메라 시점 토글 */}
        <div className="flex items-center bg-slate-900/80 backdrop-blur-md border border-slate-700/60 rounded-xl p-1 pointer-events-auto shadow-lg">
          <button
            type="button"
            onClick={() => switchView('2.5d')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === '2.5d'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            2.5D 쿼터뷰
          </button>
          <button
            type="button"
            onClick={() => switchView('top')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'top'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            탑뷰 (Top)
          </button>
        </div>

        {/* 주사위 개수 & 보드 규격 안내 */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/60 rounded-xl px-3 py-1.5 text-xs text-slate-300 shadow-lg">
            보드 규격: <span className="font-bold text-sky-400">{boardSize.rows} × {boardSize.cols}</span> (총 {totalTilesCount}칸)
          </div>
          <div className="flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md border border-slate-700/60 rounded-xl p-1 shadow-lg">
            <span className="text-[11px] font-medium text-slate-400 px-2">주사위</span>
            {[1, 2].map((cnt) => (
              <button
                key={cnt}
                type="button"
                onClick={() => syncDiceCount(cnt)}
                className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                  diceCount === cnt
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {cnt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 하단 점수 & 말 위치 상태바 */}
      <div className="absolute bottom-6 inset-x-6 flex flex-col md:flex-row items-center justify-between gap-4 pointer-events-none">
        <div className="flex items-center gap-4 bg-slate-900/90 backdrop-blur-md border border-slate-700/70 px-5 py-3 rounded-2xl shadow-xl pointer-events-auto">
          {/* 주사위 눈금 합계 */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">주사위 합</span>
            <span className="text-2xl font-black text-amber-400 min-w-[2ch] text-center">
              {isRolling ? '...' : totalScore || '-'}
            </span>
          </div>

          {/* 현재 말의 위치 */}
          <div className="flex items-center gap-2 pl-4 border-l border-slate-700">
            <span className="text-xs font-semibold text-slate-400">말 위치:</span>
            <span className="px-2.5 py-1 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-bold">
              {playerTileIndex}번 칸
            </span>
          </div>
        </div>

        {/* 주사위 굴리기 버튼 */}
        <button
          type="button"
          disabled={isRolling || isMovingPawn}
          onClick={rollDice}
          className="pointer-events-auto px-8 py-3.5 rounded-2xl font-bold text-sm tracking-wide text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-indigo-500/25 transition-all"
        >
          {isRolling ? '주사위 굴리는 중...' : isMovingPawn ? '말 이동 중...' : '주사위 던지기 (Roll)'}
        </button>
      </div>

      <div className="absolute bottom-2 left-6 text-[11px] text-slate-500 pointer-events-none hidden md:block">
        드래그: 화면 360° 회전 | 휠: 줌 인/아웃 | 주사위가 멈추면 합계만큼 말이 타일을 순회합니다.
      </div>
    </div>
  );
}