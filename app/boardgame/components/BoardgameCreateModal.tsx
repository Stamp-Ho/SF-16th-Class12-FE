'use client';

import { useState, type FormEvent } from 'react';
import { createBoardgame, type BoardgameSummary } from '../actions';

export default function BoardgameCreateModal({
	onClose,
	onCreated,
}: {
	onClose: () => void;
	onCreated: (game: BoardgameSummary) => void;
}) {
	const [name, setName] = useState('새 보드게임');
	const [rows, setRows] = useState('8');
	const [cols, setCols] = useState('10');
	const [error, setError] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setIsSubmitting(true);
		setError('');
		const result = await createBoardgame({
			name,
			gridRows: Number(rows),
			gridCols: Number(cols),
		});
		setIsSubmitting(false);
		if (!result.success) {
			setError(result.message);
			return;
		}
		onCreated(result.data);
		onClose();
	};

	return (
		<div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
			<form
				onSubmit={(event) => void handleSubmit(event)}
				className="w-full max-w-md space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
			>
				<div>
					<h2 className="whitespace-pre-wrap text-lg font-bold text-white">새 보드게임 생성</h2>
					<p className="mt-1 whitespace-pre-wrap text-xs text-slate-400">
						생성 후 보드 편집 화면으로 이동합니다.
					</p>
				</div>
				<label className="block space-y-1.5 text-xs font-semibold text-slate-300">
					<span>보드게임 이름</span>
					<input
						autoFocus
						maxLength={80}
						value={name}
						onChange={(event) => setName(event.target.value)}
						className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-rose-500"
					/>
				</label>
				<div className="grid grid-cols-2 gap-3">
					<label className="space-y-1.5 text-xs font-semibold text-slate-300">
						<span>행 (3–20)</span>
						<input
							type="number"
							min={3}
							max={20}
							step={1}
							value={rows}
							onChange={(event) => setRows(event.target.value)}
							className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-rose-500"
						/>
					</label>
					<label className="space-y-1.5 text-xs font-semibold text-slate-300">
						<span>열 (3–20)</span>
						<input
							type="number"
							min={3}
							max={20}
							step={1}
							value={cols}
							onChange={(event) => setCols(event.target.value)}
							className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-rose-500"
						/>
					</label>
				</div>
				{error && <p className="whitespace-pre-wrap text-xs text-rose-300">{error}</p>}
				<div className="flex justify-end gap-2 border-t border-slate-800 pt-3">
					<button
						type="button"
						disabled={isSubmitting}
						onClick={onClose}
						className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50"
					>
						취소
					</button>
					<button
						type="submit"
						disabled={isSubmitting || !name.trim()}
						className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-50"
					>
						{isSubmitting ? '생성 중…' : '보드게임 생성'}
					</button>
				</div>
			</form>
		</div>
	);
}
