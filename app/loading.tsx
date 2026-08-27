export default function AppLoading() {
	return (
		<main className="min-h-screen bg-slate-50 p-6 md:p-12">
			<div className="max-w-5xl mx-auto space-y-6 animate-pulse">
				<div className="h-24 rounded-2xl bg-white border border-slate-100" />
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div className="h-36 rounded-2xl bg-white border border-slate-100" />
					<div className="h-36 rounded-2xl bg-white border border-slate-100" />
					<div className="h-36 rounded-2xl bg-white border border-slate-100" />
					<div className="h-36 rounded-2xl bg-white border border-slate-100" />
				</div>
				<div className="h-40 rounded-2xl bg-white border border-slate-100" />
			</div>
		</main>
	);
}
