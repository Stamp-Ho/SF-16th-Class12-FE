import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import type { BoardTile } from '../utils/board';
import type { DiceTemplate } from '../utils/diceFactory';

export interface DiceItem {
	body: CANNON.Body;
	isSleeping: boolean;
	lastValue: number;
	mesh: THREE.Group;
}

export interface OrbitSnapshot {
	center: THREE.Vector3;
	targetCenter: THREE.Vector3;
	theta: number;
	phi: number;
	radius: number;
	targetTheta: number;
	targetPhi: number;
	targetRadius: number;
}

export type OrbitKey = 'w' | 'a' | 's' | 'd' | 'q' | 'e' | 'z' | 'x';

export type OrbitKeys = Record<OrbitKey, boolean>;

// 카메라 궤도(Orbit) 상태: 드래그·휠·키보드 입력이 target 값을 바꾸고 애니메이션 루프가 보간한다.
export interface ArenaOrbitState {
	isDragging: boolean;
	prevX: number;
	prevY: number;
	theta: number;
	phi: number;
	radius: number;
	targetTheta: number;
	targetPhi: number;
	targetRadius: number;
	center: THREE.Vector3;
	targetCenter: THREE.Vector3;
	keys: OrbitKeys;
}

// 3D 씬 실행 중에 유지하는 Three.js·물리 객체와 카메라 궤도 상태
export interface ArenaRuntime {
	scene: THREE.Scene;
	camera: THREE.PerspectiveCamera;
	renderer: THREE.WebGLRenderer;
	world: CANNON.World;
	diceList: DiceItem[];
	diceTemplate: DiceTemplate;
	goldCardDeckGroup: THREE.Group;
	boardTiles: BoardTile[];
	pawnMeshes: THREE.Group[];
	tileMeshGroup: THREE.Group;
	reqId: number | null;
	orbit: ArenaOrbitState;
}
