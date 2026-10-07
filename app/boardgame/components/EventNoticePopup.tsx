'use client';

import type { RefObject } from 'react';

// 황금카드·타일 효과 등의 결과를 알려주는 팝업
export default function EventNoticePopup({
	notice,
	confirmButtonRef,
	onClose,
}: {
	notice: { title: string; message: string };
	confirmButtonRef: RefObject<HTMLButtonElement | null>;
	onClose: () => void;
}) {
	return (
		<div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm pointer-events-auto">
			<div className="w-full max-w-sm rounded-2xl border border-amber-400/40 bg-slate-900 p-6 text-center shadow-2xl">
				<h2 className="whitespace-pre-wrap text-xl font-black text-amber-300">
					{notice.title}
				</h2>
				<p className="mt-3 whitespace-pre-wrap text-sm text-slate-200">
					{notice.message}
				</p>
				<button
					ref={confirmButtonRef}
					type="button"
					onClick={onClose}
					className="mt-5 w-full rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-300"
				>
					완료
				</button>
			</div>
		</div>
	);
}
