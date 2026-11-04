'use client';

import { useState } from 'react';
import { ArrowDownWideNarrow } from 'lucide-react';
import type { AvalonPlayerStats } from './actions';

type Person = { id: string; name: string };
type SortKey = 'games' | 'overall' | 'good' | 'evil';
const columns: { key: SortKey; label: string }[] = [
  { key: 'games', label: '게임' }, { key: 'overall', label: '전체 승률' },
  { key: 'good', label: '선 승률' }, { key: 'evil', label: '악 승률' },
];
const rate = (wins: number, games: number) => games ? Math.round(wins / games * 100) : 0;

export default function PlayerStatsTable({ people, stats }: { people: Person[]; stats: Record<string, AvalonPlayerStats> }) {
  const [sort, setSort] = useState<SortKey>('overall');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const value = (person: Person, key: SortKey) => {
    const row = stats[person.id];
    if (!row) return 0;
    if (key === 'games') return row.games;
    if (key === 'good') return rate(row.goodWins, row.goodGames);
    if (key === 'evil') return rate(row.evilWins, row.evilGames);
    return rate(row.wins, row.games);
  };
  const sorted = [...people].sort((a, b) => (value(a, sort) - value(b, sort)) * (order === 'asc' ? 1 : -1) || a.name.localeCompare(b.name, 'ko'));
  return <div className="mt-3 overflow-x-auto">
    <div className="min-w-[560px]">
      <div className="grid grid-cols-[minmax(100px,1.5fr)_repeat(4,minmax(90px,1fr))] gap-1 border-b border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs font-bold text-slate-600">
        <span className="text-left">이름</span>
        {columns.map(({ key, label }) => <button key={key} type="button" aria-label={`${label} ${sort === key && order === 'desc' ? '오름차순' : '내림차순'} 정렬`} aria-pressed={sort === key} onClick={() => { if (sort === key) setOrder(order === 'desc' ? 'asc' : 'desc'); else { setSort(key); setOrder('desc'); } }} className={`rounded-full px-1 py-1 ${sort === key ? 'bg-violet-700 text-white' : 'hover:bg-violet-100'}`}>{label}<ArrowDownWideNarrow className={`ml-1 inline size-3.5 ${sort === key && order === 'asc' ? 'rotate-180' : ''}`} /></button>)}
      </div>
      <div className="space-y-1.5 pt-2">{sorted.map((person) => {
        const row = stats[person.id];
        return <div key={person.id} className="grid grid-cols-[minmax(100px,1.5fr)_repeat(4,minmax(90px,1fr))] items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-center text-sm">
          <span className="truncate text-left font-semibold" title={person.name}>{person.name}</span>
          <span>{row?.games ?? 0}회</span>
          <span className="font-semibold text-violet-700">{rate(row?.wins ?? 0, row?.games ?? 0)}%</span>
          <span className="text-blue-700">{rate(row?.goodWins ?? 0, row?.goodGames ?? 0)}% <span className="block text-xs text-slate-400">{row?.goodWins ?? 0}/{row?.goodGames ?? 0}</span></span>
          <span className="text-rose-700">{rate(row?.evilWins ?? 0, row?.evilGames ?? 0)}% <span className="block text-xs text-slate-400">{row?.evilWins ?? 0}/{row?.evilGames ?? 0}</span></span>
        </div>;
      })}</div>
    </div>
  </div>;
}
