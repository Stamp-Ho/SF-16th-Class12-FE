import { useEffect, useRef, type RefObject } from 'react';
import { createClient as createSupabaseClient } from '@/utils/supabase/client';
import { getBoardgame, type BoardgameSnapshot } from '../actions';

interface UseBoardgameRealtimeParams {
	supabase: ReturnType<typeof createSupabaseClient>;
	activeBoardgameId: string | null;
	editModeRef: RefObject<boolean>;
	refreshBoardgameList: () => Promise<void>;
	// 다른 사용자의 변경으로 다시 불러온 보드게임을 화면 상태에 반영
	onBoardgameReloaded: (game: BoardgameSnapshot) => void;
	onBoardgameReloadError: (message: string) => void;
	// 현재 보고 있는 보드게임이 삭제되었을 때 상태 초기화
	onActiveBoardgameDeleted: () => void;
}

/**
 * 보드게임 목록과 현재 보드게임(타일·연결·황금카드)의 Realtime 변경을 구독한다.
 * 편집 중이 아닐 때만 300ms 디바운스 후 현재 보드게임을 다시 불러온다.
 */
export function useBoardgameRealtime({
	supabase,
	activeBoardgameId,
	editModeRef,
	refreshBoardgameList,
	onBoardgameReloaded,
	onBoardgameReloadError,
	onActiveBoardgameDeleted,
}: UseBoardgameRealtimeParams) {
	// 콜백은 구독을 다시 만들지 않도록 ref로 최신 값을 참조한다.
	const handlersRef = useRef({
		onBoardgameReloaded,
		onBoardgameReloadError,
		onActiveBoardgameDeleted,
	});
	useEffect(() => {
		handlersRef.current = {
			onBoardgameReloaded,
			onBoardgameReloadError,
			onActiveBoardgameDeleted,
		};
	});

	useEffect(() => {
		let isActive = true;
		let refreshTimer: ReturnType<typeof setTimeout> | undefined;
		const refreshActiveBoard = () => {
			if (!activeBoardgameId || editModeRef.current) return;
			if (refreshTimer) clearTimeout(refreshTimer);
			refreshTimer = setTimeout(() => {
				void (async () => {
					const result = await getBoardgame(activeBoardgameId);
					if (!isActive) return;
					if (!result.success) {
						handlersRef.current.onBoardgameReloadError(result.message);
						return;
					}

					handlersRef.current.onBoardgameReloaded(result.data);
				})();
			}, 300);
		};

		let channel = supabase
			.channel(`boardgame-realtime-${activeBoardgameId ?? 'list'}`)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'boardgames' },
				(payload) => {
					void refreshBoardgameList();
					const row = (
						payload.eventType === 'DELETE' ? payload.old : payload.new
					) as { id?: string };
					if (row.id !== activeBoardgameId) return;
					if (payload.eventType === 'DELETE') {
						handlersRef.current.onActiveBoardgameDeleted();
						return;
					}
					refreshActiveBoard();
				},
			);

		if (activeBoardgameId) {
			const filter = `boardgame_id=eq.${activeBoardgameId}`;
			channel = channel
				.on(
					'postgres_changes',
					{ event: '*', schema: 'public', table: 'boardgame_tiles', filter },
					refreshActiveBoard,
				)
				.on(
					'postgres_changes',
					{
						event: '*',
						schema: 'public',
						table: 'boardgame_tile_next',
						filter,
					},
					refreshActiveBoard,
				)
				.on(
					'postgres_changes',
					{
						event: '*',
						schema: 'public',
						table: 'boardgame_gold_cards',
						filter,
					},
					refreshActiveBoard,
				);
		}
		channel.subscribe();

		return () => {
			isActive = false;
			if (refreshTimer) clearTimeout(refreshTimer);
			void supabase.removeChannel(channel);
		};
	}, [activeBoardgameId, refreshBoardgameList, supabase, editModeRef]);
}
