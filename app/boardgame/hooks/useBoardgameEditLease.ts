import { useEffect, useRef, useState } from 'react';
import { acquireBoardgameTileEditLock, renewBoardgameTileEditLock } from '../actions';

const HEARTBEAT_MS = 30_000;
const LEASE_MS = 90_000;
const LOST_MESSAGE = '편집 잠금이 만료되었거나 다른 세션으로 변경되었습니다. 입력과 저장을 중단했습니다. 작성한 내용은 유지됩니다.';

export function useBoardgameEditLease(
	boardgameId: string | null,
	isEditMode: boolean,
	setStatus: (message: string) => void,
) {
	const sessionRef = useRef<{ boardgameId: string; id: string } | null>(null);
	const leaseRef = useRef<{ tileId: string; deadline: number; lost: boolean } | null>(null);
	const blockedRef = useRef(false);
	const [blockedBoard, setBlockedBoard] = useState<string | null>(null);
	const [heldTile, setHeldTile] = useState<{ boardgameId: string; tileId: string } | null>(null);
	const acquiringRef = useRef(false);
	const statusRef = useRef(setStatus);
	useEffect(() => { statusRef.current = setStatus; }, [setStatus]);
	useEffect(() => () => {
		sessionRef.current = null;
		leaseRef.current = null;
		blockedRef.current = false;
	}, [boardgameId]);

	const getSessionId = () => {
		if (!boardgameId) throw new Error('보드게임을 선택해 주세요.');
		if (sessionRef.current?.boardgameId !== boardgameId) {
			sessionRef.current = { boardgameId, id: crypto.randomUUID() };
			leaseRef.current = null;
			blockedRef.current = false;
		}
		return sessionRef.current.id;
	};
	const block = (message = LOST_MESSAGE) => {
		blockedRef.current = true;
		setBlockedBoard(boardgameId);
		statusRef.current(message);
	};
	const canEdit = () => {
		if (acquiringRef.current) return false;
		if (sessionRef.current?.boardgameId !== boardgameId) return true;
		const lease = leaseRef.current;
		if (lease && (lease.lost || Date.now() >= lease.deadline)) {
			lease.lost = true;
			block();
		}
		return !blockedRef.current;
	};
	const canEditTile = (tileId: string) =>
		sessionRef.current?.boardgameId === boardgameId &&
		leaseRef.current?.tileId === tileId && canEdit();
	const markLost = () => {
		if (leaseRef.current) leaseRef.current.lost = true;
		block();
	};
	const acquire = async (tileId: string) => {
		if (!boardgameId || acquiringRef.current) return null;
		const sessionId = getSessionId();
		const startedAt = Date.now();
		let result;
		acquiringRef.current = true;
		try {
			result = await acquireBoardgameTileEditLock(boardgameId, tileId, sessionId);
		} catch {
			statusRef.current('편집 잠금 요청에 실패했습니다. 연결을 확인해 주세요.');
			return null;
		} finally {
			acquiringRef.current = false;
		}
		if (sessionRef.current?.id !== sessionId) return null;
		if (!result.success) {
			statusRef.current(result.message);
			return null;
		}
		leaseRef.current = { tileId, deadline: startedAt + LEASE_MS, lost: false };
		setHeldTile({ boardgameId, tileId });
		blockedRef.current = false;
		setBlockedBoard(null);
		return result.data.userName;
	};
	const saved = () => {
		leaseRef.current = null;
		setHeldTile(null);
		blockedRef.current = false;
		setBlockedBoard(null);
	};
	const renamed = (tileId: string) => {
		if (leaseRef.current && canEdit()) {
			setHeldTile({ boardgameId: boardgameId!, tileId });
		}
	};

	useEffect(() => {
		if (!boardgameId || !isEditMode) return;
		let active = true;
		let inFlight = false;
		const heartbeat = async () => {
			const lease = leaseRef.current;
			const session = sessionRef.current;
			if (!lease || lease.lost || !session || session.boardgameId !== boardgameId || inFlight) return;
			inFlight = true;
			const startedAt = Date.now();
			try {
				const result = await renewBoardgameTileEditLock(boardgameId, lease.tileId, session.id);
				if (!active || leaseRef.current !== lease) return;
				if (!result.success || !result.data) {
					if (result.success) lease.lost = true;
					blockedRef.current = true;
					setBlockedBoard(boardgameId);
					statusRef.current(result.success ? LOST_MESSAGE : '잠금 갱신을 확인하지 못해 입력과 저장을 중단했습니다. 연결을 복구하면 다시 확인합니다.');
				} else {
					lease.deadline = startedAt + LEASE_MS;
					lease.lost = false;
					const wasBlocked = blockedRef.current;
					blockedRef.current = false;
					setBlockedBoard(null);
					if (wasBlocked) statusRef.current('편집 잠금을 다시 확인했습니다. 편집을 계속할 수 있습니다.');
				}
			} catch {
				if (!active || leaseRef.current !== lease) return;
				blockedRef.current = true;
				setBlockedBoard(boardgameId);
				statusRef.current('잠금 갱신 연결에 실패해 입력과 저장을 중단했습니다. 작성한 내용은 유지됩니다.');
			} finally { inFlight = false; }
		};
		const onVisible = () => { if (document.visibilityState === 'visible') void heartbeat(); };
		const timer = setInterval(() => void heartbeat(), HEARTBEAT_MS);
		const watchdog = setInterval(() => {
			if (sessionRef.current?.boardgameId !== boardgameId) return;
			const lease = leaseRef.current;
			if (lease && !lease.lost && !blockedRef.current && Date.now() >= lease.deadline) {
				blockedRef.current = true;
				setBlockedBoard(boardgameId);
				statusRef.current(LOST_MESSAGE);
			}
		}, 1_000);
		document.addEventListener('visibilitychange', onVisible);
		window.addEventListener('online', onVisible);
		return () => {
			active = false;
			clearInterval(timer);
			clearInterval(watchdog);
			document.removeEventListener('visibilitychange', onVisible);
			window.removeEventListener('online', onVisible);
		};
	}, [boardgameId, isEditMode]);

	return { acquire, saved, renamed, canEdit, canEditTile, markLost, getSessionId, leaseRef,
		ownedTileId: heldTile?.boardgameId === boardgameId ? heldTile.tileId : null,
		isLockBlocked: blockedBoard !== null && blockedBoard === boardgameId };
}
