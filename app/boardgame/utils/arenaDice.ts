import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { ArenaRuntime, DiceItem } from '../types/arena';
import { getPreciseDiceScore } from './diceFactory';

/**
 * 주사위 3D 메시를 물리 바디 위치·회전에 맞추고,
 * 모든 주사위가 멈췄으면 각 주사위의 윗면 값을 읽어 둔다.
 */
export function syncDiceMeshes(diceList: DiceItem[]) {
	const allSleeping =
		diceList.length > 0 &&
		diceList.every((dice) => dice.body.sleepState === CANNON.Body.SLEEPING);
	const currentValues: number[] = [];

	diceList.forEach((dice) => {
		dice.mesh.position.copy(dice.body.position as unknown as THREE.Vector3);
		dice.mesh.quaternion.copy(
			dice.body.quaternion as unknown as THREE.Quaternion,
		);

		if (allSleeping) {
			dice.isSleeping = true;
			dice.lastValue = getPreciseDiceScore(dice.body);
		}
		currentValues.push(dice.lastValue);
	});

	return { allSleeping, currentValues };
}

// 일반 턴과 타일 효과에서 공통으로 쓰는 물리 굴림. 개수는 호출하는 쪽에서 정한다.
export function launchDice({ diceList, orbit }: Pick<ArenaRuntime, 'diceList' | 'orbit'>) {
	const forwardX = -Math.sin(orbit.theta);
	const forwardZ = -Math.cos(orbit.theta);

	diceList.forEach((dice, idx) => {
		dice.body.wakeUp();
		dice.isSleeping = false;

		// 중앙 주사위 링 구역으로 드롭
		dice.body.position.set(
			(Math.random() - 0.5) * 2,
			6 + idx * 1.5,
			(Math.random() - 0.5) * 2,
		);
		dice.body.velocity.setZero();
		dice.body.angularVelocity.setZero();

		dice.body.quaternion.setFromEuler(
			Math.random() * Math.PI * 2,
			Math.random() * Math.PI * 2,
			Math.random() * Math.PI * 2,
		);

		const force = 5.5 + Math.random() * 4;
		dice.body.applyImpulse(
			new CANNON.Vec3(
				forwardX * force + (Math.random() - 0.5) * 3,
				-4 - Math.random() * 3,
				forwardZ * force + (Math.random() - 0.5) * 3,
			),
			new CANNON.Vec3(
				(Math.random() - 0.5) * 0.3,
				0.4,
				(Math.random() - 0.5) * 0.3,
			),
		);

		dice.body.angularVelocity.set(
			(Math.random() - 0.5) * 25,
			(Math.random() - 0.5) * 25,
			(Math.random() - 0.5) * 25,
		);
	});
}
