import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import LoginModal from '@/app/(auth)/LoginModal';
import { logout } from '@/app/(auth)/actions';
import {
	Armchair,
	Dices,
	ShieldCogCorner,
	ExternalLink,
	Megaphone,
	LogOut,
	MicVocal,
} from 'lucide-react';
import ChangePwButton from '@/components/ChangePwButton';
import DeleteLinkButton from '@/components/DeleteLinkButton';
import { requireAuth } from '@/utils/auth';

export default async function MainPage() {
	const supabase = await createClient();
	  const { status, profile } = await requireAuth();

	// 로그인하지 않은 경우 바로 로그인 모달 출력
	if (!profile) {
		return <LoginModal />;
	}


	const [{ data: links }] = await Promise.all([
		supabase
			.from('dashboard_links')
			.select('id, title, url, description, display_order')
			.order('display_order', { ascending: true }),
	]);

	const isAdmin =
		profile?.role === 'super_admin' || profile?.role === 'class_admin';

	return (
		<main className="min-h-screen bg-slate-50 p-6 md:p-12">
			<div className="max-w-5xl mx-auto space-y-8">
				{/* 상단 헤더 및 프로필 */}
				<header className="flex justify-between items-center bg-white p-6 pb-5 rounded-2xl shadow-sm border border-slate-100">
					<div>
						<h1 className="text-2xl font-bold text-slate-800">
							[SSAFY 16기] 12반 대시보드
						</h1>
						<p className="text-sm text-slate-500 mt-2">
							반갑습니다,{' '}
							<span className="font-semibold text-slate-800">
								{profile?.username}
							</span>
							님!
							{isAdmin && (
								<span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
									Admin
								</span>
							)}
						</p>
					</div>

					<div className="flex items-center gap-3">
						{/* 어드민일 때만 표시되는 버튼 */}
						{isAdmin && (
							<Link
								href="/admin"
								prefetch={false}
								className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-colors"
							>
								<ShieldCogCorner className="w-4 h-4" />
								관리자 센터
							</Link>
						)}
						<ChangePwButton />
						<form action={logout}>
							<button
								type="submit"
								className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
								title="로그아웃"
							>
								<LogOut className="w-5 h-5" />
							</button>
						</form>
					</div>
				</header>

				{/* 메인 서비스 카드 버튼들 */}
				<section className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<Link
						href="/seats"
						prefetch
						className="group bg-linear-to-br from-indigo-400 to-indigo-600 text-white p-6 rounded-2xl shadow-md hover:shadow-lg transition-all"
					>
						<div className="flex justify-between items-start">
							<div>
								<span className="text-xs font-semibold bg-white/20 px-2.5 py-1 rounded-full uppercase">
									Auction
								</span>
								<h2 className="text-2xl font-bold mt-3">자리 배정 경매</h2>
								<p className="text-indigo-100 text-sm mt-1">
									A~M 구역 선점 및 실시간 입찰
								</p>
							</div>
							<Armchair className="w-10 h-10 text-indigo-200 group-hover:scale-110 transition-transform" />
						</div>
					</Link>

					<Link
						href="/song"
						prefetch
						className="group bg-linear-to-br from-ssafy-blue to-ssafy-blue-dark text-white p-6 rounded-2xl shadow-md hover:shadow-lg transition-all"
					>
						<div className="flex justify-between items-start">
							<div>
								<span className="text-xs font-semibold bg-white/20 px-2.5 py-1 rounded-full uppercase">
									Song Queue
								</span>
								<h2 className="text-2xl font-bold mt-3">노래 큐</h2>
								<p className="text-teal-100 text-sm mt-1">
									12반의 노래방
								</p>
							</div>
							<MicVocal className="w-10 h-10 text-indigo-100 group-hover:scale-110 transition-transform" />
						</div>
					</Link>

					<Link
						href="/shuffle"
						prefetch={false}
						className="group bg-linear-to-br from-emerald-500 to-teal-600 text-white p-6 rounded-2xl shadow-md hover:shadow-lg transition-all"
					>
						<div className="flex justify-between items-start">
							<div>
								<span className="text-xs font-semibold bg-white/20 px-2.5 py-1 rounded-full uppercase">
									Randomizer
								</span>
								<h2 className="text-2xl font-bold mt-3">순서 무작위 추첨</h2>
								<p className="text-teal-100 text-sm mt-1">
									26명 무작위 순서 뽑기
								</p>
							</div>
							<Dices className="w-10 h-10 text-teal-200 group-hover:scale-110 transition-transform" />
						</div>
					</Link>
				</section>

				{/* 공지사항 목록 */}
				<section className="space-y-4">
					<h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
						<Megaphone className="w-5 h-5 text-indigo-500" /> 주요 링크
					</h2>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						{links && links.length > 0 ? (
							links.map((item) => (
								<a
									key={item.id}
									href={item.url}
									target="_blank"
									rel="noopener noreferrer"
									className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all flex flex-col justify-between"
								>
									<div className="flex items-center justify-between">
										<h3 className="font-semibold text-slate-800">
											{item.title}
										</h3>
										<ExternalLink className="w-4 h-4 text-slate-400" />
									</div>
									{item.description && (
										<div className="flex flex-row justify-between items-start">
											<p className="text-xs text-slate-500 mt-2">
												{item.description}
											</p>
										</div>
									)}
								</a>
							))
						) : (
							<div className="col-span-full bg-white p-8 rounded-2xl border border-dashed border-slate-200 text-center text-slate-400 text-sm">
								등록된 링크가 없습니다.
							</div>
						)}
					</div>
				</section>
			</div>
		</main>
	);
}
