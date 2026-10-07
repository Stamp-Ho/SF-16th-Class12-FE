import type { Dispatch, SetStateAction } from 'react';
import { GoldCardData } from '../gold-cards/types';
import { BoardTileData } from '../types/board';

export interface DiceArenaTeamInfo {
	name: string;
	color: string;
}

export type TileSelectionMode =
	| 'next'
	| 'teleport'
	| 'direction'
	| 'gold-card-target'
	| 'gold-card-effect-target'
	| null;

// 1. 게임 플레이 상태 및 액션
export interface GamePlayDomain {
	state: {
		teams: DiceArenaTeamInfo[];
		currentTeamIndex: number;
		teamSkipTurns: number[];
		teamPositions: number[];
		teamTileIds: string[];
		playerTileIndex: number;
		scores: number[];
		totalScore: number;
		diceCount: number;
		isRolling: boolean;
		isMovingPawn: boolean;
		hasRolledThisGame: boolean;
		pendingTileEvent: BoardTileData | null;
		hasPendingGoldCard: boolean;
		eventNotice: { title: string; message: string } | null;
	};
	actions: {
		onRollDice: () => void;
		onChangeDiceCount: (count: number) => void;
		onChangeTeamName: (teamIndex: number, name: string) => void;
		onRestartGame: () => void;
	};
}

// 2. 보드 편집기 상태 및 액션
export interface BoardEditorDomain {
	state: {
		canEdit: boolean;
		isEditMode: boolean;
		isBusy: boolean;
		isAddingInnerTile: boolean;
		isMovingInnerTile: boolean;
		selectedTileId: string | null;
		tileSelectionMode: TileSelectionMode;
		boardSize: { rows: number; cols: number };
		gridSizeDraft: { rows: string; cols: string };
		gridSizeError: string;
		boardTilesMap: Map<string, BoardTileData>;
	};
	actions: {
		setGridSizeDraft: Dispatch<SetStateAction<{ rows: string; cols: string }>>;
		onToggleEditMode: () => void;
		onApplyGridSize: () => void;
		onToggleAddInnerTile: () => void;
		onMoveTilePosition: () => void;
		onBeginTileSelection: (mode: 'next' | 'teleport' | 'direction') => void;
		onUpdateTile: (tile: Partial<BoardTileData>) => void;
		onDeleteTile: (tileId: string) => void;
		onCloseTileInspector: () => void;
	};
}

// 3. 황금 카드 관리 도메인
export interface GoldCardDomain {
	state: {
		cards: GoldCardData[];
		isManagerOpen: boolean;
		selectingTargetCardId: string | null;
	};
	actions: {
		setCards: Dispatch<SetStateAction<GoldCardData[]>>;
		onToggleManager: () => void;
		onSelectTargetCard: (cardId: string) => void;
	};
}

// 4. 화면/뷰 제어 도메인
export interface ViewDomain {
	isFullscreen: boolean;
	onToggleFullscreen: () => void;
}

// Sidebar 컴포넌트의 단일 Props 인터페이스
export interface DiceArenaSidebarProps {
	props: {
		game: GamePlayDomain;
		editor: BoardEditorDomain;
		goldCard: GoldCardDomain;
		view: ViewDomain;
	};
}
