'use client';

import { useEffect, useMemo, useState } from 'react';
import {
	ArrowDownWideNarrow,
	Coins,
	Crown,
	History,
	Loader2,
	Skull,
	Sword,
	X,
} from 'lucide-react';
import { getHistoriesByRound } from './actions';
import { createClient } from '@/utils/supabase/client';

type BidHistoryRecord = {
	id: number;
	user_name: string;
	price_change: number;
	bid_price: number;
	seat_code: string;
	category: '이동' | '입찰' | '도박';
	method: string;
	created_at: string;
	prev_group_name: string | null;
	next_group_name: string | null;
};

// "26.08.21 16:09:12" 형태로 변환
function formatDate(value: string) {
	const d = new Date(value);
	const pad = (n: number) => String(n).padStart(2, '0');
	const MM = pad(d.getMonth() + 1);
	const dd = pad(d.getDate());
	return `${MM}월 ${dd}일`;
}
function formatTime(value: string) {
	const d = new Date(value);
	const pad = (n: number) => String(n).padStart(2, '0');
	const hh = pad(d.getHours());
	const mm = pad(d.getMinutes());
	const ss = pad(d.getSeconds());
	return `${hh}:${mm}:${ss}`;
}

type RankingData = {
	user_name: string;
	bid_count: number;
	raised_money: number;
	success_count: number;
	fail_count: number;
};

type RankByType =
	| 'bid_count'
	| 'raised_money'
	| 'gamble_success_rate'
	| 'gamble_count';

type RawBidHistory = Omit<BidHistoryRecord, 'category'>;

function toBidHistoryRecord(record: RawBidHistory): BidHistoryRecord {
	return {
		...record,
		category:
			record.method === 'BID'
				? record.prev_group_name === null
					? '이동'
					: '입찰'
				: '도박',
	};
}

// 단일 기록을 기존 랭킹 목록에 반영한 새 배열을 반환
function applyRecordToRanking(
	rankingData: RankingData[],
	record: RawBidHistory,
): RankingData[] {
	const next = rankingData.map((r) => ({ ...r }));

	if (record.method === 'GAMBLE') {
		const existingRanking = next.find((r) => r.user_name === record.user_name);
		if (existingRanking) {
			if (record.price_change < 0) existingRanking.success_count += 1;
			else existingRanking.fail_count += 1;
		} else {
			next.push({
				user_name: record.user_name,
				bid_count: 0,
				raised_money: 0,
				success_count: record.price_change < 0 ? 1 : 0,
				fail_count: record.price_change < 0 ? 0 : 1,
			});
		}
	}

	if (record.method === 'BID' && record.price_change > 0) {
		const existingRanking = next.find((r) => r.user_name === record.user_name);
		if (existingRanking) {
			existingRanking.bid_count += 1;
			existingRanking.raised_money += record.price_change;
			if (record.user_name === '조동휘') console.log(record);
		} else {
			next.push({
				user_name: record.user_name,
				bid_count: 1,
				raised_money: record.price_change,
				success_count: 0,
				fail_count: 0,
			});
		}
	}

	return next;
}

export default function BidRecordModal({
	roundId,
	onClose,
}: {
	roundId: number;
	onClose: () => void;
}) {
	const [records, setRecords] = useState<BidHistoryRecord[]>([]);

	const [isLoading, setIsLoading] = useState(true);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [categoryFilter, setCategoryFilter] = useState<string[]>([
		'이동',
		'입찰',
		'도박',
	]);

	const [showRanking, setShowRanking] = useState(false);
	const [seatCodeFilter, setSeatCodeFilter] = useState<string | null>(null);
	const [userNameFilter, setUserNameFilter] = useState<string | null>(null);
	const [filteredRecords, setFilteredRecords] = useState<BidHistoryRecord[]>(
		[],
	);

	const [rankingData, setRankingData] = useState<RankingData[]>([]);
	const [sortedRankingData, setSortedRankingData] = useState<RankingData[]>([]);
	const [rankBy, setRankBy] = useState<RankByType>('bid_count');

	const supabase = useMemo(() => createClient(), []);

	const handleCategoryFilterChange = (category: string) => {
		if (categoryFilter.includes(category)) {
			setCategoryFilter(categoryFilter.filter((c) => c !== category));
		} else {
			setCategoryFilter([...categoryFilter, category]);
		}
	};

	useEffect(() => {
		if (rankingData.length > 0) {
			const sortedData = [...rankingData].sort((a, b) => {
				switch (rankBy) {
					case 'bid_count':
						return b.bid_count - a.bid_count;
					case 'raised_money':
						return b.raised_money - a.raised_money;
					case 'gamble_success_rate':
						const aRate =
							a.success_count + a.fail_count > 0
								? a.success_count / (a.success_count + a.fail_count)
								: 0;
						const bRate =
							b.success_count + b.fail_count > 0
								? b.success_count / (b.success_count + b.fail_count)
								: 0;
						if (bRate === aRate)
							return (
								b.success_count +
								b.fail_count -
								(a.success_count + a.fail_count)
							);
						return bRate - aRate;
					case 'gamble_count':
						return (
							b.success_count + b.fail_count - (a.success_count + a.fail_count)
						);
				}
			});
			setSortedRankingData(sortedData);
		}
	}, [rankingData, rankBy]);

	useEffect(() => {
		let isActive = true;

		const loadHistory = async () => {
			setIsLoading(true);
			setErrorMessage(null);

			try {
				const history = await getHistoriesByRound(roundId);
				if (isActive) setRecords(history.map(toBidHistoryRecord));

				let initialRankingData: RankingData[] = [];
				for (const record of history) {
					initialRankingData = applyRecordToRanking(
						initialRankingData,
						record as RawBidHistory,
					);
				}
				if (isActive) setRankingData(initialRankingData);
			} catch (error) {
				if (isActive) {
					setErrorMessage(
						error instanceof Error
							? error.message
							: '기록을 불러오지 못했습니다.',
					);
				}
			} finally {
				if (isActive) setIsLoading(false);
			}
		};

		void loadHistory();

		// 신규 입찰/도박/이동 기록을 실시간으로 반영
		const channel = supabase
			.channel(`seat_bid_histories-round-${roundId}`)
			.on(
				'postgres_changes',
				{
					event: 'INSERT',
					schema: 'public',
					table: 'seat_bid_histories',
					filter: `round_id=eq.${roundId}`,
				},
				(payload) => {
					const newRecord = payload.new as RawBidHistory;
					if (!isActive) return;

					setRecords((prev) => [toBidHistoryRecord(newRecord), ...prev]);
					setRankingData((prev) => applyRecordToRanking(prev, newRecord));
				},
			)
			.subscribe();

		return () => {
			isActive = false;
			supabase.removeChannel(channel);
		};
	}, [roundId, supabase]);

	useEffect(() => {
		setFilteredRecords(
			records.filter(
				(record) =>
					categoryFilter.includes(record.category) &&
					(seatCodeFilter == null || record.seat_code === seatCodeFilter) &&
					(userNameFilter == null || record.user_name === userNameFilter),
			),
		);
	}, [records, categoryFilter, seatCodeFilter, userNameFilter]);

	const rankByDict: Record<string, RankByType> = {
		'입찰 횟수': 'bid_count',
		'상향 입찰액': 'raised_money',
		'도박 횟수': 'gamble_count',
		'도박 성공률': 'gamble_success_rate',
	};
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
			<div className="flex h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
				<div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3">
					<h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
						<History className="h-5 w-5 text-indigo-600" />
						기록
					</h2>
					<button
						type="button"
						onClick={() => setShowRanking(!showRanking)}
						className="mr-5 ml-auto flex flex-row items-center gap-1 rounded-full bg-rose-600 px-4 py-1 text-sm font-semibold text-white transition-colors hover:bg-rose-700"
					>
						<Crown className="h-4 w-4" />
						{showRanking ? '기록 보기' : '랭킹 보기'}
					</button>
					<button
						type="button"
						onClick={onClose}
						className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
						title="닫기"
					>
						<X className="h-5 w-5" />
					</button>
				</div>

				{showRanking || (
					<div className="flex flex-row gap-2 mr-auto ml-4 py-4">
						{['이동', '입찰', '도박'].map((category) => (
							<button
								key={category}
								type="button"
								onClick={() => handleCategoryFilterChange(category)}
								className={`rounded-full px-3 py-1 text-sm font-semibold transition-colors ${
									categoryFilter.includes(category)
										? 'bg-emerald-500 text-white hover:bg-emerald-600'
										: 'bg-slate-100 text-slate-700 hover:bg-slate-200'
								}`}
							>
								{category}
							</button>
						))}
						<div className="ml-4">
							코드:
							<select
								className="ml-2 rounded-md border border-slate-300 bg-white py-1 px-2 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
								value={seatCodeFilter ?? '전체'}
								onChange={(e) =>
									setSeatCodeFilter(
										e.target.value === '전체' ? null : e.target.value,
									)
								}
							>
								{[
									'전체',
									'A',
									'B',
									'C',
									'D',
									'E',
									'F',
									'G',
									'H',
									'I',
									'J',
									'K',
									'L',
									'M',
									'가',
									'나',
									'다',
								].map((code) => (
									<option key={code} value={code}>
										{code}
									</option>
								))}
							</select>
						</div>
						<div className="ml-4">
							사용자:
							<select
								className="ml-2 rounded-md border border-slate-300 bg-white py-1 px-2 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
								value={userNameFilter ?? '전체'}
								onChange={(e) =>
									setUserNameFilter(
										e.target.value === '전체' ? null : e.target.value,
									)
								}
							>
								<option value="전체">전체</option>
								{Array.from(new Set(records.map((record) => record.user_name)))
									.sort((a, b) => a.localeCompare(b))
									.map((userName) => (
										<option key={userName} value={userName}>
											{userName}
										</option>
									))}
							</select>
						</div>
					</div>
				)}
				<div
					className={`min-h-0 flex-1 ${showRanking ? 'overflow-hidden' : 'overflow-y-auto'}`}
				>
					{isLoading ? (
						<div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
							<Loader2 className="h-4 w-4 animate-spin" />
							기록을 불러오는 중...
						</div>
					) : errorMessage ? (
						<p className="py-12 text-center text-sm text-rose-500">
							{errorMessage}
						</p>
					) : showRanking ? (
						<div className="px-2 pb-2 flex h-full min-h-0 flex-col">
							<div className="grid shrink-0 grid-cols-[0.4fr_repeat(4,minmax(0,1fr))] gap-x-2 border-b border-slate-200 bg-slate-50 pl-4 pr-6 py-3 text-center text-xs font-bold text-slate-600">
								<span className="text-left ml-2">이름</span>
								{Object.keys(rankByDict).map((title) => (
									<div
										key={title}
										className={`cursor-pointer ${rankBy === rankByDict[title] ? 'bg-indigo-500 text-white rounded-full py-1.5 -my-1.5 mx-1' : ''}`}
										onClick={() => setRankBy(rankByDict[title])}
									>
										{title}
										<ArrowDownWideNarrow
											className={`inline-block h-4 w-4 ml-1 -mr-5 ${rankBy === rankByDict[title] ? 'text-white' : 'text-slate-400/90'}`}
										/>
									</div>
								))}
							</div>

							<div className="min-h-0 flex-1 space-y-3 overflow-y-auto pt-3 pb-2">
								{rankingData.length === 0 ? (
									<p className="py-12 text-center text-sm text-slate-400">
										랭킹 데이터가 없습니다.
									</p>
								) : (
									sortedRankingData.map((record, index) => {
										const user = record.user_name;
										const bidCount = record.bid_count;
										const raisedMoney = record.raised_money;
										const successCount = record.success_count;
										const failCount = record.fail_count;

										return (
											<div
												key={`${String(record.user_name ?? index)}-${index}`}
												className="grid grid-cols-[0.4fr_repeat(4,minmax(0,1fr))] items-center gap-x-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm shadow-sm"
											>
												<div className="contents">
													{user != null && (
														<span className="truncate text-left font-bold text-slate-800">
															{String(user)}
														</span>
													)}
													<span className="font-semibold text-amber-600">
														{bidCount}회
													</span>
													<span className="font-semibold text-emerald-600">
														+ {raisedMoney}
													</span>
													<span className="font-semibold text-slate-600">
														{successCount + failCount}회
													</span>
													<span className="flex items-center justify-end gap-1 font-semibold text-slate-600">
														{(
															(successCount /
																Math.max(successCount + failCount, 1)) *
															100
														).toFixed(2)}
														%<span className="text-slate-400">(</span>
														<span className="text-emerald-600 w-3.75">
															{successCount}
														</span>
														<span className="text-slate-400">/</span>
														<span className="text-rose-600 w-3.75">
															{failCount}
														</span>
														<span className="text-slate-400">)</span>
													</span>
												</div>
											</div>
										);
									})
								)}
							</div>
						</div>
					) : filteredRecords.length === 0 ? (
						<p className="py-12 text-center text-sm text-slate-400">
							저장된 입찰 기록이 없습니다.
						</p>
					) : (
						<div className="px-2 pb-2 space-y-3">
							{filteredRecords.map((record, index) => {
								const date = record.created_at;
								const user = record.user_name;
								const seat = record.seat_code;
								const price = record.bid_price;

								return (
									<div
										key={`${String(record.id ?? index)}-${index}`}
										className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
									>
										<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
											<p
												className={`text-slate-600 text-xs border-2 rounded-full px-1.5 py-0.5 font-semibold
                                                ${record.category === '이동' ? 'bg-slate-100 border-slate-300' : record.category === '입찰' ? 'bg-emerald-100 border-emerald-300 !text-emerald-600' : 'bg-rose-100 border-rose-300 !text-rose-800'}`}
											>
												{record.category}
											</p>
											<p className="text-slate-600 text-md font-semibold mx-1">
												{seat != null ? `${String(seat)}` : ''}
											</p>
											{user != null && (
												<span className="font-bold text-slate-800">
													{String(user)}
												</span>
											)}

											{/* 상향 입찰 기록 */}
											{record.prev_group_name != null &&
												record.next_group_name != record.prev_group_name && (
													<div className="flex flex-row gap-1 items-center">
														<Sword className={`mx-1 h-4 w-4 text-rose-400`} />
														{seat != null && `${record.prev_group_name}`}{' '}
													</div>
												)}
											{/* 도박 기록 */}
											{record.method === 'GAMBLE' && (
												<div className="flex flex-row gap-1 items-center">
													{record.price_change < 0 ? (
														<>
															<Coins className="h-5 w-5 text-amber-400" />
															성공
														</>
													) : (
														<>
															<Skull className="h-5 w-5 text-rose-400" />
															실패
														</>
													)}
												</div>
											)}

											{price != null && (
												<span className="ml-auto font-semibold text-amber-600">
													{String(price)}원
												</span>
											)}
											{/* 금액 변동 */}
											<p
												className={`-ml-1.75 w-16 ${!!Number(record.price_change) && Number(record.price_change) > 0 ? 'text-emerald-600' : 'text-rose-600'}`}
											>
												{!!Number(record.price_change) &&
													(Number(record.price_change) > 0
														? `(+${String(record.price_change)})`
														: `(${String(record.price_change)})`)}
											</p>
											{date != null && (
												<div className=" text-xs text-slate-400 flex flex-col items-center -my-1">
													<p>{formatDate(date)}</p>
													<p>{formatTime(date)}</p>
												</div>
											)}
										</div>
									</div>
								);
							})}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
