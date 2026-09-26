'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { BoardTileData } from '../types/board';
import type { GoldCardData } from '../gold-cards/types';
import GoldCardManager from '../gold-cards/components/GoldCardManager';
import TileInspector from './TileInspector';

export interface DiceArenaTeamInfo {
	name: string;
	color: string;
}

export type TileSelectionMode =
	| 'next'
	| 'teleport'
	| 'direction'
	| 'gold-card-target'
	| 'gold-card-effect-target'
	| null;

export interface DiceArenaSidebarProps {
	activeBoardgameCanEdit: boolean;
	isFullscreen: boolean;
	isEditMode: boolean;
	isBusy: boolean;
	isAddingInnerTile: boolean;
	isMovingInnerTile: boolean;
	isGoldCardManagerOpen: boolean;
	gridSizeDraft: { rows: string; cols: string };
	setGridSizeDraft: Dispatch<SetStateAction<{ rows: string; cols: string }>>;
	gridSizeError: string;
	boardSize: { rows: number; cols: number };
	isRolling: boolean;
	diceCount: number;
	isMovingPawn: boolean;
	pendingTileEvent: unknown;
	eventNotice: unknown;
	goldCards: GoldCardData[];
	setGoldCards: Dispatch<SetStateAction<GoldCardData[]>>;
	boardTilesMap: Map<string, BoardTileData>;
	selectingGoldCardId: string | null;
	teams: DiceArenaTeamInfo[];
	hasRolledThisGame: boolean;
	currentTeamIndex: number;
	teamPositions: number[];
	teamTileIds: string[];
	playerTileIndex: number;
	totalScore: number;
	scores: number[];
	selectedTileId: string | null;
	tileSelectionMode: TileSelectionMode;
	onToggleEditMode: () => void;
	onToggleFullscreen: () => void;
	onApplyGridSize: () => void;
	onToggleAddInnerTile: () => void;
	onToggleGoldCardManager: () => void;
	onRollDice: () => void;
	onChangeDiceCount: (count: number) => void;
	onChangeTeamName: (teamIndex: number, name: string) => void;
	onRestartGame: () => void;
	onSelectGoldCardTarget: (cardId: string) => void;
	onBeginTileSelection: (mode: 'next' | 'teleport' | 'direction') => void;
	onMoveTilePosition: () => void;
	onUpdateTile: (tile: Partial<BoardTileData>) => void;
	onDeleteTile: (tileId: string) => void;
	onCloseTileInspector: () => void;
}

export default function DiceArenaSidebar(props: DiceArenaSidebarProps) {
	const {
		activeBoardgameCanEdit,
		isFullscreen,
		isEditMode,
		isBusy,
		isAddingInnerTile,
		isMovingInnerTile,
		isGoldCardManagerOpen,
		gridSizeDraft,
		setGridSizeDraft,
		gridSizeError,
		boardSize,
		isRolling,
		diceCount,
		isMovingPawn,
		pendingTileEvent,
		eventNotice,
		goldCards,
		setGoldCards,
		boardTilesMap,
		selectingGoldCardId,
		teams,
		hasRolledThisGame,
		currentTeamIndex,
		teamPositions,
		teamTileIds,
		playerTileIndex,
		totalScore,
		scores,
		selectedTileId,
		tileSelectionMode,
		onToggleEditMode,
		onToggleFullscreen,
		onApplyGridSize,
		onToggleAddInnerTile,
		onToggleGoldCardManager,
		onRollDice,
		onChangeDiceCount,
		onChangeTeamName,
		onRestartGame,
		onSelectGoldCardTarget,
		onBeginTileSelection,
		onMoveTilePosition,
		onUpdateTile,
		onDeleteTile,
		onCloseTileInspector,
	} = props;

	return (
		<aside
			className={`flex w-full shrink-0 flex-col gap-4 overflow-y-auto border-t border-slate-800 bg-slate-900/95 p-4 text-slate-200 lg:min-h-0 lg:w-[22rem] lg:border-l lg:border-t-0 ${
				isFullscreen ? 'min-h-0' : 'min-h-175'
			}`}
		>
			<div className="grid grid-cols-2 gap-2">
				<button
					type="button"
					disabled={isBusy || !activeBoardgameCanEdit}
					onClick={onToggleEditMode}
					className={`rounded-lg border px-3 py-2 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
						isEditMode
							? 'border-amber-500/50 bg-amber-500/20 text-amber-300'
							: 'border-slate-700 bg-slate-900 text-slate-300 hover:border-sky-400'
					}`}
				>
					{isEditMode ? '완료' : '편집 시작'}
				</button>
				<button
					type="button"
					onClick={onToggleFullscreen}
					className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-sky-400 hover:text-white"
					aria-label={isFullscreen ? '전체화면 종료' : '전체화면'}
				>
					{isFullscreen ? '전체화면 종료' : '전체화면'}
				</button>
			</div>

			{isEditMode && (
				<section className="space-y-3 rounded-xl border border-slate-700 bg-slate-950/50 p-3">
					<div>
						<h2 className="text-sm font-bold text-white">격자 크기</h2>
						<p className="mt-1 text-[11px] text-slate-400">
							각 변은 3~20칸으로 설정할 수 있습니다.
						</p>
					</div>
					<div className="grid grid-cols-3 gap-3">
						<label className="space-y-1 text-xs font-semibold text-slate-300">
							세로 (행)
							<input
								type="number"
								min={3}
								max={20}
								step={1}
								value={gridSizeDraft.rows}
								onChange={(event) =>
									setGridSizeDraft((current) => ({
										...current,
										rows: event.target.value,
									}))
								}
								className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-sky-500"
							/>
						</label>
						<label className="space-y-1 text-xs font-semibold text-slate-300">
							가로 (열)
							<input
								type="number"
								min={3}
								max={20}
								step={1}
								value={gridSizeDraft.cols}
								onChange={(event) =>
									setGridSizeDraft((current) => ({
										...current,
										cols: event.target.value,
									}))
								}
								className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-sky-500"
							/>
						</label>
						<button
							type="button"
							onClick={onApplyGridSize}
							disabled={
								isRolling ||
								isMovingPawn ||
								Boolean(pendingTileEvent || eventNotice)
							}
							className="w-full self-end rounded-lg border border-sky-600 bg-sky-600 px-3 h-9.5 text-xs font-bold text-white transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
						>
							격자 적용
						</button>
					</div>
					{gridSizeError && (
						<p className="text-xs text-rose-300">{gridSizeError}</p>
					)}
					<div className="border-t border-slate-800 pt-3">
						<div className="flex gap-2">
							<button
								type="button"
								onClick={onToggleAddInnerTile}
								className={`min-w-0 flex-1 rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
									isAddingInnerTile
										? 'border-sky-400 bg-sky-500/20 text-sky-200'
										: 'border-slate-700 bg-slate-900 text-slate-300 hover:border-sky-400'
								}`}
							>
								{isAddingInnerTile ? '내부 칸 추가 취소' : '내부 격자 추가'}
							</button>
							<button
								type="button"
								aria-pressed={isGoldCardManagerOpen}
								onClick={onToggleGoldCardManager}
								className={`min-w-0 flex-1 rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${isGoldCardManagerOpen ? 'border-amber-400 bg-amber-400/20 text-amber-100' : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-amber-400'}`}
							>
								황금 카드 덱 보기 {isGoldCardManagerOpen ? 'ON' : 'OFF'}
							</button>
						</div>
						{isAddingInnerTile && (
							<p className="mt-2 text-[11px] leading-5 text-sky-200">
								보드 안쪽의 표시된 칸을 클릭하면 타일이 추가됩니다.
							</p>
						)}
					</div>
				</section>
			)}

			{isEditMode && isGoldCardManagerOpen && (
				<GoldCardManager
					cards={goldCards}
					availableTiles={[...boardTilesMap.values()].map((tile) => ({
						id: tile.id,
						label: tile.label,
					}))}
					selectingCardId={selectingGoldCardId}
					onChange={setGoldCards}
					onSelectTarget={onSelectGoldCardTarget}
				/>
			)}

			{!isEditMode ? (
				<>
					<div className="flex items-center justify-between">
						<div>
							<p className="text-[11px] font-bold uppercase tracking-[0.2em] text-sky-400">
								Game Board
							</p>
							<h2 className="text-lg font-black text-white">게임 기판</h2>
						</div>
						<span className="text-xs text-slate-400">
							{boardSize.rows} × {boardSize.cols}
						</span>
					</div>
					<div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2">
						<div>
							<p className="text-[11px] font-semibold text-slate-300">
								이번 턴 주사위 개수
							</p>
							<p className="text-[10px] text-slate-500">
								던지기 전에 선택하세요 (1~3개)
							</p>
						</div>
						<div className="flex items-center gap-3">
							<button
								type="button"
								aria-label="주사위 한 개 줄이기"
								disabled={
									diceCount <= 1 ||
									isRolling ||
									isMovingPawn ||
									Boolean(pendingTileEvent || eventNotice)
								}
								onClick={() => onChangeDiceCount(diceCount - 1)}
								className="h-8 w-8 rounded-lg border border-slate-600 text-lg font-bold text-white hover:bg-slate-800 disabled:opacity-40"
							>
								−
							</button>
							<span className="min-w-5 text-center text-lg font-black text-amber-300">
								{diceCount}
							</span>
							<button
								type="button"
								aria-label="주사위 한 개 늘리기"
								disabled={
									diceCount >= 3 ||
									isRolling ||
									isMovingPawn ||
									Boolean(pendingTileEvent || eventNotice)
								}
								onClick={() => onChangeDiceCount(diceCount + 1)}
								className="h-8 w-8 rounded-lg border border-slate-600 text-lg font-bold text-white hover:bg-slate-800 disabled:opacity-40"
							>
								+
							</button>
						</div>
					</div>
					<button
						type="button"
						disabled={
							isRolling ||
							isMovingPawn ||
							Boolean(pendingTileEvent || eventNotice)
						}
						onClick={onRollDice}
						className="w-full rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition-all hover:from-blue-500 hover:to-indigo-500 disabled:pointer-events-none disabled:opacity-50"
					>
						{isRolling
							? '주사위 굴리는 중...'
							: isMovingPawn
								? '말 이동 중...'
								: '주사위 던지기'}
					</button>

					<div className="grid grid-cols-3 gap-3">
						<div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
							<p className="text-[11px] font-semibold text-slate-400">
								주사위 결과
							</p>
							<p className="mt-1 text-2xl font-black text-amber-400">
								{isRolling ? '...' : totalScore || '-'}
							</p>
							<p className="mt-1 text-[10px] text-slate-500">
								{scores.length ? scores.join(' + ') : '대기 중'}
							</p>
						</div>
						<div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3 col-span-2">
							<p className="text-[11px] font-semibold text-slate-400">
								현재 턴
							</p>
							<p
								className="mt-1 truncate text-lg font-black"
								style={{ color: teams[currentTeamIndex].color }}
							>
								{teams[currentTeamIndex].name}
							</p>
							<p className="mt-1 text-[10px] text-slate-500">
								말 위치{' '}
								{teamTileIds[currentTeamIndex]?.startsWith('inner_')
									? boardTilesMap.get(teamTileIds[currentTeamIndex])?.label ||
										teamTileIds[currentTeamIndex]
									: `${playerTileIndex}번`}
							</p>
						</div>
					</div>

					<section className="rounded-xl border border-slate-700 bg-slate-950/50 p-3">
						<div className="mb-3 flex items-center justify-between">
							<h3 className="text-xs font-bold text-white">참가 팀</h3>
							<span className="text-[10px] text-slate-500">
								{teams.length}팀
							</span>
						</div>
						<div className="space-y-2">
							{teams.map((team, index) => (
								<div
									key={index}
									className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
										index === currentTeamIndex
											? 'border-sky-400/50 bg-sky-400/10'
											: 'border-slate-800 bg-slate-900/60'
									}`}
								>
									<div className="flex min-w-0 items-center gap-2">
										<span
											className="h-2.5 w-2.5 shrink-0 rounded-full"
											style={{ backgroundColor: team.color }}
										/>
										{hasRolledThisGame ? (
											<span className="truncate text-xs font-semibold text-slate-200">
												{team.name}
											</span>
										) : (
											<input
												aria-label={`${team.name} 팀 이름`}
												maxLength={24}
												value={team.name}
												onChange={(event) =>
													onChangeTeamName(index, event.target.value)
												}
												className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-semibold text-slate-100 outline-none focus:border-sky-500"
											/>
										)}
									</div>
									<span className="text-[11px] font-bold text-slate-400">
										{teamTileIds[index]?.startsWith('inner_')
											? boardTilesMap.get(teamTileIds[index])?.label ||
												teamTileIds[index]
											: `${teamPositions[index]}번`}
									</span>
								</div>
							))}
						</div>
					</section>
					<button
						type="button"
						disabled={
							isRolling ||
							isMovingPawn ||
							Boolean(pendingTileEvent || eventNotice)
						}
						onClick={onRestartGame}
						className="w-full rounded-xl border border-rose-500/40 bg-rose-950/30 px-4 py-2.5 text-xs font-bold text-rose-200 transition-colors hover:bg-rose-900/50 disabled:opacity-40"
					>
						게임 처음부터 다시하기
					</button>
				</>
			) : selectedTileId ? (
				<TileInspector
					tile={boardTilesMap.get(selectedTileId) || null}
					availableTiles={[...boardTilesMap.values()]}
					isMovingPosition={isMovingInnerTile}
					isSelectingNextTile={tileSelectionMode === 'next'}
					isSelectingTeleportTile={tileSelectionMode === 'teleport'}
					isSelectingDirectionTile={tileSelectionMode === 'direction'}
					onSelectNextTile={() => onBeginTileSelection('next')}
					onSelectTeleportTile={() => onBeginTileSelection('teleport')}
					onSelectDirectionTile={() => onBeginTileSelection('direction')}
					onMovePosition={onMoveTilePosition}
					onUpdate={onUpdateTile}
					onDelete={onDeleteTile}
					onClose={onCloseTileInspector}
				/>
			) : (
				<div>선택된 타일이 없습니다.</div>
			)}
		</aside>
	);
}
