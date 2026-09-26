'use client';

import { GoldCardData, GoldCardEventType } from '../types';

interface GoldCardManagerProps {
	cards: GoldCardData[];
	availableTiles: { id: string; label: string }[];
	selectingCardId: string | null;
	onChange: (cards: GoldCardData[]) => void;
	onSelectTarget: (cardId: string) => void;
}

export default function GoldCardManager({
	cards,
	availableTiles,
	selectingCardId,
	onChange,
	onSelectTarget,
}: GoldCardManagerProps) {
	const updateCard = (cardId: string, patch: Partial<GoldCardData>) => {
		onChange(cards.map((card) => card.id === cardId ? { ...card, ...patch } : card));
	};

	const updateEvent = (cardId: string, type: GoldCardEventType) => {
		const card = cards.find((item) => item.id === cardId);
		if (!card) return;
		updateCard(cardId, {
			event: {
				type,
				...(type === 'MOVE_PAWN_SPECIFIED' ? { targetTileId: card.event.targetTileId } : {}),
			},
		});
	};

	const addCard = () => {
		const id = `gold_card_${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
		onChange([...cards, { id, title: '새 황금 카드', description: '', event: { type: 'TEXT' } }]);
	};

	return (
		<section className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-950/20 p-3">
			<div className="flex items-center justify-between">
				<div>
					<h3 className="text-sm font-bold text-amber-200">황금 카드 덱</h3>
					<p className="mt-1 text-[10px] text-slate-400">카드 설명과 드로우 이벤트를 편집합니다. 뽑은 카드는 덱을 한 바퀴 돌 때까지 다시 나오지 않습니다.</p>
				</div>
				<button type="button" onClick={addCard} className="shrink-0 rounded-lg border border-amber-400/40 bg-amber-400/10 px-2.5 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-400/20">카드 추가</button>
			</div>
			{cards.length === 0 ? (
				<p className="rounded-lg border border-dashed border-slate-700 p-3 text-center text-xs text-slate-500">덱이 비어 있습니다. 카드를 추가해 주세요.</p>
			) : (
				<div className="max-h-72 space-y-2 overflow-y-auto">
					{cards.map((card, index) => (
						<details key={card.id} open={index === 0} className="rounded-lg border border-slate-700 bg-slate-900/80 p-2.5">
							<summary className="cursor-pointer text-xs font-bold text-amber-100">{card.title || `카드 ${index + 1}`}</summary>
							<div className="mt-3 space-y-2.5">
								<label className="block space-y-1 text-[11px] font-semibold text-slate-300">카드 제목<input value={card.title} onChange={(event) => updateCard(card.id, { title: event.target.value })} className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white" /></label>
								<label className="block space-y-1 text-[11px] font-semibold text-slate-300">설명<textarea rows={3} value={card.description} onChange={(event) => updateCard(card.id, { description: event.target.value })} className="w-full resize-y rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white" placeholder="카드에 표시할 내용" /></label>
								<label className="block space-y-1 text-[11px] font-semibold text-slate-300">드로우 이벤트<select value={card.event.type} onChange={(event) => updateEvent(card.id, event.target.value as GoldCardEventType)} className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"><option value="TEXT">일반 텍스트 (바닐라)</option><option value="MOVE_PAWN_SPECIFIED">폰 위치 이동 (지정)</option><option value="MOVE_PAWN_CHOOSE">폰 위치 이동 (선택)</option><option value="SWAP_POSITIONS_CHOOSE">상호 위치 교환 (선택)</option></select></label>
				{card.event.type === 'MOVE_PAWN_SPECIFIED' && (
									<div className="space-y-1">
										<button type="button" onClick={() => onSelectTarget(card.id)} className={`w-full rounded border px-2 py-1.5 text-left text-xs ${selectingCardId === card.id ? 'border-amber-300 bg-amber-400/20 text-amber-100' : 'border-slate-700 bg-slate-950 text-slate-200 hover:border-amber-400'}`}>{selectingCardId === card.id ? '보드에서 이동할 칸을 클릭하세요' : availableTiles.find((tile) => tile.id === card.event.targetTileId)?.label ?? '이동할 칸 선택'}</button>
										{card.event.targetTileId && <p className="text-[10px] text-slate-500">대상: {card.event.targetTileId}</p>}
									</div>
								)}
								<button type="button" onClick={() => onChange(cards.filter((item) => item.id !== card.id))} className="rounded border border-rose-500/30 px-2 py-1 text-[10px] font-semibold text-rose-300 hover:bg-rose-500/10">카드 삭제</button>
							</div>
						</details>
					))}
				</div>
			)}
		</section>
	);
}
