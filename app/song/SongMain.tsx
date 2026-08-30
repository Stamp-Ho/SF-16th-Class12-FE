'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, DiscAlbum, MicVocal, Play } from 'lucide-react';
import Link from 'next/link';
import { addSongRecord, getSongRecords } from './actions';
import SingerQueueSection from './SingerQueueSection';
import { createClient } from '@/utils/supabase/client';

const RecordModal = dynamic(() => import('./RecordModal'), { ssr: false });
const SearchModal = dynamic(() => import('./SearchModal'), { ssr: false });
const RandomSelectModal = dynamic(() => import('./RandomSelectModal'), {
	ssr: false,
});

export default function SongMain({
	user,
}: {
	user: { name: string; role: string };
}) {
	const supabase = useMemo(() => createClient(), []);
	const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
	const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
	const [isRandomSelectModalOpen, setIsRandomSelectModalOpen] = useState(false);

	const [newSingerName, setNewSingerName] = useState('');
	const [newSingerReason, setNewSingerReason] = useState('');
	const [addFront, setAddFront] = useState(false); // 우선 예약 여부 상태
	const singerNameInputRef = useRef<HTMLInputElement>(null);

	const [singerList, setSingerList] = useState<
		{ id: string; name: string; reason: string }[]
	>([]);

	const fetchSingerList = async () => {
		try {
			const data = await getSongRecords();
			setSingerList(
				data
					.filter((record) => record.status === 'pending')
					.map((record) => ({
						id: record.id,
						name: record.user_name,
						reason: record.reason,
					})),
			);
		} catch (error) {
			console.error(error);
			setSingerList([]); // 오류 발생 시 빈 배열로 초기화
		}
	};
	useEffect(() => {
		fetchSingerList();
	}, []);

	useEffect(() => {
		fetchSingerList(); // 초기 로드 시 한 번 호출
		const channel = supabase
			.channel(`song_records`)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'song_records' },
				() => {
					fetchSingerList();
				},
			)
			.subscribe();
		return () => {
			supabase.removeChannel(channel);
		};
	}, []);

	const onSubmitAddSinger = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newSingerName.trim()) return;
		try {
			await addSongRecord(newSingerName, newSingerReason, addFront);
			setNewSingerName('');
			setNewSingerReason('');
			setAddFront(false);

			fetchSingerList(); // 명단 추가 후 리스트 갱신
			singerNameInputRef.current?.focus();
		} catch (error) {
			console.error('명단 추가 실패:', error);
		}
	};

	const isAdmin =
		user.role.includes('song_admin') || user.role.includes('teacher');

	return (
		<main className="min-h-screen bg-slate-50/80 p-4 sm:p-6 md:p-12 font-sans">
			<div className="max-w-4xl mx-auto space-y-6">
				{/* 1. 상단 헤더 */}
				<header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
					<div className="flex items-center gap-3">
						<Link
							href="/"
							className="p-2 -ml-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
						>
							<ArrowLeft className="w-5 h-5" />
						</Link>
						<div>
							<h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
								<MicVocal className="w-6 h-6 text-ssafy-blue" />
								SSAFY{' '}
								<span className="text-ssafy-blue font-extrabold">
									12반
								</span>{' '}
								노래 큐
							</h1>
							<p className="text-xs text-slate-400 font-medium mt-0.5">
								노래 빼기 없음!!! 🔥
							</p>
						</div>
					</div>

					<button
						onClick={() => setIsRecordModalOpen(true)}
						className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl shadow-sm transition-all self-stretch sm:self-auto active:scale-95"
					>
						<DiscAlbum className="w-4 h-4 text-ssafy-blue" />
						노래 기록
					</button>
				</header>

				{/* 2. 어드민 또는 사용자 메인 섹션 */}
				{isAdmin ? (
					<section className="space-y-4">
						{/* 노래 시작 패널 */}
						<div className="bg-linear-to-r from-ssafy-blue/10 via-white to-white px-8 py-4 rounded-2xl border border-ssafy-blue/20 shadow-sm flex items-center justify-between">
							<div>
								<span className="inline-block px-2.5 py-1 bg-ssafy-blue/20 text-ssafy-blue text-xs font-bold rounded-lg mb-2">
									ADMIN CONTROL
								</span>
								<h2 className="text-xl font-bold text-slate-800">
									다음 무대 시작
								</h2>
								<p className="text-xs text-slate-500 mt-1">
									1순위 가수가 준비되면 검색 버튼을 눌러 노래를 틀어주세요.
								</p>
							</div>
							<div className="text-ssafy-blue font-bold text-4xl ml-auto mr-8">
								노래 시작!
							</div>
							<style>{`
								@keyframes flash-red {
									0%, 100% { background-color: var(--color-ssafy-blue); }
									10%, 60% { background-color: white; }
									50% { background-color: #CD201F; }
								}
							`}</style>
							<button
								onClick={() => setIsSearchModalOpen(true)}
								style={{
									animation:
										isSearchModalOpen || isRecordModalOpen
											? ''
											: 'bounce 1s infinite, flash-red 2s infinite',
									transformOrigin: 'center',
									transition: 'transform 1s ease-in-out',
								}}
								className="text-white h-38 w-40 rounded-[38px] shadow-md shadow-ssafy-blue/30 transition-all flex items-center justify-center group active:scale-95 bg-ssafy-blue"
								title="노래 검색 및 재생"
							>
								<Play className="w-16 h-16 fill-current translate-x-0.5 group-hover:scale-110 transition-transform mr-1" />
							</button>
						</div>

						{/* 가수 초대 (등록 폼) */}
						<form
							className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4"
							onSubmit={onSubmitAddSinger}
						>
							<h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
								✨ 가수 대기열 추가
							</h2>
							<h4 className="text-sm text-slate-400 -mt-3 mb-3">
								탭 순서: 가수 이름 → 노래 사유 → 대기열 추가하기 (추가 후 다시
								가수 이름으로 포커스)
							</h4>

							<div className="grid grid-cols-3 grid-rows-1 gap-3">
								<input
									ref={singerNameInputRef}
									type="text"
									placeholder="가수 이름"
									value={newSingerName}
									onChange={(e) => setNewSingerName(e.target.value)}
									tabIndex={1}
									className="border-2 border-ssafy-blue/40 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-ssafy-blue focus:ring-2 focus:ring-ssafy-blue/20 transition-all"
								/>
								<input
									type="text"
									placeholder="노래 사유 (예: 벌칙, 지각, 기분 좋음)"
									value={newSingerReason}
									onChange={(e) => setNewSingerReason(e.target.value)}
									tabIndex={1}
									className="border-2 border-ssafy-blue/40 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-ssafy-blue focus:ring-2 focus:ring-ssafy-blue/20 transition-all"
								/>
								{/* 무작위 뽑기! */}
								<button
									type="button"
									onClick={() => {
										setIsRandomSelectModalOpen(true);
									}}
									tabIndex={0}
									className="col-span-1 py-2 bg-ssafy-blue hover:bg-ssafy-blue/80 text-white text-sm font-bold rounded-xl shadow-sm transition-all active:scale-[0.98]"
								>
									🎲 무작위 뽑기
								</button>
							</div>

							{/* 우선 예약 토글 버튼 */}
							<div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
								{[true, false].map((value) => (
									<button
										type="button"
										tabIndex={0}
										key={`addFront-${value}`}
										className={`py-2 text-xs font-bold rounded-lg transition-all border-2 ${
											addFront === value
												? 'bg-white text-slate-800 shadow-sm border-ssafy-blue'
												: 'text-slate-400 hover:text-slate-600 border-ssafy-blue/30'
										}`}
										onClick={() => setAddFront(value)}
									>
										{value ? '⚡ 우선 예약 (맨 앞)' : '📅 일반 예약 (맨 뒤)'}
									</button>
								))}
							</div>

							<button
								type="submit"
								className="w-full py-3 bg-ssafy-blue hover:bg-ssafy-blue/90 text-white text-sm font-bold rounded-xl shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99]"
								disabled={!newSingerName}
								tabIndex={1}
							>
								대기열에 추가하기
							</button>
						</form>
					</section>
				) : (
					<section className="bg-gradient-to-r from-ssafy-blue/10 via-white to-white p-6 rounded-2xl shadow-sm border border-slate-100">
						<h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">
							MY TURN STATUS
						</h2>
						<div>
							{singerList.length > 0 &&
							singerList[0].name.includes(user.name) ? (
								<div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
									<span className="text-2xl">🎤</span>
									<div>
										<p className="text-emerald-800 font-bold text-base">
											바로 다음이 {user.name}님의 차례입니다!
										</p>
										<p className="text-emerald-600 text-xs mt-0.5">
											무대로 나올 준비를 해주세요!
										</p>
									</div>
								</div>
							) : singerList.some((singer) =>
									singer.name.includes(user.name),
							  ) ? (
								<div className="p-4 bg-gradient-to-l from-ssafy-blue/10 via-white to-white border border-blue-200 rounded-xl flex items-center gap-3">
									<span className="text-2xl">👀</span>
									<div>
										<p className="text-blue-800 font-bold text-base">
											곧 {user.name}님의 차례가 다가옵니다.
										</p>
										<p className="text-blue-600 text-xs mt-0.5">
											아래 대기순번을 확인해 보세요.
										</p>
									</div>
								</div>
							) : (
								<div className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl flex items-center gap-3">
									<span className="text-2xl">😌</span>
									<div>
										<p className="text-slate-600 font-medium text-sm">
											{user.name}님은 대기 명단에 없습니다.
										</p>
										<p className="text-slate-400 text-xs mt-0.5">
											편안하게 가수의 무대를 기다려주세요. 🎶
										</p>
									</div>
								</div>
							)}
						</div>
					</section>
				)}

				{/* 3. 가수 대기실 (목록) */}
				<SingerQueueSection
					singerList={singerList}
					setSingerList={setSingerList}
					user={user}
					isAdmin={isAdmin}
					fetchSingerList={fetchSingerList}
				/>

				{/* 모달 레이어 */}
				{isSearchModalOpen && (
					<SearchModal
						targetRecordId={singerList[0]?.id}
						onClose={() => setIsSearchModalOpen(false)}
					/>
				)}
				{isRecordModalOpen && (
					<RecordModal onClose={() => setIsRecordModalOpen(false)} />
				)}
				{isRandomSelectModalOpen && (
					<RandomSelectModal
						setSingerName={setNewSingerName}
						setSingerReason={setNewSingerReason}
						onClose={() => setIsRandomSelectModalOpen(false)}
					/>
				)}
			</div>
		</main>
	);
}
