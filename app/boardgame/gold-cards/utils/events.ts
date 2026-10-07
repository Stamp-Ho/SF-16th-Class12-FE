import { GoldCardData } from '../types';

export interface GoldCardEventContext {
	movePawnToTile: (tileId: string) => boolean;
	swapPawnPositions: (teamIndex: number) => boolean;
}

export interface GoldCardChoice {
	tileId?: string;
	teamIndex?: number;
}

export function executeGoldCardEvent(
	card: GoldCardData,
	context: GoldCardEventContext,
	choice: GoldCardChoice = {},
) {
	switch (card.event.type) {
		case 'MOVE_PAWN_SPECIFIED':
			return context.movePawnToTile(card.event.targetTileId ?? '');
		case 'MOVE_PAWN_CHOOSE':
			return choice.tileId ? context.movePawnToTile(choice.tileId) : false;
		case 'SWAP_POSITIONS_CHOOSE':
			return choice.teamIndex !== undefined
				? context.swapPawnPositions(choice.teamIndex)
				: false;
		case 'TEXT':
		default:
			return true;
	}
}
