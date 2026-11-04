import type { AvalonSideStats } from './actions';

export default function SideStatsSummary({ stats }: { stats: AvalonSideStats }) {
  const goodRate = stats.games ? Math.round(stats.goodWins / stats.games * 100) : 0;
  const evilRate = stats.games ? Math.round(stats.evilWins / stats.games * 100) : 0;
  return <section aria-label="전체 게임의 진영별 승률" className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
    <div className="flex items-center justify-between gap-2"><h3 className="font-bold">전체 게임 선 · 악 승률</h3><span className="text-xs text-slate-500">완료된 게임 {stats.games}회</span></div>
    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
      <div className="rounded-lg bg-blue-50 p-3 text-blue-800"><p className="font-semibold">선 진영</p><p className="mt-1 text-xl font-bold">{goodRate}%</p><p className="text-xs">{stats.goodWins}승 / {stats.games}게임</p></div>
      <div className="rounded-lg bg-rose-50 p-3 text-rose-800"><p className="font-semibold">악 진영</p><p className="mt-1 text-xl font-bold">{evilRate}%</p><p className="text-xs">{stats.evilWins}승 / {stats.games}게임</p></div>
    </div>
    {stats.games > 0 && <div role="img" aria-label={`선 ${goodRate}%, 악 ${evilRate}%`} className="mt-3 flex h-2 overflow-hidden rounded-full bg-rose-400"><span className="bg-blue-500" style={{ width: `${stats.goodWins / stats.games * 100}%` }} /></div>}
  </section>;
}
