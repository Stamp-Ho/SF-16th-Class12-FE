import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { DiceItem } from '../types/arena';
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
