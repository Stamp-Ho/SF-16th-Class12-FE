import {
	useEffect,
	useRef,
	type Dispatch,
	type RefObject,
	type SetStateAction,
} from 'react';
import * as THREE from 'three';
import { BoardTileData } from '../types/board';
import { createDynamicTileTexture } from '../utils/board';
import {
	acquireBoardgameTileEditLock,
	getBoardgame,
	saveBoardgame,
} from '../actions';
import { GoldCardData } from '../gold-cards/types';
import { TileSelectionMode } from '../types/DiceArenaProps';
import { ArenaRuntime, OrbitSnapshot } from '../types/arena';
import { snapshotOrbit } from '../utils/arenaControls';
import { getOrbitDefaults, withTileLockOwner } from '../utils/arena';

export interface TileEditorParams {
	activeBoardgameId: string | null;
	activeBoardgameCanEdit: boolean;
	isBoardgameBusy: boolean;
	setIsBoardgameBusy: Dispatch<SetStateAction<boolean>>;
	setBoardgameStatus: Dispatch<SetStateAction<string>>;
	refreshBoardgameList: () => Promise<void>;
	boardSize: { rows: number; cols: number };
	setBoardSize: Dispatch<SetStateAction<{ rows: number; cols: number }>>;
	gridSizeDraft: { rows: string; cols: string };
	setGridSizeDraft: Dispatch<SetStateAction<{ rows: string; cols: string }>>;
	setGridSizeError: Dispatch<SetStateAction<string>>;
	persistedGridSizeRef: RefObject<{ rows: number; cols: number }>;
	setBoardRefreshKey: Dispatch<SetStateAction<number>>;
	boardTilesMap: Map<string, BoardTileData>;
	setBoardTilesMap: Dispatch<SetStateAction<Map<string, BoardTileData>>>;
	boardTilesMapRef: RefObject<Map<string, BoardTileData>>;
	tileIdRenamesRef: RefObject<Map<string, string>>;
	goldCards: GoldCardData[];
	setGoldCards: Dispatch<SetStateAction<GoldCardData[]>>;
	persistedGoldCardsRef: RefObject<string>;
	isEditMode: boolean;
	setIsEditMode: Dispatch<SetStateAction<boolean>>;
	editModeRef: RefObject<boolean>;
	isAddingInnerTile: boolean;
	setIsAddingInnerTile: Dispatch<SetStateAction<boolean>>;
	isAddingInnerTileRef: RefObject<boolean>;
	isMovingInnerTile: boolean;
	setIsMovingInnerTile: Dispatch<SetStateAction<boolean>>;
	isMovingInnerTileRef: RefObject<boolean>;
	selectedTileId: string | null;
	setSelectedTileId: Dispatch<SetStateAction<string | null>>;
	selectedTileIdRef: RefObject<string | null>;
	setTileSelectionMode: Dispatch<SetStateAction<TileSelectionMode>>;
	tileSelectionModeRef: RefObject<TileSelectionMode>;
	setSelectingGoldCardId: Dispatch<SetStateAction<string | null>>;
	selectingGoldCardIdRef: RefObject<string | null>;
	setViewMode: Dispatch<SetStateAction<'2.5d' | 'top'>>;
	viewModeRef: RefObject<'2.5d' | 'top'>;
	runtimeRef: RefObject<ArenaRuntime | null>;
	tileMeshMapRef: RefObject<Map<string, THREE.Mesh>>;
	innerCellMeshMapRef: RefObject<Map<string, THREE.Mesh>>;
	innerCellOutlineMapRef: RefObject<Map<string, THREE.LineSegments>>;
	selectionBoxRef: RefObject<THREE.BoxHelper | null>;
	orbitSnapshotRef: RefObject<OrbitSnapshot | null>;
	resetTeamsToStart: (startTileId: string) => void;
}

/**
 * 보드 편집 기능: 타일 선택·수정·삭제, 다음 칸·워프 대상 선택, 뷰 전환,
 * 편집 모드 전환(잠금 확보·저장·해제), 내부 타일 추가·이동, 격자 크기 적용.
 * 상태는 DiceArena가 소유하고 이 훅은 그 상태를 다루는 함수들을 모아 둔다.
 */
export function useTileEditor({
	activeBoardgameId,
	activeBoardgameCanEdit,
	isBoardgameBusy,
	setIsBoardgameBusy,
	setBoardgameStatus,
	refreshBoardgameList,
	boardSize,
	setBoardSize,
	gridSizeDraft,
	setGridSizeDraft,
	setGridSizeError,
	persistedGridSizeRef,
	setBoardRefreshKey,
	boardTilesMap,
	setBoardTilesMap,
	boardTilesMapRef,
	tileIdRenamesRef,
	goldCards,
	setGoldCards,
	persistedGoldCardsRef,
	isEditMode,
	setIsEditMode,
	editModeRef,
	isAddingInnerTile,
	setIsAddingInnerTile,
	isAddingInnerTileRef,
	isMovingInnerTile,
	setIsMovingInnerTile,
	isMovingInnerTileRef,
	selectedTileId,
	setSelectedTileId,
	selectedTileIdRef,
	setTileSelectionMode,
	tileSelectionModeRef,
	setSelectingGoldCardId,
	selectingGoldCardIdRef,
	setViewMode,
	viewModeRef,
	runtimeRef,
	tileMeshMapRef,
	innerCellMeshMapRef,
	innerCellOutlineMapRef,
	selectionBoxRef,
	orbitSnapshotRef,
	resetTeamsToStart,
}: TileEditorParams) {
	// 2. 타일 선택 처리 함수
	const selectTile = (tileId: string | null) => {
		const runtime = runtimeRef.current;

		if (tileId && runtime) {
			const { orbit } = runtime;
			if (!orbitSnapshotRef.current) {
				orbitSnapshotRef.current = snapshotOrbit(orbit);
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

	// 서버에 저장된 격자 크기를 보드·저장 기준값·입력창에 반영
	const applyServerGridSize = (rows: number, cols: number) => {
		setBoardSize({ rows, cols });
		persistedGridSizeRef.current = { rows, cols };
		setGridSizeDraft({ rows: String(rows), cols: String(cols) });
	};

	// 현재까지의 변경 사항을 저장하는 함수
	const saveCurrentChanges = async (): Promise<boolean> => {
		if (!activeBoardgameId || isBoardgameBusy) return false;

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
			return false;
		}

		// 동기화 기준값 갱신
		tileIdRenamesRef.current.clear();
		persistedGridSizeRef.current = boardSize;
		persistedGoldCardsRef.current = JSON.stringify(goldCards);

		// 서버의 최신 상태 갱신
		const refreshed = await getBoardgame(activeBoardgameId);
		if (refreshed.success) {
			const game = refreshed.data;
			setBoardTilesMap(new Map(game.tiles.map((tile) => [tile.id, tile])));
			boardTilesMapRef.current = new Map(
				game.tiles.map((tile) => [tile.id, tile]),
			);
			setGoldCards(game.gold_cards);
			applyServerGridSize(game.grid_rows, game.grid_cols);
			persistedGoldCardsRef.current = JSON.stringify(game.gold_cards);
			setBoardRefreshKey((current) => current + 1);
		}

		await refreshBoardgameList();
		setIsBoardgameBusy(false);
		return true;
	};

	/**
	 * 선택한 타일을 편집 가능한 상태로 설정하고 잠금을 요청합니다.
	 * 이때, 기존에 편집 중이던 타일이 있다면 변경 사항을 저장하고 잠금을 해제합니다.
	 * @param tileId 편집할 타일의 ID
	 * @returns
	 */
	const selectEditableTile = async (tileId: string) => {
		// 동일한 타일을 다시 클릭한 경우 불필요한 재요청 방지
		if (tileId === selectedTileId) return;

		if (!isEditMode || !activeBoardgameId || !activeBoardgameCanEdit) {
			selectTile(tileId);
			return;
		}

		if (isBoardgameBusy) return;

		// 1. 기존에 잠금을 보유 중인 타일이 있다면 먼저 저장 및 반환
		if (selectedTileId) {
			setBoardgameStatus(
				'이전 타일의 변경 사항을 저장하고 잠금을 해제하는 중...',
			);
			const saved = await saveCurrentChanges();
			if (!saved) {
				// 저장이 실패하면 새 타일 선택을 중단하여 작업 유실 방지
				return;
			}
		}

		// 2. 새 타일의 편집 잠금 요청
		setIsBoardgameBusy(true);
		const result = await acquireBoardgameTileEditLock(
			activeBoardgameId,
			tileId,
		);
		setIsBoardgameBusy(false);

		if (!result.success) {
			setBoardgameStatus(result.message);
			return;
		}

		// 3. 상태 업데이트 및 새 타일 선택
		setBoardTilesMap((current) => {
			const next = withTileLockOwner(current, tileId, result.data);
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

	/**
	 * 편집 모드를 토글합니다.
	 * 편집 중이었다면, 변경 사항을 저장하고 타일 잠금을 해제합니다.
	 * @returns 편집 모드 전환 작업의 성공 여부를 나타내는 Promise<boolean>
	 */
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
					const next = withTileLockOwner(
						current,
						selectedTileId,
						lockResult.data,
					);
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

		// 편집 모드 종료: 저장 및 상태 정리
		const saved = await saveCurrentChanges();
		if (!saved) return;

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

		resetTeamsToStart('outer_0');
		setSelectedTileId(null);
		orbitSnapshotRef.current = null;
		setBoardSize({ rows, cols });
	};

	return {
		selectTile,
		handleUpdateTile,
		handleDeleteTile,
		switchView,
		beginTileSelection,
		applyServerGridSize,
		saveCurrentChanges,
		selectEditableTileRef,
		handleToggleEditMode,
		handleToggleAddingInnerTile,
		handleMoveTilePosition,
		applyGridSize,
	};
}
