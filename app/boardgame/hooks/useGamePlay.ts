import {
	useCallback,
	useEffect,
	useRef,
	type Dispatch,
	type RefObject,
	type SetStateAction,
} from 'react';
import * as CANNON from 'cannon-es';
import { BoardTileData } from '../types/board';
import { BoardTile } from '../utils/board';
import { executeTileAction } from '../utils/tileActionEngine';
import { GoldCardData } from '../gold-cards/types';
import { drawCard } from '../gold-cards/utils/deck';
import { executeGoldCardEvent } from '../gold-cards/utils/events';
import { TileSelectionMode } from '../types/DiceArenaProps';
import { ArenaRuntime } from '../types/arena';
import { TEAM_COLORS, getPawnPosition } from '../utils/arena';
import { launchDice } from '../utils/arenaDice';
import {
	animatePawnHop,
	innerTileToBoardTile,
	resolveNextStep,
} from '../utils/pawnMovement';

export interface GamePlayParams {
	boardTilesMapRef: RefObject<Map<string, BoardTileData>>;
	currentTeamIndexRef: RefObject<number>;
	teamSkipTurnsRef: RefObject<number[]>;
	setTeamSkipTurns: Dispatch<SetStateAction<number[]>>;
	diceCountRef: RefObject<number>;
	drawnGoldCardRef: RefObject<GoldCardData | null>;
	editModeRef: RefObject<boolean>;
	eventNotice: { title: string; message: string } | null;
	goldCardActorTeamRef: RefObject<number>;
	goldCardDrawPile: string[];
	goldCards: GoldCardData[];
	hasRolledThisGameRef: RefObject<boolean>;
	isEditMode: boolean;
	isMovingPawn: boolean;
	isRolling: boolean;
	isRollingRef: RefObject<boolean>;
	lastMovedTeamIndexRef: RefObject<number>;
	pendingTileEvent: BoardTileData | null;
	playerTileIndexRef: RefObject<number>;
	resetTeamsToStart: (startTileId: string) => void;
	runtimeRef: RefObject<ArenaRuntime | null>;
	selectTile: (tileId: string | null) => void;
	selectedTileIdRef: RefObject<string | null>;
	selectingGoldCardIdRef: RefObject<string | null>;
	setBoardgameStatus: Dispatch<SetStateAction<string>>;
	setCurrentTeamIndex: Dispatch<SetStateAction<number>>;
	setDiceCount: Dispatch<SetStateAction<number>>;
	setDrawnGoldCard: Dispatch<SetStateAction<GoldCardData | null>>;
	setEventCountdown: Dispatch<SetStateAction<number | null>>;
	setEventNotice: Dispatch<SetStateAction<{ title: string; message: string } | null>>;
	setGoldCardActorTeamIndex: Dispatch<SetStateAction<number>>;
	setGoldCardDrawPile: Dispatch<SetStateAction<string[]>>;
	setHasRolledThisGame: Dispatch<SetStateAction<boolean>>;
	setIsGoldCardModalOpen: Dispatch<SetStateAction<boolean>>;
	setIsMovingPawn: Dispatch<SetStateAction<boolean>>;
	setIsRestartConfirmOpen: Dispatch<SetStateAction<boolean>>;
	setIsRolling: Dispatch<SetStateAction<boolean>>;
	setPendingTileEvent: Dispatch<SetStateAction<BoardTileData | null>>;
	setPlayerTileIndex: Dispatch<SetStateAction<number>>;
	setScores: Dispatch<SetStateAction<number[]>>;
	setSelectedTileId: Dispatch<SetStateAction<string | null>>;
	setSelectingGoldCardId: Dispatch<SetStateAction<string | null>>;
	setTeamPositions: Dispatch<SetStateAction<number[]>>;
	setTeamTileIds: Dispatch<SetStateAction<string[]>>;
	setTileSelectionMode: Dispatch<SetStateAction<TileSelectionMode>>;
	switchView: (mode: '2.5d' | 'top') => void;
	teamPositionsRef: RefObject<number[]>;
	teamTileIdsRef: RefObject<string[]>;
	tileSelectionModeRef: RefObject<TileSelectionMode>;
}

/**
 * 게임 진행: 주사위 굴리기·개수 변경, 말 이동, 도착 칸 이벤트 실행,
 * 황금카드 뽑기·효과 적용, 게임 재시작.
 */
export function useGamePlay({
	boardTilesMapRef,
	currentTeamIndexRef,
	teamSkipTurnsRef,
	setTeamSkipTurns,
	diceCountRef,
	drawnGoldCardRef,
	editModeRef,
	eventNotice,
	goldCardActorTeamRef,
	goldCardDrawPile,
	goldCards,
	hasRolledThisGameRef,
	isEditMode,
	isMovingPawn,
	isRolling,
	isRollingRef,
	lastMovedTeamIndexRef,
	pendingTileEvent,
	playerTileIndexRef,
	resetTeamsToStart,
	runtimeRef,
	selectTile,
	selectedTileIdRef,
	selectingGoldCardIdRef,
	setBoardgameStatus,
	setCurrentTeamIndex,
	setDiceCount,
	setDrawnGoldCard,
	setEventCountdown,
	setEventNotice,
	setGoldCardActorTeamIndex,
	setGoldCardDrawPile,
	setHasRolledThisGame,
	setIsGoldCardModalOpen,
	setIsMovingPawn,
	setIsRestartConfirmOpen,
	setIsRolling,
	setPendingTileEvent,
	setPlayerTileIndex,
	setScores,
	setSelectedTileId,
	setSelectingGoldCardId,
	setTeamPositions,
	setTeamTileIds,
	setTileSelectionMode,
	switchView,
	teamPositionsRef,
	teamTileIdsRef,
	tileSelectionModeRef,
}: GamePlayParams) {
	const effectDiceMoveRef = useRef<{ direction: 1 | -1; teamIndex: number } | null>(null);
	const selectTileRef = useRef(selectTile);
	const warpArrivalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const pendingSkipTurnRef = useRef<{ teamIndex: number; notice: { title: string; message: string } } | null>(null);
	useEffect(() => {
		selectTileRef.current = selectTile;
	}, [selectTile]);
	useEffect(() => () => {
		if (warpArrivalTimerRef.current !== null) {
			clearTimeout(warpArrivalTimerRef.current);
		}
	}, []);

	const showTileEvent = useCallback((tileId: string) => {
		const tile = boardTilesMapRef.current.get(tileId);
		if (tile) setPendingTileEvent(tile);
	}, [
		boardTilesMapRef,
		setPendingTileEvent,
	]);


	// 말(Pawn)의 칸별 이동 애니메이션
	const movePawnSteps = useCallback(
		(
			steps: number,
			teamIndex = currentTeamIndexRef.current,
			advanceTurn = true,
		) => {
			if (!Number.isInteger(steps) || steps === 0) return;
			if (!runtimeRef.current) return;
			const { pawnMeshes, boardTiles } = runtimeRef.current;
			if (!boardTiles.length) return;
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
				const { targetIdx, targetTile } = resolveNextStep({
					boardTiles,
					tilesMap: boardTilesMapRef.current,
					currentIdx,
					currentTileId,
					isFirstStep: currentStep === 1,
					direction: steps < 0 ? -1 : 1,
				});
				teamPositionsRef.current[teamIndex] = targetIdx;
				teamTileIdsRef.current[teamIndex] = targetTile.id;
				setTeamTileIds([...teamTileIdsRef.current]);
				playerTileIndexRef.current = targetIdx;
				setPlayerTileIndex(targetIdx);
				setTeamPositions([...teamPositionsRef.current]);

				// 부드러운 호를 그리며 다음 타일로 점프
				animatePawnHop(pawnMesh, getPawnPosition(targetTile, teamIndex));

				// 타일 이동 완료 되었을 때 로직.
				if (currentStep >= Math.abs(steps)) {
					clearInterval(stepInterval);
					setTimeout(() => {
						selectTile(targetTile.id);
						pawnMeshes.forEach((mesh) => mesh.scale.set(0, 0, 0));
					}, 700);
					setTimeout(() => {
						// 도착 효과로 이어진 이동은 같은 팀에 적용하고 턴을 넘기지 않는다.
						if (advanceTurn) {
							const nextTeamIndex = (teamIndex + 1) % TEAM_COLORS.length;
							currentTeamIndexRef.current = nextTeamIndex;
							setCurrentTeamIndex(nextTeamIndex);
						}
						setTimeout(() => {
							selectTile(null);
							pawnMeshes.forEach((mesh) => mesh.scale.set(1, 1, 1));
							setIsMovingPawn(false);
							// 복구 타이머가 새 도착 효과의 이동 상태를 덮어쓰지 않도록 마지막에 연다.
							showTileEvent(targetTile.id);
						}, 500);
					}, 2000);
				}
			}, 280);
		},
		// 원래 코드와 같이 selectTile은 의존성에 넣지 않는다 (렌더마다 새로 만들어지는 함수라
		// 넣으면 이 콜백과 3D 씬이 매번 다시 만들어진다).
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[
			showTileEvent,
			currentTeamIndexRef,
			playerTileIndexRef,
			setCurrentTeamIndex,
			setPlayerTileIndex,
			setTeamPositions,
			setTeamTileIds,
			teamPositionsRef,
			teamTileIdsRef,
		],
	);

	const openGoldCardModal = useCallback(() => {
		const result = drawCard(goldCards, goldCardDrawPile);
		setGoldCardDrawPile(result.drawPile);
		goldCardActorTeamRef.current = lastMovedTeamIndexRef.current;
		setGoldCardActorTeamIndex(lastMovedTeamIndexRef.current);
		drawnGoldCardRef.current = result.card;
		setDrawnGoldCard(result.card);
		setIsGoldCardModalOpen(true);
	}, [
		goldCards,
		goldCardDrawPile,
		drawnGoldCardRef,
		goldCardActorTeamRef,
		lastMovedTeamIndexRef,
		setDrawnGoldCard,
		setGoldCardActorTeamIndex,
		setGoldCardDrawPile,
		setIsGoldCardModalOpen,
	]);

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
		// 대상 선택을 위한 탑뷰 전환 전에 기존 카메라 뷰를 보관한다.
		selectTileRef.current(teamTileIdsRef.current[goldCardActorTeamRef.current]);
		tileSelectionModeRef.current = 'gold-card-effect-target';
		setTileSelectionMode('gold-card-effect-target');
		switchView('top');
	};

	// 타일 워프와 황금카드 이동에서 공통으로 사용하는 점프·선택·도착 처리.
	const warpTeamPawnToTile = useCallback((teamIndex: number, tileId: string) => {
		const runtime = runtimeRef.current;
		const targetIndex = runtime?.boardTiles.findIndex(
			(tile) => tile.id === tileId,
		) ?? -1;
		const innerTarget = boardTilesMapRef.current.get(tileId);
		const targetTile: BoardTile | undefined =
			targetIndex >= 0
				? runtime?.boardTiles[targetIndex]
				: innerTarget?.category === 'INNER'
					? innerTileToBoardTile(innerTarget)
					: undefined;
		const pawnMesh = runtime?.pawnMeshes[teamIndex];
		if (!runtime || !targetTile || !pawnMesh) {
			setEventNotice({
				title: '워프 실패',
				message: '워프 목적지 타일을 찾을 수 없습니다. 워프 설정을 확인해 주세요.',
			});
			return false;
		}

		lastMovedTeamIndexRef.current = teamIndex;
		setIsMovingPawn(true);
		pawnMesh.scale.set(1, 1, 1);
		animatePawnHop(pawnMesh, getPawnPosition(targetTile, teamIndex), {
			durationMs: 550,
			onComplete: () => {
				if (runtimeRef.current !== runtime) return;
				teamPositionsRef.current[teamIndex] = targetIndex;
				teamTileIdsRef.current[teamIndex] = tileId;
				setTeamTileIds([...teamTileIdsRef.current]);
				setTeamPositions([...teamPositionsRef.current]);
				playerTileIndexRef.current = targetIndex;
				setPlayerTileIndex(targetIndex);
				selectTileRef.current(tileId);
				// 선택한 타일을 1초 동안 보여준 뒤 도착 이벤트를 연다.
				warpArrivalTimerRef.current = setTimeout(() => {
					warpArrivalTimerRef.current = null;
					if (runtimeRef.current !== runtime) return;
					setIsMovingPawn(false);
					showTileEvent(tileId);
				}, 1000);
			},
		});
		return true;
	}, [
		boardTilesMapRef, lastMovedTeamIndexRef, playerTileIndexRef, runtimeRef,
		setEventNotice, setIsMovingPawn, setPlayerTileIndex, setTeamPositions,
		setTeamTileIds, showTileEvent, teamPositionsRef, teamTileIdsRef,
	]);

	const applyDrawnGoldCard = useCallback(
		(choice: { tileId?: string; teamIndex?: number } = {}) => {
			const activeCard = drawnGoldCardRef.current;
			if (!activeCard) {
				setIsGoldCardModalOpen(false);
				selectTileRef.current(null);
				return;
			}
			const actorTeamIndex = goldCardActorTeamRef.current;
			if (activeCard.event.type === 'MOVE_PAWN_CHOOSE' && !choice.tileId) return;
			if (activeCard.event.type === 'SWAP_POSITIONS_CHOOSE') {
				const targetTeamIndex = choice.teamIndex;
				const pawns = runtimeRef.current?.pawnMeshes;
				if (targetTeamIndex === undefined || !Number.isInteger(targetTeamIndex) ||
					targetTeamIndex === actorTeamIndex || !pawns?.[targetTeamIndex] || !pawns[actorTeamIndex]) return;
			}
			const applied = executeGoldCardEvent(
				activeCard,
				{
					movePawnToTile: (tileId) =>
						warpTeamPawnToTile(actorTeamIndex, tileId),
					swapPawnPositions: (targetTeamIndex) => {
						const swapTeamIndex =
							targetTeamIndex === actorTeamIndex
								? (actorTeamIndex + 1) % 4
								: targetTeamIndex;
						const runtime = runtimeRef.current;
						if (!runtime) return false;
						const actorPawn = runtime.pawnMeshes[actorTeamIndex];
						const targetPawn = runtime.pawnMeshes[swapTeamIndex];
						if (!actorPawn || !targetPawn) return false;
						const resolveTeamTile = (teamIndex: number) => {
							const tileId = teamTileIdsRef.current[teamIndex];
							const outerTile = runtime.boardTiles.find((tile) => tile.id === tileId);
							const innerTile = boardTilesMapRef.current.get(tileId);
							return outerTile ?? (innerTile?.category === 'INNER'
								? innerTileToBoardTile(innerTile) : undefined);
						};
						const actorTile = resolveTeamTile(actorTeamIndex);
						const targetTile = resolveTeamTile(swapTeamIndex);
						if (!actorTile || !targetTile) return false;
						// 상대의 폰 좌표를 복사하지 않고 도착 타일에 자신의 오프셋을 적용한다.
						const actorDestination = getPawnPosition(targetTile, actorTeamIndex);
						const targetDestination = getPawnPosition(actorTile, swapTeamIndex);
						let landedPawns = 0;
						const onComplete = () => {
							if (runtimeRef.current !== runtime || ++landedPawns < 2) return;
							// 두 폰이 모두 착지한 뒤 위치 상태를 함께 교환한다.
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
							setTeamPositions([...teamPositionsRef.current]);
							playerTileIndexRef.current = teamPositionsRef.current[actorTeamIndex];
							setPlayerTileIndex(playerTileIndexRef.current);
							setIsMovingPawn(false);
						};
						setIsMovingPawn(true);
						actorPawn.scale.set(1, 1, 1);
						targetPawn.scale.set(1, 1, 1);
						animatePawnHop(actorPawn, actorDestination, { durationMs: 550, onComplete });
						animatePawnHop(targetPawn, targetDestination, { durationMs: 550, onComplete });
						return true;
					},
				},
				choice,
			);
			if (!applied) {
				setIsGoldCardModalOpen(true);
				return;
			}
			drawnGoldCardRef.current = null;
			setDrawnGoldCard(null);
			setIsGoldCardModalOpen(false);
		},
		[
			boardTilesMapRef, drawnGoldCardRef, goldCardActorTeamRef, playerTileIndexRef, runtimeRef,
			setDrawnGoldCard, setIsGoldCardModalOpen, setPlayerTileIndex,
			setIsMovingPawn,
			setTeamPositions, setTeamTileIds, teamPositionsRef, teamTileIdsRef,
			warpTeamPawnToTile,
		],
	);

	const syncDiceCount = useCallback((count: number) => {
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
	}, [editModeRef, runtimeRef]);

	const startDiceRoll = useCallback((count: number) => {
		if (!runtimeRef.current || isRollingRef.current) return false;
		syncDiceCount(count);
		const runtime = runtimeRef.current;
		if (runtime.diceList.length !== count) return false;
		hasRolledThisGameRef.current = true;
		setHasRolledThisGame(true);
		isRollingRef.current = true;
		setIsRolling(true);
		setScores([]);
		launchDice(runtime);
		return true;
	}, [hasRolledThisGameRef, isRollingRef, runtimeRef, setHasRolledThisGame, setIsRolling, setScores, syncDiceCount]);

	const handleDiceSettled = useCallback((scores: number[]) => {
		if (!isRollingRef.current) return;
		isRollingRef.current = false;
		setIsRolling(false);
		setScores(scores);
		const effectMove = effectDiceMoveRef.current;
		effectDiceMoveRef.current = null;
		if (effectMove) {
			movePawnSteps(effectMove.direction * scores[0], effectMove.teamIndex, false);
		} else {
			movePawnSteps(scores.reduce((sum, value) => sum + value, 0));
		}
	}, [isRollingRef, movePawnSteps, setIsRolling, setScores]);

	const executePendingTileEvent = useCallback(() => {
		if (!pendingTileEvent) return;

		const tileEvent = pendingTileEvent;
		// 현재 턴은 이미 다음 팀이다. 도착 이벤트는 마지막으로 이동한 팀에 적용한다.
		const teamIndex = lastMovedTeamIndexRef.current;
		setPendingTileEvent(null);
		setEventCountdown(null);

		executeTileAction(tileEvent.action, {
			currentTile: tileEvent,
			skipTurns: (turns) => {
				teamSkipTurnsRef.current[teamIndex] = turns;
				setTeamSkipTurns([...teamSkipTurnsRef.current]);
				setEventNotice({
					title: `탈출로 찾기(${turns}턴 남음)`,
					message: `도착 턴 이후 자신의 차례 ${turns}번 동안 술 마시기 벌칙을 수행하고 턴을 넘깁니다.`,
				});
			},
			movePawnSteps: (steps) => {
				if (!Number.isInteger(steps) || steps === 0 || isRollingRef.current) return;
				selectTileRef.current(null);
				effectDiceMoveRef.current = { direction: steps < 0 ? -1 : 1, teamIndex };
				if (!startDiceRoll(1)) effectDiceMoveRef.current = null;
			},
			teleportPawnToTile: (targetTileId) => warpTeamPawnToTile(teamIndex, targetTileId),
			openGoldCardModal,
			openChoiceModal: () => undefined,
			showToast: (title, message) => {
				if (tileEvent.action.type === 'TELEPORT' || tileEvent.action.type === 'MOVE_STEPS') {
					// 안내 모달이 주사위 연출이나 목적지 이벤트 팝업을 가리지 않도록 한다.
					setBoardgameStatus(`${title}: ${message}`);
				} else {
					setEventNotice({ title, message });
				}
			},
		});
	}, [
		startDiceRoll,
		isRollingRef,
		openGoldCardModal,
		pendingTileEvent,
		lastMovedTeamIndexRef,
		setBoardgameStatus,
		warpTeamPawnToTile,
		setEventCountdown,
		setEventNotice,
		setPendingTileEvent,
		teamSkipTurnsRef,
		setTeamSkipTurns,
	]);

	const handleConfirmTileEvent = () => {
		selectTileRef.current(null);
		executePendingTileEvent();
	};

	const handleCloseEventNotice = () => {
		const pendingSkip = pendingSkipTurnRef.current;
		pendingSkipTurnRef.current = null;
		if (pendingSkip && pendingSkip.notice === eventNotice && pendingSkip.teamIndex === currentTeamIndexRef.current) {
			const teamIndex = pendingSkip.teamIndex;
			teamSkipTurnsRef.current[teamIndex] = Math.max(0, teamSkipTurnsRef.current[teamIndex] - 1);
			setTeamSkipTurns([...teamSkipTurnsRef.current]);
			const nextTeamIndex = (teamIndex + 1) % TEAM_COLORS.length;
			currentTeamIndexRef.current = nextTeamIndex;
			setCurrentTeamIndex(nextTeamIndex);
			playerTileIndexRef.current = teamPositionsRef.current[nextTeamIndex];
			setPlayerTileIndex(playerTileIndexRef.current);
			setScores([]);
		}
		setEventNotice(null);
		selectTileRef.current(null);
	};

	useEffect(() => {
		if (!pendingTileEvent || pendingTileEvent.action.type !== 'MOVE_STEPS') {
			return;
		}

		// The timer state is intentionally initialized when a tile event opens.
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
	}, [
		executePendingTileEvent,
		pendingTileEvent,
		setEventCountdown,
	]);

	// 주사위 굴리기
	const rollDice = useCallback(() => {
		if (
			!runtimeRef.current ||
			isMovingPawn ||
			editModeRef.current ||
			drawnGoldCardRef.current ||
			tileSelectionModeRef.current === 'gold-card-effect-target' ||
			isRollingRef.current ||
			pendingTileEvent ||
			eventNotice
		)
			return;
		const teamIndex = currentTeamIndexRef.current;
		const remainingTurns = teamSkipTurnsRef.current[teamIndex] ?? 0;
		if (remainingTurns > 0) {
			if (pendingSkipTurnRef.current) return;
			const notice = {
				title: `탈출로 찾기(${remainingTurns}턴 남음)`,
				message: '술 마시기 벌칙을 수행하세요.\n완료를 누르면 이번 턴을 넘깁니다.',
			};
			pendingSkipTurnRef.current = { teamIndex, notice };
			setEventNotice(notice);
			return;
		}
		startDiceRoll(diceCountRef.current);
	}, [
		eventNotice,
		isMovingPawn,
		pendingTileEvent,
		isRollingRef,
		runtimeRef,
		currentTeamIndexRef,
		teamSkipTurnsRef,
		editModeRef,
		setEventNotice,
		drawnGoldCardRef,
		tileSelectionModeRef,
		startDiceRoll,
		diceCountRef,
	]);

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

	const handleRestartGame = () => {
		effectDiceMoveRef.current = null;
		isRollingRef.current = false;
		setIsRolling(false);
		pendingSkipTurnRef.current = null;
		if (warpArrivalTimerRef.current !== null) {
			clearTimeout(warpArrivalTimerRef.current);
			warpArrivalTimerRef.current = null;
		}
		const runtime = runtimeRef.current;
		const startTile = runtime?.boardTiles[0];
		const startTileId = startTile?.id ?? 'outer_0';
		resetTeamsToStart(startTileId);
		lastMovedTeamIndexRef.current = 0;
		hasRolledThisGameRef.current = false;
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

	return {
		movePawnSteps,
		handleDiceSettled,
		applyDrawnGoldCard,
		syncDiceCount,
		rollDice,
		handleDiceCountChange,
		handleConfirmTileEvent,
		handleCloseEventNotice,
		selectGoldCardTarget,
		beginGoldCardEffectTargetSelection,
		handleRestartGame,
	};
}
