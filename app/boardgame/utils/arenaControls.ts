import * as THREE from 'three';
import {
	ArenaOrbitState,
	OrbitKey,
	OrbitKeys,
	OrbitSnapshot,
} from '../types/arena';
import { getOrbitDefaults } from './arena';

export const createOrbitKeys = (): OrbitKeys => ({
	w: false,
	a: false,
	s: false,
	d: false,
	q: false,
	e: false,
	z: false,
	x: false,
});

// 보드 기본 시점으로 카메라 궤도 상태를 만들고, 복원할 시점이 있으면 덮어쓴다
export function createOrbitState(
	initialOrbitDefaults: { theta: number; phi: number; radius: number },
	cameraView: OrbitSnapshot | null,
): ArenaOrbitState {
	const orbitState = {
		isDragging: false,
		prevX: 0,
		prevY: 0,
		theta: initialOrbitDefaults.theta,
		phi: initialOrbitDefaults.phi,
		radius: initialOrbitDefaults.radius,
		targetTheta: initialOrbitDefaults.theta,
		targetPhi: initialOrbitDefaults.phi,
		targetRadius: initialOrbitDefaults.radius,
		// ★ 추가: 카메라가 바라보는 중심점 좌표 (WASD로 이동할 목표 지점)
		center: new THREE.Vector3(0, 0, 0),
		targetCenter: new THREE.Vector3(0, 0, 0),
		keys: createOrbitKeys(),
	};
	if (cameraView) {
		orbitState.center.copy(cameraView.center);
		orbitState.targetCenter.copy(cameraView.targetCenter);
		orbitState.theta = cameraView.theta;
		orbitState.targetTheta = cameraView.targetTheta;
		orbitState.phi = cameraView.phi;
		orbitState.targetPhi = cameraView.targetPhi;
		orbitState.radius = cameraView.radius;
		orbitState.targetRadius = cameraView.targetRadius;
	}
	return orbitState;
}

// 현재 카메라 궤도 상태를 복사해 둔다 (타일 포커스 해제·씬 재생성 후 시점 복원용)
export const snapshotOrbit = (orbit: ArenaOrbitState): OrbitSnapshot => ({
	center: orbit.center.clone(),
	targetCenter: orbit.targetCenter.clone(),
	theta: orbit.theta,
	phi: orbit.phi,
	radius: orbit.radius,
	targetTheta: orbit.targetTheta,
	targetPhi: orbit.targetPhi,
	targetRadius: orbit.targetRadius,
});

export const getMovementKey = (e: KeyboardEvent): OrbitKey | null => {
	const key = e.code.startsWith('Key')
		? e.code.slice(3).toLowerCase()
		: e.key.toLowerCase();
	return key === 'w' ||
		key === 'a' ||
		key === 's' ||
		key === 'd' ||
		key === 'q' ||
		key === 'e' ||
		key === 'z' ||
		key === 'x'
		? key
		: null;
};

/**
 * 애니메이션 한 프레임 동안 키보드 입력(WASD/QE/ZX)을 반영하고
 * 카메라를 궤도 상태에 맞게 보간해 배치한다.
 */
export function stepOrbitCamera(
	orbitState: ArenaOrbitState,
	camera: THREE.PerspectiveCamera,
	dt: number,
	maxRadius: number,
) {
	const moveSpeed = 18 * dt;
	const forwardX = -Math.sin(orbitState.theta);
	const forwardZ = -Math.cos(orbitState.theta);
	const rightX = -forwardZ;
	const rightZ = forwardX;

	if (orbitState.keys.w) {
		orbitState.targetCenter.x += forwardX * moveSpeed;
		orbitState.targetCenter.z += forwardZ * moveSpeed;
	}
	if (orbitState.keys.s) {
		orbitState.targetCenter.x -= forwardX * moveSpeed;
		orbitState.targetCenter.z -= forwardZ * moveSpeed;
	}
	if (orbitState.keys.d) {
		orbitState.targetCenter.x += rightX * moveSpeed;
		orbitState.targetCenter.z += rightZ * moveSpeed;
	}
	if (orbitState.keys.a) {
		orbitState.targetCenter.x -= rightX * moveSpeed;
		orbitState.targetCenter.z -= rightZ * moveSpeed;
	}
	const rotateSpeed = 1.8 * dt;
	if (orbitState.keys.q) orbitState.targetTheta -= rotateSpeed;
	if (orbitState.keys.e) orbitState.targetTheta += rotateSpeed;

	const zoomFactor = Math.exp(1.5 * dt);
	if (orbitState.keys.z) orbitState.targetRadius /= zoomFactor;
	if (orbitState.keys.x) orbitState.targetRadius *= zoomFactor;
	orbitState.targetRadius = Math.max(
		10,
		Math.min(maxRadius, orbitState.targetRadius),
	);

	orbitState.targetCenter.x = Math.max(
		-50,
		Math.min(50, orbitState.targetCenter.x),
	);
	orbitState.targetCenter.z = Math.max(
		-50,
		Math.min(50, orbitState.targetCenter.z),
	);

	// 카메라 중심점 Lerp 부드러운 보간
	orbitState.center.lerp(orbitState.targetCenter, 0.1);

	// 카메라 Orbit 각도 Lerp 보간
	orbitState.theta += (orbitState.targetTheta - orbitState.theta) * 0.1;
	orbitState.phi += (orbitState.targetPhi - orbitState.phi) * 0.1;
	orbitState.radius += (orbitState.targetRadius - orbitState.radius) * 0.1;

	// ★ 중심점(center)을 기준으로 카메라 구면 좌표 계산
	camera.position.x =
		orbitState.center.x +
		orbitState.radius *
			Math.sin(orbitState.phi) *
			Math.sin(orbitState.theta);
	camera.position.y =
		orbitState.center.y + orbitState.radius * Math.cos(orbitState.phi);
	camera.position.z =
		orbitState.center.z +
		orbitState.radius *
			Math.sin(orbitState.phi) *
			Math.cos(orbitState.theta);

	// ★ (0, 0, 0) 대신 이동된 center를 바라봄
	camera.lookAt(orbitState.center);
}

interface AttachArenaControlsParams {
	canvas: HTMLCanvasElement;
	orbitState: ArenaOrbitState;
	pointerDownPos: { current: { x: number; y: number } };
	getViewMode: () => '2.5d' | 'top';
	boardSize: { rows: number; cols: number };
	// 5픽셀 미만으로 움직인 포인터 업 = 클릭(타일 피킹)
	onClick: (clientX: number, clientY: number) => void;
	// R 키로 카메라를 초기화한 뒤 호출
	onResetView: () => void;
}

/**
 * 캔버스 드래그 회전, 휠 확대/축소, 키보드(WASD/QE/ZX/R) 입력을 연결한다.
 * @returns 연결한 이벤트 리스너를 모두 해제하는 함수
 */
export function attachArenaControls({
	canvas,
	orbitState,
	pointerDownPos,
	getViewMode,
	boardSize,
	onClick,
	onResetView,
}: AttachArenaControlsParams) {
	const handlePointerDown = (e: MouseEvent | TouchEvent) => {
		canvas.focus();
		const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
		const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
		pointerDownPos.current = { x: clientX, y: clientY };
		orbitState.isDragging = true;
		orbitState.prevX = clientX;
		orbitState.prevY = clientY;
	};

	// 3. handlePointerMove에서 viewModeRef.current 참조
	const handlePointerMove = (e: MouseEvent | TouchEvent) => {
		if (!orbitState.isDragging) return;
		const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
		const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

		const deltaX = clientX - orbitState.prevX;
		const deltaY = clientY - orbitState.prevY;
		orbitState.prevX = clientX;
		orbitState.prevY = clientY;

		// 탑뷰일 때는 수평 회전(Theta)까지 완전 고정할지 여부에 따라 조정 가능
		orbitState.targetTheta -= deltaX * 0.007;

		// viewModeRef.current를 사용해 최신 상태 확인
		orbitState.targetPhi =
			getViewMode() === 'top'
				? 0.001
				: Math.max(
						0.001,
						Math.min(Math.PI / 3.4, orbitState.targetPhi - deltaY * 0.007),
					);
	};

	const handlePointerUp = (e: MouseEvent | TouchEvent) => {
		orbitState.isDragging = false;

		const clientX =
			'changedTouches' in e
				? e.changedTouches[0].clientX
				: (e as MouseEvent).clientX;
		const clientY =
			'changedTouches' in e
				? e.changedTouches[0].clientY
				: (e as MouseEvent).clientY;

		const dist = Math.hypot(
			clientX - pointerDownPos.current.x,
			clientY - pointerDownPos.current.y,
		);

		// 5픽셀 미만 움직였을 때만 "클릭(피킹)"으로 판정
		if (dist < 5) onClick(clientX, clientY);
	};

	const handleWheel = (e: WheelEvent) => {
		orbitState.targetRadius = Math.max(
			10,
			Math.min(
				Math.max(boardSize.rows, boardSize.cols) * 8,
				orbitState.targetRadius + e.deltaY * 0.025,
			),
		);
	};

	const handleKeyDown = (e: KeyboardEvent) => {
		const target = e.target as HTMLElement | null;
		const tagName = target?.tagName?.toLowerCase();
		if (
			tagName === 'input' ||
			tagName === 'textarea' ||
			target?.isContentEditable
		)
			return;

		const key = getMovementKey(e);
		if (key) {
			e.preventDefault();
			e.stopPropagation();
			orbitState.keys[key] = true;
		}
		if (e.key.toLowerCase() === 'r' || e.code === 'KeyR') {
			e.preventDefault();
			e.stopPropagation();

			const defaults = getOrbitDefaults(
				getViewMode(),
				boardSize.rows,
				boardSize.cols,
			);
			orbitState.center.set(0, 0, 0);
			orbitState.targetCenter.set(0, 0, 0);
			orbitState.theta = defaults.theta;
			orbitState.targetTheta = defaults.theta;
			orbitState.phi = defaults.phi;
			orbitState.targetPhi = defaults.phi;
			orbitState.radius = defaults.radius;
			orbitState.targetRadius = defaults.radius;
			orbitState.keys = createOrbitKeys();
			onResetView();
		}
	};

	const handleKeyUp = (e: KeyboardEvent) => {
		const key = getMovementKey(e);
		if (key) {
			e.preventDefault();
			orbitState.keys[key] = false;
		}
	};

	window.addEventListener('keydown', handleKeyDown, true);
	window.addEventListener('keyup', handleKeyUp, true);

	canvas.addEventListener('mousedown', handlePointerDown);
	window.addEventListener('mousemove', handlePointerMove);
	window.addEventListener('mouseup', handlePointerUp);
	canvas.addEventListener('touchstart', handlePointerDown);
	window.addEventListener('touchmove', handlePointerMove);
	window.addEventListener('touchend', handlePointerUp);
	canvas.addEventListener('wheel', handleWheel, { passive: true });

	return () => {
		canvas.removeEventListener('mousedown', handlePointerDown);
		window.removeEventListener('mousemove', handlePointerMove);
		window.removeEventListener('mouseup', handlePointerUp);
		canvas.removeEventListener('touchstart', handlePointerDown);
		window.removeEventListener('touchmove', handlePointerMove);
		window.removeEventListener('touchend', handlePointerUp);
		canvas.removeEventListener('wheel', handleWheel);

		window.removeEventListener('keydown', handleKeyDown, true);
		window.removeEventListener('keyup', handleKeyUp, true);
	};
}
