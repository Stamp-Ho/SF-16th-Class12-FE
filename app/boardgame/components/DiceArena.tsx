'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import {
  createHighQualityDiceTemplate,
  getPreciseDiceScore,
  DiceTemplate,
} from '../utils/diceFactory';
import TileInspector from './TileInspector';
import { BoardTileData } from '../types/board';
import { BoardTile, createDynamicTileTexture, generateBoardTiles } from '../utils/board';
import { executeTileAction } from '../utils/tileActionEngine';


interface DiceItem {
  body: CANNON.Body;
  isSleeping: boolean;
  lastValue: number;
  mesh: THREE.Mesh;
}

interface TeamInfo {
  name: string;
  color: string;
}

interface OrbitSnapshot {
  center: THREE.Vector3;
  targetCenter: THREE.Vector3;
  theta: number;
  phi: number;
  radius: number;
  targetTheta: number;
  targetPhi: number;
  targetRadius: number;
}

const TEAM_PAWN_OFFSETS = [
  { x: -0.9, z: -0.9 },
  { x: 0.9, z: -0.9 },
  { x: -0.9, z: 0.9 },
  { x: 0.9, z: 0.9 },
];

function getPawnPosition(tile: Pick<BoardTile, 'x' | 'z'>, teamIndex: number) {
  const offset = TEAM_PAWN_OFFSETS[teamIndex] ?? { x: 0, z: 0 };
  return new THREE.Vector3(tile.x + offset.x, 1.2, tile.z + offset.z);
}

function getOrbitDefaults(mode: '2.5d' | 'top', rows: number, cols: number) {
  return mode === 'top'
    ? { theta: 0, phi: 0.001, radius: Math.max(rows, cols) * 6 }
    : { theta: Math.PI / 4, phi: Math.PI / 3.4, radius: Math.max(rows, cols) * 8 };
}

export default function DiceArena() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 보드 규격 설정 (M x N)
  const [boardSize, setBoardSize] = useState<{ rows: number; cols: number }>({ rows: 10, cols: 12 });
  const [gridSizeDraft, setGridSizeDraft] = useState({ rows: '10', cols: '12' });
  const [gridSizeError, setGridSizeError] = useState('');

  // 상태 관리
  const [scores, setScores] = useState<number[]>([]);
  const [viewMode, setViewMode] = useState<'2.5d' | 'top'>('top');
  const viewModeRef = useRef<'2.5d' | 'top'>('top');
  const [isRolling, setIsRolling] = useState<boolean>(false);
  const isRollingRef = useRef(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playerTileIndex, setPlayerTileIndex] = useState<number>(0);
  const playerTileIndexRef = useRef(0);
  const [isMovingPawn, setIsMovingPawn] = useState<boolean>(false);
  const [currentTeamIndex, setCurrentTeamIndex] = useState(0);
  const currentTeamIndexRef = useRef(0);
  const [teamPositions, setTeamPositions] = useState<number[]>([0, 0, 0, 0]);
  const teamPositionsRef = useRef<number[]>([0, 0, 0, 0]);
  const teams: TeamInfo[] = [
    { name: '팀 1', color: '#38bdf8' },
    { name: '팀 2', color: '#fbbf24' },
    { name: '팀 3', color: '#f472b6' },
    { name: '팀 4', color: '#a78bfa' },
  ];
  const [pendingTileEvent, setPendingTileEvent] = useState<BoardTileData | null>(null);
  const [eventCountdown, setEventCountdown] = useState<number | null>(null);
  const [eventNotice, setEventNotice] = useState<{ title: string; message: string } | null>(null);
  const popupConfirmButtonRef = useRef<HTMLButtonElement>(null);

  // 3D & 런타임 Refs
  const runtimeRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    world: CANNON.World;
    diceList: DiceItem[];
    diceTemplate: DiceTemplate;
    boardTiles: BoardTile[];
    pawnMeshes: THREE.Group[];
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
      center: THREE.Vector3;
      targetCenter: THREE.Vector3;
      keys: {
        w: boolean;
        a: boolean;
        s: boolean;
        d: boolean;
        q: boolean;
        e: boolean;
        z: boolean;
        x: boolean;
      };
    };
  } | null>(null);

  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [isAddingInnerTile, setIsAddingInnerTile] = useState(false);
  const isAddingInnerTileRef = useRef(isAddingInnerTile);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [boardTilesMap, setBoardTilesMap] = useState<Map<string, BoardTileData>>(new Map());
  const boardTilesMapRef = useRef(boardTilesMap);
  const editModeRef = useRef(isEditMode);
  const tileMeshMapRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const innerCellMeshMapRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const innerCellOutlineMapRef = useRef<Map<string, THREE.LineSegments>>(new Map());
  const innerCellGridRef = useRef<THREE.Group | null>(null);
  const selectionBoxRef = useRef<THREE.BoxHelper | null>(null);
  const orbitSnapshotRef = useRef<OrbitSnapshot | null>(null);

  useEffect(() => {
    boardTilesMapRef.current = boardTilesMap;
  }, [boardTilesMap]);

  useEffect(() => {
    editModeRef.current = isEditMode;
    isAddingInnerTileRef.current = isAddingInnerTile;
    runtimeRef.current?.pawnMeshes.forEach((pawn) => {
      pawn.visible = !isEditMode;
    });
    if (innerCellGridRef.current) {
      const showInnerGrid = isEditMode && isAddingInnerTile;
      innerCellGridRef.current.visible = showInnerGrid;
      innerCellMeshMapRef.current.forEach((mesh, id) => {
        const isEmpty = !boardTilesMap.has(id);
        mesh.visible = showInnerGrid && isEmpty;
        const outline = innerCellOutlineMapRef.current.get(id);
        if (outline) outline.visible = showInnerGrid && isEmpty;
      });
    }
  }, [boardTilesMap, isEditMode, isAddingInnerTile]);

  // 마우스 다운 좌표 (클릭 판정용)
  const pointerDownPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    if (pendingTileEvent || eventNotice) {
      popupConfirmButtonRef.current?.focus();
    }
  }, [pendingTileEvent, eventNotice]);

  const showTileEvent = useCallback((tileId: string) => {
    const tile = boardTilesMapRef.current.get(tileId);
    if (tile) setPendingTileEvent(tile);
  }, []);

  // 2. 타일 선택 처리 함수
  const selectTile = (tileId: string | null) => {
    const runtime = runtimeRef.current;

    if (tileId && runtime) {
      const { orbit } = runtime;
      if(!orbitSnapshotRef.current) {
        orbitSnapshotRef.current = {
          center: orbit.center.clone(),
          targetCenter: orbit.targetCenter.clone(),
          theta: orbit.theta,
          phi: orbit.phi,
          radius: orbit.radius,
          targetTheta: orbit.targetTheta,
          targetPhi: orbit.targetPhi,
          targetRadius: orbit.targetRadius,
        };
      }

      const tileMesh = tileMeshMapRef.current.get(tileId);
      if (tileMesh) {
        orbit.targetCenter.set(tileMesh.position.x, 0, tileMesh.position.z);
        orbit.targetTheta = tileMesh.rotation.y;
        orbit.targetPhi = 0.001;
        orbit.targetRadius = 8.5;
      }
    } else if (!tileId && runtime && orbitSnapshotRef.current) {
      const snapshot = orbitSnapshotRef.current;
      const { orbit } = runtime;
      orbit.center.copy(snapshot.center);
      orbit.targetCenter.copy(snapshot.targetCenter);
      orbit.theta = snapshot.theta;
      orbit.phi = snapshot.phi;
      orbit.radius = snapshot.radius;
      orbit.targetTheta = snapshot.targetTheta;
      orbit.targetPhi = snapshot.targetPhi;
      orbit.targetRadius = snapshot.targetRadius;
      orbitSnapshotRef.current = null;
    }

    setSelectedTileId(tileId);
    const helper = selectionBoxRef.current;
    if (!helper) return;

    if (tileId && tileMeshMapRef.current.has(tileId)) {
      const mesh = tileMeshMapRef.current.get(tileId)!;
      helper.setFromObject(mesh);
      helper.visible = true;
    } else {
      helper.visible = false;
    }
  };

  // 3. 인스펙터에서 타일 속성 수정 시 Three.js에 실시간 반영
  const handleUpdateTile = (updated: Partial<BoardTileData>) => {
    if (!selectedTileId) return;

    setBoardTilesMap((prev) => {
      const next = new Map(prev);
      const target = next.get(selectedTileId);
      if (!target) return prev;

      const newTileData = { ...target, ...updated };
      next.set(selectedTileId, newTileData);

      // 3D 뷰포트의 실제 메시 업데이트
      const mesh = tileMeshMapRef.current.get(selectedTileId);
      if (mesh) {
        // 회전값 업데이트
        if (updated.rotationY !== undefined) {
          mesh.rotation.y = updated.rotationY;
        }
        // 상단 텍스처 교체 (materials[2]가 윗면)
        const materials = mesh.material as THREE.MeshStandardMaterial[];
        materials[2].map = createDynamicTileTexture(
          newTileData.label,
          newTileData.subLabel,
          newTileData.color,
          newTileData.textColor,
          newTileData.subLabelColor
        );
        materials[2].needsUpdate = true;
      }

      return next;
    });
  };

  const handleDeleteTile = (tileId: string) => {
    const tile = boardTilesMapRef.current.get(tileId);
    if (!tile || tile.isLocked) return;

    const nextTileMap = new Map(boardTilesMapRef.current);
    nextTileMap.delete(tileId);
    boardTilesMapRef.current = nextTileMap;
    setBoardTilesMap(nextTileMap);

    const tileMesh = tileMeshMapRef.current.get(tileId);
    if (tileMesh) {
      runtimeRef.current?.tileMeshGroup.remove(tileMesh);
      const materials = Array.isArray(tileMesh.material) ? tileMesh.material : [tileMesh.material];
      materials.forEach((material) => {
        material.map?.dispose();
        material.dispose();
      });
      tileMeshMapRef.current.delete(tileId);
    }

    const cellMesh = innerCellMeshMapRef.current.get(tileId);
    const cellOutline = innerCellOutlineMapRef.current.get(tileId);
    if (cellMesh) cellMesh.visible = isEditMode && isAddingInnerTile;
    if (cellOutline) cellOutline.visible = isEditMode && isAddingInnerTile;
    selectTile(null);
  };

  // 말(Pawn)의 칸별 이동 애니메이션
  const movePawnSteps = useCallback((steps: number) => {
    if (!runtimeRef.current) return;
    const { pawnMeshes, boardTiles } = runtimeRef.current;
    if (!boardTiles.length) return;
    const teamIndex = currentTeamIndexRef.current;
    const pawnMesh = pawnMeshes[teamIndex];
    if (!pawnMesh) return;

    setIsMovingPawn(true);

    let currentStep = 0;
    const stepInterval = setInterval(() => {
      currentStep++;
      const targetIdx = (teamPositionsRef.current[teamIndex] + 1) % boardTiles.length;
      teamPositionsRef.current[teamIndex] = targetIdx;
      playerTileIndexRef.current = targetIdx;
      setPlayerTileIndex(targetIdx);
      setTeamPositions([...teamPositionsRef.current]);

      const targetTile = boardTiles[targetIdx];
      const startPos = pawnMesh.position.clone();
      const endPos = getPawnPosition(targetTile, teamIndex);

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

      // 타일 이동 완료 되었을 때 로직.
      if (currentStep >= steps) {
        clearInterval(stepInterval);
        setIsMovingPawn(false);
        selectTile(targetTile.id);
        setTimeout(()=>{
          pawnMeshes.forEach(mesh => mesh.scale.set(0,0,0));
        }, 300)
        setTimeout(() => {
          showTileEvent(targetTile.id);
          const nextTeamIndex = (currentTeamIndexRef.current + 1) % teams.length;
          currentTeamIndexRef.current = nextTeamIndex;
          setCurrentTeamIndex(nextTeamIndex);
          setTimeout(()=>{
            selectTile(null);
            pawnMeshes.forEach(mesh => mesh.scale.set(1,1,1));
          }, 500)
        }, 2000);
      }
    }, 280);
  }, [showTileEvent]);

  const executePendingTileEvent = useCallback(() => {
    if (!pendingTileEvent) return;

    const tileEvent = pendingTileEvent;
    setPendingTileEvent(null);
    setEventCountdown(null);

    executeTileAction(tileEvent.action, {
      currentTile: tileEvent,
      movePawnSteps,
      teleportPawnToTile: (targetTileId) => {
        const runtime = runtimeRef.current;
        const targetIndex = runtime?.boardTiles.findIndex((tile) => tile.id === targetTileId) ?? -1;
        const targetTile = targetIndex >= 0 ? runtime?.boardTiles[targetIndex] : undefined;
        if (!runtime || !targetTile) return;

        teamPositionsRef.current[currentTeamIndexRef.current] = targetIndex;
        setTeamPositions([...teamPositionsRef.current]);
        playerTileIndexRef.current = targetIndex;
        setPlayerTileIndex(targetIndex);
        const teamIndex = currentTeamIndexRef.current;
        const position = getPawnPosition(targetTile, teamIndex);
        runtime.pawnMeshes[teamIndex]?.position.copy(position);
      },
      openGoldCardModal: () => {
        setEventNotice({ title: '황금카드', message: '황금카드를 1장 뽑습니다!' });
      },
      openChoiceModal: () => undefined,
      showToast: (title, message) => {
        setEventNotice({ title, message });
      },
    });
  }, [movePawnSteps, pendingTileEvent]);

  useEffect(() => {
    if (!pendingTileEvent || pendingTileEvent.action.type !== 'MOVE_STEPS') {
      return;
    }

      // The timer state is intentionally initialized when a tile event opens.
      // eslint-disable-next-line react-hooks/set-state-in-effect
    setEventCountdown(2);
    const countdownTimer = window.setInterval(() => {
      setEventCountdown((current) => (current && current > 1 ? current - 1 : current));
    }, 1000);
    const actionTimer = window.setTimeout(executePendingTileEvent, 2000);

    return () => {
      window.clearInterval(countdownTimer);
      window.clearTimeout(actionTimer);
    };
  }, [executePendingTileEvent, pendingTileEvent]);

  // 주사위 굴리기
  const rollDice = useCallback(() => {
    if (
      !runtimeRef.current ||
      isMovingPawn ||
      isRollingRef.current ||
      pendingTileEvent ||
      eventNotice
    ) return;
    const { diceList, orbit } = runtimeRef.current;

    setIsRolling(true);
    isRollingRef.current = true;
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
  }, [eventNotice, isMovingPawn, pendingTileEvent]);

  useEffect(() => {
    const handleSpacebar = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat) return;

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select' ||
        tagName === 'button' ||
        tagName === 'a' ||
        target?.isContentEditable
      ) return;

      if (pendingTileEvent || eventNotice) return;
      if (isEditMode || isRolling || isMovingPawn) return;

      event.preventDefault();
      rollDice();
    };

    window.addEventListener('keydown', handleSpacebar);
    return () => window.removeEventListener('keydown', handleSpacebar);
  }, [eventNotice, isEditMode, isMovingPawn, isRolling, pendingTileEvent, rollDice]);

  // 뷰 전환 (2.5D <-> 탑뷰)
  // 2. switchView 함수에서 Ref 값도 함께 업데이트
  const switchView = (mode: '2.5d' | 'top') => {
    if (!runtimeRef.current) return;
    const { orbit } = runtimeRef.current;

    setViewMode(mode);
    viewModeRef.current = mode; // ★ Ref 동기화
    orbit.targetCenter.set(0, 0, 0);
    const defaults = getOrbitDefaults(mode, boardSize.rows, boardSize.cols);
    orbit.targetTheta = defaults.theta;
    orbit.targetPhi = defaults.phi;
    orbit.targetRadius = defaults.radius;
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
        body,
        isSleeping: false,
        lastValue: 1,
        mesh,
      });
    }

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
    const tileSize = 4.8;
    const step = tileSize + 0.15;
    const halfW = ((boardSize.cols - 1) * step) / 2;
    const halfH = ((boardSize.rows - 1) * step) / 2;
    const boardTiles = generateBoardTiles(boardSize.rows, boardSize.cols, tileSize, 0.15);
    const tileMeshGroup = new THREE.Group();
    tileMeshMapRef.current.clear();
    innerCellMeshMapRef.current.clear();
    innerCellOutlineMapRef.current.clear();
    const tileDataMap = new Map<string, BoardTileData>(
      boardTiles.map((tile) => {
        const defaultTile = {
          id: tile.id,
          category: 'OUTER',
          gridR: tile.gridR,
          gridC: tile.gridC,
          position: { x: tile.x, y: 0.2, z: tile.z },
          rotationY: tile.rotationY,
          label: `${tile.index}번 타일!`,
          subLabel: tile.isCorner ? '코너' : '무슨 이벤트를 넣을지 고민해보세요',
          color: '#1e293b',
          textColor: '#ffffff',
          subLabelColor: '#94a3b8',
          nextTileIds: [],
          action: { type: 'CUSTOM_SCRIPT', params: { promptMessage: `test-${tile.index}` } },
          isLocked: true,
        } satisfies BoardTileData;
        const previousTile = boardTilesMapRef.current.get(tile.id);
        const tileData = previousTile
          ? {
              ...defaultTile,
              ...previousTile,
              gridR: tile.gridR,
              gridC: tile.gridC,
              position: defaultTile.position,
            }
          : defaultTile;

        return [tile.id, tileData] as const;
      })
    );

    for (const previousTile of boardTilesMapRef.current.values()) {
      if (
        previousTile.category !== 'INNER' ||
        previousTile.gridR < 1 || previousTile.gridR >= boardSize.rows - 1 ||
        previousTile.gridC < 1 || previousTile.gridC >= boardSize.cols - 1
      ) continue;

      tileDataMap.set(previousTile.id, {
        ...previousTile,
        position: {
          x: previousTile.gridC * step - halfW,
          y: 0.2,
          z: previousTile.gridR * step - halfH,
        },
      });
    }

    setBoardTilesMap(tileDataMap);

    const boxGeo = new THREE.BoxGeometry(tileSize, 0.4, tileSize);
    const createTileMesh = (tileData: BoardTileData) => {
      const topTexture = createDynamicTileTexture(
        tileData.label,
        tileData.subLabel,
        tileData.color,
        tileData.textColor,
        tileData.subLabelColor
      );
      const sideMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });
      const topMat = new THREE.MeshStandardMaterial({ map: topTexture, roughness: 0.3 });

      // Material 순서: [right, left, top, bottom, front, back]
      const materials = [sideMat, sideMat, topMat, sideMat, sideMat, sideMat];
      const mesh = new THREE.Mesh(boxGeo, materials);
      mesh.position.set(tileData.position.x, tileData.position.y, tileData.position.z);
      mesh.rotation.y = tileData.rotationY;
      mesh.receiveShadow = true;

      // ★ Raycaster 피킹을 위한 식별자 저장
      mesh.userData = { tileId: tileData.id };
      tileMeshMapRef.current.set(tileData.id, mesh);

      tileMeshGroup.add(mesh);
    };

    tileDataMap.forEach(createTileMesh);

    const innerCellGrid = new THREE.Group();
    innerCellGrid.visible = editModeRef.current && isAddingInnerTileRef.current;
    innerCellGridRef.current = innerCellGrid;
    for (let gridR = 1; gridR < boardSize.rows - 1; gridR++) {
      for (let gridC = 1; gridC < boardSize.cols - 1; gridC++) {
        const cellId = `inner_${gridR}_${gridC}`;
        if (tileDataMap.has(cellId)) continue;

        const cellPlane = new THREE.Mesh(
          new THREE.PlaneGeometry(tileSize, tileSize),
          new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.12,
            side: THREE.DoubleSide,
            depthWrite: false,
          })
        );
        cellPlane.rotation.x = -Math.PI / 2;
        cellPlane.position.set(gridC * step - halfW, 0.08, gridR * step - halfH);
        cellPlane.userData = { gridR, gridC };
        const cellOutline = new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.PlaneGeometry(tileSize, tileSize)),
          new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.7 })
        );
        cellOutline.rotation.x = -Math.PI / 2;
        cellOutline.position.copy(cellPlane.position);
        innerCellGrid.add(cellPlane, cellOutline);
        innerCellMeshMapRef.current.set(cellId, cellPlane);
        innerCellOutlineMapRef.current.set(cellId, cellOutline);
      }
    }

    const selectionBox = new THREE.BoxHelper(
      new THREE.Mesh(boxGeo),
      0x38bdf8 // 형광 하늘색 외곽선
    );
    selectionBox.visible = false;
    scene.add(selectionBox);
    selectionBoxRef.current = selectionBox;

    scene.add(tileMeshGroup);
    scene.add(innerCellGrid);

    // 4. 중앙 주사위 투척 구역 (펠트 필드 + 반투명 아크릴 안전 가벽)
    const innerW = (boardSize.cols - 2) * step;
    const innerH = (boardSize.rows - 2) * step;

    // 중앙 바닥 펠트
    const centerFloorGeo = new THREE.PlaneGeometry(innerW, innerH);
    const centerFloorMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 10,
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

    // 5. 팀별 플레이어 3D 말 생성
    const pawnMeshes = teams.map((team, teamIndex) => {
      const pawnMesh = new THREE.Group();
      const teamColor = new THREE.Color(team.color);
      const pawnBase = new THREE.Mesh(
        new THREE.CylinderGeometry(0.65, 0.75, 0.3, 32),
        new THREE.MeshStandardMaterial({ color: teamColor, metalness: 0.3, roughness: 0.2 })
      );
      const pawnBody = new THREE.Mesh(
        new THREE.ConeGeometry(0.55, 1.2, 32),
        new THREE.MeshStandardMaterial({ color: teamColor, metalness: 0.2, roughness: 0.3 })
      );
      pawnBody.position.y = 0.7;
      const pawnHead = new THREE.Mesh(
        new THREE.SphereGeometry(0.38, 32, 32),
        new THREE.MeshStandardMaterial({ color: teamColor, roughness: 0.1, metalness: 0.1 })
      );
      pawnHead.position.y = 1.45;

      pawnMesh.add(pawnBase, pawnBody, pawnHead);
      pawnMesh.traverse((child) => {
        if (child instanceof THREE.Mesh) child.castShadow = true;
      });

      pawnMesh.position.copy(getPawnPosition(boardTiles[0], teamIndex));
      pawnMesh.visible = !editModeRef.current;
      scene.add(pawnMesh);
      return pawnMesh;
    });

    // 6. 주사위 템플릿 및 Orbit 상태 설정
    const diceTemplate = createHighQualityDiceTemplate();
    const initialOrbitDefaults = getOrbitDefaults(viewModeRef.current, boardSize.rows, boardSize.cols);
    const orbitState = {
      isDragging: false,
      prevX: 0,
      prevY: 0,
      theta: initialOrbitDefaults.theta,
      phi: initialOrbitDefaults.phi,
      radius: initialOrbitDefaults.radius,
      targetTheta: initialOrbitDefaults.theta,
      targetPhi: initialOrbitDefaults.phi,
      targetRadius: initialOrbitDefaults.radius,
      // ★ 추가: 카메라가 바라보는 중심점 좌표 (WASD로 이동할 목표 지점)
      center: new THREE.Vector3(0, 0, 0),
      targetCenter: new THREE.Vector3(0, 0, 0),
      keys: {
        w: false,
        a: false,
        s: false,
        d: false,
        q: false,
        e: false,
        z: false,
        x: false,
      },
    };

    runtimeRef.current = {
      scene,
      camera,
      renderer,
      world,
      diceList: [],
      diceTemplate,
      boardTiles,
      pawnMeshes,
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

      const moveSpeed = 18 * dt;
      const forwardX = -Math.sin(orbitState.theta);
      const forwardZ = -Math.cos(orbitState.theta);
      const rightX = -forwardZ;
      const rightZ = forwardX;

      if (orbitState.keys.w) {
        orbitState.targetCenter.x += forwardX * moveSpeed;
        orbitState.targetCenter.z += forwardZ * moveSpeed;
      }
      if (orbitState.keys.s) {
        orbitState.targetCenter.x -= forwardX * moveSpeed;
        orbitState.targetCenter.z -= forwardZ * moveSpeed;
      }
      if (orbitState.keys.d) {
        orbitState.targetCenter.x += rightX * moveSpeed;
        orbitState.targetCenter.z += rightZ * moveSpeed;
      }
      if (orbitState.keys.a) {
        orbitState.targetCenter.x -= rightX * moveSpeed;
        orbitState.targetCenter.z -= rightZ * moveSpeed;
      }
      const rotateSpeed = 1.8 * dt;
      if (orbitState.keys.q) orbitState.targetTheta -= rotateSpeed;
      if (orbitState.keys.e) orbitState.targetTheta += rotateSpeed;

      const zoomFactor = Math.exp(1.5 * dt);
      if (orbitState.keys.z) orbitState.targetRadius /= zoomFactor;
      if (orbitState.keys.x) orbitState.targetRadius *= zoomFactor;
      orbitState.targetRadius = Math.max(
        10,
        Math.min(Math.max(boardSize.rows, boardSize.cols) * 8, orbitState.targetRadius)
      );

      orbitState.targetCenter.x = Math.max(-50, Math.min(50, orbitState.targetCenter.x));
      orbitState.targetCenter.z = Math.max(-50, Math.min(50, orbitState.targetCenter.z));

      // 카메라 중심점 Lerp 부드러운 보간
      orbitState.center.lerp(orbitState.targetCenter, 0.1);

      // 카메라 Orbit 각도 Lerp 보간
      orbitState.theta += (orbitState.targetTheta - orbitState.theta) * 0.1;
      orbitState.phi += (orbitState.targetPhi - orbitState.phi) * 0.1;
      orbitState.radius += (orbitState.targetRadius - orbitState.radius) * 0.1;

      // ★ 중심점(center)을 기준으로 카메라 구면 좌표 계산
      camera.position.x = orbitState.center.x + orbitState.radius * Math.sin(orbitState.phi) * Math.sin(orbitState.theta);
      camera.position.y = orbitState.center.y + orbitState.radius * Math.cos(orbitState.phi);
      camera.position.z = orbitState.center.z + orbitState.radius * Math.sin(orbitState.phi) * Math.cos(orbitState.theta);

      // ★ (0, 0, 0) 대신 이동된 center를 바라봄
      camera.lookAt(orbitState.center);

      // 주사위 물리 동기화 및 정지 판정
      const diceList = runtimeRef.current?.diceList ?? [];
      const allSleeping =
        diceList.length > 0 && diceList.every((dice) => dice.body.sleepState === CANNON.Body.SLEEPING);
      const currentValues: number[] = [];

      diceList.forEach((dice) => {
        dice.mesh.position.copy(dice.body.position as unknown as THREE.Vector3);
        dice.mesh.quaternion.copy(dice.body.quaternion as unknown as THREE.Quaternion);

        if (allSleeping) {
          dice.isSleeping = true;
          dice.lastValue = getPreciseDiceScore(dice.body);
        }
        currentValues.push(dice.lastValue);
      });

      if (allSleeping && isRollingRef.current) {
        isRollingRef.current = false;
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
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      canvasRef.current?.focus();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      pointerDownPos.current = { x: clientX, y: clientY };
      orbitState.isDragging = true;
      orbitState.prevX = clientX;
      orbitState.prevY = clientY;
    };

    // 3. handlePointerMove에서 viewModeRef.current 참조
    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (!orbitState.isDragging) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      const deltaX = clientX - orbitState.prevX;
      const deltaY = clientY - orbitState.prevY;
      orbitState.prevX = clientX;
      orbitState.prevY = clientY;

      // 탑뷰일 때는 수평 회전(Theta)까지 완전 고정할지 여부에 따라 조정 가능
      orbitState.targetTheta -= deltaX * 0.007;

      // viewModeRef.current를 사용해 최신 상태 확인
      orbitState.targetPhi =
        viewModeRef.current === 'top'
          ? 0.001
          : Math.max(0.001, Math.min(Math.PI / 3.4, orbitState.targetPhi - deltaY * 0.007));
    };

    const handlePointerUp = (e: MouseEvent | TouchEvent) => {
      orbitState.isDragging = false;

      const clientX = 'changedTouches' in e ? e.changedTouches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'changedTouches' in e ? e.changedTouches[0].clientY : (e as MouseEvent).clientY;

      const dist = Math.hypot(clientX - pointerDownPos.current.x, clientY - pointerDownPos.current.y);

      // 5픽셀 미만 움직였을 때만 "클릭(피킹)"으로 판정
      if (dist < 5 && containerRef.current) { //(dist < 5 && editModeRef.current && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = ((clientX - rect.left) / rect.width) * 2 - 1;
        const mouseY = -((clientY - rect.top) / rect.height) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);

        // 타일 메시 그룹과 충돌 검사
        const intersects = raycaster.intersectObjects(tileMeshGroup.children, false);

        if (intersects.length > 0) {
          const hitMesh = intersects[0].object as THREE.Mesh;
          const tileId = hitMesh.userData.tileId;
          if (tileId) {
            selectTile(tileId);
          }
        } else if (editModeRef.current && isAddingInnerTileRef.current) {
          const cellIntersections = raycaster.intersectObjects(
            Array.from(innerCellMeshMapRef.current.values()),
            false
          );
          const cellMesh = cellIntersections[0]?.object as THREE.Mesh | undefined;
          if (cellMesh) {
            const { gridR, gridC } = cellMesh.userData as { gridR: number; gridC: number };
            const id = `inner_${gridR}_${gridC}`;
            const innerTile: BoardTileData = {
              id,
              category: 'INNER',
              gridR,
              gridC,
              position: {
                x: gridC * step - halfW,
                y: 0.2,
                z: gridR * step - halfH,
              },
              rotationY: 0,
              label: `내부 타일 ${gridR}, ${gridC}`,
              subLabel: '타일 속성에서 내용을 설정하세요.',
              color: '#0f172a',
              textColor: '#ffffff',
              subLabelColor: '#94a3b8',
              nextTileIds: [],
              action: { type: 'NONE' },
              isLocked: false,
            };
            const nextTileMap = new Map(boardTilesMapRef.current);
            nextTileMap.set(id, innerTile);
            boardTilesMapRef.current = nextTileMap;
            setBoardTilesMap(nextTileMap);
            createTileMesh(innerTile);
            cellMesh.visible = false;
            const cellOutline = innerCellOutlineMapRef.current.get(id);
            if (cellOutline) cellOutline.visible = false;
            setIsAddingInnerTile(false);
            selectTile(id);
          } else {
            selectTile(null);
          }
        } else {
          // 빈 공간 클릭 시 선택 해제
          selectTile(null);
        }
      }
    };

    const handleWheel = (e: WheelEvent) => {
      orbitState.targetRadius = Math.max(10, Math.min(Math.max(boardSize.rows, boardSize.cols) * 8, orbitState.targetRadius + e.deltaY * 0.025));
    };

    const getMovementKey = (e: KeyboardEvent): 'w' | 'a' | 's' | 'd' | 'q' | 'e' | 'z' | 'x' | null => {
      const key = e.code.startsWith('Key') ? e.code.slice(3).toLowerCase() : e.key.toLowerCase();
      return key === 'w' || key === 'a' || key === 's' || key === 'd' ||
        key === 'q' || key === 'e' || key === 'z' || key === 'x'
        ? key
        : null;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (tagName === 'input' || tagName === 'textarea' || target?.isContentEditable) return;

      const key = getMovementKey(e);
      if (key) {
        e.preventDefault();
        e.stopPropagation();
        orbitState.keys[key] = true;
      }
      if (e.key.toLowerCase() === 'r' || e.code === 'KeyR') {
        e.preventDefault();
        e.stopPropagation();

        const defaults = getOrbitDefaults(viewModeRef.current, boardSize.rows, boardSize.cols);
        orbitState.center.set(0, 0, 0);
        orbitState.targetCenter.set(0, 0, 0);
        orbitState.theta = defaults.theta;
        orbitState.targetTheta = defaults.theta;
        orbitState.phi = defaults.phi;
        orbitState.targetPhi = defaults.phi;
        orbitState.radius = defaults.radius;
        orbitState.targetRadius = defaults.radius;
        orbitState.keys = { w: false, a: false, s: false, d: false, q: false, e: false, z: false, x: false };
        orbitSnapshotRef.current = null;
        setSelectedTileId(null);
        if (selectionBoxRef.current) selectionBoxRef.current.visible = false;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = getMovementKey(e);
      if (key) {
        e.preventDefault();
        orbitState.keys[key] = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);

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
      resizeObserver.disconnect();
      el.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      el.removeEventListener('touchstart', handlePointerDown);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
      el.removeEventListener('wheel', handleWheel);

      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      if (runtimeRef.current?.reqId) {
        cancelAnimationFrame(runtimeRef.current.reqId);
      }
      tileMeshGroup.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          material.map?.dispose();
          material.dispose();
        });
      });
      boxGeo.dispose();
      innerCellGrid.traverse((object) => {
        if (!(object instanceof THREE.Mesh || object instanceof THREE.LineSegments)) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      });
      selectionBox.geometry.dispose();
      tileMeshMapRef.current.clear();
      innerCellMeshMapRef.current.clear();
      innerCellOutlineMapRef.current.clear();
      innerCellGridRef.current = null;
      diceTemplate.dispose();
      renderer.dispose();
    };
  }, [boardSize, movePawnSteps]);

  const applyGridSize = () => {
    const rows = Number(gridSizeDraft.rows);
    const cols = Number(gridSizeDraft.cols);
    if (
      !Number.isInteger(rows) ||
      !Number.isInteger(cols) ||
      rows < 3 || rows > 20 ||
      cols < 3 || cols > 20
    ) {
      setGridSizeError('행과 열은 3부터 20 사이의 정수로 설정해 주세요.');
      return;
    }

    setGridSizeError('');
    setGridSizeDraft({ rows: String(rows), cols: String(cols) });
    if (rows === boardSize.rows && cols === boardSize.cols) return;

    teamPositionsRef.current = teams.map(() => 0);
    setTeamPositions([...teamPositionsRef.current]);
    currentTeamIndexRef.current = 0;
    setCurrentTeamIndex(0);
    playerTileIndexRef.current = 0;
    setPlayerTileIndex(0);
    setScores([]);
    setSelectedTileId(null);
    orbitSnapshotRef.current = null;
    setBoardSize({ rows, cols });
  };

  const totalScore = scores.reduce((acc, cur) => acc + cur, 0);
  return (
    <div
      className={`flex w-full flex-col overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl select-none lg:flex-row ${
        isFullscreen
          ? 'fixed inset-0 z-50 h-screen rounded-none'
          : 'rounded-3xl lg:h-[840px]'
      }`}
    >
      <div
        ref={containerRef}
        className={`relative min-w-0 flex-1 overflow-hidden bg-slate-950 ${
          isFullscreen ? 'min-h-0' : 'min-h-[700px]'
        }`}
      >
      {/* 3D 뷰포트 */}
      <canvas
        ref={canvasRef}
        tabIndex={0}
        className="w-full h-full cursor-grab active:cursor-grabbing outline-none"
      />

      {pendingTileEvent && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/65 px-4 backdrop-blur-sm pointer-events-auto">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-sky-400/40 bg-slate-900 shadow-2xl shadow-sky-950/40">
            <div
              className="flex min-h-44 flex-col items-center justify-center gap-3 px-6 py-8 text-center"
              style={{ backgroundColor: pendingTileEvent.color || '#1e293b' }}
            >
              <span className="rounded-full border border-sky-300/50 bg-slate-950/40 px-3 py-1 text-xs font-bold text-sky-100">
                {pendingTileEvent.category}
              </span>
              <h2
                className="text-3xl font-black drop-shadow-md"
                style={{ color: pendingTileEvent.textColor || '#ffffff' }}
              >
                {pendingTileEvent.label || '타일'}
              </h2>
              {pendingTileEvent.subLabel && (
                <p
                  className="text-sm"
                  style={{ color: pendingTileEvent.subLabelColor || '#94a3b8' }}
                >
                  {pendingTileEvent.subLabel}
                </p>
              )}
            </div>
            <div className="space-y-4 p-5 text-center">
              <p className="text-sm font-semibold text-slate-200">
                {pendingTileEvent.action.type === 'MOVE_STEPS'
                  ? `${Math.abs(pendingTileEvent.action.params?.steps ?? 0)}칸 이동합니다.`
                  : '이 타일의 이벤트를 실행합니다.'}
              </p>
              {pendingTileEvent.action.type === 'MOVE_STEPS' ? (
                <p className="text-sm font-bold text-amber-300">
                  {eventCountdown !== null ? `${eventCountdown}초 후 실행` : '이동 중'}
                </p>
              ) : null}
              <button
                ref={popupConfirmButtonRef}
                type="button"
                onClick={executePendingTileEvent}
                className="w-full rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-sky-400"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {eventNotice && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm pointer-events-auto">
          <div className="w-full max-w-sm rounded-2xl border border-amber-400/40 bg-slate-900 p-6 text-center shadow-2xl">
            <h2 className="text-xl font-black text-amber-300">{eventNotice.title}</h2>
            <p className="mt-3 text-sm text-slate-200">{eventNotice.message}</p>
            <button
              ref={popupConfirmButtonRef}
              type="button"
              onClick={() => setEventNotice(null)}
              className="mt-5 w-full rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-300"
            >
              확인
            </button>
          </div>
        </div>
      )}

      <div className="absolute top-4 inset-x-4 flex items-center justify-between gap-3 pointer-events-none">
        <div className="flex items-center bg-slate-900/80 backdrop-blur-md border border-slate-700/60 rounded-xl p-1 pointer-events-auto shadow-lg">
          <button
            type="button"
            onClick={() => switchView('2.5d')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === '2.5d' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            2.5D 쿼터뷰
          </button>
          <button
            type="button"
            onClick={() => switchView('top')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'top' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            탑뷰
          </button>
        </div>

      </div>

      <div className="absolute bottom-2 left-6 hidden text-[11px] text-slate-500 pointer-events-none md:block">
        Space: 주사위 굴리기 | WASD: 화면 이동 | Q/E: 회전 | Z/X: 확대·축소 | R: 현재 뷰 초기화 | 드래그: 화면 회전 | 휠: 확대·축소
      </div>
      </div>

      <aside
        className={`flex w-full shrink-0 flex-col gap-4 overflow-y-auto border-t border-slate-800 bg-slate-900/95 p-4 text-slate-200 lg:min-h-0 lg:w-[22rem] lg:border-l lg:border-t-0 ${
          isFullscreen ? 'min-h-0' : 'min-h-[700px]'
        }`}
      >
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              if (isEditMode) {
                setIsEditMode(false);
                setIsAddingInnerTile(false);
                selectTile(null);
              } else {
                setIsEditMode(true);
              }
            }}
            className={`rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
              isEditMode
                ? 'border-amber-500/50 bg-amber-500/20 text-amber-300'
                : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-sky-400'
            }`}
          >
            {isEditMode ? '편집 모드 ON' : '플레이 모드'}
          </button>
          <button
            type="button"
            onClick={() => setIsFullscreen((current) => !current)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-sky-400 hover:text-white"
            aria-label={isFullscreen ? '전체화면 종료' : '전체화면'}
          >
            {isFullscreen ? '전체화면 종료' : '전체화면'}
          </button>
        </div>

        {isEditMode && (
          <section className="space-y-3 rounded-xl border border-slate-700 bg-slate-950/50 p-3">
            <div>
              <h2 className="text-sm font-bold text-white">격자 크기</h2>
              <p className="mt-1 text-[11px] text-slate-400">각 변은 3~20칸으로 설정할 수 있습니다.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 text-xs font-semibold text-slate-300">
                세로 (행)
                <input
                  type="number"
                  min={3}
                  max={20}
                  step={1}
                  value={gridSizeDraft.rows}
                  onChange={(event) => setGridSizeDraft((current) => ({ ...current, rows: event.target.value }))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-sky-500"
                />
              </label>
              <label className="space-y-1 text-xs font-semibold text-slate-300">
                가로 (열)
                <input
                  type="number"
                  min={3}
                  max={20}
                  step={1}
                  value={gridSizeDraft.cols}
                  onChange={(event) => setGridSizeDraft((current) => ({ ...current, cols: event.target.value }))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-sky-500"
                />
              </label>
            </div>
            {gridSizeError && <p className="text-xs text-rose-300">{gridSizeError}</p>}
            <button
              type="button"
              onClick={applyGridSize}
              disabled={isRolling || isMovingPawn || Boolean(pendingTileEvent || eventNotice)}
              className="w-full rounded-lg bg-sky-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              격자 적용 ({boardSize.rows} × {boardSize.cols})
            </button>
            <div className="border-t border-slate-800 pt-3">
              <button
                type="button"
                onClick={() => setIsAddingInnerTile((current) => !current)}
                className={`w-full rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
                  isAddingInnerTile
                    ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                    : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-sky-400'
                }`}
              >
                {isAddingInnerTile ? '내부 칸 추가 취소' : '내부 격자 추가'}
              </button>
              {isAddingInnerTile && (
                <p className="mt-2 text-[11px] leading-5 text-sky-200">
                  보드 안쪽의 표시된 칸을 클릭하면 타일이 추가됩니다.
                </p>
              )}
            </div>
          </section>
        )}

        {!isEditMode ? (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-sky-400">Game Board</p>
                <h2 className="text-lg font-black text-white">게임 기판</h2>
              </div>
              <span className="text-xs text-slate-400">{boardSize.rows} × {boardSize.cols}</span>
            </div>
            <button
              type="button"
              disabled={isRolling || isMovingPawn || Boolean(pendingTileEvent || eventNotice)}
              onClick={rollDice}
              className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition-all hover:from-blue-500 hover:to-indigo-500 disabled:pointer-events-none disabled:opacity-50"
            >
              {isRolling ? '주사위 굴리는 중...' : isMovingPawn ? '말 이동 중...' : '주사위 던지기'}
            </button>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
                <p className="text-[11px] font-semibold text-slate-400">주사위 결과</p>
                <p className="mt-1 text-2xl font-black text-amber-400">{isRolling ? '...' : totalScore || '-'}</p>
                <p className="mt-1 text-[10px] text-slate-500">{scores.length ? scores.join(' + ') : '대기 중'}</p>
              </div>
              <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
                <p className="text-[11px] font-semibold text-slate-400">현재 턴</p>
                <p className="mt-1 truncate text-lg font-black" style={{ color: teams[currentTeamIndex].color }}>
                  {teams[currentTeamIndex].name}
                </p>
                <p className="mt-1 text-[10px] text-slate-500">말 위치 {playerTileIndex}번</p>
              </div>
            </div>

            <section className="rounded-xl border border-slate-700 bg-slate-950/50 p-3">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-bold text-white">참가 팀</h3>
                <span className="text-[10px] text-slate-500">{teams.length}팀</span>
              </div>
              <div className="space-y-2">
                {teams.map((team, index) => (
                  <div
                    key={team.name}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                      index === currentTeamIndex
                        ? 'border-sky-400/50 bg-sky-400/10'
                        : 'border-slate-800 bg-slate-900/60'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: team.color }} />
                      <span className="truncate text-xs font-semibold text-slate-200">{team.name}</span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-400">{teamPositions[index]}번</span>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : selectedTileId ? (
          <TileInspector
            tile={boardTilesMap.get(selectedTileId) || null}
            onUpdate={handleUpdateTile}
            onDelete={handleDeleteTile}
            onClose={() => selectTile(null)}
          />
        ):
        <div>선택된 타일이 없습니다.</div>
        }
      </aside>
    </div>
  );
}
