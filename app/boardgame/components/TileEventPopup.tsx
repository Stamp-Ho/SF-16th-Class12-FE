'use client';

import type { RefObject } from 'react';
import { BoardTileData } from '../types/board';

// 말이 도착한 타일의 이벤트를 보여주는 팝업
export default function TileEventPopup({
	tile,
	countdown,
	confirmButtonRef,
	onConfirm,
}: {
	tile: BoardTileData;
	countdown: number | null;
	confirmButtonRef: RefObject<HTMLButtonElement | null>;
	onConfirm: () => void;
}) {
	return (
		<div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/65 px-4 backdrop-blur-sm pointer-events-auto">
			<div className="w-full max-w-sm overflow-hidden rounded-2xl border border-sky-400/40 bg-slate-900 shadow-2xl shadow-sky-950/40">
				<div
					className="flex min-h-44 flex-col items-center justify-center gap-3 px-6 py-8 text-center"
					style={{
						backgroundColor: tile.color || '#1e293b',
					}}
				>
					<span className="rounded-full border border-sky-300/50 bg-slate-950/40 px-3 py-1 text-xs font-bold text-sky-100">
						{tile.category == "OUTER" ? "기본 루트" : "내부 루트"}
					</span>
					<h2
						className="whitespace-pre-wrap text-3xl font-black drop-shadow-md"
						style={{ color: tile.textColor || '#ffffff' }}
					>
						{tile.label || '타일'}
					</h2>
					{tile.subLabel && (
						<p className="whitespace-pre-wrap text-sm text-slate-300">
							{tile.subLabel}
						</p>
					)}
				</div>
				<div className="space-y-4 p-5 text-center">
					{tile.action.type === 'NONE' ? null : (
						<p className="whitespace-pre-wrap text-sm font-semibold text-slate-200">
							{tile.action.type === 'MOVE_STEPS'
								? `${Math.abs(tile.action.params?.steps ?? 0)}칸 이동합니다.`
								: tile.action.type === 'SKIP_TURNS'
									? `다음 자신의 차례부터 ${tile.action.params?.turns ?? 1}턴 동안 술 마시기 벌칙 후 턴을 넘깁니다.`
								: '이 타일의 이벤트를 실행합니다.'}
						</p>
					)}
					{tile.action.type === 'MOVE_STEPS' ? (
						<p className="whitespace-pre-wrap text-sm font-bold text-amber-300">
							{countdown !== null
								? `${countdown}초 후 실행`
								: '이동 중'}
						</p>
					) : null}
					<button
						ref={confirmButtonRef}
						type="button"
						onClick={onConfirm}
						className="w-full rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-sky-400"
					>
						완료
					</button>
				</div>
			</div>
		</div>
	);
}
