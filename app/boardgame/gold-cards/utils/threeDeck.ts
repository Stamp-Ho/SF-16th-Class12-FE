import * as THREE from 'three';
import { createGoldCardDeckTexture } from './cardArtwork';

function createRoundedCardGeometry(
	width: number,
	height: number,
	depth: number,
	radius: number,
	smoothness = 16,
): THREE.ExtrudeGeometry {
	const shape = new THREE.Shape();
	const w = width / 2;
	const h = height / 2;
	const r = Math.min(radius, w, h);

	// 둥근 사각형 외곽선
	shape.moveTo(-w + r, -h);
	shape.lineTo(w - r, -h);
	shape.absarc(w - r, -h + r, r, -Math.PI / 2, 0, false);
	shape.lineTo(w, h - r);
	shape.absarc(w - r, h - r, r, 0, Math.PI / 2, false);
	shape.lineTo(-w + r, h);
	shape.absarc(-w + r, h - r, r, Math.PI / 2, Math.PI, false);
	shape.lineTo(-w, -h + r);
	shape.absarc(-w + r, -h + r, r, Math.PI, (Math.PI * 3) / 2, false);

	const extrudeSettings = {
		depth: depth,
		bevelEnabled: false,
		curveSegments: smoothness,
	};

	const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

	// 중앙 정렬 및 XZ 평면(바닥) 방향으로 회전
	geometry.center();
	geometry.rotateX(Math.PI / 2);

	// UV 좌표를 0 ~ 1 범위로 정규화 (텍스처 정밀 매핑)
	const posAttr = geometry.attributes.position;
	const uvAttr = geometry.attributes.uv;
	for (let i = 0; i < posAttr.count; i++) {
		const x = posAttr.getX(i);
		const z = posAttr.getZ(i);
		// X(-w ~ w) -> (0 ~ 1), Z(-h ~ h) -> (0 ~ 1)
		uvAttr.setXY(i, (x + w) / width, (z + h) / height);
	}
	uvAttr.needsUpdate = true;

	return geometry;
}

export function createGoldCardDeckGroup() {
	const deck = new THREE.Group();
	deck.name = 'gold-card-deck';

	const cardGeometry = createRoundedCardGeometry(1.9, 2.8, 0.025, 0.15);

	const sideMaterial = new THREE.MeshStandardMaterial({
		color: 0xfbbf24,
		metalness: 0.2,
		roughness: 0.3,
	});

	const topCardFaceMaterial = new THREE.MeshStandardMaterial({
		map: createGoldCardDeckTexture(),
		metalness: 0.25,
		roughness: 0.3,
	});

	// ExtrudeGeometry의 머티리얼 매핑 규칙:
	// [0]: 앞/뒷면 (Caps)
	// [1]: 둘레 옆면 (Sides)
	const regularMaterials = [sideMaterial, sideMaterial];
	const topCardMaterials = [topCardFaceMaterial, sideMaterial];

	const cardCount = 30;
	for (let index = 0; index < cardCount; index++) {
		const isTopCard = index === cardCount - 1;
		const card = new THREE.Mesh(
			cardGeometry,
			isTopCard ? topCardMaterials : regularMaterials,
		);

		card.position.set(0, index * 0.025, 0);
		card.rotation.y = (Math.random() - 0.5) * 0.05; // 자연스럽게 살짝만 틀어지도록 조정
		card.castShadow = true;
		card.receiveShadow = true;

		deck.add(card);
	}

	return deck;
}

export function disposeGoldCardDeckGroup(deck: THREE.Group) {
	const uniqueGeometries = new Set<THREE.BufferGeometry>();
	const uniqueMaterials = new Set<THREE.Material>();

	deck.traverse((object) => {
		if (!(object instanceof THREE.Mesh)) return;

		if (object.geometry) {
			uniqueGeometries.add(object.geometry);
		}

		if (Array.isArray(object.material)) {
			object.material.forEach((mat) => uniqueMaterials.add(mat));
		} else if (object.material) {
			uniqueMaterials.add(object.material);
		}
	});

	// 중복 없이 1회씩만 dispose 실행
	uniqueGeometries.forEach((geom) => geom.dispose());
	uniqueMaterials.forEach((mat) => {
		// 텍스처 맵이 있다면 텍스처도 함께 해제
		if ('map' in mat && mat.map instanceof THREE.Texture) {
			mat.map.dispose();
		}
		mat.dispose();
	});
}
