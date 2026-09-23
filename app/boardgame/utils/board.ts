// utils/board.ts
import * as THREE from 'three';

export interface BoardTile {
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
  tileSize = 2.4,
  gap = 0.15
): BoardTile[] {
  const step = tileSize + gap;
  const halfW = ((cols - 1) * step) / 2;
  const halfH = ((rows - 1) * step) / 2;

  interface TileCoord {
    r: number;
    c: number;
    rotY: number;
  }

  const perimeterCoords: TileCoord[] = [];

  // 1. 상단 변: 좌 -> 우 (중심은 아래쪽 +Z 방향)
  for (let c = 0; c < cols; c++) {
    perimeterCoords.push({ r: 0, c, rotY: Math.PI });
  }

  // 2. 우측 변: 상 -> 하 (중심은 왼쪽 -X 방향)
  for (let r = 1; r < rows; r++) {
    perimeterCoords.push({ r, c: cols - 1, rotY: Math.PI / 2 });
  }

  // 3. 하단 변: 우 -> 좌 (중심은 위쪽 -Z 방향)
  for (let c = cols - 2; c >= 0; c--) {
    perimeterCoords.push({ r: rows - 1, c, rotY: 0 });
  }

  // 4. 좌측 변: 하 -> 상 (중심은 오른쪽 +X 방향)
  for (let r = rows - 2; r >= 1; r--) {
    perimeterCoords.push({ r, c: 0, rotY: -Math.PI / 2 });
  }

  return perimeterCoords.map((coord, idx) => {
    const isCorner =
      (coord.r === 0 || coord.r === rows - 1) &&
      (coord.c === 0 || coord.c === cols - 1);

    return {
      index: idx,
      gridR: coord.r,
      gridC: coord.c,
      x: coord.c * step - halfW,
      z: coord.r * step - halfH,
      rotationY: coord.rotY,
      isCorner,
    };
  });
}

/**
 * 타일 상단 텍스처 (캔버스의 위쪽이 실제 보드의 안쪽/중심을 향함)
 */
export function createTileTexture(num: number, isCorner: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // 베이스 배경
  ctx.fillStyle = isCorner ? '#1e293b' : '#0f172a';
  ctx.fillRect(0, 0, 256, 256);

  // 안쪽(중심)을 가리키는 상단 포인트 인디케이터 바
  ctx.fillStyle = isCorner ? '#38bdf8' : '#64748b';
  ctx.fillRect(20, 14, 216, 12);

  // 외곽 테두리
  ctx.lineWidth = 8;
  ctx.strokeStyle = isCorner ? '#38bdf8' : '#334155';
  ctx.strokeRect(8, 8, 240, 240);

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