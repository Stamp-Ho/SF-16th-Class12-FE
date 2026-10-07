// utils/board.ts
import * as THREE from 'three';
import { drawGoldCardArtwork } from '../gold-cards/utils/cardArtwork';
import type { BoardTileData } from '../types/board';

export interface BoardTile {
	id: string;
	index: number;
	gridR: number;
	gridC: number;
	x: number;
	z: number;
	rotationY: number; // 보드 중심을 향하는 Y축 회전 각도 (라디안)
	isCorner: boolean;
}
export function generateBoardTiles(
	rows: number,
	cols: number,
	tileWidth = 2.4,
	tileHeight = tileWidth,
	gap = 0.15,
): BoardTile[] {
	const cornerWidth = tileWidth * 1.6;
	const cornerHeight = tileHeight * 1.6;
	const totalWidth =
		cornerWidth * 2 + Math.max(0, cols - 2) * tileWidth + (cols - 1) * gap;
	const totalHeight =
		cornerHeight * 2 + Math.max(0, rows - 2) * tileHeight + (rows - 1) * gap;
	const minX = -totalWidth / 2;
	const minZ = -totalHeight / 2;
	const xByCol = Array.from({ length: cols }, (_, col) =>
		col === 0
			? minX + cornerWidth / 2
			: col === cols - 1
				? -minX - cornerWidth / 2
				: minX +
					cornerWidth +
					gap +
					tileWidth / 2 +
					(col - 1) * (tileWidth + gap),
	);
	const zByRow = Array.from({ length: rows }, (_, row) =>
		row === 0
			? minZ + cornerHeight / 2
			: row === rows - 1
				? -minZ - cornerHeight / 2
				: minZ +
					cornerHeight +
					gap +
					tileHeight / 2 +
					(row - 1) * (tileHeight + gap),
	);

	interface TileCoord {
		r: number;
		c: number;
		rotY: number;
	}

	const perimeterCoords: TileCoord[] = [];

	// 1. 하단 변: 우측 하단(출발점) -> 좌측 하단 (c: cols-1 -> 0)
	// 타일 상단이 보드 안쪽(위쪽, -Z)을 향하므로 rotY = 0
	for (let c = cols - 1; c >= 0; c--) {
		perimeterCoords.push({ r: rows - 1, c, rotY: 0 });
	}

	// 2. 좌측 변: 하단 코너 다음 -> 상단 좌측 코너 (r: rows-2 -> 0)
	// 타일 상단이 보드 안쪽(우측, +X)을 향하므로 rotY = -Math.PI / 2
	for (let r = rows - 2; r >= 0; r--) {
		perimeterCoords.push({ r, c: 0, rotY: -Math.PI / 2 });
	}

	// 3. 상단 변: 좌측 코너 다음 -> 우측 상단 코너 (c: 1 -> cols-1)
	// 타일 상단이 보드 안쪽(아래쪽, +Z)을 향하므로 rotY = Math.PI
	for (let c = 1; c < cols; c++) {
		perimeterCoords.push({ r: 0, c, rotY: Math.PI });
	}

	// 4. 우측 변: 상단 코너 다음 -> 우측 하단 직전 (r: 1 -> rows-2)
	// 타일 상단이 보드 안쪽(좌측, -X)을 향하므로 rotY = Math.PI / 2
	for (let r = 1; r <= rows - 2; r++) {
		perimeterCoords.push({ r, c: cols - 1, rotY: Math.PI / 2 });
	}

	return perimeterCoords.map((coord, idx) => {
		const isCorner =
			(coord.r === 0 || coord.r === rows - 1) &&
			(coord.c === 0 || coord.c === cols - 1);

		return {
			id: `outer_${idx}`,
			index: idx,
			gridR: coord.r,
			gridC: coord.c,
			x: xByCol[coord.c],
			z: zByRow[coord.r],
			rotationY: coord.rotY,
			isCorner,
		};
	});
}

/**
 * 타일 상단 텍스처 (캔버스의 위쪽이 실제 보드의 안쪽/중심을 향함)
 */
export function createTileTexture(
	num: number,
	isCorner: boolean,
): THREE.CanvasTexture {
	const canvas = document.createElement('canvas');
	canvas.width = 512;
	canvas.height = 512;
	const ctx = canvas.getContext('2d')!;

	// 베이스 배경
	ctx.fillStyle = isCorner ? '#1e293b' : '#0f172a';
	ctx.fillRect(0, 0, 512, 512);

	// 안쪽(중심)을 가리키는 상단 포인트 인디케이터 바
	ctx.fillStyle = isCorner ? '#38bdf8' : '#64748b';
	ctx.fillRect(40, 28, 432, 24);

	// 외곽 테두리
	ctx.lineWidth = 8;
	ctx.strokeStyle = isCorner ? '#38bdf8' : '#334155';
	ctx.strokeRect(16, 16, 480, 480);

	// 타일 번호 숫자 (캔버스 정중앙에 정자세로 렌더링)
	ctx.fillStyle = isCorner ? '#38bdf8' : '#f1f5f9';
	ctx.font = 'bold 96px -apple-system, BlinkMacSystemFont, sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(`${num}`, 128, 136);

	const texture = new THREE.CanvasTexture(canvas);
	texture.needsUpdate = true;
	return texture;
}

export function createDynamicTileTexture(
	label: string,
	bgColor = '#1e293b',
	textColor = '#ffffff',
	isGoldCardTile = false,
	aspectRatio = 1,
): THREE.CanvasTexture {
	const canvas = document.createElement('canvas');
	canvas.width = 512;
	canvas.height = Math.round(canvas.width / aspectRatio);
	const ctx = canvas.getContext('2d');

	if (ctx) {
		// 배경
		ctx.fillStyle = bgColor;
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		// 테두리
		ctx.strokeStyle = '#38bdf8';
		ctx.lineWidth = 8;
		ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

		if (isGoldCardTile) {
			// 황금 카드 칸은 라벨 대신 카드 한 장을 타일 윗면에 표시한다.
			drawGoldCardArtwork(ctx, canvas.width / 2, canvas.height / 2, 236, 332);
		} else {
			// 설명은 도착 팝업에서만 보여주고 타일 표면에는 제목만 표시한다.
			ctx.fillStyle = textColor;
			const lines = (label || '타일').split(/\r\n?|\n/);
			const maxWidth = canvas.width - 64;
			const maxHeight = canvas.height - 64;
			ctx.font = 'bold 56px sans-serif';
			const widestLine = Math.max(...lines.map((line) => ctx.measureText(line).width));
			const fontSize = Math.min(
				56,
				widestLine > 0 ? (56 * maxWidth) / widestLine : 56,
				maxHeight / (lines.length * 1.25),
			);
			const lineHeight = fontSize * 1.25;
			ctx.font = `bold ${fontSize}px sans-serif`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			const firstLineY = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2;
			lines.forEach((line, index) => {
				ctx.fillText(line, canvas.width / 2, firstLineY + index * lineHeight);
			});
		}
	}

	const texture = new THREE.CanvasTexture(canvas);
	texture.needsUpdate = true;
	return texture;
}

// 최초 생성과 편집 모두 실제 메시 윗면의 비율로 같은 텍스처를 만든다.
export function createTileTopTexture(
	tile: Pick<BoardTileData, 'label' | 'color' | 'textColor' | 'action'>,
	geometry: THREE.BoxGeometry,
) {
	return createDynamicTileTexture(
		tile.label,
		tile.color,
		tile.textColor,
		tile.action.type === 'DRAW_GOLD_CARD',
		geometry.parameters.width / geometry.parameters.depth,
	);
}
