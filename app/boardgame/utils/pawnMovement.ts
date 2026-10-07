import * as THREE from 'three';
import { BoardTileData } from '../types/board';
import { BoardTile } from './board';

// 내부(INNER) 타일 데이터를 말 이동에 쓰는 BoardTile 좌표 형태로 변환
export const innerTileToBoardTile = (innerTile: BoardTileData): BoardTile => ({
	id: innerTile.id,
	index: -1,
	gridR: innerTile.gridR,
	gridC: innerTile.gridC,
	x: innerTile.position.x,
	z: innerTile.position.z,
	rotationY: innerTile.rotationY,
	isCorner: false,
});

/**
 * 말이 한 칸 이동할 목표 칸을 정한다.
 * 현재 칸에 설정된 다음 칸(첫 걸음이 방향 전환 칸이면 그 대상)이 있으면 그 칸으로,
 * 후진은 현재 칸으로 연결된 이전 칸으로, 연결이 없으면 외곽의 이전 칸으로 이동한다.
 * 내부 타일이면 index는 -1이다.
 */
export function resolveNextStep({
	boardTiles,
	tilesMap,
	currentIdx,
	currentTileId,
	isFirstStep,
	direction = 1,
}: {
	boardTiles: BoardTile[];
	tilesMap: Map<string, BoardTileData>;
	currentIdx: number;
	currentTileId: string | undefined;
	isFirstStep: boolean;
	direction?: 1 | -1;
}) {
	const currentTileData = currentTileId
		? tilesMap.get(currentTileId)
		: undefined;
	// 후진은 현재 칸으로 연결된 이전 칸을 따라간다. 방향 전환은 전진에만 적용한다.
	const previousTile = direction === -1 && currentTileId
		? [...tilesMap.values()].find((tile) => tile.nextTileIds[0] === currentTileId)
		: undefined;
	const configuredNextId = direction === -1
		? previousTile?.id
		: isFirstStep && currentTileData?.action.type === 'DIRECTION_CHANGE'
			? currentTileData.action.params?.targetTileId
			: currentTileData?.nextTileIds[0];
	const configuredNextIdx = configuredNextId
		? boardTiles.findIndex((tile) => tile.id === configuredNextId)
		: -1;
	const configuredInnerTile =
		configuredNextIdx < 0 && configuredNextId
			? tilesMap.get(configuredNextId)
			: undefined;
	const hasConfiguredTarget =
		configuredNextIdx >= 0 || configuredInnerTile?.category === 'INNER';
	const targetIdx = hasConfiguredTarget
		? configuredNextIdx
		: currentIdx >= 0
			? (currentIdx + direction + boardTiles.length) % boardTiles.length
			: 0;
	const targetTile: BoardTile =
		targetIdx >= 0
			? boardTiles[targetIdx]
			: innerTileToBoardTile(configuredInnerTile!);
	return { targetIdx, targetTile };
}

// 말을 현재 위치에서 endPos까지 부드러운 호를 그리며 점프시킨다
export function animatePawnHop(
	pawnMesh: THREE.Object3D,
	endPos: THREE.Vector3,
	{ durationMs = 200, onComplete }: { durationMs?: number; onComplete?: () => void } = {},
) {
	const startPos = pawnMesh.position.clone();
	const startTime = performance.now();
	const jumpAnim = () => {
		const progress = Math.min((performance.now() - startTime) / durationMs, 1);
		if (progress < 1) {
			pawnMesh.position.lerpVectors(startPos, endPos, progress);
			pawnMesh.position.y += Math.sin(progress * Math.PI) * 1.0;
			requestAnimationFrame(jumpAnim);
		} else {
			pawnMesh.position.copy(endPos);
			onComplete?.();
		}
	};
	jumpAnim();
}
