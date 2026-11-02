'use client';

import Link from 'next/link';
import Image from 'next/image';
import { startTransition, useEffect, useState } from 'react';
import { ArrowLeft, Crown, Eye, EyeOff, Shield, Swords } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { createAvalonRoom, getAvalonRoom, getMyAvalonRoom, joinAvalonRoom, leaveAvalonRoom, listAvalonRooms, moveAvalonRoom } from './actions';
import type { AvalonRoomSummary } from './actions';
import { defaultConfig, GOOD_COUNTS, ROLES, TEAM_COUNTS, type Card, type Config, type Phase, type PlotCard, type Role } from './rules';
import { initialState, publicView, type AvalonView, type Move } from './engine';
import { useLocalNotes } from './useLocalNotes';

type View = AvalonView;
type User = { id: string; name: string };
const cardName: Record<Card, string> = { success: '성공', fail: '실패', magic: '마법', good_message: '선 전령', evil_message: '악 전령', good_rogue: '선 도적', evil_rogue: '악 도적' };
const plotName: Record<PlotCard, string> = { are_you_the_one: 'Are You the One?', charge: 'Charge!', show_your_strength: 'Show Your Strength', show_your_true_nature: 'Show Your True Nature', king_returns: 'The King Returns', ambush: 'Ambush', lead_to_victory: 'Lead to Victory', we_found_you: 'We Found You!', restore_your_honor: 'Restore Your Honor' };
const field = 'rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900 outline-none focus:border-violet-500';
const primary = 'rounded-xl bg-violet-700 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40';
const secondary = 'rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-800 disabled:opacity-40';
const previewUser: User = { id: 'preview-user', name: '나 (예시)' };
const previewPhases: { phase: Phase; label: string }[] = [
  { phase: 'propose', label: '팀 제안' }, { phase: 'vote', label: '팀 투표' },
  { phase: 'quest', label: '원정 카드' }, { phase: 'lady', label: '호수의 여인' },
  { phase: 'finished', label: '게임 결과' },
];

function previewView(phase: Phase): View {
  const state = initialState(previewUser);
  state.players = [
    { id: previewUser.id, name: previewUser.name, seat: 0, roles: ['merlin'], side: 'good', currentSide: 'good', ready: true, seen: true },
    { id: 'preview-1', name: '참가자 2', seat: 1, roles: ['good_lancelot'], side: 'good', currentSide: 'evil', ready: true, seen: true },
    { id: 'preview-2', name: '참가자 3', seat: 2, roles: [], side: 'good', currentSide: 'good', ready: true, seen: true },
    { id: 'preview-3', name: '참가자 4', seat: 3, roles: ['assassin'], side: 'evil', currentSide: 'evil', ready: true, seen: true },
    { id: 'preview-4', name: '참가자 5', seat: 4, roles: ['evil_lancelot'], side: 'evil', currentSide: 'good', ready: true, seen: true },
  ];
  state.config = { ...defaultConfig(), lady: true, lancelot: 'variant1', goodSlots: [['merlin'], ['good_lancelot']], evilSlots: [['assassin'], ['evil_lancelot']] };
  state.phase = phase;
  state.mission = 3;
  state.results = [
    { number: 1, team: [previewUser.id, 'preview-2'], success: true, cards: ['success', 'success'], failCount: 0, vote: {} },
    { number: 2, team: ['preview-1', 'preview-3', 'preview-4'], success: false, cards: ['success', 'fail', 'success'], failCount: 1, vote: {} },
  ];
  state.voteHistory = [{ mission: 2, team: ['preview-1', 'preview-3', 'preview-4'], votes: { [previewUser.id]: true, 'preview-1': false, 'preview-2': true, 'preview-3': false, 'preview-4': true }, approved: true }];
  if (phase === 'quest') state.voteHistory.push({ mission: 3, team: [previewUser.id, 'preview-2'], votes: { [previewUser.id]: true, 'preview-1': true, 'preview-2': true, 'preview-3': false, 'preview-4': false }, approved: true });
  state.lancelotCards = [true, false, false, false, false, false, true];
  state.lancelotApplied = [2];
  state.publicEvents = ['1차 원정 성공', '2차 원정 실패', '2차 원정 후 랜슬롯 충성심 카드: 진영 전환'];
  state.ladyHolder = previewUser.id;
  state.proposal = [previewUser.id, 'preview-2'];
  if (phase === 'propose') state.proposal = [];
  if (phase === 'finished') { state.winner = 'good'; state.winReason = '멀린 암살 실패'; }
  return publicView(state, previewUser.id);
}

export default function AvalonMain({ user, preview = false }: { user: User; preview?: boolean }) {
  const [roomId, setRoomId] = useState(preview ? 'preview' : '');
  const [rooms, setRooms] = useState<AvalonRoomSummary[]>([]);
  const [view, setView] = useState<View | null>(() => preview ? previewView('propose') : null);
  const [config, setConfig] = useState<Config | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [team, setTeam] = useState<string[]>([]);
  const [missionChoice, setMissionChoice] = useState(1);
  const [swordHolder, setSwordHolder] = useState('');
  const [watchHolder, setWatchHolder] = useState('');
  const [target, setTarget] = useState('');
  const [secondTarget, setSecondTarget] = useState('');
  const [assassinationKind, setAssassinationKind] = useState<'merlin' | 'messengers'>('merlin');
  const [plotCardChoice, setPlotCardChoice] = useState<PlotCard | ''>('');
  const { notes, updateNote, ready: notesReady } = useLocalNotes(roomId, view?.phase);
  const [showSecret, setShowSecret] = useState(false);

  async function create() {
    setBusy(true); setError('');
    const result = await createAvalonRoom();
    if (result.ok) {
      setShowSecret(false);
      setRoomId(result.data.id);
      const room = await getAvalonRoom(result.data.id);
      if (room.ok) { setView(room.data.view); setConfig(room.data.view.config); }
    } else setError(result.error);
    setBusy(false);
  }
  async function join(id: string) {
    setBusy(true); setError('');
    const result = await joinAvalonRoom(id);
    if (result.ok) { setShowSecret(false); setRoomId(result.data.id); setView(result.data.view); setConfig(result.data.view.config); }
    else setError(result.error);
    setBusy(false);
  }
  async function send(move: Move) {
    if (preview) { setError('미리보기에서는 행동이 저장되지 않습니다. 위에서 다른 화면을 선택해 보세요.'); return; }
    if (!roomId || busy) return;
    setBusy(true); setError('');
    const result = await moveAvalonRoom(roomId, move);
    if (result.ok) { setView(result.data.view); if (move.type === 'config') setConfig(result.data.view.config); }
    else setError(result.error);
    setBusy(false);
  }

  useEffect(() => {
    if (preview) return;
    startTransition(() => {
      void getMyAvalonRoom().then((result) => { if (result.ok && result.data) { setRoomId(result.data.id); setView(result.data.view); setConfig(result.data.view.config); } });
      void listAvalonRooms().then((result) => { if (result.ok) setRooms(result.data); });
    });
  }, [preview]);

  useEffect(() => {
    if (preview) return;
    const supabase = createClient();
    let active = true;
    const refresh = () => {
      startTransition(() => {
        void listAvalonRooms().then((result) => { if (active && result.ok) setRooms(result.data); });
        if (roomId) void getAvalonRoom(roomId).then((result) => { if (active && result.ok && !busy) setView(result.data.view); });
      });
    };
    const channel = supabase.channel('avalon-room-signals').on('postgres_changes', { event: '*', schema: 'public', table: 'avalon_room_signals' }, refresh).subscribe();
    const timer = setInterval(refresh, 30000);
    return () => { active = false; clearInterval(timer); void supabase.removeChannel(channel); };
  }, [roomId, busy, preview]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (view?.phase === 'propose') { setTeam([]); setSwordHolder(''); setWatchHolder(''); setMissionChoice(view.mission); }
      setTarget(''); setSecondTarget('');
    }, 0);
    return () => clearTimeout(timer);
  }, [view?.phase, view?.mission]);

  const me = view?.players.find((p) => p.id === user.id);
  const leader = view?.players.find((p) => p.seat === view.leaderSeat);
  const isHost = view?.hostId === user.id;
  const required = view ? TEAM_COUNTS[view.players.length]?.[missionChoice - 1] + Number(view.config.trapper) : 0;
  const selectedRoles = view?.myRole.map((r) => ROLES[r].name).join(' · ');
  const latestVote = view?.voteHistory.at(-1);
  const showingCurrentVote = view && ['plot_king', 'plot_forced', 'plot_ambush', 'quest', 'excalibur', 'trapper'].includes(view.phase);
  const boardVotes = view?.phase === 'vote' ? view.earlyVotes : showingCurrentVote && latestVote?.approved && latestVote.mission === view.mission ? latestVote.votes : {};
  const boardTeam = view?.phase === 'propose' && me?.seat === view.leaderSeat ? team : view?.proposal ?? [];
  const canPickTeam = view?.phase === 'propose' && me?.seat === view.leaderSeat;

  return <main className="min-h-screen bg-slate-100 px-4 py-5 text-slate-900 sm:px-6 sm:py-8">
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600"><ArrowLeft size={17} /> 대시보드</Link>
        <span className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-sm font-semibold text-violet-800"><Shield size={15} /> 레지스탕스: 아발론</span>
      </header>
      {preview && <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><p className="font-bold">플레이 화면 미리보기</p><p className="mt-1">가상 참가자와 예시 결과를 사용합니다. 실제 방에 연결되거나 행동이 저장되지 않습니다.</p><label className="mt-3 block font-medium">확인할 화면 <select className={`${field} mt-1 w-full`} value={view?.phase ?? 'propose'} onChange={(e) => { setError(''); setView(previewView(e.target.value as Phase)); }}>{previewPhases.map(({ phase, label }) => <option key={phase} value={phase}>{label}</option>)}</select></label></section>}
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {!view ? <section className="rounded-2xl bg-white p-5 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold">아발론 게임</h1>
        <p className="mt-2 text-sm text-slate-600">5~10명이 각자 휴대전화로 역할을 확인하고 투표합니다. 토론은 대면 또는 별도 메신저에서 진행하세요.</p>
        <button className={`${primary} mt-6 w-full`} disabled={busy} onClick={create}>새 방 만들기</button>
        <h2 className="mt-7 font-bold">열려 있는 방</h2>
        <div className="mt-3 space-y-2">{rooms.length ? rooms.map((room) => <div key={room.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{room.hostName}님의 방 · {room.players.length}/{room.capacity}명</p><p className="mt-1 text-sm text-slate-500">{room.players.join(', ')} · {room.phase === 'lobby' ? '대기 중' : '진행 중'}</p></div><button className={secondary} disabled={busy || room.phase !== 'lobby' || room.players.length >= room.capacity} onClick={() => void join(room.id)}>{room.phase === 'lobby' ? '입장' : '진행 중'}</button></div>) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">열려 있는 방이 없습니다.</p>}</div>
      </section> : <>
        <div className={view.phase === 'lobby' ? '' : 'grid items-stretch gap-5 md:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]'}>
        <section className="flex min-w-0 flex-col rounded-2xl bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-widest text-violet-600">{view.players.find((p) => p.id === view.hostId)?.name}님의 방</p><h1 className="mt-1 text-2xl font-bold">{view.phase === 'lobby' ? '대기실' : view.phase === 'finished' ? '게임 종료' : `${view.mission}차 원정`}</h1></div>
            {view.phase !== 'lobby' && <div className="text-right text-sm"><div><Crown className="inline size-4 text-amber-500" /> 리더: {leader?.name}</div><div className="text-slate-500">부결 {view.rejected}/5</div></div>}
          </div>
          {view.phase !== 'lobby' && <div className="mt-auto grid grid-cols-5 gap-1.5 pt-4">{Array.from({ length: 5 }, (_, i) => {
            const result = view.results.find((r) => r.number === i + 1);
            const current = view.phase !== 'finished' && view.mission === i + 1;
            const teamSize = TEAM_COUNTS[view.players.length][i] + Number(view.config.trapper);
            const status = result ? result.success ? '성공' : '실패' : current ? '진행 중' : '대기';
            return <div key={i} aria-label={`${i + 1}차 원정 · 원정대 ${teamSize}명 · ${status}`} className={`relative flex min-h-20 flex-col items-center justify-start rounded-lg px-1 py-2 text-center text-xs font-bold ${result ? result.success ? 'bg-sky-100 text-sky-800' : 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-500'}`}>
              <span className="text-lg leading-none">{teamSize}<span className="ml-0.5 text-xs">명</span></span>
              <span>{status}</span>
              {current && <Image src="/avalon/tokens/progress.png" alt="현재 원정" width={28} height={28} className="absolute bottom-1 right-1 size-7 object-contain" />}
            </div>;
          })}</div>}
        </section>
        {view.phase !== 'lobby' && <section className="flex min-w-0 flex-col rounded-2xl bg-white p-2 shadow-sm sm:p-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="flex min-w-0 items-center gap-2 font-bold">{showSecret ? <Eye size={18} className="shrink-0" /> : <EyeOff size={18} className="shrink-0" />} 내 정보</h2><button type="button" aria-expanded={showSecret} onClick={() => setShowSecret((visible) => !visible)} className="shrink-0 rounded-lg border border-violet-200 px-3 py-2 text-sm font-medium text-violet-800">{showSecret ? '가리기' : '보기'}</button></div>
          {showSecret && <div id="avalon-secret" className="mt-3 min-w-0 flex-1 rounded-xl bg-violet-50 p-2 text-sm text-violet-900 md:mb-3 [overflow-wrap:anywhere]">
            <p className="font-bold text-violet-950">{selectedRoles || (view.mySide === 'good' ? '충신' : '하수인')} · {view.mySide === 'good' ? '선' : '악'} 진영</p>
            {view.myKnowledge.map((row, i) => <div key={i} className="mt-3"><p className="font-semibold">{row.label}</p><div className="mt-1 flex flex-wrap gap-1.5">{(row.players.length ? row.players : ['없음']).map((name, index) => <span key={`${name}-${index}`} className="max-w-full rounded-lg border border-violet-200 bg-white px-2 py-1 text-xs font-medium whitespace-normal [overflow-wrap:anywhere]">{name}</span>)}</div></div>)}
            {view.myFindings.map((finding, i) => <p key={i} className="mt-3">진영 조사: {view.players.find((p) => p.id === finding.target)?.name} → {finding.side === 'good' ? '선' : '악'}</p>)}
            {view.myCardPeeks.map((peek, i) => <p key={i} className="mt-3">확인한 카드: {view.players.find((p) => p.id === peek.target)?.name} → {cardName[peek.card]}</p>)}
          </div>}
        </section>}
        </div>

        {view.phase === 'lobby' ? <>
          <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
            <h2 className="font-bold">참가자 {view.players.length}/{view.config.playerCount}</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">{view.players.map((p) => <div key={p.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm"><span>{p.seat + 1}. {p.name} {p.id === view.hostId ? '👑' : ''}</span><span className={p.ready ? 'text-emerald-600' : 'text-slate-400'}>{p.ready ? '준비됨' : '대기'}</span></div>)}</div>
            <div className="mt-4 flex flex-wrap gap-2"><button className={secondary} disabled={busy} onClick={() => void send({ type: 'ready', ready: !me?.ready })}>{me?.ready ? '준비 취소' : '준비 완료'}</button><button className={secondary} disabled={busy} onClick={async () => { const result = await leaveAvalonRoom(roomId); if (result.ok) { setRoomId(''); setView(null); const list = await listAvalonRooms(); if (list.ok) setRooms(list.data); } else setError(result.error); }}>방 나가기</button>{isHost && <button className={primary} disabled={busy || view.players.length !== view.config.playerCount || view.players.some((p) => !p.ready)} onClick={() => void send({ type: 'start' })}>게임 시작</button>}</div>
          </section>
          {isHost && config && <ConfigEditor config={config} setConfig={setConfig} busy={busy} save={() => void send({ type: 'config', config })} />}
        </> : <>
          <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
            <h2 className="font-bold">참가자와 원정 팀</h2>
            {canPickTeam && <p className="mt-1 text-sm text-slate-600">이름을 눌러 원정 팀원 {required}명을 선택하세요. {team.length}/{required}명 선택</p>}
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">{view.players.map((p) => {
              const selected = boardTeam.includes(p.id);
              const vote = boardVotes[p.id];
              return <div key={p.id} className={`relative min-w-0 rounded-xl border p-2.5 text-center text-sm ${selected ? 'border-amber-500 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
                {p.seat === view.leaderSeat && <Image src="/avalon/tokens/leader.png" alt="리더 토큰" width={34} height={34} className="absolute left-2 top-2 size-8 object-contain" />}
                {p.id === view.ladyHolder && <Image src="/avalon/tokens/lady.png" alt="호수의 여인 토큰" width={28} height={34} className="absolute right-2 top-2 h-8 w-7 rounded object-cover" />}
                <button type="button" disabled={!canPickTeam || busy} aria-pressed={canPickTeam ? selected : undefined} onClick={() => setTeam(selected ? team.filter((id) => id !== p.id) : team.length < required ? [...team, p.id] : team)} className="w-full rounded-lg p-1 focus-visible:outline-2 focus-visible:outline-violet-600 disabled:cursor-default">
                  <span className="flex h-12 items-center justify-center" aria-hidden="true">{selected && <Image src="/avalon/tokens/quest-team.png" alt="" width={48} height={48} className="size-12 object-contain" />}</span>
                  <span className={`relative mt-1 inline-block max-w-full align-middle`}>
                    <span className="block truncate font-semibold">{p.name}</span>
                    {vote !== undefined &&
                      <span role="img" aria-label={vote ? '찬성 투표' : '반대 투표'}
                        className={`absolute -right-9 top-1/2 size-7 -translate-y-1/2 rounded-full border border-slate-700 
                          ${vote ? 'bg-white' : 'bg-slate-900'}`} />}
                  </span>
                  <span className="block h-5 text-xs text-slate-500">{p.seat === view.leaderSeat ? '리더' : selected ? '원정 팀' : '\u00a0'}</span>
                </button>
                <label className="mt-2 block text-left text-xs text-slate-600">개인 메모<textarea value={notes[p.name] ?? ''} onChange={(e) => updateNote(p.name, e.target.value)} disabled={!notesReady} maxLength={500} rows={2} placeholder="나만 볼 수 있어요" className="mt-1 w-full resize-y rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-900 outline-none focus:border-violet-500" /></label>
              </div>;
            })}</div>
            {view.phase === 'propose' && <div className="mt-4 border-t border-slate-200 pt-4">{canPickTeam ? <>
              {view.config.targeting && <label className="block text-sm">원정 선택 <select className={`${field} ml-2`} value={missionChoice} onChange={(e) => { setMissionChoice(Number(e.target.value)); setTeam([]); }}>{[1, 2, 3, 4, 5].filter((n) => !view.results.some((r) => r.number === n) && (n !== 5 || view.results.filter((r) => r.success).length >= 2)).map((n) => <option key={n} value={n}>{n}차</option>)}</select></label>}
              {view.config.excalibur && <label className="mt-3 block text-sm">엑스칼리버 소유자<select className={`${field} mt-1 w-full`} value={swordHolder} onChange={(e) => setSwordHolder(e.target.value)}><option value="">리더가 아닌 팀원</option>{view.players.filter((p) => team.includes(p.id) && p.id !== user.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
              {view.config.goodSlots.concat(view.config.evilSlots).some((slot) => slot.includes('good_rogue') || slot.includes('evil_rogue')) && (view.players.length >= 7 || missionChoice > 2) && <label className="mt-3 block text-sm">도적 감시 대상<select className={`${field} mt-1 w-full`} value={watchHolder} onChange={(e) => setWatchHolder(e.target.value)}><option value="">감시할 팀원</option>{view.players.filter((p) => team.includes(p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
              <button className={`${primary} mt-4 w-full`} disabled={busy || team.length !== required || (view.config.excalibur && !swordHolder) || (view.config.goodSlots.concat(view.config.evilSlots).some((slot) => slot.includes('good_rogue') || slot.includes('evil_rogue')) && (view.players.length >= 7 || missionChoice > 2) && !watchHolder)} onClick={() => void send({ type: 'propose', team, mission: missionChoice, excaliburHolder: swordHolder, rogueWatchHolder: watchHolder })}>팀 제안하기</button>
            </> : <p className="text-sm text-slate-600">리더가 원정 팀을 고르고 있습니다.</p>}</div>}
          </section>
          {view.phase !== 'propose' && <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6"><PhaseControls view={view} user={user} busy={busy} send={send} target={target} setTarget={setTarget} secondTarget={secondTarget} setSecondTarget={setSecondTarget} assassinationKind={assassinationKind} setAssassinationKind={setAssassinationKind} plotCardChoice={plotCardChoice} setPlotCardChoice={setPlotCardChoice} /></section>}
          {view.phase === 'finished' && !preview && <button className={`${secondary} w-full`} onClick={async () => { setRoomId(''); setView(null); const result = await listAvalonRooms(); if (result.ok) setRooms(result.data); }}>열린 방 목록으로</button>}
          {view.phase === 'finished' && view.voteHistory.length > 0 && <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6"><h2 className="font-bold">공개 팀 투표</h2><div className="mt-2 max-h-56 space-y-2 overflow-y-auto text-sm">{view.voteHistory.slice().reverse().map((item, i) => <div key={i} className="rounded-lg bg-slate-50 p-2"><p className="font-semibold">{item.mission}차 · {item.approved ? '승인' : '부결'}</p><div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-5">{view.players.map((p) => <span key={p.id} className="relative min-w-0 rounded-lg bg-white px-2 py-1 pr-7"><span className="block truncate">{p.name}</span><span role="img" aria-label={item.votes[p.id] ? '찬성 투표' : '반대 투표'} className={`absolute right-2 top-1/2 size-4 -translate-y-1/2 rounded-full border border-slate-700 ${item.votes[p.id] ? 'bg-white' : 'bg-slate-900'}`} /></span>)}</div></div>)}</div></section>}
          {view.config.plot && <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6"><h2 className="font-bold">공개 플롯 카드</h2><div className="mt-2 space-y-1 text-sm text-slate-600">{view.players.map((p) => <div key={p.id}>{p.name}: {(view.plotHands[p.id] ?? []).map((card) => plotName[card]).join(', ') || '없음'}</div>)}</div></section>}
          {view.publicEvents.length > 0 && <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6"><h2 className="font-bold">진행 기록</h2><ol className="mt-2 space-y-1 text-sm text-slate-600">{view.publicEvents.slice(-12).map((event, i) => <li key={i}>• {event}</li>)}</ol></section>}
        </>}
      </>}
    </div>
  </main>;
}

export function AvalonPreview() {
  return <AvalonMain user={previewUser} preview />;
}

function ConfigEditor({ config, setConfig, save, busy }: { config: Config; setConfig: (c: Config) => void; save: () => void; busy: boolean }) {
  const setCount = (count: number) => setConfig({ ...defaultConfig(count), expansion: config.expansion });
  const setExpansion = (enabled: boolean) => {
    if (enabled) { setConfig({ ...config, expansion: true }); return; }
    setConfig({ ...config, expansion: false,
      goodSlots: config.goodSlots.map((slot) => { const base = slot.filter((r) => !ROLES[r].expansion); return base.length ? base : []; }),
      evilSlots: config.evilSlots.map((slot) => slot.filter((r) => !ROLES[r].expansion)),
      trapper: false, excalibur: false, plot: false, seniorKnowsJunior: false,
    });
  };
  const toggleRole = (side: 'good' | 'evil', index: number, role: Role) => {
    const slots = (side === 'good' ? config.goodSlots : config.evilSlots).map((s) => [...s]);
    slots[index] = slots[index].includes(role) ? slots[index].filter((r) => r !== role) : [...slots[index], role];
    setConfig({ ...config, [side === 'good' ? 'goodSlots' : 'evilSlots']: slots });
  };
  return <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
    <h2 className="text-lg font-bold">방 설정</h2><p className="mt-1 text-sm text-slate-500">직업은 자리별로 배치한 뒤 참가자에게 무작위로 배정됩니다. 멀린만 다른 직업을 겸할 수 없습니다.</p>
    <div className="mt-4 flex flex-wrap items-center gap-3"><label className="text-sm font-medium">인원 <select className={field} value={config.playerCount} onChange={(e) => setCount(Number(e.target.value))}>{[5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n}명</option>)}</select></label><label className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 font-semibold text-amber-900"><input type="checkbox" checked={config.expansion} onChange={(e) => setExpansion(e.target.checked)} /> 확장</label></div>
    {(['good', 'evil'] as const).map((side) => <div key={side} className="mt-5"><h3 className="font-bold">{side === 'good' ? '선' : '악'} 진영 {side === 'good' ? GOOD_COUNTS[config.playerCount] : config.playerCount - GOOD_COUNTS[config.playerCount]}자리</h3><div className="mt-2 space-y-3">{(side === 'good' ? config.goodSlots : config.evilSlots).map((slot, i) =>
      {
        return <div key={i} className="rounded-xl border border-slate-200 p-3">
        <p className="mb-2 text-sm font-semibold">
          {i + 1}번 자리 · {slot.length > 0 ? slot.map((r) => ROLES[r].name).join(' + ') : side === 'good' ? '충신' : '하수인'}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(ROLES) as Role[]).filter((role) =>ROLES[role].side === side && (config.expansion || !ROLES[role].expansion))
            .map((role) =>
              <button key={role} type="button" onClick={() => toggleRole(side, i, role)} className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium ${slot.includes(role) ? 'border-violet-600 bg-violet-100 text-violet-900' : 'border-slate-200 text-slate-600'}`}>
                {ROLES[role].name}
              </button>)}
        </div>
      </div>
    })}</div></div>)}
    <div className="mt-5 grid gap-2 sm:grid-cols-2">{([['lady', '호수의 여인'], ['targeting', '목표 원정 선택'], ['trapper', '함정꾼'], ['excalibur', '엑스칼리버'], ['plot', '플롯 카드'], ['seniorKnowsJunior', '상급 전령의 정보']] as const).filter(([key]) => config.expansion || !['trapper', 'excalibur', 'plot', 'seniorKnowsJunior'].includes(key)).map(([key, label]) => <label key={key} className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm"><input type="checkbox" checked={config[key]} onChange={(e) => setConfig({ ...config, [key]: e.target.checked })} /> {label}</label>)}</div>
    <label className="mt-4 block text-sm font-medium">랜슬롯 원정 카드 규칙 <select className={`${field} mt-1 block w-full`} value={config.lancelot} onChange={(e) => setConfig({ ...config, lancelot: e.target.value as Config['lancelot'] })}><option value="off">사용 안 함</option><option value="variant1">변형 1: 현재 악은 성공/실패 선택</option><option value="variant2">변형 2: 현재 악은 실패만 제출</option></select></label>
    {config.lancelot !== 'off' && <p className="mt-2 text-xs text-slate-600">두 변형 모두 2·3·4차 원정 뒤, 호수의 여인 확인 후 충성심 카드를 뽑습니다. 7장 중 전환 2장입니다.</p>}
    <button className={`${primary} mt-5 w-full`} disabled={busy} onClick={save}>설정 저장</button>
  </section>;
}

function PhaseControls({ view, user, busy, send, target, setTarget, secondTarget, setSecondTarget, assassinationKind, setAssassinationKind, plotCardChoice, setPlotCardChoice }: {
  view: View; user: User; busy: boolean; send: (move: Move) => Promise<void>;
  target: string; setTarget: (id: string) => void; secondTarget: string; setSecondTarget: (id: string) => void;
  assassinationKind: 'merlin' | 'messengers'; setAssassinationKind: (kind: 'merlin' | 'messengers') => void;
  plotCardChoice: PlotCard | ''; setPlotCardChoice: (card: PlotCard | '') => void;
}) {
  const me = view.players.find((p) => p.id === user.id);
  const isLeader = me?.seat === view.leaderSeat;
  const candidates = view.players.filter((p) => p.id !== user.id);
  const select = (items: typeof candidates, value: string, set: (id: string) => void, placeholder = '대상 선택') => <select className={`${field} w-full`} value={value} onChange={(e) => set(e.target.value)}><option value="">{placeholder}</option>{items.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>;

  if (view.phase === 'reveal') return <><h2 className="font-bold">역할 확인</h2><p className="mt-2 text-sm text-slate-600">개인 정보를 확인한 뒤 준비해 주세요. {view.players.filter((p) => p.seen).length}/{view.players.length}명 확인</p><button className={`${primary} mt-4 w-full`} disabled={busy || me?.seen} onClick={() => void send({ type: 'seen' })}>{me?.seen ? '확인 완료' : '역할 확인 완료'}</button></>;
  if (view.phase === 'loyalty_check') return <><h2 className="font-bold">진영 조사 응답</h2>{view.pendingCheck?.target === user.id ? <><p className="mt-2 text-sm text-slate-600">사기꾼은 조사 결과를 선 또는 악으로 선택할 수 있습니다. 실제 진영은 바뀌지 않습니다.</p><div className="mt-4 grid grid-cols-2 gap-2"><button className={primary} disabled={busy} onClick={() => void send({ type: 'loyalty_reply', side: 'good' })}>선으로 응답</button><button className={secondary} disabled={busy} onClick={() => void send({ type: 'loyalty_reply', side: 'evil' })}>악으로 응답</button></div></> : <p className="mt-2 text-sm text-slate-600">진영 조사 응답을 기다립니다.</p>}</>;
  if (view.phase === 'plot_lead') return <><h2 className="font-bold">Lead to Victory</h2>{view.plotOpportunity[0] === user.id ? <div className="mt-3 flex gap-2"><button className={primary} disabled={busy} onClick={() => void send({ type: 'plot_use', card: 'lead_to_victory', target: 'use' })}>리더가 되기</button><button className={secondary} disabled={busy} onClick={() => void send({ type: 'plot_use', card: 'lead_to_victory' })}>넘기기</button></div> : <p className="mt-2 text-sm text-slate-600">카드 보유자의 결정을 기다립니다.</p>}</>;
  if (view.phase === 'plot_distribute') return <><h2 className="font-bold">플롯 카드 배분</h2><p className="mt-2 text-sm text-slate-600">다음 카드: {plotName[view.plotDrawn[0]]}</p>{isLeader ? <><div className="mt-3">{select(candidates, target, setTarget, '카드를 받을 사람')}</div><button className={`${primary} mt-3 w-full`} disabled={busy || !target} onClick={() => void send({ type: 'plot_give', holder: target })}>카드 전달</button></> : <p className="mt-3 text-sm text-slate-600">리더가 카드를 배분하고 있습니다.</p>}</>;
  if (view.phase === 'plot_immediate') {
    const pending = view.plotPending;
    if (!pending) return null;
    const acting = pending.card === 'show_your_strength' ? isLeader : pending.holder === user.id;
    const otherHands = target ? view.plotHands[target] ?? [] : [];
    return <><h2 className="font-bold">{plotName[pending.card]}</h2>{acting ? <><p className="mt-2 text-sm text-slate-600">{pending.card === 'restore_your_honor' ? '다른 사람의 플롯 카드를 가져옵니다.' : '진영을 확인하거나 보여줄 대상을 선택합니다.'}</p><div className="mt-3">{select(view.players.filter((p) => pending.card === 'are_you_the_one' ? p.id !== user.id && Math.min(Math.abs(p.seat - me!.seat), view.players.length - Math.abs(p.seat - me!.seat)) === 1 : p.id !== user.id), target, setTarget)}</div>{pending.card === 'restore_your_honor' && <select className={`${field} mt-2 w-full`} value={plotCardChoice} onChange={(e) => setPlotCardChoice(e.target.value as PlotCard)}><option value="">가져올 카드</option>{otherHands.map((card, i) => <option key={`${card}-${i}`} value={card}>{plotName[card]}</option>)}</select>}<button className={`${primary} mt-3 w-full`} disabled={busy || !target || (pending.card === 'restore_your_honor' && !plotCardChoice)} onClick={() => void send({ type: 'plot_apply', target, card: plotCardChoice || undefined })}>효과 적용</button></> : <p className="mt-2 text-sm text-slate-600">카드 효과 처리를 기다립니다.</p>}</>;
  }
  if (['plot_king', 'plot_forced', 'plot_ambush'].includes(view.phase)) {
    const card: PlotCard = view.phase === 'plot_king' ? 'king_returns' : view.phase === 'plot_forced' ? 'we_found_you' : 'ambush';
    return <><h2 className="font-bold">{plotName[card]}</h2>{view.plotOpportunity[0] === user.id ? <><p className="mt-2 text-sm text-slate-600">카드를 사용하거나 넘길 수 있습니다.</p>{card !== 'king_returns' && <div className="mt-3">{select(view.players.filter((p) => view.proposal.includes(p.id)), target, setTarget, '원정 팀원 선택')}</div>}<div className="mt-3 flex gap-2"><button className={primary} disabled={busy || (card !== 'king_returns' && !target)} onClick={() => void send({ type: 'plot_use', card, target: card === 'king_returns' ? 'use' : target })}>사용</button><button className={secondary} disabled={busy} onClick={() => void send({ type: 'plot_use', card })}>넘기기</button></div></> : <p className="mt-2 text-sm text-slate-600">카드 보유자의 결정을 기다립니다.</p>}</>;
  }
  if (view.phase === 'vote') return <><h2 className="font-bold">팀 승인 투표</h2><p className="mt-2 text-sm text-slate-600">{view.voteCount}/{view.players.length}명 제출 · 모두 제출하면 투표 내용이 공개됩니다.</p>{!view.voted ? <div className="mt-4 grid grid-cols-2 gap-2"><button className={primary} disabled={busy} onClick={() => void send({ type: 'vote', approve: true })}>찬성</button><button className={secondary} disabled={busy} onClick={() => void send({ type: 'vote', approve: false })}>반대</button></div> : <p className="mt-4 text-sm text-violet-700">투표 완료. 다른 참가자를 기다립니다.</p>}</>;
  if (view.phase === 'quest') return <><h2 className="flex items-center gap-2 font-bold"><Swords size={18} /> 원정 카드</h2><p className="mt-2 text-sm text-slate-600">{view.cardCount}/{view.proposal.length}명 제출 · 제출한 카드는 기본적으로 익명으로 공개됩니다.</p>{view.publicQuestCard && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-800">공개 카드: {view.players.find((p) => p.id === view.forcedPublicCard)?.name} · {cardName[view.publicQuestCard]}</p>}{view.proposal.includes(user.id) ? view.cardSubmitted ? <p className="mt-4 text-violet-700">카드 제출 완료. 다른 팀원을 기다립니다.</p> : <div className="mt-4 grid grid-cols-2 gap-2">{view.myAllowedCards.map((card) => <button key={card} className={card === 'fail' || card === 'evil_message' || card === 'evil_rogue' ? secondary : primary} disabled={busy} onClick={() => void send({ type: 'quest', card })}>{cardName[card]}</button>)}</div> : <p className="mt-4 text-sm text-slate-600">원정 팀의 카드 제출을 기다립니다.</p>}</>;
  if (view.phase === 'excalibur') return <><h2 className="font-bold">엑스칼리버</h2>{view.excaliburHolder === user.id ? <><p className="mt-2 text-sm text-slate-600">다른 팀원의 카드를 바꾸거나 사용하지 않을 수 있습니다.</p><div className="mt-3">{select(view.players.filter((p) => view.proposal.includes(p.id) && p.id !== user.id), target, setTarget)}</div><div className="mt-3 flex gap-2"><button className={primary} disabled={busy || !target} onClick={() => void send({ type: 'excalibur', target })}>카드 바꾸기</button><button className={secondary} disabled={busy} onClick={() => void send({ type: 'excalibur' })}>사용 안 함</button></div></> : <p className="mt-2 text-sm text-slate-600">엑스칼리버 소유자의 선택을 기다립니다.</p>}</>;
  if (view.phase === 'trapper') return <><h2 className="font-bold">함정꾼</h2>{isLeader ? <><p className="mt-2 text-sm text-slate-600">원정 카드 한 장을 확인하고 판정에서 제외합니다.</p><div className="mt-3">{select(view.players.filter((p) => view.proposal.includes(p.id)), target, setTarget)}</div><button className={`${primary} mt-3 w-full`} disabled={busy || !target} onClick={() => void send({ type: 'trapper', target })}>카드 제외</button></> : <p className="mt-2 text-sm text-slate-600">리더의 선택을 기다립니다.</p>}</>;
  if (view.phase === 'lady') return <><h2 className="font-bold">호수의 여인</h2>{view.ladyHolder === user.id ? <><p className="mt-2 text-sm text-slate-600">한 사람의 현재 진영을 비밀리에 확인합니다.</p><div className="mt-3">{select(candidates.filter((p) => !view.ladyUsed.includes(p.id)), target, setTarget)}</div><button className={`${primary} mt-3 w-full`} disabled={busy || !target} onClick={() => void send({ type: 'lady', target })}>진영 확인</button></> : <p className="mt-2 text-sm text-slate-600">호수의 여인 보유자가 조사 중입니다.</p>}</>;
  if (view.phase === 'recruit') return <><h2 className="font-bold">불신의 충신 모집</h2>{view.myRole.includes('assassin') ? <><p className="mt-2 text-sm text-slate-600">암살자가 불신의 충신을 한 번 추측합니다.</p><div className="mt-3">{select(candidates, target, setTarget)}</div><button className={`${primary} mt-3 w-full`} disabled={busy || !target} onClick={() => void send({ type: 'recruit', target })}>모집 시도</button></> : <p className="mt-2 text-sm text-slate-600">암살자의 선택을 기다립니다.</p>}</>;
  if (view.phase === 'assassinate') return <><h2 className="font-bold">마지막 암살</h2>{(view.recruited ? view.recruited === user.id : view.myRole.includes('assassin')) ? <><p className="mt-2 text-sm text-slate-600">멀린 또는 선 전령을 지목합니다. 역할을 알 수 없도록 모든 참가자를 선택할 수 있습니다.</p>{view.config.evilSlots.some((s) => s.includes('evil_messenger')) && <select className={`${field} mt-3 w-full`} value={assassinationKind} onChange={(e) => setAssassinationKind(e.target.value as 'merlin' | 'messengers')}><option value="merlin">멀린 1명</option><option value="messengers">선 전령 2명</option></select>}<div className="mt-3 space-y-2">{select(candidates, target, setTarget)}{assassinationKind === 'messengers' && select(candidates.filter((p) => p.id !== target), secondTarget, setSecondTarget, '두 번째 대상')}</div><button className={`${primary} mt-3 w-full`} disabled={busy || !target || (assassinationKind === 'messengers' && !secondTarget)} onClick={() => void send({ type: 'assassinate', target, targetType: assassinationKind, secondTarget })}>암살 확정</button></> : <p className="mt-2 text-sm text-slate-600">악 진영의 마지막 선택을 기다립니다.</p>}</>;
  if (view.phase === 'finished') return <><h2 className="text-xl font-bold">{view.winner === 'good' ? '선 진영 승리' : '악 진영 승리'}</h2><p className="mt-2 text-sm text-slate-600">{view.winReason}</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{view.players.map((p) => <div key={p.id} className="rounded-lg bg-slate-50 p-3 text-sm">{p.name} · {p.roles.map((r) => ROLES[r].name).join(' + ') || (p.side === 'good' ? '충신' : '하수인')} · {p.side === 'good' ? '선' : '악'}</div>)}</div></>;
  return null;
}
