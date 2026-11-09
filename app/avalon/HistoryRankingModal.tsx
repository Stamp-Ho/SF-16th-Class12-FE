'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckSquare, Square, X } from 'lucide-react';
import { getAvalonGameRecords, type AvalonGameRecord } from './actions';
import GameDetailModal from './GameDetailModal';

type RankingRow = { playerId: string; name: string; games: number; wins: number; bestPlayerVotes: number };
const percent = (wins: number, games: number) => games ? Math.round(wins / games * 100) : 0;
const formatDate = (value: string) => new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Seoul' }).format(new Date(value));

export default function HistoryRankingModal({ onClose }: { onClose: () => void }) {
  const [records, setRecords] = useState<AvalonGameRecord[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [detailGame, setDetailGame] = useState<AvalonGameRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void getAvalonGameRecords().then((result) => {
      if (!active) return;
      if (result.ok) {
        setRecords(result.data);
        setSelected(result.data.map((game) => game.gameId));
      } else setError(result.error);
      setLoading(false);
    }).catch(() => {
      if (active) { setError('전적을 불러오지 못했습니다.'); setLoading(false); }
    });
    return () => { active = false; };
  }, []);

  const allSelected = records.length > 0 && selected.length === records.length;
  const ranking = useMemo(() => {
    const selectedSet = new Set(selected);
    const rows = new Map<string, RankingRow>();
    for (const game of records) {
      if (!selectedSet.has(game.gameId)) continue;
      for (const player of game.players) {
        const row = rows.get(player.playerId) ?? { playerId: player.playerId, name: player.playerName, games: 0, wins: 0, bestPlayerVotes: 0 };
        row.games += 1;
        row.wins += Number(player.won);
        row.bestPlayerVotes += player.bestPlayerVotes;
        row.name = player.playerName;
        rows.set(player.playerId, row);
      }
    }
    return [...rows.values()].sort((a, b) => b.bestPlayerVotes - a.bestPlayerVotes || b.wins - a.wins || percent(b.wins, b.games) - percent(a.wins, a.games) || a.name.localeCompare(b.name, 'ko'));
  }, [records, selected]);

  function toggleGame(gameId: string) {
    setSelected((current) => current.includes(gameId) ? current.filter((id) => id !== gameId) : [...current, gameId]);
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="avalon-history-title" className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
        <div><h2 id="avalon-history-title" className="text-xl font-bold text-slate-900">전적 보기</h2><p className="mt-1 text-sm text-slate-500">경기를 선택해 승리 수, 승리 비율, 베스트 플레이어 투표 랭킹을 확인하세요.</p></div>
        <button type="button" onClick={onClose} aria-label="전적 보기 닫기" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        {loading ? <p className="py-12 text-center text-sm text-slate-500">전적을 불러오는 중...</p> : error ? <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p> : <>
          <section className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold text-slate-800">경기 선택 <span className="font-normal text-slate-500">({selected.length}/{records.length})</span></h3><button type="button" disabled={!records.length} onClick={() => setSelected(allSelected ? [] : records.map((game) => game.gameId))} className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 px-3 py-2 text-sm font-semibold text-violet-800 disabled:opacity-40">{allSelected ? <Square size={16} /> : <CheckSquare size={16} />}{allSelected ? '전체 해제' : '전체 선택'}</button></div>
            {records.length ? <ul className="mt-3 grid max-h-52 gap-2 overflow-y-auto sm:grid-cols-2">{records.map((game, index) => {
              const winners = game.players.filter((player) => player.won);
              const checked = selected.includes(game.gameId);
              return <li key={game.gameId} className={`flex items-center gap-2 rounded-lg border p-3 ${checked ? 'border-violet-300 bg-violet-50' : 'border-slate-200 bg-white'}`}>
                <label className="flex min-w-0 flex-1 cursor-pointer gap-2 text-sm"><input type="checkbox" checked={checked} onChange={() => toggleGame(game.gameId)} className="mt-0.5 accent-violet-700" /><span className="min-w-0"><span className="block font-semibold text-slate-800">경기 {records.length - index} · {formatDate(game.completedAt)}</span><span className="mt-0.5 block truncate text-xs text-slate-500">승리: {winners.map((player) => player.playerName).join(', ') || '기록 없음'}</span></span></label>
                <button type="button" onClick={() => setDetailGame(game)} className="shrink-0 rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-100">자세히</button>
              </li>;
            })}</ul> : <p className="mt-4 rounded-lg bg-slate-50 p-5 text-center text-sm text-slate-500">완료된 게임 기록이 없습니다.</p>}
          </section>

          {selected.length > 0 && <section className="mt-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold text-slate-800">플레이어 랭킹</h3><span className="text-xs text-slate-500">선택한 {selected.length}경기 · 베스트 플레이어 투표 순</span></div>
            {ranking.length ? <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[540px] text-sm"><thead className="bg-slate-50 text-xs text-slate-600"><tr><th className="px-3 py-3 text-left">순위 · 플레이어</th><th className="px-3 py-3 text-right">승리한 게임</th><th className="px-3 py-3 text-right">승리 비율</th><th className="px-3 py-3 text-right">베스트 플레이어 투표</th></tr></thead><tbody>{ranking.map((row, index) => <tr key={row.playerId} className="border-t border-slate-100"><td className="max-w-64 truncate px-3 py-3 font-semibold">{index + 1}. {row.name}</td><td className="px-3 py-3 text-right">{row.wins}승 / {row.games}경기</td><td className="px-3 py-3 text-right">{percent(row.wins, row.games)}%</td><td className="px-3 py-3 text-right font-bold text-violet-700">{row.bestPlayerVotes}표</td></tr>)}</tbody></table></div> : <p className="rounded-lg bg-slate-50 p-5 text-center text-sm text-slate-500">선택한 경기의 참가 기록이 없습니다.</p>}
          </section>}
          {records.length > 0 && selected.length === 0 && <p className="mt-5 rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">경기를 선택하면 해당 경기들의 랭킹을 볼 수 있습니다.</p>}
        </>}
      </div>
      <footer className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6"><button type="button" onClick={onClose} className="rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white">닫기</button></footer>
    </section>
    {detailGame && <GameDetailModal game={detailGame} onClose={() => setDetailGame(null)} />}
  </div>;
}
