// utils/tileActionEngine.ts
import { TileAction, BoardTileData } from '../types/board';

export interface ActionExecutionContext {
	currentTile: BoardTileData;
	movePawnSteps: (steps: number) => void;
	skipTurns: (turns: number) => void;
	teleportPawnToTile: (targetTileId: string) => void;
	openGoldCardModal: (deckId: string) => void;
	openChoiceModal: (options: { label: string; nextTileId: string }[]) => void;
	showToast: (title: string, message: string) => void;
}

export function executeTileAction(
	action: TileAction,
	ctx: ActionExecutionContext,
) {
	const { type, params } = action;

	switch (type) {
		case 'SKIP_TURNS':
			if (typeof params?.turns === 'number' && Number.isSafeInteger(params.turns) && params.turns > 0 && params.turns <= 99) {
				ctx.skipTurns(params.turns);
			}
			break;

		case 'MOVE_STEPS': {
			// 이전에 저장한 칸 수는 부호만 사용한다. 값이 없으면 앞으로 이동한다.
			const direction = (params?.steps ?? 1) < 0 ? -1 : 1;
			ctx.showToast(
				'이동 효과',
				`주사위 1개를 굴려 나온 눈만큼 ${direction > 0 ? '앞으로' : '뒤로'} 이동합니다!`,
			);
			ctx.movePawnSteps(direction);
			break;
		}

		case 'TELEPORT':
			if (params?.targetTileId) {
				ctx.showToast(
					'워프 발동',
					params.promptMessage || '특정 구역으로 강제 이동합니다!',
				);
				ctx.teleportPawnToTile(params.targetTileId);
			}
			break;

		case 'DRAW_GOLD_CARD':
			ctx.openGoldCardModal(params?.deckId || 'default_deck');
			break;

		case 'DIRECTION_CHANGE':
			// 방향 전환 타일에 설정한 다음 칸은 다음 주사위 이동 때 적용한다.
			break;

		case 'NONE':
		default:
			// 일반 타일 도착
			break;
	}
}
