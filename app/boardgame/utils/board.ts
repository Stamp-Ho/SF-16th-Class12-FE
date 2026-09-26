// utils/board.ts
import * as THREE from 'three';

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
  subLabel?: string,
  bgColor = '#1e293b',
  textColor = '#ffffff',
  subLabelColor = '#94a3b8'
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // 배경
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 512, 512);

    // 테두리
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, 496, 496);

    // 메인 라벨
    ctx.fillStyle = textColor;
    ctx.font = 'bold 56px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label || '타일', 256, subLabel ? 200 : 256);

    // 서브 라벨 / 액션 표시
    if (subLabel) {
      ctx.fillStyle = subLabelColor;
      ctx.font = '36px sans-serif';
      ctx.fillText(subLabel, 256, 300);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
