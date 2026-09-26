// utils/tileActionEngine.ts
import { TileAction, BoardTileData } from '../types/board';

export interface ActionExecutionContext {
  currentTile: BoardTileData;
  movePawnSteps: (steps: number) => void;
  teleportPawnToTile: (targetTileId: string) => void;
  openGoldCardModal: (deckId: string) => void;
  openChoiceModal: (options: { label: string; nextTileId: string }[]) => void;
  showToast: (title: string, message: string) => void;
}

export function executeTileAction(action: TileAction, ctx: ActionExecutionContext) {
  const { type, params } = action;

  switch (type) {
    case 'MOVE_STEPS':
      if (params?.steps) {
        ctx.showToast('이동 효과', `${params.steps > 0 ? '앞으로' : '뒤로'} ${Math.abs(params.steps)}칸 이동합니다!`);
        ctx.movePawnSteps(params.steps);
      }
      break;

    case 'TELEPORT':
      if (params?.targetTileId) {
        ctx.showToast('워프 발동', params.promptMessage || '특정 구역으로 강제 이동합니다!');
        ctx.teleportPawnToTile(params.targetTileId);
      }
      break;

    case 'DRAW_GOLD_CARD':
      ctx.showToast('황금카드', '황금카드를 1장 뽑습니다!');
      ctx.openGoldCardModal(params?.deckId || 'default_deck');
      break;

    case 'SPLIT_CHOICE':
      // 내부 지름길 진입로에 도착했을 때 분기 처리
      // params에 갈림길 옵션을 넘겨 플레이어에게 팝업을 띄움
      break;

    case 'CUSTOM_SCRIPT':
      ctx.showToast(params?.promptTitle || '이벤트', params?.promptMessage || '벌칙을 수행하세요!');
      break;

    case 'NONE':
    default:
      // 일반 타일 도착
      break;
  }
}