// utils/diceMesh.ts
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface DiceGeometryParams {
  segments?: number;
  edgeRadius?: number;
  notchRadius?: number;
  notchDepth?: number;
}

const DEFAULT_PARAMS: Required<DiceGeometryParams> = {
  segments: 36,     // 세밀한 베벨 및 구멍을 위한 세그먼트
  edgeRadius: 0.08,  // 둥근 모서리 반경
  notchRadius: 0.125, // 눈금 파인 구멍 반경
  notchDepth: 0.11,  // 눈금 깊이 (내부 코어 메쉬를 노출시키는 깊이)
};

/**
 * 6면의 눈금 홈이 실제로 오목하게 파인 외곽 박스 지오메트리 생성
 */
export function createDiceOuterGeometry(options?: DiceGeometryParams): THREE.BufferGeometry {
  const params = { ...DEFAULT_PARAMS, ...options };
  let boxGeometry = new THREE.BoxGeometry(
    1, 1, 1,
    params.segments,
    params.segments,
    params.segments
  );

  const positionAttr = boxGeometry.attributes.position;
  const subCubeHalfSize = 0.5 - params.edgeRadius;

  // 홈 파기 함수 (코사인 곡선 기반 디스플레이스먼트)
  const notchWave = (v: number) => {
    const scaled = (1 / params.notchRadius) * v;
    const clamped = Math.PI * Math.max(-1, Math.min(1, scaled));
    return params.notchDepth * (Math.cos(clamped) + 1.0);
  };
  const notch = (pos: [number, number]) => notchWave(pos[0]) * notchWave(pos[1]);

  const offset = 0.23; // 복수 눈금(2~6) 간격 오프셋
  const eps = 1e-4;

  for (let i = 0; i < positionAttr.count; i++) {
    let position = new THREE.Vector3().fromBufferAttribute(positionAttr, i);

    // 1. 모서리 둥글리기 (Bevel Smoothing)
    const subCube = new THREE.Vector3(
      Math.sign(position.x),
      Math.sign(position.y),
      Math.sign(position.z)
    ).multiplyScalar(subCubeHalfSize);

    const addition = new THREE.Vector3().subVectors(position, subCube);

    if (
      Math.abs(position.x) > subCubeHalfSize &&
      Math.abs(position.y) > subCubeHalfSize &&
      Math.abs(position.z) > subCubeHalfSize
    ) {
      addition.normalize().multiplyScalar(params.edgeRadius);
      position = subCube.add(addition);
    } else if (Math.abs(position.x) > subCubeHalfSize && Math.abs(position.y) > subCubeHalfSize) {
      addition.z = 0;
      addition.normalize().multiplyScalar(params.edgeRadius);
      position.x = subCube.x + addition.x;
      position.y = subCube.y + addition.y;
    } else if (Math.abs(position.x) > subCubeHalfSize && Math.abs(position.z) > subCubeHalfSize) {
      addition.y = 0;
      addition.normalize().multiplyScalar(params.edgeRadius);
      position.x = subCube.x + addition.x;
      position.z = subCube.z + addition.z;
    } else if (Math.abs(position.y) > subCubeHalfSize && Math.abs(position.z) > subCubeHalfSize) {
      addition.x = 0;
      addition.normalize().multiplyScalar(params.edgeRadius);
      position.y = subCube.y + addition.y;
      position.z = subCube.z + addition.z;
    }

    // 2. 6면 눈금 홈 버텍스 디스플레이스먼트 (원본 식의 누락/부호 오류 교정)
    // Face +Y : [1] (중앙 1개)
    if (Math.abs(position.y - 0.5) < eps) {
      position.y -= notch([position.x, position.z]);
    }
    // Face -Y : [6] (위/중간/아래 각 2개씩)
    else if (Math.abs(position.y - (-0.5)) < eps) {
      position.y += notch([position.x + offset, position.z + offset]);
      position.y += notch([position.x + offset, position.z]);
      position.y += notch([position.x + offset, position.z - offset]);
      position.y += notch([position.x - offset, position.z + offset]);
      position.y += notch([position.x - offset, position.z]);
      position.y += notch([position.x - offset, position.z - offset]);
    }
    // Face +X : [2] (대각선 2개)
    else if (Math.abs(position.x - 0.5) < eps) {
      position.x -= notch([position.y + offset, position.z + offset]);
      position.x -= notch([position.y - offset, position.z - offset]);
    }
    // Face -X : [5] (모서리 4개 + 중앙 1개)
    else if (Math.abs(position.x - (-0.5)) < eps) {
      position.x += notch([position.y + offset, position.z + offset]);
      position.x += notch([position.y + offset, position.z - offset]);
      position.x += notch([position.y, position.z]);
      position.x += notch([position.y - offset, position.z + offset]);
      position.x += notch([position.y - offset, position.z - offset]);
    }
    // Face +Z : [3] (대각선 3개)
    else if (Math.abs(position.z - 0.5) < eps) {
      position.z -= notch([position.x - offset, position.y + offset]);
      position.z -= notch([position.x, position.y]);
      position.z -= notch([position.x + offset, position.y - offset]);
    }
    // Face -Z : [4] (모서리 4개)
    else if (Math.abs(position.z - (-0.5)) < eps) {
      position.z += notch([position.x + offset, position.y + offset]);
      position.z += notch([position.x + offset, position.y - offset]);
      position.z += notch([position.x - offset, position.y + offset]);
      position.z += notch([position.x - offset, position.y - offset]);
    }

    positionAttr.setXYZ(i, position.x, position.y, position.z);
  }

  boxGeometry.deleteAttribute('normal');
  boxGeometry.deleteAttribute('uv');
  boxGeometry = BufferGeometryUtils.mergeVertices(boxGeometry, 1e-4);
  boxGeometry.computeVertexNormals();

  return boxGeometry;
}

/**
 * 파인 홈 사이로 드러날 내부 코어 박스 지오메트리
 */
export function createDiceInnerGeometry(edgeRadius = 0.08): THREE.BufferGeometry {
  const baseSize = 1 - 2 * edgeRadius;
  const baseGeometry = new THREE.PlaneGeometry(baseSize, baseSize);
  const offset = 0.485;

  return BufferGeometryUtils.mergeGeometries([
    baseGeometry.clone().translate(0, 0, offset),
    baseGeometry.clone().translate(0, 0, -offset),
    baseGeometry.clone().rotateX(0.5 * Math.PI).translate(0, -offset, 0),
    baseGeometry.clone().rotateX(0.5 * Math.PI).translate(0, offset, 0),
    baseGeometry.clone().rotateY(0.5 * Math.PI).translate(-offset, 0, 0),
    baseGeometry.clone().rotateY(0.5 * Math.PI).translate(offset, 0, 0),
  ], false);
}