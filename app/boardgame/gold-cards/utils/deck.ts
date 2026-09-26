import { GoldCardData } from '../types';

export function shuffleCards(cards: GoldCardData[]): string[] {
	const ids = cards.map((card) => card.id);
	for (let index = ids.length - 1; index > 0; index--) {
		const swapIndex = Math.floor(Math.random() * (index + 1));
		[ids[index], ids[swapIndex]] = [ids[swapIndex], ids[index]];
	}
	return ids;
}

export function drawCard(cards: GoldCardData[], drawPile: string[]) {
	const availableIds = new Set(cards.map((card) => card.id));
	const remainingPile = drawPile.filter((id) => availableIds.has(id));
	const pile = remainingPile.length > 0 ? remainingPile : shuffleCards(cards);
	const drawnId = pile[pile.length - 1];

	return {
		card: cards.find((card) => card.id === drawnId) ?? null,
		drawPile: pile.slice(0, -1),
	};
}
