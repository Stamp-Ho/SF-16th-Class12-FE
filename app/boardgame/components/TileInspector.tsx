import { BoardTileData, TileActionType } from '../types/board';

interface TileInspectorProps {
	tile: BoardTileData | null;
	onUpdate: (updated: Partial<BoardTileData>) => void;
	onDelete: (tileId: string) => void;
	onClose: () => void;
	availableTiles: BoardTileData[];
	isMovingPosition: boolean;
	onMovePosition: () => void;
	isSelectingNextTile: boolean;
	isSelectingTeleportTile: boolean;
	isSelectingDirectionTile: boolean;
	onSelectNextTile: () => void;
	onSelectTeleportTile: () => void;
	onSelectDirectionTile: () => void;
}

export default function TileInspector({
	tile,
	onUpdate,
	onDelete,
	onClose,
	availableTiles,
	isMovingPosition,
	onMovePosition,
	isSelectingNextTile,
	isSelectingTeleportTile,
	isSelectingDirectionTile,
	onSelectNextTile,
	onSelectTeleportTile,
	onSelectDirectionTile,
}: TileInspectorProps) {
	if (!tile) return null;
	const isGoldCardTile = tile.action.type === 'DRAW_GOLD_CARD';

	const handleActionTypeChange = (type: TileActionType) => {
		onUpdate({
			action: {
				type,
				params: type === 'MOVE_STEPS' ? { steps: 2 } : {},
			},
		});
	};

	return (
		<div className="pointer-events-auto min-h-0 w-full flex-1 overflow-y-auto rounded-2xl border border-slate-700/80 bg-slate-900/95 p-5 text-slate-200 shadow-2xl">
			{/* 헤더 */}
			<div className="flex items-center justify-between border-b border-slate-800 pb-3">
				<div>
					<div className="flex items-center gap-2">
						<span className="text-xs font-bold px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30">
							{tile.category}
						</span>
						<h3 className="font-bold text-sm text-white">타일 속성 편집</h3>
					</div>
					<p className="text-[11px] text-slate-500 mt-0.5">ID: {tile.id}</p>
				</div>
				<button
					onClick={onClose}
					className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 text-sm"
				>
					✕
				</button>
			</div>

			{/* 1. 기본 표시 정보 */}
			<div className="flex flex-col gap-3 pb-3">
				<label className="flex flex-col gap-1 text-xs font-semibold text-slate-300">
					타일 라벨 (텍스트)
					<input
						type="text"
						value={isGoldCardTile ? '황금 카드 뽑기' : tile.label}
						onChange={(e) => onUpdate({ label: e.target.value })}
						readOnly={isGoldCardTile}
						className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
						placeholder="예: 원샷, 한 칸 앞으로"
					/>
				</label>

				<label className="flex flex-col gap-1 text-xs font-semibold text-slate-300">
					서브 설명 (작은 글씨)
					<input
						type="text"
						value={isGoldCardTile ? '' : tile.subLabel || ''}
						onChange={(e) => onUpdate({ subLabel: e.target.value })}
						readOnly={isGoldCardTile}
						className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
						placeholder="상세 규칙이나 부연 설명"
					/>
				</label>

				<div className="flex flex-row gap-3">
					<label className="flex flex-col gap-1 text-xs font-semibold text-slate-300">
						배경 색상
						<div className="flex items-center gap-2">
							<input
								type="color"
								value={tile.color || '#1e293b'}
								onChange={(e) => onUpdate({ color: e.target.value })}
								className="w-7 h-7 rounded border border-slate-700 bg-transparent cursor-pointer"
							/>
							<span className="text-[10px] text-slate-400 font-mono">
								{tile.color || '#1e293b'}
							</span>
						</div>
					</label>

					<label className="flex flex-col gap-1 text-xs font-semibold text-slate-300">
						제목 색상
						<div className="flex items-center gap-2">
							<input
								type="color"
								value={tile.textColor || '#ffffff'}
								onChange={(e) => onUpdate({ textColor: e.target.value })}
								className="w-7 h-7 rounded border border-slate-700 bg-transparent cursor-pointer"
							/>
							<span className="text-[10px] text-slate-400 font-mono">
								{tile.textColor || '#ffffff'}
							</span>
						</div>
					</label>
				</div>
			</div>

			{/* 2. 각도 조정 */}
			{tile.category === 'INNER' && (
				<div className="flex flex-col gap-2 border-t border-slate-800 pt-3">
					<button
						type="button"
						onClick={onMovePosition}
						className={`w-full rounded-lg border px-3 py-2 text-xs font-bold ${isMovingPosition ? 'border-amber-400 bg-amber-500/20 text-amber-200' : 'border-slate-700 bg-slate-800 text-slate-200 hover:border-sky-400'}`}
					>
						{isMovingPosition ? '빈 칸을 선택하세요 (취소)' : '위치 이동'}
					</button>
					{isMovingPosition && (
						<p className="text-[10px] text-amber-200">
							빈 내부 격자만 선택할 수 있습니다.
						</p>
					)}
				</div>
			)}

			{/* 2. 각도 조정 */}
			<div className="flex flex-col gap-1.5">
				<span className="text-xs font-semibold text-slate-300">
					타일 텍스처 방향 (Y 회전)
				</span>
				<div className="grid grid-cols-4 gap-1">
					{[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((rot, idx) => (
						<button
							key={rot}
							type="button"
							onClick={() => onUpdate({ rotationY: rot })}
							className={`py-1 text-xs rounded border transition-all ${
								Math.abs(tile.rotationY - rot) < 0.01
									? 'bg-blue-600 border-blue-400 text-white font-bold'
									: 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
							}`}
						>
							{[0, 90, 180, 270][idx]}°
						</button>
					))}
				</div>
			</div>

			{/* 3. 특수 기능(액션) 지정 */}
			<div className="flex flex-col gap-2 border-t border-slate-800 pt-3">
				<label className="flex flex-col gap-1 text-xs font-semibold text-slate-300">
					다음 칸
					<button
						type="button"
						onClick={onSelectNextTile}
						className={`rounded-lg border px-2.5 py-2 text-left text-xs ${isSelectingNextTile ? 'border-amber-400 bg-amber-500/20 text-amber-200' : 'border-slate-700 bg-slate-800 text-white hover:border-sky-400'}`}
					>
						{isSelectingNextTile
							? '보드에서 다음 칸을 클릭하세요'
							: (availableTiles.find(
									(candidate) => candidate.id === tile.nextTileIds[0],
								)?.label ?? '다음 칸 선택')}
					</button>
					<span className="text-[10px] font-normal text-slate-500">
						{tile.nextTileIds[0]
							? `현재 연결: ${tile.nextTileIds[0]} · 주사위 이동 시 이 연결을 따라갑니다.`
							: '보드의 타일을 클릭해 다음 칸을 지정하세요.'}
					</span>
				</label>
			</div>

			{/* 3. 특수 기능(액션) 지정 */}
			<div className="flex flex-col gap-2 border-t border-slate-800 pt-3">
				<span className="text-xs font-semibold text-slate-300">
					도착 시 특수 기능
				</span>
				<select
					value={tile.action.type}
					onChange={(e) =>
						handleActionTypeChange(e.target.value as TileActionType)
					}
					className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
				>
					<option value="NONE">일반 칸 (액션 없음)</option>
					<option value="MOVE_STEPS">칸 이동 (앞으로/뒤로)</option>
					<option value="DIRECTION_CHANGE">방향 전환</option>
					<option value="TELEPORT">특정 타일로 워프</option>
					<option value="DRAW_GOLD_CARD">황금카드 뽑기</option>
				</select>

				{/* 액션별 세부 옵션 UI */}
				{tile.action.type === 'MOVE_STEPS' && (
					<div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/50 flex flex-col gap-1.5 mt-1">
						<span className="text-[11px] text-slate-400">
							이동할 칸 수 (음수는 뒤로)
						</span>
						<input
							type="number"
							value={tile.action.params?.steps ?? 2}
							onChange={(e) =>
								onUpdate({
									action: {
										...tile.action,
										params: {
											...tile.action.params,
											steps: Number(e.target.value),
										},
									},
								})
							}
							className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
						/>
					</div>
				)}

				{tile.action.type === 'TELEPORT' && (
					<div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/50 flex flex-col gap-1.5 mt-1">
						<button
							type="button"
							onClick={onSelectTeleportTile}
							className={`rounded border px-2 py-2 text-left text-xs ${isSelectingTeleportTile ? 'border-amber-400 bg-amber-500/20 text-amber-200' : 'border-slate-700 bg-slate-900 text-white hover:border-sky-400'}`}
						>
							{isSelectingTeleportTile
								? '보드에서 워프 위치를 클릭하세요'
								: (availableTiles.find(
										(candidate) =>
											candidate.id === tile.action.params?.targetTileId,
									)?.label ?? '워프 위치 선택')}
						</button>
						{tile.action.params?.targetTileId && (
							<span className="text-[10px] text-slate-500">
								워프 대상: {tile.action.params.targetTileId}
							</span>
						)}
					</div>
				)}

				{tile.action.type === 'DIRECTION_CHANGE' && (
					<div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/50 flex flex-col gap-1.5 mt-1">
						<button
							type="button"
							onClick={onSelectDirectionTile}
							className={`rounded border px-2 py-2 text-left text-xs ${isSelectingDirectionTile ? 'border-amber-400 bg-amber-500/20 text-amber-200' : 'border-slate-700 bg-slate-900 text-white hover:border-sky-400'}`}
						>
							{isSelectingDirectionTile
								? '보드에서 방향 전환 목적지를 클릭하세요'
								: (availableTiles.find(
										(candidate) =>
											candidate.id === tile.action.params?.targetTileId,
									)?.label ?? '방향 전환 목적지 선택')}
						</button>
						{tile.action.params?.targetTileId && (
							<span className="text-[10px] text-slate-500">
								다음 주사위 이동 목적지: {tile.action.params.targetTileId}
							</span>
						)}
					</div>
				)}
			</div>

			{/* 4. 하단 버튼 영역 */}
			<div className="mt-auto pt-3 border-t border-slate-800 flex items-center justify-between">
				{!tile.isLocked ? (
					<button
						type="button"
						onClick={() => onDelete(tile.id)}
						className="px-3 py-1.5 rounded-lg bg-rose-600/20 border border-rose-500/40 text-rose-300 hover:bg-rose-600 hover:text-white text-xs font-semibold transition-all"
					>
						타일 삭제
					</button>
				) : (
					<span className="text-[11px] text-slate-500">
						외곽 기본 타일(삭제 불가)
					</span>
				)}
				<button
					type="button"
					onClick={onClose}
					className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white ml-auto"
				>
					완료
				</button>
			</div>
		</div>
	);
}
