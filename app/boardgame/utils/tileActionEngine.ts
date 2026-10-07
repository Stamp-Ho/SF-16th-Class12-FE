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

		case 'MOVE_STEPS':
			if (params?.steps) {
				ctx.showToast(
					'이동 효과',
					`${params.steps > 0 ? '앞으로' : '뒤로'} ${Math.abs(params.steps)}칸 이동합니다!`,
				);
				ctx.movePawnSteps(params.steps);
			}
			break;

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
