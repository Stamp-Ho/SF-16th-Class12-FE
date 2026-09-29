'use client';

// 3D 보드 좌상단의 2.5D 쿼터뷰 / 탑뷰 전환 버튼
export default function ArenaViewToggle({
	viewMode,
	onSwitchView,
}: {
	viewMode: '2.5d' | 'top';
	onSwitchView: (mode: '2.5d' | 'top') => void;
}) {
	return (
		<div className="absolute top-4 inset-x-4 flex items-center justify-between gap-3 pointer-events-none">
			<div className="flex items-center bg-slate-900/80 backdrop-blur-md border border-slate-700/60 rounded-xl p-1 pointer-events-auto shadow-lg">
				<button
					type="button"
					onClick={() => onSwitchView('2.5d')}
					className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
						viewMode === '2.5d'
							? 'bg-blue-600 text-white'
							: 'text-slate-400 hover:text-slate-200'
					}`}
				>
					2.5D 쿼터뷰
				</button>
				<button
					type="button"
					onClick={() => onSwitchView('top')}
					className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
						viewMode === 'top'
							? 'bg-blue-600 text-white'
							: 'text-slate-400 hover:text-slate-200'
					}`}
				>
					탑뷰
				</button>
			</div>
		</div>
	);
}
