'use client';

import { useState } from 'react';
import { Dices, PlusCircle, UsersRound } from 'lucide-react';
import type { BoardgameSummary } from '../actions';
import BoardgameCreateModal from './BoardgameCreateModal';
import BoardgameEditorAccessModal from './BoardgameEditorAccessModal';
import ConfirmModal from '@/components/ConfirmModal';

export default function BoardgameHeader({
	boardgames,
	activeBoardgameId,
	canCreateBoardgame,
	isBusy,
	onSelect,
	onCreated,
	activeBoardgameIsMaker,
	editors,
	status,
	onGrantEditor,
	onRevokeEditor,
	onDeleteBoardgame,
}: {
	boardgames: BoardgameSummary[];
	activeBoardgameId: string | null;
	canCreateBoardgame: boolean;
	isBusy: boolean;
	onSelect: (boardgameId: string) => void;
	onCreated: (game: BoardgameSummary) => void;
	activeBoardgameIsMaker: boolean;
	editors: string[];
	status: string;
	onGrantEditor: (userName: string) => Promise<boolean>;
	onRevokeEditor: (userName: string) => Promise<void>;
	onDeleteBoardgame: () => Promise<void>;
}) {
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [isEditorAccessOpen, setIsEditorAccessOpen] = useState(false);
	const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
	return (
		<>
			<header className="w-full">
				<h1 className="flex w-full items-center gap-2 text-2xl font-bold text-slate-900">
					<Dices className="h-7 w-7 text-rose-600" />
					<span>보드게임</span>
					{canCreateBoardgame && (
						<div className="ml-auto flex gap-2">
							<button
								type="button"
								disabled={isBusy}
								onClick={() => setIsCreateOpen(true)}
								className="flex items-center gap-2 self-start rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white shadow-md transition-colors hover:bg-rose-500 disabled:opacity-40 sm:px-4 sm:py-2.5"
							>
								<PlusCircle className="h-4 w-4" /> 새 보드게임 생성
							</button>
							<button
								type="button"
								disabled={isBusy || !activeBoardgameId || !activeBoardgameIsMaker}
								onClick={() => setIsEditorAccessOpen(true)}
								className="flex items-center gap-2 self-start rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 sm:px-4 sm:py-2.5"
							>
								<UsersRound className="h-4 w-4" /> 편집 권한 부여
							</button>
							<button
								type="button"
								disabled={isBusy || !activeBoardgameId || !activeBoardgameIsMaker}
								onClick={() => setIsDeleteConfirmOpen(true)}
								className="flex items-center gap-2 self-start rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 sm:px-4 sm:py-2.5"
							>
								보드게임 삭제
							</button>
						</div>
					)}
				</h1>
				<p className="mt-1 text-xs text-slate-500">
					우리가 직접 만들어 즐기는 주루마블
				</p>
			</header>

			<nav
				aria-label="보드게임 선택"
				className="flex w-full items-center gap-2 overflow-x-auto border-b border-slate-800 pb-2"
			>
				{boardgames.map((game) => (
					<button
						key={game.id}
						type="button"
						disabled={isBusy}
						aria-pressed={activeBoardgameId === game.id}
						onClick={() => onSelect(game.id)}
						className={`whitespace-nowrap rounded-xl px-4 py-2 text-xs font-bold transition-all disabled:opacity-50 border ${
							activeBoardgameId !== game.id
								? 'border-slate-300 bg-white text-slate-900 shadow-sm'
								: 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
						}`}
					>
						{game.name}
					</button>
				))}
				{boardgames.length === 0 && !isBusy && (
					<span className="px-1 py-2 text-xs text-slate-500">
						등록된 보드게임이 없습니다.
					</span>
				)}
			</nav>

			{isCreateOpen && (
				<BoardgameCreateModal
					onClose={() => setIsCreateOpen(false)}
					onCreated={onCreated}
				/>
			)}
			{isEditorAccessOpen && activeBoardgameId && activeBoardgameIsMaker && (
				<BoardgameEditorAccessModal
					editors={editors}
					isBusy={isBusy}
					status={status}
					onClose={() => setIsEditorAccessOpen(false)}
					onGrant={onGrantEditor}
					onRevoke={onRevokeEditor}
				/>
			)}
			{isDeleteConfirmOpen && (
				<ConfirmModal
					message={`보드게임[ ${boardgames.find(game => game.id === activeBoardgameId)?.name} ]을 삭제하시겠습니까?`}
					warning="삭제하면 되돌릴 수 없습니다."
					onConfirm={() => { onDeleteBoardgame(); setIsDeleteConfirmOpen(false); }}
					onCancel={() => setIsDeleteConfirmOpen(false)}
				/>
			)}
		</>
	);
}
