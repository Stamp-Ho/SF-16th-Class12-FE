'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Cookie, Shield, ArrowLeft, Sparkles, Vote } from 'lucide-react';

const initialUserList: string[] = [
	'강명환',
	'강명묵',
	'강정훈',
	'김민철',
	'김태엽',
	'김태원',
	'김한나',
	'박경진',
	'박재윤',
	'박현도',
	'송강규',
	'윤동현',
	'이가은',
	'이동원',
	'이상은',
	'이찬원',
	'이채원',
	'장세정',
	'장익환',
	'장지현',
	'전승현',
	'정승현',
	'정인호',
	'정제영',
	'조동휘',
	'차민수',
	'차은수',
];
const initialSnackList: { snackName: string; votedUsers: string[] }[] = [
	{
		snackName: '칙촉',
		votedUsers: initialUserList.filter((u, i) => i % 2 === 0),
	},
	{
		snackName: '쿠쿠다스',
		votedUsers: initialUserList.filter((u, i) => i % 2 !== 0),
	},
];
export default function SnackMain({ profile }: { profile: any }) {
	const [snackList, setSnackList] =
		useState<{ snackName: string; votedUsers: string[] }[]>(initialSnackList);
	return (
		<main className="min-h-screen bg-slate-50 p-6 md:p-12">
			<div className="max-w-5xl mx-auto space-y-8">
				{/* 상단 네비게이션 & 헤더 */}
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
					<div>
						<Link
							href="/"
							className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-slate-800 transition-colors mb-2"
						>
							<ArrowLeft className="w-3.5 h-3.5" /> 메인 대시보드로
						</Link>
						<h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
							<Cookie className="w-7 h-7 text-amber-600" />
							간식 센터
						</h1>
						<p className="text-xs text-slate-500 mt-1">간식 뽑기 및 신청</p>
					</div>
				</div>

				{/* 셔플 액션 컨트롤 파트 */}
				<div className="bg-linear-to-br from-amber-500/80 to-amber-600 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
					<div className="space-y-2 text-center md:text-left z-10">
						<span className="text-xs font-semibold bg-white/20 px-3 py-1 rounded-full uppercase tracking-wider inline-flex items-center gap-1">
							<Sparkles className="w-3.5 h-3.5 text-amber-300" /> SNACK CENTER
							토목공사 중
						</span>
						<h2 className="text-2xl md:text-3xl font-extrabold">
							이 페이지엔 어떤 기능을 넣을지 고민중입니다
						</h2>
						<p className="text-amber-100 text-xs">
							간식을 밥처럼 먹지만 말아주세요...
						</p>
					</div>

					<button
						onClick={() => {
							alert('간식 뽑기 기능은 아직 구현되지 않았습니다.');
						}}
						className="z-10 flex items-center gap-3 px-8 py-4 bg-amber-400 hover:bg-amber-300 text-slate-900 font-extrabold text-base rounded-2xl shadow-lg hover:shadow-amber-400/30 transition-all transform active:scale-95 disabled:opacity-50"
					>
						{false ? '뽑는 중...' : '간식 뽑기 시작!'}
					</button>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
					{/* 과자 신청 */}
					<section className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
						<div className="flex items-center justify-between border-b border-slate-100 pb-4">
							<h3 className="font-bold text-slate-800 flex items-center gap-2 text-base">
								<Vote className="w-5 h-5 text-amber-500" />
								아마두 신청 과자 목록
							</h3>
						</div>

						{/* 신청 과자 격자 배치 */}
						<div className="grid grid-cols-5 sm:grid-cols-5 gap-3">
							{snackList.map((snack, index) => {
								const isVoted = snack.votedUsers.includes(profile.username);
								return (
									<div
										key={index}
										className={`border-2 text-amber-800 p-2 rounded-lg text-center ${
											isVoted
												? ' border-amber-500 bg-amber-100'
												: 'bg-white border-slate-300'
										}`}
									>
										{snack.snackName}
										<p className="text-xs text-amber-600 mt-1">
											{snack.votedUsers.length}표
										</p>
										<button className="text-xs text-amber-600 mt-1 bg-amber-200 hover:bg-amber-300 px-2 py-1 rounded">
											{isVoted ? '취소' : '나도 원해요'}
										</button>
									</div>
								);
							})}
						</div>
					</section>
					{/* 과자를 밥처럼 먹는 자를 막기 위한 기능 */}
					<section className="lg:col-span-1 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
						<div className="flex items-center justify-between border-b border-slate-100 pb-4">
							<h3 className="font-bold text-slate-800 flex items-center gap-2 text-base">
								<Shield className="w-5 h-5 text-amber-500" />
								아마도 악랄한 기능
							</h3>
						</div>
						<p className="text-slate-500 text-sm">
							과자를 밥처럼 먹는 자가 많아지면 <br />
							여기 뭐가 추가됩니다
						</p>
					</section>
				</div>
			</div>
		</main>
	);
}
