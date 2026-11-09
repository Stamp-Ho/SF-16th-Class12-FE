'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { getAvalonGameDetail, type AvalonGameRecord } from './actions';
import type { GameState } from './rules';
import { ROLES } from './rules';

const dateText = (value: string) => new Intl.DateTimeFormat('ko-KR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Seoul' }).format(new Date(value));
const cardText: Record<string, string> = { success: '성공', fail: '실패', magic: '마법', good_message: '선 전령', evil_message: '악 전령', good_rogue: '선 도적', evil_rogue: '악 도적' };

function GameStateDetail({ state }: { state: GameState }) {
  const nameOf = (id: string) => state.players.find((player) => player.id === id)?.name ?? '알 수 없음';
  const sideName = (side: string | null) => side === 'good' ? '선' : side === 'evil' ? '악' : '알 수 없음';
  const voteCounts = Object.values(state.bestPlayerVotes ?? {}).reduce<Record<string, number>>((counts, target) => { if (target) counts[target] = (counts[target] ?? 0) + 1; return counts; }, {});
  const winningSide = state.winner;

  return <>
    <section className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
      <p className="text-sm font-bold text-violet-900">{winningSide === 'good' ? '선 진영 승리' : '악 진영 승리'}</p>
      <p className="mt-1 text-sm text-violet-800">{state.winReason ?? '승리 사유 기록 없음'}</p>
      <p className="mt-2 text-xs text-violet-700">{state.players.length}명 · {state.results.length}회 원정 · {state.config.expansion ? '확장 규칙 사용' : '기본 규칙'}</p>
    </section>

    <section className="mt-5">
      <h3 className="font-bold text-slate-900">참가자와 직업</h3>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">{state.players.map((player) => <article key={player.id} className={`rounded-xl border p-3 ${player.currentSide === winningSide ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-white'}`}>
        <div className="flex items-center justify-between gap-2"><span className="font-semibold text-slate-900">{player.name}</span><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${player.currentSide === 'good' ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'}`}>{sideName(player.currentSide)} · {player.currentSide === winningSide ? '승리' : '패배'}</span></div>
        <p className="mt-1 text-sm text-slate-600">{player.roles.map((role) => ROLES[role]?.name ?? role).join(' · ') || (player.currentSide === 'good' ? '충신' : '하수인')}{player.side !== player.currentSide && <span className="ml-1 text-xs text-slate-500">(게임 중 진영 변경)</span>}</p>
        {state.assassinated?.includes(player.id) && <p className="mt-1 text-xs font-semibold text-rose-700">암살 대상</p>}
      </article>)}</div>
    </section>

    <section className="mt-5">
      <h3 className="font-bold text-slate-900">팀 승인 투표</h3>
      {state.voteHistory.length ? <div className="mt-2 space-y-2">{state.voteHistory.map((vote, index) => <article key={`${vote.mission}-${index}`} className="rounded-xl border border-slate-200 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold">{vote.mission}차 원정 팀 투표 · <span className={vote.approved ? 'text-blue-700' : 'text-rose-700'}>{vote.approved ? '승인' : '부결'}</span></h4><span className="text-xs text-slate-500">리더: {vote.leaderId ? nameOf(vote.leaderId) : '기록 없음'}</span></div>
        <p className="mt-1 text-xs text-slate-600">제안 팀: {vote.team.map(nameOf).join(', ') || '없음'}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">{state.players.map((player) => <span key={player.id} className="rounded-lg bg-slate-50 px-2 py-1 text-xs text-slate-700">{player.name}: {vote.votes[player.id] === undefined ? '미투표' : vote.votes[player.id] ? '찬성' : '반대'}</span>)}</div>
      </article>)}</div> : <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">팀 투표 기록이 없습니다.</p>}
    </section>

    <section className="mt-5">
      <h3 className="font-bold text-slate-900">원정 기록</h3>
      {state.results.length ? <div className="mt-2 space-y-2">{state.results.map((result) => <article key={result.number} className={`rounded-xl border p-3 ${result.success ? 'border-blue-200 bg-blue-50/60' : 'border-rose-200 bg-rose-50/60'}`}>
        <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold">{result.number}차 원정 · <span className={result.success ? 'text-blue-700' : 'text-rose-700'}>{result.success ? '성공' : '실패'}</span></h4><span className="text-xs text-slate-600">실패 카드 {result.failCount}장</span></div>
        <p className="mt-1 text-sm text-slate-700">원정 팀: {result.team.map((id) => `${nameOf(id)}${result.excaliburTarget === id ? ' (엑스칼리버 대상)' : ''}`).join(', ') || '기록 없음'}</p>
        <p className="mt-1 text-xs text-slate-600">공개된 원정 카드: {result.cards.map((card) => cardText[card] ?? card).join(' · ') || '없음'}</p>
        {result.leaderId && <p className="mt-1 text-xs text-slate-600">리더: {nameOf(result.leaderId)}{result.excaliburHolder ? ` · 엑스칼리버: ${nameOf(result.excaliburHolder)}` : ''}</p>}
      </article>)}</div> : <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">원정 기록이 없습니다.</p>}
    </section>

    <section className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <h3 className="font-bold text-amber-950">베스트 플레이어 투표</h3>
      {Object.keys(state.bestPlayerVotes ?? {}).length ? <div className="mt-2 flex flex-wrap gap-1.5">{state.players.map((voter) => {
        const choice = state.bestPlayerVotes?.[voter.id];
        return <span key={voter.id} className="rounded-lg bg-white px-2 py-1.5 text-xs text-amber-950">{voter.name}: {choice ? nameOf(choice) : '건너뜀'}</span>;
      })}</div> : <p className="mt-1 text-sm text-amber-900">투표 기록이 없습니다.</p>}
      <p className="mt-2 text-sm font-semibold text-amber-950">최다 득표: {Object.keys(voteCounts).length ? Object.entries(voteCounts).filter(([, count]) => count === Math.max(...Object.values(voteCounts))).map(([id, count]) => `${nameOf(id)} ${count}표`).join(' · ') : '없음'}</p>
    </section>

    <section className="mt-5">
      <h3 className="font-bold text-slate-900">기타 게임 기록</h3>
      {state.publicEvents.length ? <ol className="mt-2 space-y-1 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{state.publicEvents.map((event, index) => <li key={`${index}-${event}`}>{index + 1}. {event}</li>)}</ol> : <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">기록이 없습니다.</p>}
      {state.config.plot && <><h4 className="mt-4 text-sm font-semibold text-slate-800">종료 시점 플롯 카드</h4><div className="mt-2 flex flex-wrap gap-1.5">{state.players.map((player) => <span key={player.id} className="rounded-lg bg-slate-50 px-2 py-1 text-xs text-slate-600">{player.name}: {(state.plotHands[player.id] ?? []).map((card) => card.replaceAll('_', ' ')).join(', ') || '없음'}</span>)}</div></>}
    </section>
  </>;
}

export default function GameDetailModal({ game, onClose }: { game: AvalonGameRecord; onClose: () => void }) {
  const [state, setState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void getAvalonGameDetail(game.gameId, game.roomId).then((result) => {
      if (!active) return;
      if (result.ok) setState(result.data.state);
      else setError(result.error);
      setLoading(false);
    }).catch(() => {
      if (active) { setError('경기 상세를 불러오지 못했습니다.'); setLoading(false); }
    });
    return () => { active = false; };
  }, [game.gameId, game.roomId]);

  const winner = game.players.find((player) => player.won)?.side;
  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/65 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="avalon-game-detail-title" className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6"><div><h2 id="avalon-game-detail-title" className="text-xl font-bold text-slate-900">경기 자세히</h2><p className="mt-1 text-sm text-slate-500">{dateText(game.completedAt)}</p></div><button type="button" onClick={onClose} aria-label="경기 상세 닫기" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button></header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        {loading ? <p className="py-12 text-center text-sm text-slate-500">상세 기록을 불러오는 중...</p> : error ? <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p> : state ? <GameStateDetail state={state} /> : <>
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">이 경기의 상세 상태를 방에서 찾을 수 없어, 참가자와 승패 및 투표 집계만 표시합니다.</p>
          <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm font-semibold text-violet-900">{winner === 'good' ? '선 진영 승리' : winner === 'evil' ? '악 진영 승리' : '승패 기록 없음'}</div>
          <h3 className="mt-5 font-bold">참가자와 결과</h3><div className="mt-2 grid gap-2 sm:grid-cols-2">{game.players.map((player) => <div key={player.playerId} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 p-3"><span>{player.playerName} · {player.side === 'good' ? '선' : '악'}</span><span className="text-sm font-semibold">{player.won ? '승리' : '패배'} · 베스트 {player.bestPlayerVotes}표</span></div>)}</div>
        </>}
      </div>
      <footer className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6"><button type="button" onClick={onClose} className="rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white">닫기</button></footer>
    </section>
  </div>;
}
