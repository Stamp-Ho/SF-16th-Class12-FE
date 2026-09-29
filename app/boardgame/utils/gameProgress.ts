import { BoardTileData } from '../types/board';
import { DEFAULT_TEAM_NAMES } from './arena';
import { generateBoardTiles } from './board';

/**
 * localStorage에 저장된 보드게임 진행 상태(팀 이름·위치·현재 턴·점수)를 읽어
 * 현재 보드 구성에 맞게 검증한 값을 돌려준다. 잘못된 값은 기본값으로 대체한다.
 */
export function restoreGameProgress(
	boardgameId: string,
	gridRows: number,
	gridCols: number,
	tiles: BoardTileData[],
) {
	const progressKey = `dice-arena-progress:${boardgameId}`;
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
		gridRows,
		gridCols,
		4.8,
		4.8,
		0.15,
	);
	const outerTileIndexById = new Map(
		outerTiles.map((tile, index) => [tile.id, index]),
	);
	const validTileIds = new Set([
		...outerTiles.map((tile) => tile.id),
		...tiles.map((tile) => tile.id),
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
	return {
		restoredTileIds,
		restoredPositions,
		restoredNames,
		restoredCurrentTeam,
		restoredScores,
		restoredHasRolled,
	};
}

// 진행 상태를 localStorage에 저장 (저장소 접근이 막혀 있으면 무시)
export function saveGameProgress(
	boardgameId: string,
	progress: {
		teamNames: string[];
		teamPositions: number[];
		teamTileIds: string[];
		currentTeamIndex: number;
		hasRolled: boolean;
		scores: number[];
	},
) {
	try {
		window.localStorage.setItem(
			`dice-arena-progress:${boardgameId}`,
			JSON.stringify(progress),
		);
	} catch {
		// 저장소 접근이 차단된 환경에서는 현재 탭의 메모리 상태만 유지합니다.
	}
}
