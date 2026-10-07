import {
	useEffect,
	type Dispatch,
	type RefObject,
	type SetStateAction,
} from 'react';
import * as THREE from 'three';
import { createHighQualityDiceTemplate } from '../utils/diceFactory';
import { BoardTileData } from '../types/board';
import { generateBoardTiles } from '../utils/board';
import { GoldCardData } from '../gold-cards/types';
import { createGoldCardDeckGroup } from '../gold-cards/utils/threeDeck';
import { TileSelectionMode } from '../types/DiceArenaProps';
import { ArenaRuntime, OrbitSnapshot } from '../types/arena';
import {
	attachArenaControls,
	createOrbitState,
	stepOrbitCamera,
} from '../utils/arenaControls';
import { syncDiceMeshes } from '../utils/arenaDice';
import { getOrbitDefaults } from '../utils/arena';
import {
	addArenaLights,
	addArenaWalls,
	addCenterFloor,
	addTileMesh,
	buildArenaTileData,
	createArenaRenderer,
	createArenaWorld,
	createInnerCellGrid,
	createTeamPawnMeshes,
	disposeArenaScene,
} from '../utils/arenaScene';
import {
	createInnerTileData,
	getInnerCellPosition,
	getUnusedTileId,
	isInnerCellOccupied,
	moveInnerTile,
	withTileLinkTarget,
} from '../utils/boardTiles';

export interface ArenaSceneParams {
	activeBoardgameId: string | null;
	boardRefreshKey: number;
	boardSize: { rows: number; cols: number };
	canvasRef: RefObject<HTMLCanvasElement | null>;
	containerRef: RefObject<HTMLDivElement | null>;
	runtimeRef: RefObject<ArenaRuntime | null>;
	tileMeshMapRef: RefObject<Map<string, THREE.Mesh>>;
	innerCellMeshMapRef: RefObject<Map<string, THREE.Mesh>>;
	innerCellOutlineMapRef: RefObject<Map<string, THREE.LineSegments>>;
	innerCellGridRef: RefObject<THREE.Group | null>;
	selectionBoxRef: RefObject<THREE.BoxHelper | null>;
	boardTilesMapRef: RefObject<Map<string, BoardTileData>>;
	selectedTileIdRef: RefObject<string | null>;
	editModeRef: RefObject<boolean>;
	isAddingInnerTileRef: RefObject<boolean>;
	isMovingInnerTileRef: RefObject<boolean>;
	isRollingRef: RefObject<boolean>;
	diceCountRef: RefObject<number>;
	viewModeRef: RefObject<'2.5d' | 'top'>;
	cameraViewRestoreRef: RefObject<OrbitSnapshot | null>;
	orbitSnapshotRef: RefObject<OrbitSnapshot | null>;
	pointerDownPos: RefObject<{ x: number; y: number }>;
	tileSelectionModeRef: RefObject<TileSelectionMode>;
	selectingGoldCardIdRef: RefObject<string | null>;
	tileIdRenamesRef: RefObject<Map<string, string>>;
	teamTileIdsRef: RefObject<string[]>;
	teamPositionsRef: RefObject<number[]>;
	selectEditableTileRef: RefObject<(tileId: string) => void>;
	canEditBoardRef: RefObject<() => boolean>;
	canEditSelectedTileRef: RefObject<() => boolean>;
	onEditableTileRenamedRef: RefObject<(tileId: string) => void>;
	setIsBoardReady: Dispatch<SetStateAction<boolean>>;
	setBoardTilesMap: Dispatch<SetStateAction<Map<string, BoardTileData>>>;
	setIsRolling: Dispatch<SetStateAction<boolean>>;
	setScores: Dispatch<SetStateAction<number[]>>;
	setTileSelectionMode: Dispatch<SetStateAction<TileSelectionMode>>;
	setGoldCards: Dispatch<SetStateAction<GoldCardData[]>>;
	setSelectingGoldCardId: Dispatch<SetStateAction<string | null>>;
	setTeamTileIds: Dispatch<SetStateAction<string[]>>;
	setTeamPositions: Dispatch<SetStateAction<number[]>>;
	setIsMovingInnerTile: Dispatch<SetStateAction<boolean>>;
	setIsAddingInnerTile: Dispatch<SetStateAction<boolean>>;
	setSelectedTileId: Dispatch<SetStateAction<string | null>>;
	applyDrawnGoldCard: (choice?: { tileId?: string; teamIndex?: number }) => void;
	movePawnSteps: (steps: number) => void;
	selectTile: (tileId: string | null) => void;
	syncDiceCount: (count: number) => void;
}

/**
 * 보드 크기·보드게임이 바뀔 때마다 3D 씬(렌더러·물리·타일·말·주사위)을 만들고
 * 애니메이션 루프와 입력(드래그·휠·키보드·타일 클릭)을 연결한다. 정리 시 모두 해제한다.
 */
export function useArenaScene({
	activeBoardgameId,
	boardRefreshKey,
	boardSize,
	canvasRef,
	containerRef,
	runtimeRef,
	tileMeshMapRef,
	innerCellMeshMapRef,
	innerCellOutlineMapRef,
	innerCellGridRef,
	selectionBoxRef,
	boardTilesMapRef,
	selectedTileIdRef,
	editModeRef,
	isAddingInnerTileRef,
	isMovingInnerTileRef,
	isRollingRef,
	diceCountRef,
	viewModeRef,
	cameraViewRestoreRef,
	orbitSnapshotRef,
	pointerDownPos,
	tileSelectionModeRef,
	selectingGoldCardIdRef,
	tileIdRenamesRef,
	teamTileIdsRef,
	teamPositionsRef,
	selectEditableTileRef,
	canEditBoardRef,
	canEditSelectedTileRef,
	onEditableTileRenamedRef,
	setIsBoardReady,
	setBoardTilesMap,
	setIsRolling,
	setScores,
	setTileSelectionMode,
	setGoldCards,
	setSelectingGoldCardId,
	setTeamTileIds,
	setTeamPositions,
	setIsMovingInnerTile,
	setIsAddingInnerTile,
	setSelectedTileId,
	applyDrawnGoldCard,
	movePawnSteps,
	selectTile,
	syncDiceCount,
}: ArenaSceneParams) {
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
		const renderer = createArenaRenderer(canvasRef.current, width, height);

		// 조명
		addArenaLights(scene);

		// 2. 물리 세계
		const world = createArenaWorld();

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
		const tileDataMap = buildArenaTileData({
			boardTiles,
			previousTiles: boardTilesMapRef.current,
			boardSize,
			stepX,
			stepZ,
			halfW,
			halfH,
		});

		setBoardTilesMap(tileDataMap);
		setIsBoardReady(true);

		const boxGeo = new THREE.BoxGeometry(tileWidth, 0.4, tileHeight);
		const createTileMesh = (tileData: BoardTileData) =>
			addTileMesh(tileData, {
				boardSize,
				tileWidth,
				tileHeight,
				boxGeo,
				tileMeshMap: tileMeshMapRef.current,
				tileMeshGroup,
			});

		tileDataMap.forEach(createTileMesh);

		const innerCellGrid = createInnerCellGrid({
			boardSize,
			tileWidth,
			tileHeight,
			stepX,
			stepZ,
			halfW,
			halfH,
			tileDataMap,
			innerCellMeshMap: innerCellMeshMapRef.current,
			innerCellOutlineMap: innerCellOutlineMapRef.current,
			isEditMode: editModeRef.current,
			isAddingInnerTile: isAddingInnerTileRef.current,
			isMovingInnerTile: isMovingInnerTileRef.current,
		});
		innerCellGridRef.current = innerCellGrid;

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
		addCenterFloor(scene, innerW, innerH);

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

		addArenaWalls(scene, world, {
			innerW,
			innerH,
			wallHeight,
			wallThick,
			halfInnerW,
			halfInnerH,
		});

		// 5. 팀별 플레이어 3D 말 생성
		const pawnMeshes = createTeamPawnMeshes({
			scene,
			boardTiles,
			savedTileIds: teamTileIdsRef.current,
			tilesMap: boardTilesMapRef.current,
			isEditMode: editModeRef.current,
		});

		// 6. 주사위 템플릿 및 Orbit 상태 설정
		const diceTemplate = createHighQualityDiceTemplate();
		const orbitState = createOrbitState(
			getOrbitDefaults(viewModeRef.current, boardSize.rows, boardSize.cols),
			cameraViewRestoreRef.current,
		);
		cameraViewRestoreRef.current = null;

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

			stepOrbitCamera(
				orbitState,
				camera,
				dt,
				Math.max(boardSize.rows, boardSize.cols) * 8,
			);

			// 주사위 물리 동기화 및 정지 판정
			const diceList = runtimeRef.current?.diceList ?? [];
			const { allSleeping, currentValues } = syncDiceMeshes(diceList);

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

		// 캔버스 클릭(드래그 없이 5픽셀 미만 이동) 시 타일·내부 격자 피킹
		const handleCanvasClick = (clientX: number, clientY: number) => {
			if (editModeRef.current && !canEditBoardRef.current()) return;
			if (!containerRef.current) return;
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
					if (!canEditSelectedTileRef.current()) return;
					if (sourceTile) {
						const updatedTile = withTileLinkTarget(
							sourceTile,
							selectionMode,
							tileId,
						);
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
					const isOccupied = isInnerCellOccupied(
						boardTilesMapRef.current,
						gridR,
						gridC,
					);
					const movingTileId = selectedTileIdRef.current;
					if (isMovingInnerTileRef.current && movingTileId) {
						if (!canEditSelectedTileRef.current()) return;
						const selectedTile = boardTilesMapRef.current.get(movingTileId);
						if (selectedTile?.category === 'INNER' && !isOccupied) {
							const newTileId = id;
							tileIdRenamesRef.current.set(movingTileId, newTileId);
							const { movedTile, nextTileMap } = moveInnerTile(
								boardTilesMapRef.current,
								movingTileId,
								selectedTile,
								newTileId,
								gridR,
								gridC,
								getInnerCellPosition(gridR, gridC, stepX, stepZ, halfW, halfH),
							);
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
							onEditableTileRenamedRef.current(newTileId);
							selectTile(newTileId);
						}
					} else if (!isMovingInnerTileRef.current && !isOccupied) {
						const innerTile = createInnerTileData(
							getUnusedTileId(boardTilesMapRef.current, id),
							gridR,
							gridC,
							getInnerCellPosition(gridR, gridC, stepX, stepZ, halfW, halfH),
						);
						const nextTileMap = new Map(boardTilesMapRef.current);
						nextTileMap.set(id, innerTile);
						boardTilesMapRef.current = nextTileMap;
						setBoardTilesMap(nextTileMap);
						createTileMesh(innerTile);
						cellMesh.visible = false;
						const cellOutline = innerCellOutlineMapRef.current.get(id);
						if (cellOutline) cellOutline.visible = false;
						setIsAddingInnerTile(false);
						selectEditableTileRef.current(innerTile.id);
					}
				} else {
					selectTile(null);
				}
			} else {
				// 빈 공간 클릭 시 선택 해제
				selectTile(null);
			}
		};

		const detachControls = attachArenaControls({
			canvas: canvasRef.current,
			orbitState,
			pointerDownPos,
			getViewMode: () => viewModeRef.current,
			boardSize,
			onClick: handleCanvasClick,
			onResetView: () => {
				orbitSnapshotRef.current = null;
				setSelectedTileId(null);
				if (selectionBoxRef.current) selectionBoxRef.current.visible = false;
			},
		});

		return () => {
			window.removeEventListener('resize', handleResize);
			resizeObserver.disconnect();
			detachControls();
			if (runtimeRef.current?.reqId) {
				cancelAnimationFrame(runtimeRef.current.reqId);
			}
			disposeArenaScene({
				tileMeshGroup,
				boxGeo,
				innerCellGrid,
				selectionBox,
				goldCardDeckGroup,
			});
			tileMeshMap.clear();
			innerCellMeshMap.clear();
			innerCellOutlineMap.clear();
			innerCellGridRef.current = null;
			diceTemplate.dispose();
			renderer.dispose();
		};
		// 의존성은 DiceArena에 있던 원래 이펙트와 같다. 나머지 값은 ref·setter이거나
		// 원래도 의존성에 없던 함수(씬을 만든 시점의 함수를 그대로 사용)다.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		activeBoardgameId,
		applyDrawnGoldCard,
		boardRefreshKey,
		boardSize,
		movePawnSteps,
		diceCountRef,
		setScores,
		setTeamPositions,
		setTeamTileIds,
		teamPositionsRef,
		teamTileIdsRef,
	]);
}
