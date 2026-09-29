import { BoardTileData } from '../types/board';

// 내부 격자 (gridR, gridC) 칸에 이미 내부 타일이 있는지
export const isInnerCellOccupied = (
	tiles: Map<string, BoardTileData>,
	gridR: number,
	gridC: number,
) =>
	[...tiles.values()].some(
		(tile) =>
			tile.category === 'INNER' &&
			tile.gridR === gridR &&
			tile.gridC === gridC,
	);

// 내부 격자 칸의 3D 좌표
export const getInnerCellPosition = (
	gridR: number,
	gridC: number,
	stepX: number,
	stepZ: number,
	halfW: number,
	halfH: number,
) => ({
	x: gridC * stepX - halfW,
	y: 0.2,
	z: gridR * stepZ - halfH,
});

// id가 이미 쓰이고 있으면 `${id}_1`, `${id}_2` … 중 비어 있는 id를 반환
export function getUnusedTileId(tiles: Map<string, BoardTileData>, id: string) {
	let newTileId = id;
	let suffix = 1;
	while (tiles.has(newTileId)) {
		newTileId = `${id}_${suffix++}`;
	}
	return newTileId;
}

// 내부 격자 칸을 클릭해 새로 만드는 내부 타일의 기본값
export const createInnerTileData = (
	id: string,
	gridR: number,
	gridC: number,
	position: BoardTileData['position'],
): BoardTileData => ({
	id,
	category: 'INNER',
	gridR,
	gridC,
	position,
	rotationY: 0,
	label: `내부 타일 ${gridR}, ${gridC}`,
	subLabel: '타일 속성에서 내용을 설정하세요.',
	color: '#0f172a',
	textColor: '#ffffff',
	nextTileIds: [],
	action: { type: 'NONE' },
	isLocked: false,
});

// 타일 선택 모드('next' 또는 워프/방향 대상)에 따라 원본 타일의 연결 대상을 바꾼 타일
export const withTileLinkTarget = (
	sourceTile: BoardTileData,
	selectionMode: string,
	tileId: string,
): BoardTileData =>
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

/**
 * 내부 타일을 새 칸(newTileId)으로 옮긴 타일 맵을 만든다.
 * 다른 타일의 다음 칸·워프 대상이 옮긴 타일을 가리키면 새 id로 바꾼다.
 */
export function moveInnerTile(
	tiles: Map<string, BoardTileData>,
	movingTileId: string,
	selectedTile: BoardTileData,
	newTileId: string,
	gridR: number,
	gridC: number,
	position: BoardTileData['position'],
) {
	const movedTile = {
		...selectedTile,
		id: newTileId,
		gridR,
		gridC,
		position,
	};
	const nextTileMap = new Map(tiles);
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
	return { movedTile, nextTileMap };
}
