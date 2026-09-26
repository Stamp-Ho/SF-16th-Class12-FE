export type GoldCardEventType =
	| 'MOVE_PAWN_SPECIFIED'
	| 'MOVE_PAWN_CHOOSE'
	| 'SWAP_POSITIONS_CHOOSE'
	| 'TEXT';

export interface GoldCardEvent {
	type: GoldCardEventType;
	targetTileId?: string;
}

export interface GoldCardData {
	id: string;
	title: string;
	description: string;
	event: GoldCardEvent;
}
