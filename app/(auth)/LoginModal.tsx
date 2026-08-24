'use client';

import { useState, useTransition } from 'react';
import { loginWithName } from '@/app/(auth)/actions';
import { LogIn, Loader2, Lock, User } from 'lucide-react';

export default function LoginModal() {
	const [isPending, startTransition] = useTransition();
	const [errorMessage, setErrorMessage] = useState('');

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setErrorMessage('');

		const formData = new FormData(e.currentTarget);
		startTransition(async () => {
			const result = await loginWithName(formData);
			if (result?.error) {
				setErrorMessage(result.error);
			}
		});
	};

	return (
		<div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
			<div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-8 border border-slate-100 space-y-6">
				<div className="text-center space-y-2">
					<div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
						<LogIn className="w-6 h-6" />
					</div>
					<h2 className="text-2xl font-bold text-slate-800">
						SSAFY 504 로그인
					</h2>
					<p className="text-sm text-slate-500">
						서비스 이용을 위해 이름과 비밀번호를 입력하세요.
					</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<label className="block text-xs font-semibold text-slate-600 mb-1">
							이름
						</label>
						<div className="relative">
							<User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
							<input
								type="text"
								name="name"
								placeholder="홍길동"
								className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
								required
							/>
						</div>
					</div>

					<div>
						<label className="block text-xs font-semibold text-slate-600 mb-1">
							비밀번호
						</label>
						<div className="relative">
							<Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
							<input
								type="password"
								name="password"
								placeholder="••••••••"
								className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
								required
							/>
						</div>
					</div>

					{errorMessage && (
						<p className="text-xs text-rose-500 font-medium text-center bg-rose-50 p-2.5 rounded-lg">
							{errorMessage}
						</p>
					)}
					<button
						type="submit"
						disabled={isPending}
						className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm py-3 rounded-xl transition-colors disabled:opacity-50"
					>
						{isPending ? (
							<Loader2 className="w-4 h-4 animate-spin" />
						) : (
							'로그인하기'
						)}
					</button>
				</form>
			</div>
		</div>
	);
}
