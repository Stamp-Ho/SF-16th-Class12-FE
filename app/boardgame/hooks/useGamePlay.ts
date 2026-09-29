import {
	useCallback,
	useEffect,
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
import {
	animatePawnHop,
	innerTileToBoardTile,
	resolveNextStep,
} from '../utils/pawnMovement';

export interface GamePlayParams {
	boardTilesMapRef: RefObject<Map<string, BoardTileData>>;
	currentTeamIndexRef: RefObject<number>;
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
	const showTileEvent = useCallback((tileId: string) => {
		const tile = boardTilesMapRef.current.get(tileId);
		if (tile) setPendingTileEvent(tile);
	}, [
		boardTilesMapRef,
		setPendingTileEvent,
	]);


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
				const { targetIdx, targetTile } = resolveNextStep({
					boardTiles,
					tilesMap: boardTilesMapRef.current,
					currentIdx,
					currentTileId,
					isFirstStep: currentStep === 1,
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
					? innerTileToBoardTile(innerTarget)
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
		// 원래 코드와 같이 최초 렌더의 함수를 유지한다 (값은 ref로 읽음).
		// moveTeamPawnToTile을 넣으면 렌더마다 콜백이 바뀌어 3D 씬이 매번 다시 만들어진다.
		// eslint-disable-next-line react-hooks/exhaustive-deps
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
	}, [
		movePawnSteps,
		openGoldCardModal,
		pendingTileEvent,
		currentTeamIndexRef,
		playerTileIndexRef,
		setPlayerTileIndex,
		setTeamPositions,
		setTeamTileIds,
		teamPositionsRef,
		teamTileIdsRef,
		boardTilesMapRef,
		runtimeRef,
		setEventCountdown,
		setEventNotice,
		setPendingTileEvent,
	]);

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
	}, [
		eventNotice,
		isMovingPawn,
		pendingTileEvent,
		hasRolledThisGameRef,
		setHasRolledThisGame,
		setScores,
		isRollingRef,
		runtimeRef,
		setIsRolling,
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

	return {
		movePawnSteps,
		applyDrawnGoldCard,
		syncDiceCount,
		rollDice,
		handleDiceCountChange,
		executePendingTileEvent,
		selectGoldCardTarget,
		beginGoldCardEffectTargetSelection,
		handleRestartGame,
	};
}
