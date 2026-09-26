'use client';

import { useState, type FormEvent } from 'react';

export default function BoardgameEditorAccessModal({
	editors,
	isBusy,
	status,
	onClose,
	onGrant,
	onRevoke,
}: {
	editors: string[];
	isBusy: boolean;
	status: string;
	onClose: () => void;
	onGrant: (userName: string) => Promise<boolean>;
	onRevoke: (userName: string) => Promise<void>;
}) {
	const [userName, setUserName] = useState('');

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (await onGrant(userName)) setUserName('');
	};

	return (
		<div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
			<div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
				<div>
					<h2 className="text-lg font-bold text-white">편집 권한 부여</h2>
					<p className="mt-1 text-xs text-slate-400">
						사용자 이름을 추가하거나, 목록의 이름을 눌러 권한을 회수하세요.
					</p>
				</div>

				<form onSubmit={(event) => void handleSubmit(event)} className="flex gap-2">
					<input
						autoFocus
						value={userName}
						onChange={(event) => setUserName(event.target.value)}
						placeholder="사용자 이름"
						className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500"
					/>
					<button
						type="submit"
						disabled={isBusy || !userName.trim()}
						className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-500 disabled:opacity-40"
					>
						추가
					</button>
				</form>

				<div className="min-h-12 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
					<p className="mb-2 text-[11px] font-semibold text-slate-400">현재 편집자</p>
					<div className="flex flex-wrap gap-2">
						{editors.map((editor) => (
							<button
								key={editor}
								type="button"
								disabled={isBusy}
								onClick={() => void onRevoke(editor)}
								className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-rose-400 hover:text-rose-200 disabled:opacity-40"
								title="클릭해 편집 권한 회수"
							>
								{editor} ×
							</button>
						))}
						{editors.length === 0 && (
							<span className="text-xs text-slate-500">추가된 편집자가 없습니다.</span>
						)}
					</div>
				</div>

				{status && <p className="text-xs text-slate-300">{status}</p>}
				<div className="flex justify-end border-t border-slate-800 pt-3">
					<button
						type="button"
						disabled={isBusy}
						onClick={onClose}
						className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50"
					>
						닫기
					</button>
				</div>
			</div>
		</div>
	);
}
