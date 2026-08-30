'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { getAllRounds, getSeatsDataByRounds } from './actions';
import ClassroomGrid from './ClassroomGrid';
import { createClient } from '@/utils/supabase/client';
import {
	Armchair,
	PlusCircle,
	Users,
	Coins,
	CheckCircle2,
	Clock,
	ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import GambleModal from './GambleModal';

const AdminControlPanel = dynamic(() => import('./AdminControlPanel'), {
	ssr: false,
});

const AllocationAddModal = dynamic(() => import('./AllocationAddModal'), {
	ssr: false,
});

export default function SeatsMain({ profile }: { profile: any }) {
	const supabase = useMemo(() => createClient(), []);

	const [rounds, setRounds] = useState<any[]>([]);
	const [selectedRound, setSelectedRound] = useState<any | null>(null);

	const [gambleModalOn, setGambleModalOn] = useState(false);

	// 스크린 샷 모드
	const [screenShotMode, setScreenShotMode] = useState(false);
	// 돈 표시 여부
	const [showMoney, setShowMoney] = useState(true);

	// 모달 상태
	const [isModalOpen, setIsModalOpen] = useState(false);
	const selectedRoundNumberRef = useRef<number | null>(null);

	// 로그인 사용자 정보
	const currentUser = profile;
	// 그룹 정렬 기준 (선점 좌석 없으면 상단 노출)
	const [sortGroupsByOccupied, setSortGroupsByOccupied] = useState(true);

	// 라운드 메타 정보만 가공 (그룹/좌석 데이터는 포함하지 않음)
	const buildRoundMeta = (round: any) => ({
		...round,
		roundNumber: round.id,
		numberPerGroup: round.people_per_group,
		isClosed: round.is_closed,
		isGambleEnabled: round.is_gamble_enabled,
	});

	// 특정 라운드의 그룹/좌석 원시 데이터를 화면에서 쓰는 형태로 가공
	const buildRoundDetail = (
		roundMeta: any,
		groups: any[],
		allocations: any[],
	) => ({
		...roundMeta,
		groups: groups.map((group) => ({
			...group,
			groupId: String(group.id),
			m1: group.member_1,
			m2: group.member_2,
			m3: group.member_3,
			groupName: group.group_name,
		})),
		seats: allocations.map((allocation) => ({
			...allocation,
			id: String(allocation.id),
			current_group_id: allocation.group_id
				? String(allocation.group_id)
				: null,
			current_group_name: allocation.seat_group?.group_name ?? null,
			current_bid_price: allocation.bid_price,
			locked: allocation.is_locked,
			member_left:
				allocation.member_left ?? allocation.seat_group?.member_1 ?? null,
			member_middle:
				allocation.member_middle ?? allocation.seat_group?.member_2 ?? null,
			member_right:
				allocation.member_right ?? allocation.seat_group?.member_3 ?? null,
		})),
	});

	// 현재 보고 있는 라운드의 그룹/좌석 데이터만 조회 (불필요한 전체 라운드 조회 방지)
	const loadRoundDetail = useCallback(async (roundMeta: any) => {
		try {
			const { groups, allocations } = await getSeatsDataByRounds([
				roundMeta.id,
			]);
			setSelectedRound(buildRoundDetail(roundMeta, groups, allocations));
		} catch (err) {
			console.error('회차 상세 데이터 로드 에러:', err);
		}
	}, []);

	const loadData = useCallback(async () => {
		try {
			const roundData = await getAllRounds();
			if (!roundData || roundData.length === 0) {
				setRounds([]);
				setSelectedRound(null);
				return;
			}

			const metaList = roundData.map(buildRoundMeta);
			setRounds(metaList);

			const prevRoundNumber = selectedRoundNumberRef.current;
			const targetMeta =
				(prevRoundNumber != null &&
					metaList.find((r) => r.roundNumber === prevRoundNumber)) ||
				metaList[0];

			await loadRoundDetail(targetMeta);
		} catch (err) {
			console.error('데이터 로드 에러:', err);
		}
	}, [loadRoundDetail]);

	// 회차 탭 선택 시 해당 회차 데이터만 조회
	const handleSelectRound = useCallback(
		(r: any) => {
			setSelectedRound((prev: any) =>
				prev?.roundNumber === r.roundNumber
					? prev
					: { ...r, groups: [], seats: [] },
			);
			void loadRoundDetail(r);
		},
		[loadRoundDetail],
	);

	useEffect(() => {
		void loadData();
		// 💡 Supabase Realtime 구독 설정
		const channel = supabase
			.channel('realtime-seats')
			.on(
				'postgres_changes',
				{
					event: 'UPDATE',
					schema: 'public',
					table: 'seat_allocations',
				},
				(payload) => {
					const updatedSeat = payload.new;
					const currentCode = myOccupiedCodeRef.current;
					const currentGroupId = myGroupIdRef.current;
					const currentRoundId = selectedRoundNumberRef.current;

					// 내가 선점 중이던 자리를 다른 팀이 뺏어간 경우 알림
					if (
						currentCode &&
						updatedSeat.seat_code === currentCode &&
						updatedSeat.group_id !== Number(currentGroupId) &&
						updatedSeat.group_id !== null &&
						updatedSeat.round_id === currentRoundId
					) {
						alert(
							`⚠️ [경고] ${updatedSeat.seat_code}구역 자리를 다른 팀이 상향 입찰하여 뺏어갔습니다!`,
						);
					}

					// 현재 보고 있는 회차와 무관한 변경이면 재조회하지 않음
					if (updatedSeat.round_id === currentRoundId) {
						void loadData();
					}
				},
			)
			.subscribe();

		// 컴포넌트 언마운트 시 구독 해제 (메모리 누수 방지)
		return () => {
			supabase.removeChannel(channel);
		};
	}, [loadData, supabase]);

	// 신규 배정 모달 열기
	const handleOpenCreateModal = () => {
		setIsModalOpen(true);
	};

	const myOccupiedCodeRef = useRef<string | null>(null);
	const myGroupIdRef = useRef<string>('');

	// 1. 현재 회차의 영구 저장된 전체 짝 목록 (initial_groups)
	const currentGroups = selectedRound?.groups || [];

	// 💡 2. 동명이인이 없으므로 currentGroups에서 내 이름(currentUser.name)이 속한 짝 찾기
	const myMatchedGroup = currentGroups.find(
		(g: any) =>
			g.m1 === currentUser.name ||
			g.m2 === currentUser.name ||
			g.m3 === currentUser.name,
	);

	// 내 그룹 ID 및 그룹명 (예: groupId: "GROUP_1", groupName: "정인호, 김철수")
	const myGroupId = myMatchedGroup?.groupId || '';
	const myGroupName = myMatchedGroup?.groupName || currentUser.name;

	// 3. 내가 속한 그룹이 현재 선점하고 있는 구역(A~M) 및 입찰가 정보 검색
	const myOccupiedSeat = selectedRound?.seats?.find(
		(s: any) => s.current_group_id === myGroupId && myGroupId !== '',
	);
	const myOccupiedCode = myOccupiedSeat?.seat_code || null;
	const myCurrentBidPrice = myOccupiedSeat?.current_bid_price || 0;

	useEffect(() => {
		selectedRoundNumberRef.current = selectedRound?.roundNumber ?? null;
	}, [selectedRound]);

	useEffect(() => {
		myOccupiedCodeRef.current = myOccupiedCode;
		myGroupIdRef.current = myGroupId;
	}, [myOccupiedCode, myGroupId]);
	return (
		<main className="min-h-screen bg-slate-50 p-3 sm:p-6">
			<div className="max-w-6xl mx-auto space-y-3 sm:space-y-6 w-full">
				<Link
					href="/"
					className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors w-fit py-2 m-0"
				>
					<ArrowLeft className="w-4 h-4" /> 메인 화면으로
				</Link>
				{/* 1. 상단 헤더 */}
				<div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full">
					<div className="w-full">
						<h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2 w-full justify-between">
							<Armchair className="w-7 h-7 text-indigo-600" />
							자리 배정 경매
							{currentUser.role === 'super_admin' && (
								<button
									onClick={handleOpenCreateModal}
									className="flex items-center ml-auto gap-2 px-3 py-2 sm:px-4 sm:py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-all self-start sm:self-auto"
								>
									<PlusCircle className="w-4 h-4" />새 자리 배정 시작
								</button>
							)}
						</h1>
						<p className="text-xs text-slate-500 mt-1">
							2주 단위 자리 배정 및 선착순/경매 구역(A~M) 입찰 시스템
						</p>
					</div>
				</div>

				{/* 2. 회차 선택 탭 */}
				<div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200">
					{rounds.map((r) => (
						<button
							key={r.roundNumber}
							onClick={() => handleSelectRound(r)}
							className={`px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
								selectedRound?.roundNumber === r.roundNumber
									? 'bg-slate-900 text-white shadow-sm'
									: 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
							}`}
						>
							{r.title} ({r.isClosed ? '마감됨' : '진행중'})
						</button>
					))}
				</div>

				{/* 3. 내 그룹 및 선점 위치 요약 카드 */}

				{/* 4. 어드민 제어 패널 */}
				{currentUser.role === 'super_admin' && selectedRound && (
					<AdminControlPanel
						roundNumber={selectedRound.roundNumber}
						isClosed={selectedRound.isClosed}
						isGambleEnabled={selectedRound.isGambleEnabled}
						loadData={loadData}
						screenShotMode={screenShotMode}
						setScreenShotMode={setScreenShotMode}
						showMoney={showMoney}
						setShowMoney={setShowMoney}
					/>
				)}

				{/* 💡 5. [메인 2열 레이아웃] 좌측: 배치도 / 우측: 전체 그룹 현황 */}
				{selectedRound ? (
					<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
						{/* 좌측 (2열 차지): 배치도 */}
						<div className="lg:col-span-2">
							<ClassroomGrid
								roundId={selectedRound.id}
								seatList={selectedRound.seats}
								myGroupId={myGroupId}
								myGroupName={myGroupName}
								currentUserName={currentUser.name}
								isAdmin={currentUser.role === 'super_admin'}
								numberPerGroup={selectedRound.numberPerGroup}
								loadData={loadData}
								screenShotMode={screenShotMode}
								showMoney={showMoney}
								roundTitle={selectedRound.title}
							/>
						</div>

						{/* 💡 우측 (1열 차지): 전체 2인 짝 그룹 현황 리스트 */}
						<div className="space-y-3">
							<div className="grid grid-cols-2 gap-2">
								{/* 내 소속 짝 카드 */}
								<div className="bg-linear-to-br from-indigo-300 to-indigo-600 text-white px-5 py-3 rounded-2xl shadow-md flex items-center justify-between">
									<div className="space-y-1">
										<span className="text-[10px] font-bold bg-white/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
											MY GROUP
										</span>
										<h3
											className={`${myGroupName.length > 8 ? 'text-[14.5px]' : 'text-xl'} flex items-center h-7.25 font-black`}
										>
											{myGroupName}
										</h3>
										<p className="text-indigo-100 text-xs">
											본인:{' '}
											<span className="font-bold underline">
												{currentUser.name}
											</span>
										</p>
									</div>
								</div>
								{/* 내 입찰가 카드 */}
								<div>
									<div className="bg-linear-to-br from-amber-300 to-amber-600 text-white px-5 py-3 rounded-2xl shadow-md flex items-center justify-between">
										<div className="space-y-1">
											<span className="text-[10px] font-bold bg-white/30 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
												Seat Bid
											</span>

											<div className="text-xl font-black flex items-center justify-center mr-1">
												<Coins className="w-5 h-5 text-white text-xl mr-2" />
												{myCurrentBidPrice.toLocaleString()} 원
											</div>
											<p className="text-white text-xs">진짜 돈 입니다</p>
										</div>
									</div>
								</div>
							</div>

							<div className="grid grid-cols-2 gap-2">
								{/* 현재 선점 위치 카드 */}
								<div
									className={`px-5 py-3 rounded-2xl shadow-md flex items-center justify-between border  ${
										myOccupiedCode
											? 'bg-linear-to-br from-teal-200 to-teal-600 text-white border-teal-300'
											: 'bg-white text-slate-800 border-slate-200'
									}`}
								>
									<div className="space-y-1">
										<span
											className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
												myOccupiedCode
													? 'bg-white/20 text-white'
													: 'bg-slate-100 text-slate-500'
											}`}
										>
											CURRENT SEAT
										</span>
										<h3 className="text-xl font-black flex items-center gap-2">
											{myOccupiedCode ? (
												<>
													<span>{myOccupiedCode} 구역 선점 중</span>
												</>
											) : (
												<span className="text-slate-400">자리 미배정</span>
											)}
										</h3>
										<p
											className={`text-xs animate-pulse 
												${myOccupiedCode ? 'text-white' : 'text-slate-400'}`}
										>
											{myCurrentBidPrice > 0
												? '여전히 입찰 가능. 주의!'
												: myOccupiedCode
													? '자유 이동 가능'
													: '빈 자리 눌러!'}
										</p>
									</div>
								</div>
								{/* 행운 노려보기 버튼 */}
								<div
									className={`px-5 py-3 rounded-2xl shadow-lg flex items-center justify-between border transition-all duration-300 shadow-md relative overflow-hidden ${
										myOccupiedCode &&
										myCurrentBidPrice >= 500 &&
										selectedRound.isGambleEnabled
											? 'cursor-pointer bg-[linear-gradient(110deg,#E6C685_0%,#F9E9C3_45%,#F9E9C3_55%,#D9A036_100%)] text-slate-950 border-[#FDF2D9] shadow-inner shadow-white/30'
											: 'cursor-not-allowed bg-white text-slate-800 border-slate-200'
									}`}
									onClick={() => {
										if (
											myOccupiedCode &&
											myCurrentBidPrice >= 500 &&
											selectedRound.isGambleEnabled
										) {
											setGambleModalOn(true);
										}
									}}
								>
									<div className="space-y-1 relative z-10">
										<span
											className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
												myOccupiedCode &&
												myCurrentBidPrice >= 500 &&
												selectedRound.isGambleEnabled
													? 'bg-yellow-800/80 text-yellow-300'
													: 'bg-slate-100 text-slate-500'
											}`}
										>
											LUCKY TRY
										</span>
										{selectedRound.isGambleEnabled ? (
											<>
												<h3
													className={`text-xl font-black flex items-center gap-2 
														text-slate-800`}
												>
													행운 노리기
												</h3>

												<p
													className={`text-xs font-bold animate-pulse ${
														myOccupiedCode && myCurrentBidPrice >= 500
															? 'text-yellow-950/80'
															: 'text-slate-400'
													}`}
												>
													결과는 본인 책임~
												</p>
											</>
										) : (
											<>
												<h3
													className={`text-xl font-black flex items-center gap-2 
														text-slate-500`}
												>
													도박 금지됨
												</h3>

												<p
													className={`text-xs font-bold animate-pulse 'text-slate-300'`}
												>
													관리자에게 문의하세요
												</p>
											</>
										)}
									</div>
								</div>
							</div>

							<div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
								<div className="flex items-center justify-between border-b border-slate-100 pb-3">
									<h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
										<Users className="w-4 h-4 text-indigo-600" />
										전체 짝 목록 (
										{currentGroups.length > 0 ? currentGroups.length : '?'})
									</h3>
									<button
										onClick={() => setSortGroupsByOccupied((prev) => !prev)}
										className="text-[13px] text-slate-500 hover:text-slate-800 transition-colors mr-5"
									>
										{sortGroupsByOccupied
											? '원래 순서대로 정렬'
											: '미배정 상단 노출'}
									</button>
								</div>

								<div className="space-y-2 max-h-85.5 overflow-y-auto pr-1">
									{/* 우측 짝 카드 리스트 내부 */}
									{(sortGroupsByOccupied
										? [...currentGroups].sort((a: any, b: any) => {
												const aOccupied = selectedRound.seats.some(
													(s: any) => s.current_group_id === a.groupId,
												);
												const bOccupied = selectedRound.seats.some(
													(s: any) => s.current_group_id === b.groupId,
												);
												return aOccupied === bOccupied ? 0 : aOccupied ? 1 : -1;
											})
										: currentGroups
									).map((g: any, idx: number) => {
										const occupiedSeat = selectedRound.seats.find(
											(s: any) => s.current_group_id === g.groupId,
										);

										return (
											<div
												key={g.groupId || idx}
												// 💡 드래그 가능 속성 및 드래그 시작 시 groupId 저장
												draggable={!selectedRound.isClosed}
												onDragStart={(e) => {
													e.dataTransfer.setData('text/plain', g.groupId);
													e.dataTransfer.setData(
														'groupName',
														g.groupName || `${g.m1}, ${g.m2}`,
													);
													e.dataTransfer.effectAllowed = 'move';
												}}
												className={`p-3 rounded-2xl border text-xs flex items-center min-h-12.25 justify-between transition-all cursor-grab active:cursor-grabbing ${
													occupiedSeat
														? 'bg-slate-50 border-slate-200'
														: 'bg-amber-50/50 border-amber-200/60'
												}`}
											>
												<div>
													<p className="font-bold text-slate-800">
														{[g.m1, g.m2, g.m3].filter(Boolean).join(' • ')}
													</p>
												</div>

												{occupiedSeat ? (
													<span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 px-2 py-1 rounded-lg font-extrabold text-[11px]">
														<CheckCircle2 className="w-3 h-3" />
														{occupiedSeat.seat_code} 구역
													</span>
												) : (
													<span className="inline-flex items-center gap-1 bg-rose-100 text-rose-700 px-2 py-1 rounded-lg font-bold text-[10px]">
														<Clock className="w-3 h-3" /> 미배정
													</span>
												)}
											</div>
										);
									})}
								</div>
							</div>
						</div>
					</div>
				) : (
					<div className="bg-white p-12 rounded-3xl text-center text-slate-400 text-xs border border-dashed border-slate-200">
						진행 중인 자리 배정이 없습니다. [새 자리 배정 시작] 버튼을
						눌러주세요.
					</div>
				)}

				{/* 신규 자리 배정 생성 모달 */}
				{isModalOpen && (
					<AllocationAddModal
						onClose={() => setIsModalOpen(false)}
						rounds={rounds}
						loadData={loadData}
					/>
				)}

				{gambleModalOn && (
					<GambleModal
						seatId={myOccupiedSeat?.id || ''}
						userName={currentUser.name}
						onClose={() => setGambleModalOn(false)}
					/>
				)}
			</div>
		</main>
	);
}
