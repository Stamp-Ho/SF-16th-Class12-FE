'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { closeRound, openRound, deleteRound, toggleGamble } from './actions';
import {
	Lock,
	Unlock,
	ShieldCheck,
	Loader2,
	Trash2,
	Coins,
	CameraOff,
	Camera,
	DollarSign,
} from 'lucide-react';

export default function AdminControlPanel({
	roundNumber,
	isClosed,
	isGambleEnabled,
	loadData,
	screenShotMode,
	setScreenShotMode,
	showMoney,
	setShowMoney,
}: {
	roundNumber: number;
	isClosed: boolean;
	isGambleEnabled: boolean;
	loadData: () => Promise<void>;
	screenShotMode: boolean;
	setScreenShotMode: (value: boolean) => void;
	showMoney: boolean;
	setShowMoney: (value: boolean) => void;
}) {
	const [isPending, startTransition] = useTransition();
	const [isGamblePending, startGambleTransition] = useTransition();
	const router = useRouter();

	const refreshAuctionState = async () => {
		await loadData();
		router.refresh();
	};

	// 1. 경매 마감 / 시작 토글
	const handleToggleStatus = () => {
		startTransition(async () => {
			try {
				if (isClosed) {
					await openRound(roundNumber);
				} else {
					await closeRound(roundNumber);
				}
				await refreshAuctionState();
			} catch (err: any) {
				alert(`상태 변경 에러: ${err.message}`);
			}
		});
	};
	// 2. 도박 허용/금지 토글
	const handleToggleGamble = () => {
		startGambleTransition(async () => {
			try {
				await toggleGamble(roundNumber);
				await refreshAuctionState();
			} catch (err: any) {
				alert(`도박 상태 변경 에러: ${err.message}`);
			}
		});
	};

	return (
		<div className="bg-slate-900 text-white rounded-2xl shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4 p-2.5 sm:p-4">
			<div className="flex items-center gap-3 justify-start w-full">
				<ShieldCheck className="w-6 h-6 text-amber-400 shrink-0" />
				<div>
					<h3 className="font-bold text-sm">관리자 경매 컨트롤 센터</h3>
					<p className="text-xs text-slate-400">
						현재 상태:{' '}
						<span
							className={
								isClosed
									? 'text-rose-400 font-bold'
									: 'text-emerald-400 font-bold'
							}
						>
							{isClosed ? '경매 마감됨' : '경매 진행 중'}
						</span>
					</p>
				</div>
				<div
					onClick={() => setScreenShotMode(!screenShotMode)}
					className="cursor-pointer bg-white/20 py-1 px-2 rounded-full"
				>
					{screenShotMode ? (
						<Camera className={`w-6 h-6 shrink-0  text-emerald-400`} />
					) : (
						<CameraOff className={`w-6 h-6 shrink-0 text-slate-400`} />
					)}
				</div>
				<div
					onClick={() => setShowMoney(!showMoney)}
					className="cursor-pointer bg-white/20 py-1 px-2 rounded-full"
				>
					{showMoney ? (
						<DollarSign className={`w-6 h-6 shrink-0  text-emerald-400`} />
					) : (
						<DollarSign className={`w-6 h-6 shrink-0 text-slate-400`} />
					)}
				</div>
			</div>

			<div className="flex items-center justify-end gap-3 w-full">
				{/* 상태 변경 버튼 */}
				<button
					onClick={handleToggleStatus}
					disabled={isPending}
					className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
						isClosed
							? 'bg-emerald-600 hover:bg-emerald-500 text-white'
							: 'bg-rose-600 hover:bg-rose-500 text-white'
					}`}
				>
					{isPending ? (
						<Loader2 className="w-3.5 h-3.5 animate-spin" />
					) : isClosed ? (
						<>
							<Unlock className="w-3.5 h-3.5" /> 경매 재개
						</>
					) : (
						<>
							<Lock className="w-3.5 h-3.5" /> 경매 종료
						</>
					)}
				</button>

				{/* 도박 금지/허용 버튼 */}
				<button
					onClick={handleToggleGamble}
					disabled={isGamblePending}
					className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-white rounded-xl text-xs font-bold transition-all
							${!isGambleEnabled ? 'bg-rose-600 hover:bg-rose-500' : 'bg-amber-500 hover:bg-amber-400'}
						`}
				>
					{isGamblePending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
					<Coins className="w-3.5 h-3.5" />{' '}
					{isGambleEnabled ? '도박 허용' : '도박 금지'}
				</button>

				{/* 경매 삭제 버튼 */}
				<button
					onClick={() => {
						if (confirm('정말로 이 회차의 경매를 삭제하시겠습니까?')) {
							startTransition(async () => {
								try {
									await deleteRound(roundNumber);
									await refreshAuctionState();
									alert('경매가 삭제되었습니다.');
								} catch (err: any) {
									alert(`삭제 에러: ${err.message}`);
								}
							});
						}
					}}
					disabled={isPending}
					className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all"
				>
					<Trash2 className="w-3.5 h-3.5" /> 경매 삭제
				</button>
			</div>
		</div>
	);
}
