import * as THREE from 'three';
import { BoardTile } from './board';
import { BoardTileData } from '../types/board';

const TEAM_PAWN_OFFSETS = [
	{ x: -0.9, z: -0.9 },
	{ x: 0.9, z: -0.9 },
	{ x: -0.9, z: 0.9 },
	{ x: 0.9, z: 0.9 },
];
export const DEFAULT_TEAM_NAMES = ['7공주', '이상은이상해', '쉬고오3', '전전승현입니다.'];
export const TEAM_COLORS = ['#38bdf8', '#fbbf24', '#f472b6', '#a78bfa'];
export const BOARD_SURFACE_Y = 0.4;
// 타일 윗면(0.4)에 폰 받침의 반높이(0.15)를 더해 바닥을 맞춘다.
const PAWN_BASE_HEIGHT = BOARD_SURFACE_Y + 0.15;

export function getPawnPosition(tile: Pick<BoardTile, 'x' | 'z'>, teamIndex: number) {
	const offset = TEAM_PAWN_OFFSETS[teamIndex] ?? { x: 0, z: 0 };
	return new THREE.Vector3(tile.x + offset.x, PAWN_BASE_HEIGHT, tile.z + offset.z);
}

export function getOrbitDefaults(mode: '2.5d' | 'top', rows: number, cols: number) {
	return mode === 'top'
		? { theta: 0, phi: 0.001, radius: Math.max(rows, cols) * 6 }
		: {
				theta: Math.PI / 4,
				phi: Math.PI / 3.4,
				radius: Math.max(rows, cols) * 8.5,
			};
}

// 타일 맵을 복사해 지정한 타일의 편집 잠금 보유자만 바꾼 새 맵을 반환
export function withTileLockOwner(
	tiles: Map<string, BoardTileData>,
	tileId: string,
	lockedByUserName: string,
) {
	const next = new Map(tiles);
	const tile = next.get(tileId);
	if (tile) next.set(tileId, { ...tile, lockedByUserName });
	return next;
}
