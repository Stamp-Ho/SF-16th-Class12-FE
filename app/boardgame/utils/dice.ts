// utils/dice.ts
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// 주사위 면 텍스처 생성 함수 (각 면 눈금 드로잉)
export function createDiceFaceTexture(value: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  if (!ctx) return new THREE.CanvasTexture(canvas);

  // 주사위 바탕 (부드러운 아이보리 톤)
  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(0, 0, 256, 256);

  // 1번 눈금은 포인트 레드, 나머지는 다크 그레이
  ctx.fillStyle = value === 1 ? '#e11d48' : '#1e293b';

  const r = value === 1 ? 26 : 18;
  const c = 128;
  const p1 = 68;
  const p2 = 188;

  const drawCircle = (x: number, y: number) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  switch (value) {
    case 1:
      drawCircle(c, c);
      break;
    case 2:
      drawCircle(p1, p1);
      drawCircle(p2, p2);
      break;
    case 3:
      drawCircle(p1, p1);
      drawCircle(c, c);
      drawCircle(p2, p2);
      break;
    case 4:
      drawCircle(p1, p1);
      drawCircle(p2, p1);
      drawCircle(p1, p2);
      drawCircle(p2, p2);
      break;
    case 5:
      drawCircle(p1, p1);
      drawCircle(p2, p1);
      drawCircle(c, c);
      drawCircle(p1, p2);
      drawCircle(p2, p2);
      break;
    case 6:
      drawCircle(p1, p1);
      drawCircle(p2, p1);
      drawCircle(p1, c);
      drawCircle(p2, c);
      drawCircle(p1, p2);
      drawCircle(p2, p2);
      break;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// 6면 머티리얼 배열 생성 (+X, -X, +Y, -Y, +Z, -Z 순서)
export function createDiceMaterials(): THREE.MeshStandardMaterial[] {
  const faceOrder = [1, 6, 2, 5, 3, 4];
  return faceOrder.map((num) => {
    const tex = createDiceFaceTexture(num);
    return new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.25,
      metalness: 0.05,
    });
  });
}

// Three.js Box Face 방향 벡터 정의
const FACE_VECTORS: { dir: CANNON.Vec3; value: number }[] = [
  { dir: new CANNON.Vec3(1, 0, 0), value: 1 },
  { dir: new CANNON.Vec3(-1, 0, 0), value: 6 },
  { dir: new CANNON.Vec3(0, 1, 0), value: 2 },
  { dir: new CANNON.Vec3(0, -1, 0), value: 5 },
  { dir: new CANNON.Vec3(0, 0, 1), value: 3 },
  { dir: new CANNON.Vec3(0, 0, -1), value: 4 },
];

// 월드 Y축(상단)을 바라보는 면 계산
export function getDiceTopValue(body: CANNON.Body): number {
  let maxDot = -Infinity;
  let topValue = 1;
  const worldUp = new CANNON.Vec3(0, 1, 0);

  for (const { dir, value } of FACE_VECTORS) {
    const worldDir = body.quaternion.vmult(dir);
    const dot = worldDir.dot(worldUp);
    if (dot > maxDot) {
      maxDot = dot;
      topValue = value;
    }
  }
  return topValue;
}