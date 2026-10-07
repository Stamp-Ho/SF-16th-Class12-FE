import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { BoardTileData } from '../types/board';
import { BoardTile, createTileTopTexture } from './board';
import { BOARD_SURFACE_Y, TEAM_COLORS, getPawnPosition } from './arena';
import { disposeGoldCardDeckGroup } from '../gold-cards/utils/threeDeck';

export function createArenaRenderer(
	canvas: HTMLCanvasElement,
	width: number,
	height: number,
) {
	const renderer = new THREE.WebGLRenderer({
		canvas,
		antialias: true,
		powerPreference: 'high-performance',
	});
	renderer.setSize(width, height);
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	return renderer;
}

// 조명 (환경광 + 그림자를 만드는 방향광)
export function addArenaLights(scene: THREE.Scene) {
	const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
	scene.add(ambientLight);

	const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
	dirLight.position.set(16, 30, 20);
	dirLight.castShadow = true;
	dirLight.shadow.mapSize.width = 2048;
	dirLight.shadow.mapSize.height = 2048;
	dirLight.shadow.camera.near = 1;
	dirLight.shadow.camera.far = 70;
	dirLight.shadow.camera.left = -20;
	dirLight.shadow.camera.right = 20;
	dirLight.shadow.camera.top = 20;
	dirLight.shadow.camera.bottom = -20;
	scene.add(dirLight);
}

// 물리 세계와 바닥
export function createArenaWorld() {
	const world = new CANNON.World({
		gravity: new CANNON.Vec3(0, -42, 0),
		allowSleep: true,
	});
	world.defaultContactMaterial.friction = 0.4;
	world.defaultContactMaterial.restitution = 0.3;

	// 타일 윗면을 공통 충돌 바닥으로 사용해 주사위가 타일 아래로 들어가지 않도록 한다.
	const floorBody = new CANNON.Body({
		type: CANNON.Body.STATIC,
		shape: new CANNON.Plane(),
	});
	floorBody.position.y = BOARD_SURFACE_Y;
	floorBody.quaternion.setFromAxisAngle(
		new CANNON.Vec3(-1, 0, 0),
		Math.PI * 0.5,
	);
	world.addBody(floorBody);
	return world;
}

interface BuildArenaTileDataParams {
	boardTiles: BoardTile[];
	previousTiles: Map<string, BoardTileData>;
	boardSize: { rows: number; cols: number };
	stepX: number;
	stepZ: number;
	halfW: number;
	halfH: number;
}

/**
 * 외곽 타일 기본값에 이전 타일 데이터를 덮어쓰고,
 * 현재 격자 안에 들어가는 내부(INNER) 타일을 위치를 다시 계산해 추가한다.
 */
export function buildArenaTileData({
	boardTiles,
	previousTiles,
	boardSize,
	stepX,
	stepZ,
	halfW,
	halfH,
}: BuildArenaTileDataParams) {
	const tileDataMap = new Map<string, BoardTileData>(
		boardTiles.map((tile) => {
			const defaultTile = {
				id: tile.id,
				category: 'OUTER',
				gridR: tile.gridR,
				gridC: tile.gridC,
				position: { x: tile.x, y: 0.2, z: tile.z },
				rotationY: tile.rotationY,
				label: `${tile.index}번 타일!`,
				subLabel: '무슨 이벤트를 넣을지 고민해보세요',
				color: '#1e293b',
				textColor: '#ffffff',
				nextTileIds: [boardTiles[(tile.index + 1) % boardTiles.length].id],
				action: {
					type: 'NONE',
					params: { promptMessage: `test-${tile.index}` },
				},
				isLocked: true,
			} satisfies BoardTileData;
			const previousTile = previousTiles.get(tile.id);
			const tileData = previousTile
				? {
						...defaultTile,
						...previousTile,
						gridR: tile.gridR,
						gridC: tile.gridC,
						rotationY: tile.rotationY,
						position: defaultTile.position,
					}
				: defaultTile;

			return [tile.id, tileData] as const;
		}),
	);

	for (const previousTile of previousTiles.values()) {
		if (
			previousTile.category !== 'INNER' ||
			previousTile.gridR < 1 ||
			previousTile.gridR >= boardSize.rows - 1 ||
			previousTile.gridC < 1 ||
			previousTile.gridC >= boardSize.cols - 1
		)
			continue;

		tileDataMap.set(previousTile.id, {
			...previousTile,
			position: {
				x: previousTile.gridC * stepX - halfW,
				y: 0.2,
				z: previousTile.gridR * stepZ - halfH,
			},
		});
	}
	return tileDataMap;
}

interface AddTileMeshContext {
	boardSize: { rows: number; cols: number };
	tileWidth: number;
	tileHeight: number;
	boxGeo: THREE.BoxGeometry;
	tileMeshMap: Map<string, THREE.Mesh>;
	tileMeshGroup: THREE.Group;
}

// 타일 데이터로 3D 타일 메시를 만들어 그룹과 피킹용 맵에 등록
export function addTileMesh(
	tileData: BoardTileData,
	{
		boardSize,
		tileWidth,
		tileHeight,
		boxGeo,
		tileMeshMap,
		tileMeshGroup,
	}: AddTileMeshContext,
) {
		const isOuter = tileData.category === 'OUTER';
		const isCorner =
			isOuter &&
			(tileData.gridR === 0 || tileData.gridR === boardSize.rows - 1) &&
			(tileData.gridC === 0 || tileData.gridC === boardSize.cols - 1);
		const tileGeometry = isOuter
			? new THREE.BoxGeometry(
					isCorner ? tileWidth * 1.6 : tileWidth,
					0.4,
					tileHeight * 1.6,
				)
			: boxGeo;
		const topTexture = createTileTopTexture(tileData, tileGeometry);
		const sideMat = new THREE.MeshStandardMaterial({
			color: 0x1e293b,
			roughness: 0.6,
		});
		const topMat = new THREE.MeshStandardMaterial({
			map: topTexture,
			roughness: 0.3,
		});

		// Material 순서: [right, left, top, bottom, front, back]
		const materials = [sideMat, sideMat, topMat, sideMat, sideMat, sideMat];
		const mesh = new THREE.Mesh(tileGeometry, materials);
		mesh.position.set(
			tileData.position.x,
			tileData.position.y,
			tileData.position.z,
		);
		mesh.rotation.y = tileData.rotationY;
		mesh.receiveShadow = true;

		// ★ Raycaster 피킹을 위한 식별자 저장
		mesh.userData = { tileId: tileData.id };
		tileMeshMap.set(tileData.id, mesh);

		tileMeshGroup.add(mesh);
}

interface CreateInnerCellGridParams {
	boardSize: { rows: number; cols: number };
	tileWidth: number;
	tileHeight: number;
	stepX: number;
	stepZ: number;
	halfW: number;
	halfH: number;
	tileDataMap: Map<string, BoardTileData>;
	innerCellMeshMap: Map<string, THREE.Mesh>;
	innerCellOutlineMap: Map<string, THREE.LineSegments>;
	isEditMode: boolean;
	isAddingInnerTile: boolean;
	isMovingInnerTile: boolean;
}

// 편집 모드에서 내부 타일을 추가·이동할 때 쓰는 내부 격자(칸 + 외곽선)
export function createInnerCellGrid({
	boardSize,
	tileWidth,
	tileHeight,
	stepX,
	stepZ,
	halfW,
	halfH,
	tileDataMap,
	innerCellMeshMap,
	innerCellOutlineMap,
	isEditMode,
	isAddingInnerTile,
	isMovingInnerTile,
}: CreateInnerCellGridParams) {
	const innerCellGrid = new THREE.Group();
	innerCellGrid.visible = isEditMode && isAddingInnerTile;
	for (let gridR = 1; gridR < boardSize.rows - 1; gridR++) {
		for (let gridC = 1; gridC < boardSize.cols - 1; gridC++) {
			const cellId = `inner_${gridR}_${gridC}`;

			const cellPlane = new THREE.Mesh(
				new THREE.PlaneGeometry(tileWidth, tileHeight),
				new THREE.MeshBasicMaterial({
					color: 0x38bdf8,
					transparent: true,
					opacity: 0.12,
					side: THREE.DoubleSide,
					depthWrite: false,
				}),
			);
			cellPlane.visible =
				![...tileDataMap.values()].some(
					(tile) =>
						tile.category === 'INNER' &&
						tile.gridR === gridR &&
						tile.gridC === gridC,
				) &&
				isEditMode &&
				(isAddingInnerTile || isMovingInnerTile);
			cellPlane.rotation.x = -Math.PI / 2;
			cellPlane.position.set(
				gridC * stepX - halfW,
				0.08,
				gridR * stepZ - halfH,
			);
			cellPlane.userData = { gridR, gridC };
			const cellOutline = new THREE.LineSegments(
				new THREE.EdgesGeometry(
					new THREE.PlaneGeometry(tileWidth, tileHeight),
				),
				new THREE.LineBasicMaterial({
					color: 0x38bdf8,
					transparent: true,
					opacity: 0.7,
				}),
			);
			cellOutline.visible = cellPlane.visible;
			cellOutline.rotation.x = -Math.PI / 2;
			cellOutline.position.copy(cellPlane.position);
			innerCellGrid.add(cellPlane, cellOutline);
			innerCellMeshMap.set(cellId, cellPlane);
			innerCellOutlineMap.set(cellId, cellOutline);
		}
	}
	return innerCellGrid;
}

// 중앙 주사위 투척 구역 바닥 펠트
export function addCenterFloor(
	scene: THREE.Scene,
	innerW: number,
	innerH: number,
) {
	const centerFloorGeo = new THREE.PlaneGeometry(innerW, innerH);
	const centerFloorMat = new THREE.MeshStandardMaterial({
		color: 0x0f172a,
		roughness: 10,
	});
	const centerFloor = new THREE.Mesh(centerFloorGeo, centerFloorMat);
	centerFloor.rotation.x = -Math.PI / 2;
	centerFloor.position.y = 0.02;
	centerFloor.receiveShadow = true;
	scene.add(centerFloor);
}

// 중앙 물리 가벽 4면 (주사위가 테두리 말이나 밖으로 튀는 것 방지)
export function addArenaWalls(
	scene: THREE.Scene,
	world: CANNON.World,
	{
		innerW,
		innerH,
		wallHeight,
		wallThick,
		halfInnerW,
		halfInnerH,
	}: {
		innerW: number;
		innerH: number;
		wallHeight: number;
		wallThick: number;
		halfInnerW: number;
		halfInnerH: number;
	},
) {
	const wallsData = [
		{ x: 0, z: -halfInnerH, w: innerW, d: wallThick },
		{ x: 0, z: halfInnerH, w: innerW, d: wallThick },
		{ x: -halfInnerW, z: 0, w: wallThick, d: innerH },
		{ x: halfInnerW, z: 0, w: wallThick, d: innerH },
	];

	wallsData.forEach(({ x, z, w, d }) => {
		const wallBody = new CANNON.Body({
			type: CANNON.Body.STATIC,
			shape: new CANNON.Box(new CANNON.Vec3(w / 2, wallHeight / 2, d / 2)),
		});
		wallBody.position.set(x, wallHeight / 2, z);
		world.addBody(wallBody);

		// 반투명 아크릴 시각 메시
		const wallGeo = new THREE.BoxGeometry(w, wallHeight, d);
		const wallMat = new THREE.MeshStandardMaterial({
			color: 0x38bdf8,
			transparent: true,
			opacity: 0.18,
			roughness: 0.1,
		});
		const wallMesh = new THREE.Mesh(wallGeo, wallMat);
		wallMesh.position.set(x, wallHeight / 2, z);
		scene.add(wallMesh);
	});
}

interface CreateTeamPawnMeshesParams {
	scene: THREE.Scene;
	boardTiles: BoardTile[];
	savedTileIds: string[];
	tilesMap: Map<string, BoardTileData>;
	isEditMode: boolean;
}

// 팀별 3D 말을 만들어 저장된 위치(없으면 출발 칸)에 배치
export function createTeamPawnMeshes({
	scene,
	boardTiles,
	savedTileIds,
	tilesMap,
	isEditMode,
}: CreateTeamPawnMeshesParams) {
	const pawnMeshes = TEAM_COLORS.map((color, teamIndex) => {
		const pawnMesh = new THREE.Group();
		const teamColor = new THREE.Color(color);
		const pawnBase = new THREE.Mesh(
			new THREE.CylinderGeometry(0.65, 0.75, 0.3, 32),
			new THREE.MeshStandardMaterial({
				color: teamColor,
				metalness: 0.3,
				roughness: 0.2,
			}),
		);
		const pawnBody = new THREE.Mesh(
			new THREE.ConeGeometry(0.55, 1.2, 32),
			new THREE.MeshStandardMaterial({
				color: teamColor,
				metalness: 0.2,
				roughness: 0.3,
			}),
		);
		pawnBody.position.y = 0.7;
		const pawnHead = new THREE.Mesh(
			new THREE.SphereGeometry(0.38, 32, 32),
			new THREE.MeshStandardMaterial({
				color: teamColor,
				roughness: 0.1,
				metalness: 0.1,
			}),
		);
		pawnHead.position.y = 1.45;

		pawnMesh.add(pawnBase, pawnBody, pawnHead);
		pawnMesh.traverse((child) => {
			if (child instanceof THREE.Mesh) child.castShadow = true;
		});

		const savedTileId = savedTileIds[teamIndex];
		const savedOuterTile = boardTiles.find((tile) => tile.id === savedTileId);
		const savedInnerTile = tilesMap.get(savedTileId);
		const pawnStart =
			savedOuterTile ??
			(savedInnerTile?.category === 'INNER'
				? { x: savedInnerTile.position.x, z: savedInnerTile.position.z }
				: boardTiles[0]);
		pawnMesh.position.copy(getPawnPosition(pawnStart, teamIndex));
		pawnMesh.visible = !isEditMode;
		scene.add(pawnMesh);
		return pawnMesh;
	});
	return pawnMeshes;
}

// 씬에서 만든 타일·내부 격자·선택 박스·황금카드 덱의 GPU 리소스 해제
export function disposeArenaScene({
	tileMeshGroup,
	boxGeo,
	innerCellGrid,
	selectionBox,
	goldCardDeckGroup,
}: {
	tileMeshGroup: THREE.Group;
	boxGeo: THREE.BoxGeometry;
	innerCellGrid: THREE.Group;
	selectionBox: THREE.BoxHelper;
	goldCardDeckGroup: THREE.Group;
}) {
	tileMeshGroup.traverse((object) => {
		if (!(object instanceof THREE.Mesh)) return;
		if (object.geometry !== boxGeo) object.geometry.dispose();
		const materials = Array.isArray(object.material)
			? object.material
			: [object.material];
		materials.forEach((material) => {
			material.map?.dispose();
			material.dispose();
		});
	});
	boxGeo.dispose();
	innerCellGrid.traverse((object) => {
		if (
			!(
				object instanceof THREE.Mesh || object instanceof THREE.LineSegments
			)
		)
			return;
		object.geometry.dispose();
		const materials = Array.isArray(object.material)
			? object.material
			: [object.material];
		materials.forEach((material) => material.dispose());
	});
	selectionBox.geometry.dispose();
	disposeGoldCardDeckGroup(goldCardDeckGroup);
}
