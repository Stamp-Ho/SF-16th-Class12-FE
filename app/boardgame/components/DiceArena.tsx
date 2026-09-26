'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { createClient as createSupabaseClient } from '@/utils/supabase/client';
import ConfirmModal from '@/components/ConfirmModal';
import {
	createHighQualityDiceTemplate,
	getPreciseDiceScore,
	DiceTemplate,
} from '../utils/diceFactory';
import { BoardTileData } from '../types/board';
import {
	BoardTile,
	createDynamicTileTexture,
	generateBoardTiles,
} from '../utils/board';
import { executeTileAction } from '../utils/tileActionEngine';
import {
	acquireBoardgameTileEditLock,
	grantBoardgameEditor,
	getBoardgame,
	listBoardgames,
	revokeBoardgameEditor,
	saveBoardgame,
	type BoardgameSummary,
} from '../actions';
import BoardgameHeader from './BoardgameHeader';
import DiceArenaSidebar, {
	type DiceArenaTeamInfo,
	type TileSelectionMode,
} from './DiceArenaSidebar';
import GoldCardDrawModal from '../gold-cards/components/GoldCardDrawModal';
import { GoldCardData } from '../gold-cards/types';
import { drawCard } from '../gold-cards/utils/deck';
import { executeGoldCardEvent } from '../gold-cards/utils/events';
import {
	createGoldCardDeckGroup,
	disposeGoldCardDeckGroup,
} from '../gold-cards/utils/threeDeck';

interface DiceItem {
	body: CANNON.Body;
	isSleeping: boolean;
	lastValue: number;
	mesh: THREE.Group;
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
const DEFAULT_TEAM_NAMES = ['팀 1', '팀 2', '팀 3', '팀 4'];
const TEAM_COLORS = ['#38bdf8', '#fbbf24', '#f472b6', '#a78bfa'];

function getPawnPosition(tile: Pick<BoardTile, 'x' | 'z'>, teamIndex: number) {
	const offset = TEAM_PAWN_OFFSETS[teamIndex] ?? { x: 0, z: 0 };
	return new THREE.Vector3(tile.x + offset.x, 1.2, tile.z + offset.z);
}

function getOrbitDefaults(mode: '2.5d' | 'top', rows: number, cols: number) {
	return mode === 'top'
		? { theta: 0, phi: 0.001, radius: Math.max(rows, cols) * 6 }
		: {
				theta: Math.PI / 4,
				phi: Math.PI / 3.4,
				radius: Math.max(rows, cols) * 8.5,
			};
}

export default function DiceArena({
	canCreateBoardgame,
}: {
	canCreateBoardgame: boolean;
}) {
	const supabase = useMemo(() => createSupabaseClient(), []);
	const containerRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);

	// 보드 규격 설정 (M x N)
	const [boardSize, setBoardSize] = useState<{ rows: number; cols: number }>({
		rows: 8,
		cols: 10,
	});
	const [gridSizeDraft, setGridSizeDraft] = useState({
		rows: '8',
		cols: '10',
	});
	const [gridSizeError, setGridSizeError] = useState('');
	const [boardgames, setBoardgames] = useState<BoardgameSummary[]>([]);
	const [activeBoardgameId, setActiveBoardgameId] = useState<string | null>(
		null,
	);
	const [activeBoardgameCanEdit, setActiveBoardgameCanEdit] = useState(false);
	const [activeBoardgameIsMaker, setActiveBoardgameIsMaker] = useState(false);
	const [boardgameStatus, setBoardgameStatus] = useState('');
	const [isBoardgameBusy, setIsBoardgameBusy] = useState(false);
	const [, setIsBoardReady] = useState(false);
	const [boardRefreshKey, setBoardRefreshKey] = useState(0);

	// 상태 관리
	const [scores, setScores] = useState<number[]>([]);
	const [viewMode, setViewMode] = useState<'2.5d' | 'top'>('top');
	const viewModeRef = useRef<'2.5d' | 'top'>('top');
	const [isRolling, setIsRolling] = useState<boolean>(false);
	const isRollingRef = useRef(false);
	const [hasRolledThisGame, setHasRolledThisGame] = useState(false);
	const hasRolledThisGameRef = useRef(false);
	const [diceCount, setDiceCount] = useState(2);
	const diceCountRef = useRef(2);
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [playerTileIndex, setPlayerTileIndex] = useState<number>(0);
	const playerTileIndexRef = useRef(0);
	const [isMovingPawn, setIsMovingPawn] = useState<boolean>(false);
	const [currentTeamIndex, setCurrentTeamIndex] = useState(0);
	const currentTeamIndexRef = useRef(0);
	const [teamPositions, setTeamPositions] = useState<number[]>([0, 0, 0, 0]);
	const teamPositionsRef = useRef<number[]>([0, 0, 0, 0]);
	const [teamTileIds, setTeamTileIds] = useState<string[]>([
		'outer_0',
		'outer_0',
		'outer_0',
		'outer_0',
	]);
	const teamTileIdsRef = useRef(teamTileIds);
	const [teamNames, setTeamNames] = useState<string[]>(DEFAULT_TEAM_NAMES);
	const [isRestartConfirmOpen, setIsRestartConfirmOpen] = useState(false);
	const loadedProgressBoardgameIdRef = useRef<string | null>(null);
	const [goldCards, setGoldCards] = useState<GoldCardData[]>([]);
	const persistedGridSizeRef = useRef(boardSize);
	const persistedGoldCardsRef = useRef('[]');
	const [goldCardDrawPile, setGoldCardDrawPile] = useState<string[]>([]);
	const [drawnGoldCard, setDrawnGoldCard] = useState<GoldCardData | null>(null);
	const drawnGoldCardRef = useRef<GoldCardData | null>(null);
	const [isGoldCardModalOpen, setIsGoldCardModalOpen] = useState(false);
	const [selectingGoldCardId, setSelectingGoldCardId] = useState<string | null>(
		null,
	);
	const selectingGoldCardIdRef = useRef<string | null>(null);
	const goldCardActorTeamRef = useRef(0);
	const [goldCardActorTeamIndex, setGoldCardActorTeamIndex] = useState(0);
	const lastMovedTeamIndexRef = useRef(0);
	const teams: DiceArenaTeamInfo[] = teamNames.map((name, index) => ({
		name,
		color: TEAM_COLORS[index],
	}));
	const [pendingTileEvent, setPendingTileEvent] =
		useState<BoardTileData | null>(null);
	const [eventCountdown, setEventCountdown] = useState<number | null>(null);
	const [eventNotice, setEventNotice] = useState<{
		title: string;
		message: string;
	} | null>(null);
	const popupConfirmButtonRef = useRef<HTMLButtonElement>(null);

	// 3D & 런타임 Refs
	const runtimeRef = useRef<{
		scene: THREE.Scene;
		camera: THREE.PerspectiveCamera;
		renderer: THREE.WebGLRenderer;
		world: CANNON.World;
		diceList: DiceItem[];
		diceTemplate: DiceTemplate;
		goldCardDeckGroup: THREE.Group;
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
	const [isGoldCardManagerOpen, setIsGoldCardManagerOpen] = useState(false);
	const [isAddingInnerTile, setIsAddingInnerTile] = useState(false);
	const isAddingInnerTileRef = useRef(isAddingInnerTile);
	const [isMovingInnerTile, setIsMovingInnerTile] = useState(false);
	const isMovingInnerTileRef = useRef(false);
	const [tileSelectionMode, setTileSelectionMode] =
		useState<TileSelectionMode>(null);
	const tileSelectionModeRef = useRef<TileSelectionMode>(null);
	const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
	const selectedTileIdRef = useRef<string | null>(null);
	const [boardTilesMap, setBoardTilesMap] = useState<
		Map<string, BoardTileData>
	>(new Map());
	const tileIdRenamesRef = useRef(new Map<string, string>());
	const boardTilesMapRef = useRef(boardTilesMap);
	const editModeRef = useRef(isEditMode);
	const tileMeshMapRef = useRef<Map<string, THREE.Mesh>>(new Map());
	const innerCellMeshMapRef = useRef<Map<string, THREE.Mesh>>(new Map());
	const innerCellOutlineMapRef = useRef<Map<string, THREE.LineSegments>>(
		new Map(),
	);
	const innerCellGridRef = useRef<THREE.Group | null>(null);
	const selectionBoxRef = useRef<THREE.BoxHelper | null>(null);
	const orbitSnapshotRef = useRef<OrbitSnapshot | null>(null);
	const cameraViewRestoreRef = useRef<OrbitSnapshot | null>(null);

	useEffect(() => {
		boardTilesMapRef.current = boardTilesMap;
	}, [boardTilesMap]);

	useEffect(() => {
		if (
			!activeBoardgameId ||
			loadedProgressBoardgameIdRef.current !== activeBoardgameId
		)
			return;
		try {
			window.localStorage.setItem(
				`dice-arena-progress:${activeBoardgameId}`,
				JSON.stringify({
					teamNames,
					teamPositions: teamPositionsRef.current,
					teamTileIds,
					currentTeamIndex,
					hasRolled: hasRolledThisGame,
					scores,
				}),
			);
		} catch {
			// 저장소 접근이 차단된 환경에서는 현재 탭의 메모리 상태만 유지합니다.
		}
	}, [
		activeBoardgameId,
		currentTeamIndex,
		hasRolledThisGame,
		scores,
		teamNames,
		teamTileIds,
		teamPositions,
	]);

	useEffect(() => {
		let isActive = true;
		void listBoardgames().then((result) => {
			if (!isActive) return;
			if (result.success) setBoardgames(result.data);
			else setBoardgameStatus(result.message);
		});
		return () => {
			isActive = false;
		};
	}, []);

	useEffect(() => {
		if (boardgameStatus !== '') {
			setTimeout(() => setBoardgameStatus(''), 3000);
		}
	}, [boardgameStatus]);

	useEffect(() => {
		editModeRef.current = isEditMode;
		isAddingInnerTileRef.current = isAddingInnerTile;
		isMovingInnerTileRef.current = isMovingInnerTile;
		runtimeRef.current?.pawnMeshes.forEach((pawn) => {
			pawn.visible = !isEditMode;
		});
		runtimeRef.current?.diceList.forEach((dice) => {
			dice.mesh.visible = !isEditMode;
		});
		if (runtimeRef.current?.goldCardDeckGroup) {
			runtimeRef.current.goldCardDeckGroup.visible = true;
		}
		if (innerCellGridRef.current) {
			const showInnerGrid =
				isEditMode && (isAddingInnerTile || isMovingInnerTile);
			innerCellGridRef.current.visible = showInnerGrid;
			innerCellMeshMapRef.current.forEach((mesh, id) => {
				const [gridR, gridC] = id.split('_').slice(1).map(Number);
				const isEmpty = ![...boardTilesMap.values()].some(
					(tile) =>
						tile.category === 'INNER' &&
						tile.gridR === gridR &&
						tile.gridC === gridC,
				);
				mesh.visible = showInnerGrid && isEmpty;
				const outline = innerCellOutlineMapRef.current.get(id);
				if (outline) outline.visible = showInnerGrid && isEmpty;
			});
		}
	}, [boardTilesMap, isEditMode, isAddingInnerTile, isMovingInnerTile]);

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
			if (!orbitSnapshotRef.current) {
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
				orbit.targetRadius = 12.5;
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
		selectedTileIdRef.current = tileId;
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
			if (newTileData.action.type === 'DRAW_GOLD_CARD') {
				newTileData.label = '황금 카드 뽑기';
				newTileData.subLabel = '';
			}
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
					newTileData.color,
					newTileData.textColor,
					newTileData.action.type === 'DRAW_GOLD_CARD',
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
			const materials = Array.isArray(tileMesh.material)
				? tileMesh.material
				: [tileMesh.material];
			materials.forEach((material) => {
				if (material instanceof THREE.MeshStandardMaterial) {
					material.map?.dispose();
				}
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
	const movePawnSteps = useCallback(
		(steps: number) => {
			if (!runtimeRef.current) return;
			const { pawnMeshes, boardTiles } = runtimeRef.current;
			if (!boardTiles.length) return;
			const teamIndex = currentTeamIndexRef.current;
			lastMovedTeamIndexRef.current = teamIndex;
			const pawnMesh = pawnMeshes[teamIndex];
			if (!pawnMesh) return;

			setIsMovingPawn(true);

			let currentStep = 0;
			const stepInterval = setInterval(() => {
				currentStep++;
				const currentIdx = teamPositionsRef.current[teamIndex];
				const currentTileId =
					teamTileIdsRef.current[teamIndex] ?? boardTiles[currentIdx]?.id;
				const currentTileData = currentTileId
					? boardTilesMapRef.current.get(currentTileId)
					: undefined;
				const configuredNextId =
					currentStep === 1 &&
					currentTileData?.action.type === 'DIRECTION_CHANGE'
						? currentTileData.action.params?.targetTileId
						: currentTileData?.nextTileIds[0];
				const configuredNextIdx = configuredNextId
					? boardTiles.findIndex((tile) => tile.id === configuredNextId)
					: -1;
				const configuredInnerTile =
					configuredNextIdx < 0 && configuredNextId
						? boardTilesMapRef.current.get(configuredNextId)
						: undefined;
				const hasConfiguredTarget =
					configuredNextIdx >= 0 || configuredInnerTile?.category === 'INNER';
				const targetIdx = hasConfiguredTarget
					? configuredNextIdx
					: currentIdx >= 0
						? (currentIdx + 1) % boardTiles.length
						: 0;
				const targetTile: BoardTile =
					targetIdx >= 0
						? boardTiles[targetIdx]
						: {
								id: configuredInnerTile!.id,
								index: -1,
								gridR: configuredInnerTile!.gridR,
								gridC: configuredInnerTile!.gridC,
								x: configuredInnerTile!.position.x,
								z: configuredInnerTile!.position.z,
								rotationY: configuredInnerTile!.rotationY,
								isCorner: false,
							};
				teamPositionsRef.current[teamIndex] = targetIdx;
				teamTileIdsRef.current[teamIndex] = targetTile.id;
				setTeamTileIds([...teamTileIdsRef.current]);
				playerTileIndexRef.current = targetIdx;
				setPlayerTileIndex(targetIdx);
				setTeamPositions([...teamPositionsRef.current]);

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
					setTimeout(() => {
						selectTile(targetTile.id);
						pawnMeshes.forEach((mesh) => mesh.scale.set(0, 0, 0));
					}, 700);
					setTimeout(() => {
						showTileEvent(targetTile.id);
						const nextTeamIndex =
							(currentTeamIndexRef.current + 1) % TEAM_COLORS.length;
						currentTeamIndexRef.current = nextTeamIndex;
						setCurrentTeamIndex(nextTeamIndex);
						setTimeout(() => {
							selectTile(null);
							pawnMeshes.forEach((mesh) => mesh.scale.set(1, 1, 1));
							setIsMovingPawn(false);
						}, 500);
					}, 2000);
				}
			}, 280);
		},
		[showTileEvent],
	);

	const openGoldCardModal = useCallback(() => {
		const result = drawCard(goldCards, goldCardDrawPile);
		setGoldCardDrawPile(result.drawPile);
		goldCardActorTeamRef.current = lastMovedTeamIndexRef.current;
		setGoldCardActorTeamIndex(lastMovedTeamIndexRef.current);
		drawnGoldCardRef.current = result.card;
		setDrawnGoldCard(result.card);
		setIsGoldCardModalOpen(true);
	}, [goldCards, goldCardDrawPile]);

	const selectGoldCardTarget = (cardId: string) => {
		if (selectingGoldCardIdRef.current === cardId) {
			selectingGoldCardIdRef.current = null;
			setSelectingGoldCardId(null);
			tileSelectionModeRef.current = null;
			setTileSelectionMode(null);
			return;
		}
		selectingGoldCardIdRef.current = cardId;
		setSelectingGoldCardId(cardId);
		tileSelectionModeRef.current = 'gold-card-target';
		setTileSelectionMode('gold-card-target');
		switchView('top');
	};

	const beginGoldCardEffectTargetSelection = () => {
		setIsGoldCardModalOpen(false);
		tileSelectionModeRef.current = 'gold-card-effect-target';
		setTileSelectionMode('gold-card-effect-target');
		switchView('top');
	};

	const moveTeamPawnToTile = (teamIndex: number, tileId: string) => {
		const runtime = runtimeRef.current;
		if (!runtime) return;
		const targetIndex = runtime.boardTiles.findIndex(
			(tile) => tile.id === tileId,
		);
		const innerTarget = boardTilesMapRef.current.get(tileId);
		const targetTile: BoardTile | undefined =
			targetIndex >= 0
				? runtime.boardTiles[targetIndex]
				: innerTarget?.category === 'INNER'
					? {
							id: innerTarget.id,
							index: -1,
							gridR: innerTarget.gridR,
							gridC: innerTarget.gridC,
							x: innerTarget.position.x,
							z: innerTarget.position.z,
							rotationY: innerTarget.rotationY,
							isCorner: false,
						}
					: undefined;
		if (!targetTile) return;

		teamPositionsRef.current[teamIndex] = targetIndex;
		teamTileIdsRef.current[teamIndex] = tileId;
		setTeamTileIds([...teamTileIdsRef.current]);
		setTeamPositions([...teamPositionsRef.current]);
		if (teamIndex === goldCardActorTeamRef.current) {
			playerTileIndexRef.current = targetIndex;
			setPlayerTileIndex(targetIndex);
		}
		runtime.pawnMeshes[teamIndex]?.position.copy(
			getPawnPosition(targetTile, teamIndex),
		);
	};

	const applyDrawnGoldCard = useCallback(
		(choice: { tileId?: string; teamIndex?: number } = {}) => {
			const activeCard = drawnGoldCardRef.current;
			if (!activeCard) return;
			const actorTeamIndex = goldCardActorTeamRef.current;
			executeGoldCardEvent(
				activeCard,
				{
					movePawnToTile: (tileId) =>
						moveTeamPawnToTile(actorTeamIndex, tileId),
					swapPawnPositions: (targetTeamIndex) => {
						const swapTeamIndex =
							targetTeamIndex === actorTeamIndex
								? (actorTeamIndex + 1) % 4
								: targetTeamIndex;
						const runtime = runtimeRef.current;
						if (!runtime) return;
						[
							teamPositionsRef.current[actorTeamIndex],
							teamPositionsRef.current[swapTeamIndex],
						] = [
							teamPositionsRef.current[swapTeamIndex],
							teamPositionsRef.current[actorTeamIndex],
						];
						[
							teamTileIdsRef.current[actorTeamIndex],
							teamTileIdsRef.current[swapTeamIndex],
						] = [
							teamTileIdsRef.current[swapTeamIndex],
							teamTileIdsRef.current[actorTeamIndex],
						];
						setTeamTileIds([...teamTileIdsRef.current]);
						const actorPawn = runtime.pawnMeshes[actorTeamIndex];
						const targetPawn = runtime.pawnMeshes[swapTeamIndex];
						if (actorPawn && targetPawn) {
							const actorPosition = actorPawn.position.clone();
							actorPawn.position.copy(targetPawn.position);
							targetPawn.position.copy(actorPosition);
						}
						setTeamPositions([...teamPositionsRef.current]);
						playerTileIndexRef.current =
							teamPositionsRef.current[actorTeamIndex];
						setPlayerTileIndex(playerTileIndexRef.current);
					},
				},
				choice,
			);
			drawnGoldCardRef.current = null;
			setDrawnGoldCard(null);
			setIsGoldCardModalOpen(false);
		},
		[],
	);

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
				const targetIndex =
					runtime?.boardTiles.findIndex((tile) => tile.id === targetTileId) ??
					-1;
				const innerTarget = boardTilesMapRef.current.get(targetTileId);
				const targetTile: BoardTile | undefined =
					targetIndex >= 0
						? runtime?.boardTiles[targetIndex]
						: innerTarget?.category === 'INNER'
							? {
									id: innerTarget.id,
									index: -1,
									gridR: innerTarget.gridR,
									gridC: innerTarget.gridC,
									x: innerTarget.position.x,
									z: innerTarget.position.z,
									rotationY: innerTarget.rotationY,
									isCorner: false,
								}
							: undefined;
				if (!runtime || !targetTile) return;

				teamPositionsRef.current[currentTeamIndexRef.current] = targetIndex;
				teamTileIdsRef.current[currentTeamIndexRef.current] = targetTileId;
				setTeamTileIds([...teamTileIdsRef.current]);
				setTeamPositions([...teamPositionsRef.current]);
				playerTileIndexRef.current = targetIndex;
				setPlayerTileIndex(targetIndex);
				const teamIndex = currentTeamIndexRef.current;
				const position = getPawnPosition(targetTile, teamIndex);
				runtime.pawnMeshes[teamIndex]?.position.copy(position);
			},
			openGoldCardModal,
			openChoiceModal: () => undefined,
			showToast: (title, message) => {
				setEventNotice({ title, message });
			},
		});
	}, [movePawnSteps, openGoldCardModal, pendingTileEvent]);

	useEffect(() => {
		if (!pendingTileEvent || pendingTileEvent.action.type !== 'MOVE_STEPS') {
			return;
		}

		// The timer state is intentionally initialized when a tile event opens.
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setEventCountdown(2);
		const countdownTimer = window.setInterval(() => {
			setEventCountdown((current) =>
				current && current > 1 ? current - 1 : current,
			);
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
		)
			return;
		const { diceList, orbit } = runtimeRef.current;

		hasRolledThisGameRef.current = true;
		setHasRolledThisGame(true);
		setIsRolling(true);
		isRollingRef.current = true;
		setScores([]);

		const forwardX = -Math.sin(orbit.theta);
		const forwardZ = -Math.cos(orbit.theta);

		diceList.forEach((dice, idx) => {
			dice.body.wakeUp();
			dice.isSleeping = false;

			// 중앙 주사위 링 구역으로 드롭
			dice.body.position.set(
				(Math.random() - 0.5) * 2,
				6 + idx * 1.5,
				(Math.random() - 0.5) * 2,
			);
			dice.body.velocity.setZero();
			dice.body.angularVelocity.setZero();

			dice.body.quaternion.setFromEuler(
				Math.random() * Math.PI * 2,
				Math.random() * Math.PI * 2,
				Math.random() * Math.PI * 2,
			);

			const force = 5.5 + Math.random() * 4;
			dice.body.applyImpulse(
				new CANNON.Vec3(
					forwardX * force + (Math.random() - 0.5) * 3,
					-4 - Math.random() * 3,
					forwardZ * force + (Math.random() - 0.5) * 3,
				),
				new CANNON.Vec3(
					(Math.random() - 0.5) * 0.3,
					0.4,
					(Math.random() - 0.5) * 0.3,
				),
			);

			dice.body.angularVelocity.set(
				(Math.random() - 0.5) * 25,
				(Math.random() - 0.5) * 25,
				(Math.random() - 0.5) * 25,
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
			)
				return;

			if (pendingTileEvent || eventNotice) return;
			if (isEditMode || isRolling || isMovingPawn) return;

			event.preventDefault();
			rollDice();
		};

		window.addEventListener('keydown', handleSpacebar);
		return () => window.removeEventListener('keydown', handleSpacebar);
	}, [
		eventNotice,
		isEditMode,
		isMovingPawn,
		isRolling,
		pendingTileEvent,
		rollDice,
	]);

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

	const beginTileSelection = (mode: 'next' | 'teleport' | 'direction') => {
		tileSelectionModeRef.current = mode;
		setTileSelectionMode(mode);
		setIsMovingInnerTile(false);
		isMovingInnerTileRef.current = false;
		setIsAddingInnerTile(false);
		switchView('top');
	};

	const selectEditableTile = async (tileId: string) => {
		if (!isEditMode || !activeBoardgameId || !activeBoardgameCanEdit) {
			selectTile(tileId);
			return;
		}
		const result = await acquireBoardgameTileEditLock(
			activeBoardgameId,
			tileId,
		);
		if (!result.success) {
			setBoardgameStatus(result.message);
			return;
		}
		setBoardTilesMap((current) => {
			const next = new Map(current);
			const tile = next.get(tileId);
			if (tile) next.set(tileId, { ...tile, lockedByUserName: result.data });
			boardTilesMapRef.current = next;
			return next;
		});
		setBoardgameStatus(`타일 ${tileId} 편집 잠금을 확보했습니다.`);
		selectTile(tileId);
	};
	const selectEditableTileRef = useRef<(tileId: string) => void>(() => {});
	useEffect(() => {
		selectEditableTileRef.current = (tileId) => void selectEditableTile(tileId);
	});

	const handleToggleEditMode = async () => {
		if (!isEditMode) {
			if (!activeBoardgameId || !activeBoardgameCanEdit || isBoardgameBusy)
				return;
			if (selectedTileId) {
				setIsBoardgameBusy(true);
				const lockResult = await acquireBoardgameTileEditLock(
					activeBoardgameId,
					selectedTileId,
				);
				setIsBoardgameBusy(false);
				if (!lockResult.success) {
					setBoardgameStatus(lockResult.message);
					return;
				}
				setBoardTilesMap((current) => {
					const next = new Map(current);
					const tile = next.get(selectedTileId);
					if (tile) {
						next.set(selectedTileId, {
							...tile,
							lockedByUserName: lockResult.data,
						});
					}
					boardTilesMapRef.current = next;
					return next;
				});
			}
			editModeRef.current = true;
			setIsEditMode(true);
			setBoardgameStatus(
				'편집할 타일을 선택하세요. 타일 잠금은 선택 시 설정됩니다.',
			);
			return;
		}
		if (!activeBoardgameId || isBoardgameBusy) return;
		setIsBoardgameBusy(true);
		const tiles = [...boardTilesMap.values()];
		const shouldSaveGridSize =
			boardSize.rows !== persistedGridSizeRef.current.rows ||
			boardSize.cols !== persistedGridSizeRef.current.cols;
		const shouldSaveGoldCards =
			JSON.stringify(goldCards) !== persistedGoldCardsRef.current;
		const result = await saveBoardgame({
			id: activeBoardgameId,
			gridRows: boardSize.rows,
			gridCols: boardSize.cols,
			tiles,
			goldCards,
			saveGridSize: shouldSaveGridSize,
			saveGoldCards: shouldSaveGoldCards,
			tileIdRenames: [...tileIdRenamesRef.current].map(([from, to]) => ({
				from,
				to,
			})),
		});
		if (!result.success) {
			setBoardgameStatus(result.message);
			setIsBoardgameBusy(false);
			return;
		}
		tileIdRenamesRef.current.clear();
		persistedGridSizeRef.current = boardSize;
		persistedGoldCardsRef.current = JSON.stringify(goldCards);
		editModeRef.current = false;
		setIsEditMode(false);
		setIsAddingInnerTile(false);
		isAddingInnerTileRef.current = false;
		setIsMovingInnerTile(false);
		isMovingInnerTileRef.current = false;
		tileSelectionModeRef.current = null;
		setTileSelectionMode(null);
		selectingGoldCardIdRef.current = null;
		setSelectingGoldCardId(null);
		selectTile(null);
		setBoardgameStatus('변경 사항을 저장하고 타일 잠금을 해제했습니다.');
		const refreshed = await getBoardgame(activeBoardgameId);
		if (refreshed.success) {
			const game = refreshed.data;
			setBoardTilesMap(new Map(game.tiles.map((tile) => [tile.id, tile])));
			setGoldCards(game.gold_cards);
			setBoardSize({ rows: game.grid_rows, cols: game.grid_cols });
			persistedGridSizeRef.current = {
				rows: game.grid_rows,
				cols: game.grid_cols,
			};
			persistedGoldCardsRef.current = JSON.stringify(game.gold_cards);
			setGridSizeDraft({
				rows: String(game.grid_rows),
				cols: String(game.grid_cols),
			});
			setBoardRefreshKey((current) => current + 1);
		}
		await refreshBoardgameList();
		setIsBoardgameBusy(false);
	};

	const handleToggleAddingInnerTile = () => {
		if (isAddingInnerTile) {
			setIsAddingInnerTile(false);
			isAddingInnerTileRef.current = false;
			return;
		}
		setIsAddingInnerTile(true);
		isAddingInnerTileRef.current = true;
		setIsMovingInnerTile(false);
		isMovingInnerTileRef.current = false;
		tileSelectionModeRef.current = null;
		setTileSelectionMode(null);
		selectTile(null);
		switchView('top');
	};

	const handleMoveTilePosition = () => {
		if (isMovingInnerTile) {
			setIsMovingInnerTile(false);
			isMovingInnerTileRef.current = false;
			return;
		}
		setIsAddingInnerTile(false);
		isAddingInnerTileRef.current = false;
		tileSelectionModeRef.current = null;
		setTileSelectionMode(null);
		setIsMovingInnerTile(true);
		isMovingInnerTileRef.current = true;
		switchView('top');
	};

	const handleCloseTileInspector = () => {
		setIsMovingInnerTile(false);
		isMovingInnerTileRef.current = false;
		tileSelectionModeRef.current = null;
		setTileSelectionMode(null);
		selectTile(null);
	};

	const handleChangeTeamName = (teamIndex: number, name: string) => {
		setTeamNames((current) =>
			current.map((teamName, index) =>
				index === teamIndex ? name.slice(0, 24) : teamName,
			),
		);
	};

	const handleRestartGame = () => {
		const runtime = runtimeRef.current;
		const startTile = runtime?.boardTiles[0];
		const startTileId = startTile?.id ?? 'outer_0';
		teamPositionsRef.current = teams.map(() => 0);
		teamTileIdsRef.current = teams.map(() => startTileId);
		setTeamTileIds([...teamTileIdsRef.current]);
		currentTeamIndexRef.current = 0;
		lastMovedTeamIndexRef.current = 0;
		playerTileIndexRef.current = 0;
		hasRolledThisGameRef.current = false;
		setTeamPositions([...teamPositionsRef.current]);
		setCurrentTeamIndex(0);
		setPlayerTileIndex(0);
		setScores([]);
		setHasRolledThisGame(false);
		setGoldCardDrawPile([]);
		setDrawnGoldCard(null);
		drawnGoldCardRef.current = null;
		setIsGoldCardModalOpen(false);
		setPendingTileEvent(null);
		setEventCountdown(null);
		setEventNotice(null);
		setSelectedTileId(null);
		selectedTileIdRef.current = null;
		if (runtime && startTile) {
			runtime.pawnMeshes.forEach((pawn, index) => {
				pawn.position.copy(getPawnPosition(startTile, index));
				pawn.scale.set(1, 1, 1);
			});
		}
		diceCountRef.current = 2;
		setDiceCount(2);
		syncDiceCount(2);
		setIsRestartConfirmOpen(false);
		setBoardgameStatus('게임을 처음부터 다시 시작합니다.');
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
			mesh.visible = !editModeRef.current;
			scene.add(mesh);

			const body = new CANNON.Body({
				mass: 1.0,
				shape: boxShape,
				sleepTimeLimit: 0.1,
				sleepSpeedLimit: 0.15,
			});

			body.position.set(
				(Math.random() - 0.5) * 2,
				5 + diceList.length * 1.2,
				(Math.random() - 0.5) * 2,
			);
			world.addBody(body);

			diceList.push({
				body,
				isSleeping: false,
				lastValue: 1,
				mesh,
			});
		}
	};

	const handleDiceCountChange = (nextCount: number) => {
		if (
			!Number.isInteger(nextCount) ||
			nextCount < 1 ||
			nextCount > 3 ||
			isRollingRef.current ||
			isMovingPawn
		)
			return;
		diceCountRef.current = nextCount;
		setDiceCount(nextCount);
		syncDiceCount(nextCount);
	};

	useEffect(() => {
		if (!canvasRef.current || !containerRef.current) return;
		const tileMeshMap = tileMeshMapRef.current;
		const innerCellMeshMap = innerCellMeshMapRef.current;
		const innerCellOutlineMap = innerCellOutlineMapRef.current;
		setIsBoardReady(false);

		// 1. Scene & Camera
		const scene = new THREE.Scene();
		scene.background = new THREE.Color(0x090d16);

		const width = containerRef.current.clientWidth;
		const height = containerRef.current.clientHeight;

		const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 150);
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
		floorBody.quaternion.setFromAxisAngle(
			new CANNON.Vec3(-1, 0, 0),
			Math.PI * 0.5,
		);
		world.addBody(floorBody);

		// 3. M * N 주루마블 외곽 타일 빌드 부분
		const tileWidth = 4.8;
		const tileHeight = 4.8;
		const stepX = tileWidth + 0.15;
		const stepZ = tileHeight + 0.15;
		const halfW = ((boardSize.cols - 1) * stepX) / 2;
		const halfH = ((boardSize.rows - 1) * stepZ) / 2;
		const boardTiles = generateBoardTiles(
			boardSize.rows,
			boardSize.cols,
			tileWidth,
			tileHeight,
			0.15,
		);
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
					subLabel: '무슨 이벤트를 넣을지 고민해보세요',
					color: '#1e293b',
					textColor: '#ffffff',
					nextTileIds: [boardTiles[(tile.index + 1) % boardTiles.length].id],
					action: {
						type: 'NONE',
						params: { promptMessage: `test-${tile.index}` },
					},
					isLocked: true,
				} satisfies BoardTileData;
				const previousTile = boardTilesMapRef.current.get(tile.id);
				const tileData = previousTile
					? {
							...defaultTile,
							...previousTile,
							gridR: tile.gridR,
							gridC: tile.gridC,
							rotationY: tile.rotationY,
							position: defaultTile.position,
						}
					: defaultTile;

				return [tile.id, tileData] as const;
			}),
		);

		for (const previousTile of boardTilesMapRef.current.values()) {
			if (
				previousTile.category !== 'INNER' ||
				previousTile.gridR < 1 ||
				previousTile.gridR >= boardSize.rows - 1 ||
				previousTile.gridC < 1 ||
				previousTile.gridC >= boardSize.cols - 1
			)
				continue;

			tileDataMap.set(previousTile.id, {
				...previousTile,
				position: {
					x: previousTile.gridC * stepX - halfW,
					y: 0.2,
					z: previousTile.gridR * stepZ - halfH,
				},
			});
		}

		setBoardTilesMap(tileDataMap);
		setIsBoardReady(true);

		const boxGeo = new THREE.BoxGeometry(tileWidth, 0.4, tileHeight);
		const createTileMesh = (tileData: BoardTileData) => {
			const isOuter = tileData.category === 'OUTER';
			const isCorner =
				isOuter &&
				(tileData.gridR === 0 || tileData.gridR === boardSize.rows - 1) &&
				(tileData.gridC === 0 || tileData.gridC === boardSize.cols - 1);
			const tileGeometry = isOuter
				? new THREE.BoxGeometry(
						isCorner ? tileWidth * 1.6 : tileWidth,
						0.4,
						tileHeight * 1.6,
					)
				: boxGeo;
			const topTexture = createDynamicTileTexture(
				tileData.label,
				tileData.color,
				tileData.textColor,
				tileData.action.type === 'DRAW_GOLD_CARD',
				isCorner ? 1 : tileWidth / (tileHeight * (isOuter ? 1.6 : 1)),
			);
			const sideMat = new THREE.MeshStandardMaterial({
				color: 0x1e293b,
				roughness: 0.6,
			});
			const topMat = new THREE.MeshStandardMaterial({
				map: topTexture,
				roughness: 0.3,
			});

			// Material 순서: [right, left, top, bottom, front, back]
			const materials = [sideMat, sideMat, topMat, sideMat, sideMat, sideMat];
			const mesh = new THREE.Mesh(tileGeometry, materials);
			mesh.position.set(
				tileData.position.x,
				tileData.position.y,
				tileData.position.z,
			);
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

				const cellPlane = new THREE.Mesh(
					new THREE.PlaneGeometry(tileWidth, tileHeight),
					new THREE.MeshBasicMaterial({
						color: 0x38bdf8,
						transparent: true,
						opacity: 0.12,
						side: THREE.DoubleSide,
						depthWrite: false,
					}),
				);
				cellPlane.visible =
					![...tileDataMap.values()].some(
						(tile) =>
							tile.category === 'INNER' &&
							tile.gridR === gridR &&
							tile.gridC === gridC,
					) &&
					editModeRef.current &&
					(isAddingInnerTileRef.current || isMovingInnerTileRef.current);
				cellPlane.rotation.x = -Math.PI / 2;
				cellPlane.position.set(
					gridC * stepX - halfW,
					0.08,
					gridR * stepZ - halfH,
				);
				cellPlane.userData = { gridR, gridC };
				const cellOutline = new THREE.LineSegments(
					new THREE.EdgesGeometry(
						new THREE.PlaneGeometry(tileWidth, tileHeight),
					),
					new THREE.LineBasicMaterial({
						color: 0x38bdf8,
						transparent: true,
						opacity: 0.7,
					}),
				);
				cellOutline.visible = cellPlane.visible;
				cellOutline.rotation.x = -Math.PI / 2;
				cellOutline.position.copy(cellPlane.position);
				innerCellGrid.add(cellPlane, cellOutline);
				innerCellMeshMapRef.current.set(cellId, cellPlane);
				innerCellOutlineMapRef.current.set(cellId, cellOutline);
			}
		}

		const selectionBox = new THREE.BoxHelper(
			new THREE.Mesh(boxGeo),
			0x38bdf8, // 형광 하늘색 외곽선
		);
		selectionBox.visible = false;
		scene.add(selectionBox);
		selectionBoxRef.current = selectionBox;
		const selectedMesh = selectedTileIdRef.current
			? tileMeshMapRef.current.get(selectedTileIdRef.current)
			: undefined;
		if (selectedMesh) {
			selectionBox.setFromObject(selectedMesh);
			selectionBox.visible = true;
		}

		scene.add(tileMeshGroup);
		scene.add(innerCellGrid);

		// 4. 중앙 주사위 투척 구역 (펠트 필드 + 반투명 아크릴 안전 가벽)
		const innerW = (boardSize.cols - 2) * stepX;
		const innerH = (boardSize.rows - 2) * stepZ;

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
		const goldCardDeckGroup = createGoldCardDeckGroup();
		goldCardDeckGroup.visible = true;
		const startTile = boardTiles[0];
		goldCardDeckGroup.position.set(
			startTile.x + tileWidth * 0.8 + 1.9 / 2 + 0.25,
			0.15,
			startTile.z,
		);
		scene.add(goldCardDeckGroup);

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
		const pawnMeshes = TEAM_COLORS.map((color, teamIndex) => {
			const pawnMesh = new THREE.Group();
			const teamColor = new THREE.Color(color);
			const pawnBase = new THREE.Mesh(
				new THREE.CylinderGeometry(0.65, 0.75, 0.3, 32),
				new THREE.MeshStandardMaterial({
					color: teamColor,
					metalness: 0.3,
					roughness: 0.2,
				}),
			);
			const pawnBody = new THREE.Mesh(
				new THREE.ConeGeometry(0.55, 1.2, 32),
				new THREE.MeshStandardMaterial({
					color: teamColor,
					metalness: 0.2,
					roughness: 0.3,
				}),
			);
			pawnBody.position.y = 0.7;
			const pawnHead = new THREE.Mesh(
				new THREE.SphereGeometry(0.38, 32, 32),
				new THREE.MeshStandardMaterial({
					color: teamColor,
					roughness: 0.1,
					metalness: 0.1,
				}),
			);
			pawnHead.position.y = 1.45;

			pawnMesh.add(pawnBase, pawnBody, pawnHead);
			pawnMesh.traverse((child) => {
				if (child instanceof THREE.Mesh) child.castShadow = true;
			});

			const savedTileId = teamTileIdsRef.current[teamIndex];
			const savedOuterTile = boardTiles.find((tile) => tile.id === savedTileId);
			const savedInnerTile = boardTilesMapRef.current.get(savedTileId);
			const pawnStart =
				savedOuterTile ??
				(savedInnerTile?.category === 'INNER'
					? { x: savedInnerTile.position.x, z: savedInnerTile.position.z }
					: boardTiles[0]);
			pawnMesh.position.copy(getPawnPosition(pawnStart, teamIndex));
			pawnMesh.visible = !editModeRef.current;
			scene.add(pawnMesh);
			return pawnMesh;
		});

		// 6. 주사위 템플릿 및 Orbit 상태 설정
		const diceTemplate = createHighQualityDiceTemplate();
		const initialOrbitDefaults = getOrbitDefaults(
			viewModeRef.current,
			boardSize.rows,
			boardSize.cols,
		);
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
		const cameraView = cameraViewRestoreRef.current;
		if (cameraView) {
			orbitState.center.copy(cameraView.center);
			orbitState.targetCenter.copy(cameraView.targetCenter);
			orbitState.theta = cameraView.theta;
			orbitState.targetTheta = cameraView.targetTheta;
			orbitState.phi = cameraView.phi;
			orbitState.targetPhi = cameraView.targetPhi;
			orbitState.radius = cameraView.radius;
			orbitState.targetRadius = cameraView.targetRadius;
			cameraViewRestoreRef.current = null;
		}

		runtimeRef.current = {
			scene,
			camera,
			renderer,
			world,
			diceList: [],
			diceTemplate,
			goldCardDeckGroup,
			boardTiles,
			pawnMeshes,
			tileMeshGroup,
			reqId: null,
			orbit: orbitState,
		};

		syncDiceCount(diceCountRef.current);

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
				Math.min(
					Math.max(boardSize.rows, boardSize.cols) * 8,
					orbitState.targetRadius,
				),
			);

			orbitState.targetCenter.x = Math.max(
				-50,
				Math.min(50, orbitState.targetCenter.x),
			);
			orbitState.targetCenter.z = Math.max(
				-50,
				Math.min(50, orbitState.targetCenter.z),
			);

			// 카메라 중심점 Lerp 부드러운 보간
			orbitState.center.lerp(orbitState.targetCenter, 0.1);

			// 카메라 Orbit 각도 Lerp 보간
			orbitState.theta += (orbitState.targetTheta - orbitState.theta) * 0.1;
			orbitState.phi += (orbitState.targetPhi - orbitState.phi) * 0.1;
			orbitState.radius += (orbitState.targetRadius - orbitState.radius) * 0.1;

			// ★ 중심점(center)을 기준으로 카메라 구면 좌표 계산
			camera.position.x =
				orbitState.center.x +
				orbitState.radius *
					Math.sin(orbitState.phi) *
					Math.sin(orbitState.theta);
			camera.position.y =
				orbitState.center.y + orbitState.radius * Math.cos(orbitState.phi);
			camera.position.z =
				orbitState.center.z +
				orbitState.radius *
					Math.sin(orbitState.phi) *
					Math.cos(orbitState.theta);

			// ★ (0, 0, 0) 대신 이동된 center를 바라봄
			camera.lookAt(orbitState.center);

			// 주사위 물리 동기화 및 정지 판정
			const diceList = runtimeRef.current?.diceList ?? [];
			const allSleeping =
				diceList.length > 0 &&
				diceList.every((dice) => dice.body.sleepState === CANNON.Body.SLEEPING);
			const currentValues: number[] = [];

			diceList.forEach((dice) => {
				dice.mesh.position.copy(dice.body.position as unknown as THREE.Vector3);
				dice.mesh.quaternion.copy(
					dice.body.quaternion as unknown as THREE.Quaternion,
				);

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
					: Math.max(
							0.001,
							Math.min(Math.PI / 3.4, orbitState.targetPhi - deltaY * 0.007),
						);
		};

		const handlePointerUp = (e: MouseEvent | TouchEvent) => {
			orbitState.isDragging = false;

			const clientX =
				'changedTouches' in e
					? e.changedTouches[0].clientX
					: (e as MouseEvent).clientX;
			const clientY =
				'changedTouches' in e
					? e.changedTouches[0].clientY
					: (e as MouseEvent).clientY;

			const dist = Math.hypot(
				clientX - pointerDownPos.current.x,
				clientY - pointerDownPos.current.y,
			);

			// 5픽셀 미만 움직였을 때만 "클릭(피킹)"으로 판정
			if (dist < 5 && containerRef.current) {
				//(dist < 5 && editModeRef.current && containerRef.current) {
				const rect = containerRef.current.getBoundingClientRect();
				const mouseX = ((clientX - rect.left) / rect.width) * 2 - 1;
				const mouseY = -((clientY - rect.top) / rect.height) * 2 + 1;

				const raycaster = new THREE.Raycaster();
				raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);

				// 타일 메시 그룹과 충돌 검사
				const intersects = raycaster.intersectObjects(
					tileMeshGroup.children,
					false,
				);

				if (intersects.length > 0) {
					const hitMesh = intersects[0].object as THREE.Mesh;
					const tileId = hitMesh.userData.tileId;
					const selectionMode = tileSelectionModeRef.current;
					const sourceId = selectedTileIdRef.current;
					if (tileId && selectionMode === 'gold-card-effect-target') {
						applyDrawnGoldCard({ tileId });
						tileSelectionModeRef.current = null;
						setTileSelectionMode(null);
					} else if (
						tileId &&
						selectionMode === 'gold-card-target' &&
						selectingGoldCardIdRef.current
					) {
						const cardId = selectingGoldCardIdRef.current;
						setGoldCards((current) =>
							current.map((card) =>
								card.id === cardId
									? { ...card, event: { ...card.event, targetTileId: tileId } }
									: card,
							),
						);
						selectingGoldCardIdRef.current = null;
						setSelectingGoldCardId(null);
						tileSelectionModeRef.current = null;
						setTileSelectionMode(null);
						if (sourceId) selectTile(sourceId);
					} else if (
						tileId &&
						selectionMode &&
						sourceId &&
						tileId !== sourceId
					) {
						const sourceTile = boardTilesMapRef.current.get(sourceId);
						if (sourceTile) {
							const updatedTile =
								selectionMode === 'next'
									? { ...sourceTile, nextTileIds: [tileId] }
									: {
											...sourceTile,
											action: {
												...sourceTile.action,
												params: {
													...sourceTile.action.params,
													targetTileId: tileId,
												},
											},
										};
							const nextMap = new Map(boardTilesMapRef.current);
							nextMap.set(sourceId, updatedTile);
							boardTilesMapRef.current = nextMap;
							setBoardTilesMap(nextMap);
							tileSelectionModeRef.current = null;
							setTileSelectionMode(null);
							selectTile(sourceId);
						}
					} else if (
						tileId &&
						!isMovingInnerTileRef.current &&
						!selectionMode
					) {
						selectEditableTileRef.current(tileId);
					}
				} else if (
					editModeRef.current &&
					(isAddingInnerTileRef.current || isMovingInnerTileRef.current)
				) {
					const cellIntersections = raycaster.intersectObjects(
						Array.from(innerCellMeshMapRef.current.values()),
						false,
					);
					const cellMesh = cellIntersections[0]?.object as
						| THREE.Mesh
						| undefined;
					if (cellMesh) {
						const { gridR, gridC } = cellMesh.userData as {
							gridR: number;
							gridC: number;
						};
						const id = `inner_${gridR}_${gridC}`;
						const isOccupied = [...boardTilesMapRef.current.values()].some(
							(tile) =>
								tile.category === 'INNER' &&
								tile.gridR === gridR &&
								tile.gridC === gridC,
						);
						const movingTileId = selectedTileIdRef.current;
						if (isMovingInnerTileRef.current && movingTileId) {
							const selectedTile = boardTilesMapRef.current.get(movingTileId);
							if (selectedTile?.category === 'INNER' && !isOccupied) {
								const newTileId = id;
								const movedTile = {
									...selectedTile,
									id: newTileId,
									gridR,
									gridC,
									position: {
										x: gridC * stepX - halfW,
										y: 0.2,
										z: gridR * stepZ - halfH,
									},
								};
								tileIdRenamesRef.current.set(movingTileId, newTileId);
								const nextTileMap = new Map(boardTilesMapRef.current);
								nextTileMap.delete(movingTileId);
								nextTileMap.set(newTileId, movedTile);
								for (const [tileId, tile] of nextTileMap) {
									const nextTileIds = tile.nextTileIds.map((nextId) =>
										nextId === movingTileId ? newTileId : nextId,
									);
									const action =
										tile.action.params?.targetTileId === movingTileId
											? {
													...tile.action,
													params: {
														...tile.action.params,
														targetTileId: newTileId,
													},
												}
											: tile.action;
									nextTileMap.set(tileId, { ...tile, nextTileIds, action });
								}
								boardTilesMapRef.current = nextTileMap;
								setBoardTilesMap(nextTileMap);
								teamTileIdsRef.current = teamTileIdsRef.current.map((tileId) =>
									tileId === movingTileId ? newTileId : tileId,
								);
								setTeamTileIds([...teamTileIdsRef.current]);
								setTeamPositions([...teamPositionsRef.current]);
								const tileMesh = tileMeshMapRef.current.get(movingTileId);
								if (tileMesh) {
									tileMesh.position.set(
										movedTile.position.x,
										movedTile.position.y,
										movedTile.position.z,
									);
									tileMesh.userData.tileId = newTileId;
									tileMeshMapRef.current.delete(movingTileId);
									tileMeshMapRef.current.set(newTileId, tileMesh);
								}
								setIsMovingInnerTile(false);
								selectTile(newTileId);
							}
						} else if (!isMovingInnerTileRef.current && !isOccupied) {
							let newTileId = id;
							let suffix = 1;
							while (boardTilesMapRef.current.has(newTileId)) {
								newTileId = `${id}_${suffix++}`;
							}
							const innerTile: BoardTileData = {
								id: newTileId,
								category: 'INNER',
								gridR,
								gridC,
								position: {
									x: gridC * stepX - halfW,
									y: 0.2,
									z: gridR * stepZ - halfH,
								},
								rotationY: 0,
								label: `내부 타일 ${gridR}, ${gridC}`,
								subLabel: '타일 속성에서 내용을 설정하세요.',
								color: '#0f172a',
								textColor: '#ffffff',
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
						}
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
			orbitState.targetRadius = Math.max(
				10,
				Math.min(
					Math.max(boardSize.rows, boardSize.cols) * 8,
					orbitState.targetRadius + e.deltaY * 0.025,
				),
			);
		};

		const getMovementKey = (
			e: KeyboardEvent,
		): 'w' | 'a' | 's' | 'd' | 'q' | 'e' | 'z' | 'x' | null => {
			const key = e.code.startsWith('Key')
				? e.code.slice(3).toLowerCase()
				: e.key.toLowerCase();
			return key === 'w' ||
				key === 'a' ||
				key === 's' ||
				key === 'd' ||
				key === 'q' ||
				key === 'e' ||
				key === 'z' ||
				key === 'x'
				? key
				: null;
		};

		const handleKeyDown = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement | null;
			const tagName = target?.tagName?.toLowerCase();
			if (
				tagName === 'input' ||
				tagName === 'textarea' ||
				target?.isContentEditable
			)
				return;

			const key = getMovementKey(e);
			if (key) {
				e.preventDefault();
				e.stopPropagation();
				orbitState.keys[key] = true;
			}
			if (e.key.toLowerCase() === 'r' || e.code === 'KeyR') {
				e.preventDefault();
				e.stopPropagation();

				const defaults = getOrbitDefaults(
					viewModeRef.current,
					boardSize.rows,
					boardSize.cols,
				);
				orbitState.center.set(0, 0, 0);
				orbitState.targetCenter.set(0, 0, 0);
				orbitState.theta = defaults.theta;
				orbitState.targetTheta = defaults.theta;
				orbitState.phi = defaults.phi;
				orbitState.targetPhi = defaults.phi;
				orbitState.radius = defaults.radius;
				orbitState.targetRadius = defaults.radius;
				orbitState.keys = {
					w: false,
					a: false,
					s: false,
					d: false,
					q: false,
					e: false,
					z: false,
					x: false,
				};
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
				if (object.geometry !== boxGeo) object.geometry.dispose();
				const materials = Array.isArray(object.material)
					? object.material
					: [object.material];
				materials.forEach((material) => {
					material.map?.dispose();
					material.dispose();
				});
			});
			boxGeo.dispose();
			innerCellGrid.traverse((object) => {
				if (
					!(
						object instanceof THREE.Mesh || object instanceof THREE.LineSegments
					)
				)
					return;
				object.geometry.dispose();
				const materials = Array.isArray(object.material)
					? object.material
					: [object.material];
				materials.forEach((material) => material.dispose());
			});
			selectionBox.geometry.dispose();
			disposeGoldCardDeckGroup(goldCardDeckGroup);
			tileMeshMap.clear();
			innerCellMeshMap.clear();
			innerCellOutlineMap.clear();
			innerCellGridRef.current = null;
			diceTemplate.dispose();
			renderer.dispose();
		};
	}, [
		activeBoardgameId,
		applyDrawnGoldCard,
		boardRefreshKey,
		boardSize,
		movePawnSteps,
	]);

	const applyGridSize = () => {
		const rows = Number(gridSizeDraft.rows);
		const cols = Number(gridSizeDraft.cols);
		if (
			!Number.isInteger(rows) ||
			!Number.isInteger(cols) ||
			rows < 3 ||
			rows > 20 ||
			cols < 3 ||
			cols > 20
		) {
			setGridSizeError('행과 열은 3부터 20 사이의 정수로 설정해 주세요.');
			return;
		}

		setGridSizeError('');
		setGridSizeDraft({ rows: String(rows), cols: String(cols) });
		if (rows === boardSize.rows && cols === boardSize.cols) return;

		teamPositionsRef.current = teams.map(() => 0);
		teamTileIdsRef.current = teams.map(() => 'outer_0');
		setTeamTileIds([...teamTileIdsRef.current]);
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

	const refreshBoardgameList = useCallback(async () => {
		const result = await listBoardgames();
		if (result.success) setBoardgames(result.data);
		else setBoardgameStatus(result.message);
	}, []);

	useEffect(() => {
		let isActive = true;
		let refreshTimer: ReturnType<typeof setTimeout> | undefined;
		const refreshActiveBoard = () => {
			if (!activeBoardgameId || editModeRef.current) return;
			if (refreshTimer) clearTimeout(refreshTimer);
			refreshTimer = setTimeout(() => {
				void (async () => {
					const result = await getBoardgame(activeBoardgameId);
					if (!isActive) return;
					if (!result.success) {
						setBoardgameStatus(result.message);
						return;
					}

					const game = result.data;
					const currentOrbit = runtimeRef.current?.orbit;
					if (currentOrbit) {
						cameraViewRestoreRef.current = {
							center: currentOrbit.center.clone(),
							targetCenter: currentOrbit.targetCenter.clone(),
							theta: currentOrbit.theta,
							phi: currentOrbit.phi,
							radius: currentOrbit.radius,
							targetTheta: currentOrbit.targetTheta,
							targetPhi: currentOrbit.targetPhi,
							targetRadius: currentOrbit.targetRadius,
						};
					}

					const tiles = new Map(game.tiles.map((tile) => [tile.id, tile]));
					if (
						selectedTileIdRef.current &&
						!tiles.has(selectedTileIdRef.current)
					) {
						selectedTileIdRef.current = null;
						setSelectedTileId(null);
						orbitSnapshotRef.current = null;
					}
					setBoardSize({ rows: game.grid_rows, cols: game.grid_cols });
					persistedGridSizeRef.current = {
						rows: game.grid_rows,
						cols: game.grid_cols,
					};
					setGridSizeDraft({
						rows: String(game.grid_rows),
						cols: String(game.grid_cols),
					});
					setBoardTilesMap(tiles);
					setGoldCards(game.gold_cards);
					persistedGoldCardsRef.current = JSON.stringify(game.gold_cards);
					setGoldCardDrawPile([]);
					setBoardRefreshKey((current) => current + 1);
					setBoardgameStatus('다른 사용자의 변경 사항을 반영했습니다.');
				})();
			}, 300);
		};

		let channel = supabase
			.channel(`boardgame-realtime-${activeBoardgameId ?? 'list'}`)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'boardgames' },
				(payload) => {
					void refreshBoardgameList();
					const row = (
						payload.eventType === 'DELETE' ? payload.old : payload.new
					) as { id?: string };
					if (row.id !== activeBoardgameId) return;
					if (payload.eventType === 'DELETE') {
						editModeRef.current = false;
						setIsEditMode(false);
						const orbit = runtimeRef.current?.orbit;
						if (orbit) {
							cameraViewRestoreRef.current = {
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
						setActiveBoardgameId(null);
						loadedProgressBoardgameIdRef.current = null;
						setActiveBoardgameCanEdit(false);
						setActiveBoardgameIsMaker(false);
						setBoardTilesMap(new Map());
						setGoldCards([]);
						setSelectedTileId(null);
						selectedTileIdRef.current = null;
						orbitSnapshotRef.current = null;
						setBoardRefreshKey((current) => current + 1);
						setBoardgameStatus('선택한 보드게임이 삭제되었습니다.');
						return;
					}
					refreshActiveBoard();
				},
			);

		if (activeBoardgameId) {
			const filter = `boardgame_id=eq.${activeBoardgameId}`;
			channel = channel
				.on(
					'postgres_changes',
					{ event: '*', schema: 'public', table: 'boardgame_tiles', filter },
					refreshActiveBoard,
				)
				.on(
					'postgres_changes',
					{
						event: '*',
						schema: 'public',
						table: 'boardgame_tile_next',
						filter,
					},
					refreshActiveBoard,
				)
				.on(
					'postgres_changes',
					{
						event: '*',
						schema: 'public',
						table: 'boardgame_gold_cards',
						filter,
					},
					refreshActiveBoard,
				);
		}
		channel.subscribe();

		return () => {
			isActive = false;
			if (refreshTimer) clearTimeout(refreshTimer);
			void supabase.removeChannel(channel);
		};
	}, [activeBoardgameId, refreshBoardgameList, supabase]);

	const activeBoardgameEditors =
		boardgames.find((game) => game.id === activeBoardgameId)?.editors ?? [];

	const handleLoadBoardgame = async (boardgameId: string) => {
		if (!boardgameId) {
			loadedProgressBoardgameIdRef.current = null;
			editModeRef.current = false;
			setIsEditMode(false);
			selectedTileIdRef.current = null;
			orbitSnapshotRef.current = null;
			cameraViewRestoreRef.current = null;
			setActiveBoardgameId(null);
			setActiveBoardgameCanEdit(false);
			setActiveBoardgameIsMaker(false);
			setBoardTilesMap(new Map());
			setGoldCards([]);
			setGoldCardDrawPile([]);
			setSelectedTileId(null);
			setBoardRefreshKey((current) => current + 1);
			return;
		}

		setIsBoardgameBusy(true);
		setBoardgameStatus('게임을 불러오는 중…');
		const result = await getBoardgame(boardgameId);
		if (!result.success) {
			setBoardgameStatus(result.message);
			setIsBoardgameBusy(false);
			return;
		}

		const game = result.data;
		const summary = boardgames.find((item) => item.id === game.id);
		const progressKey = `dice-arena-progress:${game.id}`;
		let savedProgress: {
			teamNames?: unknown;
			teamTileIds?: unknown;
			currentTeamIndex?: unknown;
			hasRolled?: unknown;
			scores?: unknown;
		} = {};
		try {
			const rawProgress = window.localStorage.getItem(progressKey);
			if (rawProgress) {
				const parsed: unknown = JSON.parse(rawProgress);
				if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
					savedProgress = parsed;
				}
			}
		} catch {
			try {
				window.localStorage.removeItem(progressKey);
			} catch {
				// 저장소 접근이 불가능하면 기본 진행 상태로 시작합니다.
			}
		}
		const outerTiles = generateBoardTiles(
			game.grid_rows,
			game.grid_cols,
			4.8,
			4.8,
			0.15,
		);
		const outerTileIndexById = new Map(
			outerTiles.map((tile, index) => [tile.id, index]),
		);
		const validTileIds = new Set([
			...outerTiles.map((tile) => tile.id),
			...game.tiles.map((tile) => tile.id),
		]);
		const savedTileIds = Array.isArray(savedProgress.teamTileIds)
			? savedProgress.teamTileIds
			: [];
		const restoredTileIds = DEFAULT_TEAM_NAMES.map((_, index) => {
			const candidate = savedTileIds[index];
			return typeof candidate === 'string' && validTileIds.has(candidate)
				? candidate
				: (outerTiles[0]?.id ?? 'outer_0');
		});
		const restoredPositions = restoredTileIds.map(
			(tileId) => outerTileIndexById.get(tileId) ?? -1,
		);
		const restoredNames = DEFAULT_TEAM_NAMES.map((fallback, index) => {
			const candidate = Array.isArray(savedProgress.teamNames)
				? savedProgress.teamNames[index]
				: null;
			return typeof candidate === 'string' && candidate.trim()
				? candidate.trim().slice(0, 24)
				: fallback;
		});
		const restoredCurrentTeam =
			typeof savedProgress.currentTeamIndex === 'number' &&
			Number.isInteger(savedProgress.currentTeamIndex) &&
			savedProgress.currentTeamIndex >= 0 &&
			savedProgress.currentTeamIndex < DEFAULT_TEAM_NAMES.length
				? savedProgress.currentTeamIndex
				: 0;
		const restoredScores = Array.isArray(savedProgress.scores)
			? savedProgress.scores
					.filter(
						(value): value is number =>
							typeof value === 'number' && Number.isFinite(value),
					)
					.slice(0, 6)
			: [];
		const restoredHasRolled = savedProgress.hasRolled === true;
		selectedTileIdRef.current = null;
		orbitSnapshotRef.current = null;
		cameraViewRestoreRef.current = null;
		setActiveBoardgameId(game.id);
		loadedProgressBoardgameIdRef.current = game.id;
		editModeRef.current = false;
		setIsEditMode(false);
		setActiveBoardgameCanEdit(summary?.can_edit ?? false);
		setActiveBoardgameIsMaker(summary?.is_maker ?? false);
		setBoardSize({ rows: game.grid_rows, cols: game.grid_cols });
		persistedGridSizeRef.current = {
			rows: game.grid_rows,
			cols: game.grid_cols,
		};
		setGridSizeDraft({
			rows: String(game.grid_rows),
			cols: String(game.grid_cols),
		});
		setBoardTilesMap(new Map(game.tiles.map((tile) => [tile.id, tile])));
		setGoldCards(game.gold_cards);
		persistedGoldCardsRef.current = JSON.stringify(game.gold_cards);
		setGoldCardDrawPile([]);
		setSelectedTileId(null);
		teamPositionsRef.current = restoredPositions;
		teamTileIdsRef.current = restoredTileIds;
		setTeamTileIds([...teamTileIdsRef.current]);
		setTeamPositions([...teamPositionsRef.current]);
		setTeamNames(restoredNames);
		setCurrentTeamIndex(restoredCurrentTeam);
		currentTeamIndexRef.current = restoredCurrentTeam;
		setPlayerTileIndex(restoredPositions[restoredCurrentTeam] ?? 0);
		playerTileIndexRef.current = restoredPositions[restoredCurrentTeam] ?? 0;
		setHasRolledThisGame(restoredHasRolled);
		hasRolledThisGameRef.current = restoredHasRolled;
		setScores(restoredScores);
		setSelectedTileId(null);
		setBoardRefreshKey((current) => current + 1);
		setBoardgameStatus('게임을 불러왔습니다.');
		setIsBoardgameBusy(false);
	};

	const handleCreatedBoardgame = (game: BoardgameSummary) => {
		setBoardgames((current) => [
			game,
			...current.filter((item) => item.id !== game.id),
		]);
		setActiveBoardgameId(game.id);
		loadedProgressBoardgameIdRef.current = game.id;
		setActiveBoardgameCanEdit(true);
		setActiveBoardgameIsMaker(true);
		setBoardSize({ rows: game.grid_rows, cols: game.grid_cols });
		persistedGridSizeRef.current = {
			rows: game.grid_rows,
			cols: game.grid_cols,
		};
		setGridSizeDraft({
			rows: String(game.grid_rows),
			cols: String(game.grid_cols),
		});
		setBoardTilesMap(new Map());
		setGoldCards([]);
		setTeamNames(DEFAULT_TEAM_NAMES);
		teamPositionsRef.current = teams.map(() => 0);
		teamTileIdsRef.current = teams.map(() => 'outer_0');
		setTeamTileIds([...teamTileIdsRef.current]);
		setTeamPositions([...teamPositionsRef.current]);
		currentTeamIndexRef.current = 0;
		setCurrentTeamIndex(0);
		setPlayerTileIndex(0);
		playerTileIndexRef.current = 0;
		hasRolledThisGameRef.current = false;
		setHasRolledThisGame(false);
		setScores([]);
		persistedGoldCardsRef.current = '[]';
		setGoldCardDrawPile([]);
		setSelectedTileId(null);
		selectedTileIdRef.current = null;
		setBoardRefreshKey((current) => current + 1);
		setBoardgameStatus('보드게임이 생성되었습니다.');
	};

	const handleGrantEditor = async (userName: string): Promise<boolean> => {
		if (!activeBoardgameId || !userName.trim()) return false;
		setIsBoardgameBusy(true);
		const result = await grantBoardgameEditor(
			activeBoardgameId,
			userName.trim(),
		);
		if (!result.success) {
			setBoardgameStatus(result.message);
			setIsBoardgameBusy(false);
			return false;
		}
		await refreshBoardgameList();
		setBoardgameStatus('편집 권한을 추가했습니다.');
		setIsBoardgameBusy(false);
		return true;
	};

	const handleRevokeEditor = async (userName: string) => {
		if (!activeBoardgameId) return;
		setIsBoardgameBusy(true);
		const result = await revokeBoardgameEditor(activeBoardgameId, userName);
		if (!result.success) {
			setBoardgameStatus(result.message);
			setIsBoardgameBusy(false);
			return;
		}
		await refreshBoardgameList();
		setBoardgameStatus('편집 권한을 회수했습니다.');
		setIsBoardgameBusy(false);
	};

	const totalScore = scores.reduce((acc, cur) => acc + cur, 0);
	return (
		<>
			<BoardgameHeader
				boardgames={boardgames}
				activeBoardgameId={activeBoardgameId}
				canCreateBoardgame={canCreateBoardgame}
				isBusy={isBoardgameBusy || isEditMode}
				onSelect={(id) => void handleLoadBoardgame(id)}
				onCreated={handleCreatedBoardgame}
				activeBoardgameIsMaker={activeBoardgameIsMaker}
				editors={activeBoardgameEditors}
				status={boardgameStatus}
				onGrantEditor={handleGrantEditor}
				onRevokeEditor={handleRevokeEditor}
			/>

			{activeBoardgameId && (
				<div
					className={`flex w-full flex-col overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl select-none lg:flex-row ${
						isFullscreen
							? 'fixed inset-0 z-50 h-screen rounded-none'
							: 'rounded-3xl h-180'
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
										style={{
											backgroundColor: pendingTileEvent.color || '#1e293b',
										}}
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
											<p className="text-sm text-slate-300">
												{pendingTileEvent.subLabel}
											</p>
										)}
									</div>
									<div className="space-y-4 p-5 text-center">
										{pendingTileEvent.action.type === 'NONE' ? null : (
											<p className="text-sm font-semibold text-slate-200">
												{pendingTileEvent.action.type === 'MOVE_STEPS'
													? `${Math.abs(pendingTileEvent.action.params?.steps ?? 0)}칸 이동합니다.`
													: '이 타일의 이벤트를 실행합니다.'}
											</p>
										)}
										{pendingTileEvent.action.type === 'MOVE_STEPS' ? (
											<p className="text-sm font-bold text-amber-300">
												{eventCountdown !== null
													? `${eventCountdown}초 후 실행`
													: '이동 중'}
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
									<h2 className="text-xl font-black text-amber-300">
										{eventNotice.title}
									</h2>
									<p className="mt-3 text-sm text-slate-200">
										{eventNotice.message}
									</p>
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

						{(isGoldCardModalOpen ||
							tileSelectionMode === 'gold-card-effect-target') && (
							<GoldCardDrawModal
								card={drawnGoldCard}
								teamNames={teams.map((team) => team.name)}
								actorTeamIndex={goldCardActorTeamIndex}
								selectingTarget={
									tileSelectionMode === 'gold-card-effect-target'
								}
								onApply={() => applyDrawnGoldCard()}
								onChooseTarget={beginGoldCardEffectTargetSelection}
								onChooseSwapTeam={(teamIndex) =>
									applyDrawnGoldCard({ teamIndex })
								}
								onCancelTarget={() => {
									tileSelectionModeRef.current = null;
									setTileSelectionMode(null);
									setIsGoldCardModalOpen(true);
								}}
								onClose={() => {
									drawnGoldCardRef.current = null;
									setIsGoldCardModalOpen(false);
									setDrawnGoldCard(null);
									tileSelectionModeRef.current = null;
									setTileSelectionMode(null);
								}}
							/>
						)}

						<div className="absolute top-4 inset-x-4 flex items-center justify-between gap-3 pointer-events-none">
							<div className="flex items-center bg-slate-900/80 backdrop-blur-md border border-slate-700/60 rounded-xl p-1 pointer-events-auto shadow-lg">
								<button
									type="button"
									onClick={() => switchView('2.5d')}
									className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
										viewMode === '2.5d'
											? 'bg-blue-600 text-white'
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
											? 'bg-blue-600 text-white'
											: 'text-slate-400 hover:text-slate-200'
									}`}
								>
									탑뷰
								</button>
							</div>
						</div>

						{boardgameStatus && (
							<div className="pointer-events-none absolute right-4 top-4 w-[min(10,calc(100%-2rem))] rounded-xl border border-slate-700/60 bg-slate-900/80 px-3 py-2 text-right shadow-lg backdrop-blur-md">
								<p className="text-[11px] text-slate-300">{boardgameStatus}</p>
							</div>
						)}

						<div className="absolute bottom-2 left-6 hidden text-[11px] text-slate-500 pointer-events-none md:block">
							Space: 주사위 굴리기 | WASD: 화면 이동 | Q/E: 회전 | Z/X:
							확대·축소 | R: 현재 뷰 초기화 | 드래그: 화면 회전 | 휠: 확대·축소
						</div>
					</div>

					<DiceArenaSidebar
						activeBoardgameCanEdit={activeBoardgameCanEdit}
						isFullscreen={isFullscreen}
						isEditMode={isEditMode}
						isBusy={isBoardgameBusy}
						isAddingInnerTile={isAddingInnerTile}
						isMovingInnerTile={isMovingInnerTile}
						isGoldCardManagerOpen={isGoldCardManagerOpen}
						gridSizeDraft={gridSizeDraft}
						setGridSizeDraft={setGridSizeDraft}
						gridSizeError={gridSizeError}
						boardSize={boardSize}
						isRolling={isRolling}
						diceCount={diceCount}
						isMovingPawn={isMovingPawn}
						pendingTileEvent={pendingTileEvent}
						eventNotice={eventNotice}
						goldCards={goldCards}
						setGoldCards={setGoldCards}
						boardTilesMap={boardTilesMap}
						selectingGoldCardId={selectingGoldCardId}
						teams={teams}
						hasRolledThisGame={hasRolledThisGame}
						currentTeamIndex={currentTeamIndex}
						teamPositions={teamPositions}
						teamTileIds={teamTileIds}
						playerTileIndex={playerTileIndex}
						totalScore={totalScore}
						scores={scores}
						selectedTileId={selectedTileId}
						tileSelectionMode={tileSelectionMode}
						onToggleEditMode={() => void handleToggleEditMode()}
						onToggleFullscreen={() => setIsFullscreen((current) => !current)}
						onApplyGridSize={applyGridSize}
						onToggleAddInnerTile={handleToggleAddingInnerTile}
						onToggleGoldCardManager={() =>
							setIsGoldCardManagerOpen((open) => !open)
						}
						onRollDice={rollDice}
						onChangeDiceCount={handleDiceCountChange}
						onChangeTeamName={handleChangeTeamName}
						onRestartGame={() => setIsRestartConfirmOpen(true)}
						onSelectGoldCardTarget={selectGoldCardTarget}
						onBeginTileSelection={beginTileSelection}
						onMoveTilePosition={handleMoveTilePosition}
						onUpdateTile={handleUpdateTile}
						onDeleteTile={handleDeleteTile}
						onCloseTileInspector={handleCloseTileInspector}
					/>
				</div>
			)}
			{isRestartConfirmOpen && (
				<ConfirmModal
					message="게임을 처음부터 다시 시작할까요?"
					warning="팀 위치, 현재 턴, 주사위 결과가 초기화됩니다. 팀 이름은 유지됩니다."
					onConfirm={handleRestartGame}
					onCancel={() => setIsRestartConfirmOpen(false)}
				/>
			)}
		</>
	);
}
