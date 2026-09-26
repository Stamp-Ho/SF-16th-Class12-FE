import { GoldCardData } from '../types';

export interface GoldCardEventContext {
	movePawnToTile: (tileId: string) => void;
	swapPawnPositions: (teamIndex: number) => void;
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
			if (card.event.targetTileId) context.movePawnToTile(card.event.targetTileId);
			break;
		case 'MOVE_PAWN_CHOOSE':
			if (choice.tileId) context.movePawnToTile(choice.tileId);
			break;
		case 'SWAP_POSITIONS_CHOOSE':
			if (choice.teamIndex !== undefined) context.swapPawnPositions(choice.teamIndex);
			break;
		case 'TEXT':
		default:
			break;
	}
}
