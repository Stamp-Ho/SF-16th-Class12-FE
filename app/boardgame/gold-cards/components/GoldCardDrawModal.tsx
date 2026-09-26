'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { GoldCardData } from '../types';

interface GoldCardDrawModalProps {
	card: GoldCardData | null;
	teamNames: string[];
	actorTeamIndex: number;
	selectingTarget: boolean;
	onApply: () => void;
	onChooseTarget: () => void;
	onChooseSwapTeam: (teamIndex: number) => void;
	onCancelTarget: () => void;
	onClose: () => void;
}

export default function GoldCardDrawModal({ card, teamNames, actorTeamIndex, selectingTarget, onApply, onChooseTarget, onChooseSwapTeam, onCancelTarget, onClose }: GoldCardDrawModalProps) {
	if (selectingTarget) {
		return (
			<div className="pointer-events-none absolute inset-x-0 top-20 z-50 flex justify-center px-4">
				<div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-amber-300/60 bg-slate-950/95 px-4 py-3 text-sm font-bold text-amber-100 shadow-xl">
					<span>보드에서 폰을 이동할 칸을 선택하세요.</span>
					<button type="button" onClick={onCancelTarget} className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800">취소</button>
				</div>
			</div>
		);
	}
	return (
		<div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 backdrop-blur-sm">
			<div className="w-full max-w-sm rounded-3xl border border-amber-300/50 bg-slate-900 p-5 text-center shadow-2xl shadow-amber-950/50">
				<div className="mb-4 flex h-24 items-end justify-center" aria-label="황금 카드 덱">
					{[0, 1, 2].map((layer) => <motion.div key={layer} initial={{ y: 15, rotate: (layer - 1) * 7 }} animate={{ y: 0, rotate: (layer - 1) * 7 }} transition={{ delay: layer * 0.08 }} className="-mr-12 h-20 w-14 rounded-lg border-2 border-amber-200/70 bg-gradient-to-br from-amber-300 via-yellow-600 to-amber-950 shadow-lg last:mr-0"><div className="m-1 flex h-[calc(100%-0.5rem)] items-center justify-center rounded border border-amber-100/50 text-lg font-black text-amber-100">★</div></motion.div>)}
				</div>
				<AnimatePresence mode="wait">
					{card ? (
						<motion.div key={card.id} initial={{ opacity: 0, rotateY: 90, scale: 0.8 }} animate={{ opacity: 1, rotateY: 0, scale: 1 }} transition={{ duration: 0.55, delay: 0.15 }} className="mx-auto flex min-h-64 max-w-xs flex-col rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-100 via-yellow-200 to-amber-400 p-5 text-slate-900 shadow-xl">
							<p className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-800">Golden Card</p>
							<h2 className="mt-3 text-xl font-black">{card.title}</h2>
							<p className="mt-4 flex-1 whitespace-pre-wrap text-sm font-semibold leading-6">{card.description || '설명이 없는 카드입니다.'}</p>
							<span className="mt-4 rounded-full bg-amber-900/10 px-3 py-1 text-[10px] font-bold">{card.event.type === 'MOVE_PAWN_SPECIFIED' ? '폰 위치 이동 (지정)' : card.event.type === 'MOVE_PAWN_CHOOSE' ? '폰 위치 이동 (선택)' : card.event.type === 'SWAP_POSITIONS_CHOOSE' ? '상호 위치 교환 (선택)' : '일반 텍스트 (바닐라)'}</span>
						</motion.div>
					) : (
						<motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-slate-700 bg-slate-950 p-8 text-sm font-semibold text-slate-300">황금 카드 덱이 비어 있습니다.</motion.div>
					)}
				</AnimatePresence>
				<div className="mt-5 flex gap-2">
					<button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-bold text-slate-300 hover:bg-slate-800">닫기</button>
					{card?.event.type === 'MOVE_PAWN_CHOOSE' && <button type="button" onClick={onChooseTarget} className="flex-1 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-black text-slate-950 hover:bg-amber-300">이동 위치 선택</button>}
					{card?.event.type === 'SWAP_POSITIONS_CHOOSE' && <div className="flex flex-1 flex-col gap-1">{teamNames.map((name, teamIndex) => teamIndex !== actorTeamIndex && <button key={name} type="button" onClick={() => onChooseSwapTeam(teamIndex)} className="rounded-lg bg-amber-400 px-3 py-2 text-xs font-black text-slate-950 hover:bg-amber-300">{name}과 위치 교환</button>)}</div>}
					{card && (card.event.type === 'MOVE_PAWN_SPECIFIED' || card.event.type === 'TEXT') && <button type="button" onClick={onApply} className="flex-1 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-black text-slate-950 hover:bg-amber-300">카드 적용</button>}
				</div>
			</div>
		</div>
	);
}
