// utils/diceFactory.ts
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { createDiceOuterGeometry, createDiceInnerGeometry } from './diceMesh';

export interface DiceTemplate {
  group: THREE.Group;
  outerMesh: THREE.Mesh;
  innerMesh: THREE.Mesh;
  dispose: () => void;
}

/**
 * 고품질 3D 주사위 템플릿 메쉬 생성 (원본 메쉬 구조와 동일)
 */
export function createHighQualityDiceTemplate(): DiceTemplate {
  const outerGeo = createDiceOuterGeometry();
  const innerGeo = createDiceInnerGeometry();

  // 원본 감성의 매트하면서도 부드러운 하이라이트를 지닌 고품질 상아색 외피
  const boxMaterialOuter = new THREE.MeshStandardMaterial({
    color: 0xf4f4f5, // 은은한 도자기/아이보리 화이트
    roughness: 0.18,
    metalness: 0.02,
    flatShading: false,
  });

  // 파인 홈 안쪽에서 선명하게 대비를 주는 칠흑색 유광 코어
  const boxMaterialInner = new THREE.MeshStandardMaterial({
    color: 0x09090b, // 리얼 딥 블랙
    roughness: 0.1,
    metalness: 0.85,
    side: THREE.DoubleSide,
  });

  const diceGroup = new THREE.Group();
  const innerMesh = new THREE.Mesh(innerGeo, boxMaterialInner);
  const outerMesh = new THREE.Mesh(outerGeo, boxMaterialOuter);

  outerMesh.castShadow = true;
  outerMesh.receiveShadow = true;

  diceGroup.add(innerMesh, outerMesh);

  return {
    group: diceGroup,
    outerMesh,
    innerMesh,
    dispose: () => {
      outerGeo.dispose();
      innerGeo.dispose();
      boxMaterialOuter.dispose();
      boxMaterialInner.dispose();
    },
  };
}

/**
 * 정밀 면 방향 벡터 매핑 (+Y: 1, -Y: 6, +X: 2, -X: 5, +Z: 3, -Z: 4)
 */
const FACE_VECTORS: { dir: CANNON.Vec3; value: number }[] = [
  { dir: new CANNON.Vec3(0, 1, 0), value: 1 },
  { dir: new CANNON.Vec3(0, -1, 0), value: 6 },
  { dir: new CANNON.Vec3(1, 0, 0), value: 2 },
  { dir: new CANNON.Vec3(-1, 0, 0), value: 5 },
  { dir: new CANNON.Vec3(0, 0, 1), value: 3 },
  { dir: new CANNON.Vec3(0, 0, -1), value: 4 },
];

export function getPreciseDiceScore(body: CANNON.Body): number {
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