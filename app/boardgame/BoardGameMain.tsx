// app/page.tsx
import DiceArena from './components/DiceArena';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function BoardGameMain({
	profile,
}: {
	profile: { name: string; role: string };
}) {
	return (
		<main className="min-h-screen bg-white text-slate-900 flex flex-col items-center p-4 md:p-8">
			<div className="w-full max-w-6xl space-y-4">
				<Link
					href="/"
					className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors w-fit py-2 m-0"
				>
					<ArrowLeft className="w-4 h-4" /> 메인 화면으로
				</Link>
				<DiceArena canCreateBoardgame={profile.role === 'super_admin'} />
			</div>
		</main>
	);
}
