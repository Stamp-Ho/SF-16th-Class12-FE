'use client';

import Link from 'next/link';
import Image from 'next/image';
import { startTransition, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowLeftRight, BookOpen, Check, Crown, Eye, EyeOff, Shield, ShieldAlert, ShieldHalf, ShieldOff, ShieldQuestionMark, Skull, Sword, Swords, X } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { createAvalonRoom, dissolveAvalonRoom, getAvalonAvatarUrls, getAvalonRoom, getMyAvalonRoom, joinAvalonRoom, leaveAvalonRoom, listAvalonRooms, moveAvalonRoom } from './actions';
import type { AvalonRoomSummary } from './actions';
import { defaultConfig, GOOD_COUNTS, REJECTED_VOTE_REVEAL_MS, ROLES, TEAM_COUNTS, validateConfig, type Card, type Config, type GameState, type Phase, type PlotCard, type Role, type Side } from './rules';
import { applyMove, excaliburReplacementCard, gawainCheckEvent, gawainUnplayedCard, initialState, publicView, type AvalonView, type Move } from './engine';
import { useLocalNotes } from './useLocalNotes';
import { PREVIEW_FALLBACK_IDS, PREVIEW_NAMES } from './previewData';
import RulebookModal, { getPendingAvalonAction } from './RulebookModal';
import LadyIcon from './LadyIcon';
import TeamAssignmentModal from './TeamAssignmentModal';
import HistoryRankingModal from './HistoryRankingModal';

type View = AvalonView;
type User = { id: string; name: string };
function PlayerAvatar({ name, url }: { name: string; url?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return url && failedUrl !== url
    ? <Image src={url} alt={`${name} 프로필`} width={40} height={40} unoptimized onError={() => setFailedUrl(url)} className="size-10 shrink-0 rounded-full bg-slate-200 object-cover" />
    : <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">{name.trim().charAt(0) || '?'}</span>;
}
function GoldSword({ className = 'size-4' }: { className?: string }) {
  const gradientId = useId().replaceAll(':', '');
  return <Sword aria-label="엑스칼리버 보유자" className={className} stroke={`url(#${gradientId})`} strokeWidth={2.5}>
      <defs><linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fff8c5" /><stop offset="28%" stopColor="#e6aa20" /><stop offset="55%" stopColor="#fff1a0" /><stop offset="80%" stopColor="#b87908" /><stop offset="100%" stopColor="#ffe66d" /></linearGradient></defs>
    </Sword>;
}
function ExcaliburSword() {
  return <span className="pointer-events-none absolute left-4.25 top-2 z-10 -rotate-10 drop-shadow-[0_1px_1px_rgba(120,65,0,0.75)]">
    <GoldSword className="size-8" />
  </span>;
}
function limitNoteLineBreaks(value: string) {
  const lines = value.replace(/\r\n?/g, '\n').split('\n');
  const first = Array.from(lines[0]);
  const overflow = first.slice(10);
  const second = Array.from(overflow.join('') + lines.slice(1).join('')).slice(0, 10).join('');
  return first.slice(0, 10).join('') + (lines.length > 1 || overflow.length > 0 ? `\n${second}` : '');
}
function PlayerNote({ name, value, disabled, onChange }: { name: string; value: string; disabled: boolean; onChange: (name: string, value: string) => void }) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (input) input.scrollTop = input.scrollHeight;
  }, [value]);

  return <textarea ref={inputRef} aria-label={`${name} 개인 메모`} value={limitNoteLineBreaks(value)} onChange={(event) => onChange(name, limitNoteLineBreaks(event.currentTarget.value))} disabled={disabled} rows={2} placeholder="메모: 나만 보임" className="h-8.5 w-full resize-none overflow-hidden rounded-lg border border-slate-200 bg-white p-2 pb-0 text-xs text-slate-900 outline-none focus:border-violet-500" />;
}
const cardName: Record<Card, string> = { success: '성공', fail: '실패', magic: '마법', good_message: '선 전령', evil_message: '악 전령', good_rogue: '선 도적', evil_rogue: '악 도적' };
const gawainPeekLabel = (unplayedCard: Card) => `내지 않은 카드: ${cardName[unplayedCard]}`;
function visibleQuestCards(config: Config): Card[] {
  const roles = new Set(config.goodSlots.concat(config.evilSlots).flat());
  const cards: Card[] = ['success', 'fail'];
  if (roles.has('good_messenger_senior') || roles.has('good_messenger_junior')) cards.push('good_message');
  if (roles.has('evil_messenger')) cards.push('evil_message');
  if (roles.has('good_rogue')) cards.push('good_rogue');
  if (roles.has('evil_rogue')) cards.push('evil_rogue');
  return cards;
}
function questCardToSubmit(selected: Card, allowed: Card[]): Card | undefined {
  if (selected === 'fail' && allowed.includes('magic')) return 'magic';
  if (allowed.includes(selected)) return selected;
  return allowed.includes('success') ? 'success' : allowed.includes('fail') ? 'fail' : allowed[0];
}
const plotName: Record<PlotCard, string> = { are_you_the_one: 'Are You the One?', charge: 'Charge!', show_your_strength: 'Show Your Strength', show_your_true_nature: 'Show Your True Nature', king_returns: 'The King Returns', ambush: 'Ambush', lead_to_victory: 'Lead to Victory', we_found_you: 'We Found You!', restore_your_honor: 'Restore Your Honor' };
const field = 'rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900 outline-none focus:border-violet-500';
const primary = 'rounded-xl bg-violet-700 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40';
const secondary = 'rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-800 disabled:opacity-40';
function showGameNotification(title: string, body: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || document.hasFocus()) return;
  try {
    const notification = new Notification(title, { body });
    notification.onclick = () => { window.focus(); notification.close(); };
  } catch {
    // 알림을 지원하지 않는 환경에서도 게임 진행은 계속한다.
  }
}
const previewPeople: User[] = PREVIEW_NAMES.map((name, index) => ({ id: PREVIEW_FALLBACK_IDS[index], name }));
type PreviewScreen = 'reveal' | 'propose' | 'excalibur_assign' | 'vote' | 'reselect_after_rejection' | 'quest' | 'excalibur' | 'gawain_check' | 'lady' | 'assassinate' | 'best_player_vote' | 'finished';
type AssassinationKind = 'merlin' | 'messengers' | 'lovers';
type PreviewAssassination = { target: string; secondTarget?: string; kind: AssassinationKind };
type PreviewExcaliburResult = { target?: string; original?: Card; changed?: Card; success: boolean; failCount: number };
const previewPhases: { screen: PreviewScreen; label: string }[] = [
  { screen: 'reveal', label: '역할 확인' },
  { screen: 'propose', label: '팀 제안' }, { screen: 'vote', label: '팀 투표' }, { screen: 'excalibur_assign', label: '투표 승인 후 엑스칼리버 수여' },
  { screen: 'reselect_after_rejection', label: '부결 투표 후 재선정' },
  { screen: 'quest', label: '원정 카드' }, { screen: 'excalibur', label: '엑스칼리버' }, { screen: 'gawain_check', label: '가웨인 판정' }, { screen: 'lady', label: '호수의 여인' },
  { screen: 'assassinate', label: '암살자 암살 턴' },
  { screen: 'best_player_vote', label: '승패 확정 후 베스트 플레이어 투표' },
  { screen: 'finished', label: '게임 결과' },
];

function RejectionTrack({ rejected, active }: { rejected: number; active: boolean }) {
  return <div role="img" aria-label={`팀 투표 부결 ${rejected}/5회. 5회 부결되면 악 진영 승리`} className="flex items-center gap-1.5 pt-4.5">
    <span aria-hidden="true" className="mr-1 text-sm font-medium text-slate-600">부결</span>
    {Array.from({ length: 5 }, (_, index) => {
      const isFinal = index === 4;
      const isRejected = index < rejected;
      const isCurrent = active && index === rejected;
      const Icon = isRejected ? ShieldOff : isFinal ? ShieldAlert : ShieldQuestionMark;
      const color = isRejected ? 'text-slate-950' : isCurrent ? isFinal ? 'text-red-600' : 'text-orange-500' : isFinal ? 'text-red-600/30' : 'text-slate-400';
      return <Icon key={index} aria-hidden="true" className={`${isFinal ? 'size-6' : 'size-5'} ${color} ${isCurrent ? 'rejection-warning-pulse' : ''}`} />;
    })}
  </div>;
}

function previewState(screen: PreviewScreen, people: User[], rejectedAt: string | null = null): GameState {
  const phase: Phase = screen === 'reselect_after_rejection' ? 'propose' : screen;
  const [self, second, third, fourth, fifth, sixth, seventh, eighth] = people;
  const state = initialState(self);
  state.players = [
    { ...self, seat: 0, roles: ["gawain"], side: 'good', currentSide: 'good', ready: true, seen: true },
    { ...second, seat: 1, roles: ['good_lancelot'], side: 'good', currentSide: 'evil', ready: true, seen: true },
    { ...third, seat: 2, roles: ['isolde'], side: 'good', currentSide: 'good', ready: true, seen: true },
    { ...fourth, seat: 3, roles: ['assassin'], side: 'evil', currentSide: 'evil', ready: true, seen: true },
    { ...fifth, seat: 4, roles: ['evil_lancelot'], side: 'evil', currentSide: 'good', ready: true, seen: true },
    { ...sixth, seat: 5, roles: ['tristan'], side: 'good', currentSide: 'good', ready: true, seen: true },
    { ...seventh, seat: 6, roles: ['mordred'], side: 'evil', currentSide: 'evil', ready: true, seen: true },
    { ...eighth, seat: 7, roles: ['merlin'], side: 'good', currentSide: 'good', ready: true, seen: true }
  ];
  state.config = { ...defaultConfig(8), expansion: true, lady: true, lancelot: 'variant1', goodSlots: [['gawain'], ['good_lancelot'], ['isolde'], ['tristan'], ['merlin']], evilSlots: [['assassin'], ['evil_lancelot'], ['mordred']] };
  if (phase === 'quest') {
    state.players[0].roles = ['good_sorcerer'];
    state.players[3].roles.push('evil_sorcerer');
    state.config.goodSlots[0] = ['good_sorcerer'];
    state.config.evilSlots[0].push('evil_sorcerer');
  }
  if (screen === 'excalibur_assign') state.config.excalibur = true;
  state.phase = phase;
  state.mission = 3;
  const secondVote = { [self.id]: true, [second.id]: false, [third.id]: true, [fourth.id]: false, [fifth.id]: true, [sixth.id]: true, [seventh.id]: false, [eighth.id]: true };
  const thirdVote = { [self.id]: true, [second.id]: true, [third.id]: true, [fourth.id]: false, [fifth.id]: false, [sixth.id]: true, [seventh.id]: false, [eighth.id]: true };
  const rejectedVote = { [self.id]: true, [second.id]: false, [third.id]: true, [fourth.id]: false, [fifth.id]: false, [sixth.id]: true, [seventh.id]: false, [eighth.id]: false };
  const fourthVote = { [self.id]: true, [second.id]: true, [third.id]: true, [fourth.id]: false, [fifth.id]: false, [sixth.id]: true, [seventh.id]: false, [eighth.id]: true };
  const fifthVote = { [self.id]: true, [second.id]: false, [third.id]: true, [fourth.id]: false, [fifth.id]: true, [sixth.id]: true, [seventh.id]: false, [eighth.id]: true };
  const secondTeam = [second.id, fourth.id, fifth.id, seventh.id];
  const thirdTeam = [self.id, second.id, third.id, sixth.id];
  const gawainTeam = [second.id, third.id, fourth.id, sixth.id];
  const fourthTeam = [self.id, second.id, third.id, fourth.id, eighth.id];
  const fifthTeam = [self.id, third.id, fifth.id, sixth.id, eighth.id];
  state.results = [
    { number: 1, team: [self.id, third.id, eighth.id], success: true, cards: ['success', 'success', 'success'], failCount: 0, vote: {}, leaderId: self.id },
    { number: 2, team: secondTeam, success: false, cards: ['success', 'fail', 'success', 'success'], failCount: 1, vote: secondVote, leaderId: second.id },
  ];
  state.voteHistory = [{ mission: 2, team: secondTeam, votes: secondVote, approved: true, leaderId: second.id }];
  if (phase === 'quest' || phase === 'assassinate' || phase === 'best_player_vote' || phase === 'finished') state.voteHistory.push({ mission: 3, team: thirdTeam, votes: thirdVote, approved: true, leaderId: self.id,
    excaliburHolder: phase === 'assassinate' || phase === 'best_player_vote' || phase === 'finished' ? sixth.id : null });
  if (phase === 'gawain_check') {
    state.players[1].roles.push('good_sorcerer');
    state.players[3].roles.push('evil_sorcerer');
    state.config.goodSlots[1].push('good_sorcerer');
    state.config.evilSlots[0].push('evil_sorcerer');
    state.voteHistory.push({ mission: 3, team: gawainTeam, votes: thirdVote, approved: true, leaderId: third.id });
    state.results.push({ number: 3, team: gawainTeam, success: false, cards: ['success', 'success', 'magic', 'success'], failCount: 0, vote: thirdVote, leaderId: third.id });
    state.proposal = gawainTeam;
    state.cards = { [second.id]: 'success', [third.id]: 'success', [fourth.id]: 'magic', [sixth.id]: 'success' };
    state.submittedCards = { ...state.cards };
  }
  if (phase === 'excalibur') {
    state.players[1].roles.push('good_sorcerer');
    state.players[3].roles.push('evil_sorcerer');
    state.config.goodSlots[1].push('good_sorcerer');
    state.config.evilSlots[0].push('evil_sorcerer');
    state.config.excalibur = true;
    state.leaderSeat = 2;
    state.proposal = [self.id, second.id, third.id, fourth.id];
    state.excaliburHolder = self.id;
    state.cards = { [self.id]: 'success', [second.id]: 'magic', [third.id]: 'success', [fourth.id]: 'success' };
    state.submittedCards = { ...state.cards };
    state.votes = thirdVote;
    state.voteHistory.push({ mission: 3, team: [...state.proposal], votes: thirdVote, approved: true, leaderId: third.id, excaliburHolder: self.id });
  }
  if (phase === 'excalibur_assign') {
    state.proposal = thirdTeam;
    state.votes = thirdVote;
    state.voteHistory.push({ mission: 3, team: thirdTeam, votes: thirdVote, approved: true, leaderId: self.id, excaliburHolder: null });
  }
  if (phase === 'reveal') { state.players[1].seen = false; state.players[3].seen = false; }
  if (phase === 'vote') state.votes = { [second.id]: false, [third.id]: true };
  state.lancelotCards = [true, false, false, false, false, false, true];
  state.lancelotApplied = [2];
  state.publicEvents = ['1차 원정 성공', '2차 원정 실패', '2차 원정 후 랜슬롯 충성심 카드: 진영 전환'];
  state.history = [
    { type: 'quest', index: 0 }, { type: 'event', index: 0 },
    { type: 'vote', index: 0 }, { type: 'quest', index: 1 },
    { type: 'event', index: 1 }, { type: 'event', index: 2 },
    ...(phase === 'quest' || phase === 'assassinate' || phase === 'best_player_vote' || phase === 'finished' || phase === 'gawain_check' || phase === 'excalibur' || phase === 'excalibur_assign' ? [{ type: 'vote' as const, index: 1 }] : []),
    ...(phase === 'gawain_check' ? [{ type: 'quest' as const, index: 2 }] : []),
  ];
  state.ladyHolder = self.id;
  state.ladyUsed = [second.id];
  if (phase !== 'gawain_check' && phase !== 'excalibur' && phase !== 'excalibur_assign') state.proposal = thirdTeam;
  if (phase === 'propose') state.proposal = [];
  if (screen === 'reselect_after_rejection') {
    state.leaderSeat = 2;
    state.rejected = 1;
    state.rejectedVoteAt = rejectedAt;
    state.votes = rejectedVote;
    state.voteHistory.push({ mission: 3, team: thirdTeam, votes: rejectedVote, approved: false, leaderId: second.id });
    state.publicEvents.push('3차 팀 투표 부결 (1/5)');
    state.history.push({ type: 'vote', index: 1 }, { type: 'event', index: 3 });
  }
  if (phase === 'assassinate' || phase === 'best_player_vote' || phase === 'finished') {
    state.config.excalibur = true;
    state.voteHistory.push(
      { mission: 4, team: fourthTeam, votes: fourthVote, approved: true, leaderId: third.id },
      { mission: 5, team: fifthTeam, votes: fifthVote, approved: true, leaderId: sixth.id },
    );
    state.results.push(
      { number: 3, team: thirdTeam, success: true, cards: ['success', 'success', 'success', 'success'], failCount: 0, vote: thirdVote, leaderId: self.id, excaliburHolder: sixth.id, excaliburTarget: second.id },
      { number: 4, team: fourthTeam, success: false, cards: ['success', 'fail', 'success', 'fail', 'success'], failCount: 2, vote: fourthVote, leaderId: third.id },
      { number: 5, team: fifthTeam, success: true, cards: ['success', 'success', 'success', 'success', 'success'], failCount: 0, vote: fifthVote, leaderId: sixth.id },
    );
    state.mission = 5;
    state.leaderSeat = 5;
    state.proposal = fifthTeam;
    state.history.push({ type: 'quest', index: 2 }, { type: 'vote', index: 2 }, { type: 'quest', index: 3 }, { type: 'vote', index: 3 }, { type: 'quest', index: 4 });
  }
  if (phase === 'best_player_vote' || phase === 'finished') {
    state.winner = 'good'; state.winReason = '멀린 암살 실패'; state.assassinated = [third.id];
  }
  if (phase === 'best_player_vote') state.bestPlayerVotes = { [second.id]: third.id, [fourth.id]: null };
  return state;
}

function previewView(screen: PreviewScreen, people: User[], actorId = people[0].id, rejectedAt: string | null = null): View {
  return publicView(previewState(screen, people, rejectedAt), actorId);
}

export default function AvalonMain({ user, role = '', preview = false, previewParticipants = previewPeople, previewAvatarUrls = {}, previewAvatarError }: { user: User; role?: string; preview?: boolean; previewParticipants?: User[]; previewAvatarUrls?: Record<string, string>; previewAvatarError?: string }) {
  const [roomId, setRoomId] = useState(preview ? 'preview' : '');
  const [rooms, setRooms] = useState<AvalonRoomSummary[]>([]);
  const [statsOpen, setStatsOpen] = useState(false);
  const configDirty = useRef(false);
  const [previewScreen, setPreviewScreen] = useState<PreviewScreen>('propose');
  const [view, setView] = useState<View | null>(() => preview ? previewView('propose', previewParticipants) : null);
  const [config, setConfig] = useState<Config | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notificationFeedback, setNotificationFeedback] = useState('');
  const previousRoomPhase = useRef<{ roomId: string; phase: Phase } | null>(null);
  const seenActionTurns = useRef(new Set<string>());
  const originalTitle = useRef<string | null>(null);
  const lastAvalonTitle = useRef<string | null>(null);
  const [team, setTeam] = useState<string[]>([]);
  const [missionChoice, setMissionChoice] = useState(1);
  const [watchHolder, setWatchHolder] = useState('');
  const [proposalPick, setProposalPick] = useState<'team' | 'watch'>('team');
  const [target, setTarget] = useState('');
  const [secondTarget, setSecondTarget] = useState('');
  const [assassinationKind, setAssassinationKind] = useState<AssassinationKind>('merlin');
  const [plotCardChoice, setPlotCardChoice] = useState<PlotCard | ''>('');
  const { notes, updateNote, ready: notesReady } = useLocalNotes(roomId, view?.phase);
  const [showSecret, setShowSecret] = useState(false);
  const [rulebookOpen, setRulebookOpen] = useState(false);
  const [compositionOpen, setCompositionOpen] = useState(false);
  const [teamAssignmentOpen, setTeamAssignmentOpen] = useState(false);
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string>>(previewAvatarUrls);
  const [avatarError, setAvatarError] = useState(previewAvatarError ?? '');
  const [previewTurn, setPreviewTurn] = useState(0);
  const [previewQuestChoice, setPreviewQuestChoice] = useState<Card | null>(null);
  const [previewLadyResult, setPreviewLadyResult] = useState<{ target: string; side: Side } | null>(null);
  const [previewGawainResult, setPreviewGawainResult] = useState<{ target: string; unplayedCard: Card } | null>(null);
  const [previewExcaliburResult, setPreviewExcaliburResult] = useState<PreviewExcaliburResult | null>(null);
  const [previewAssassination, setPreviewAssassination] = useState<PreviewAssassination | null>(null);
  const [previewProposedTeam, setPreviewProposedTeam] = useState<string[]>([]);
  const [previewAssignedSwordHolder, setPreviewAssignedSwordHolder] = useState<string | null>(null);
  const [previewVoteChoice, setPreviewVoteChoice] = useState<boolean | null>(null);
  const [previewActionDoneKey, setPreviewActionDoneKey] = useState<string | null>(null);
  const [completionReadyFor, setCompletionReadyFor] = useState('');
  const [rejectionRevealExpiredFor, setRejectionRevealExpiredFor] = useState('');
  const [reminderTurnKey, setReminderTurnKey] = useState<string | null>(null);
  const playerIds = view?.players.map((player) => player.id).join(',') ?? '';
  const phaseStartedAt = view?.phaseStartedAt;
  const rejectedVoteAt = view?.rejectedVoteAt;
  const plotOpportunityActor = view?.plotOpportunity[0];
  const nextPlotCard = view?.plotDrawn[0];
  const pendingPlotCard = view?.plotPending?.card;
  const pendingPlotHolder = view?.plotPending?.holder;
  const completionKey = view && (view.phase === 'vote' || view.phase === 'quest')
    ? `${roomId}:${view.phase}:${phaseStartedAt ?? `${view.mission}:${view.voteHistory.length}:${view.results.length}:${previewTurn}`}` : '';
  const showCompletionChecks = completionReadyFor === completionKey;

  useEffect(() => {
    if (!previewLadyResult) return;
    const timer = setTimeout(() => setPreviewLadyResult(null), 5000);
    return () => clearTimeout(timer);
  }, [previewLadyResult]);

  useEffect(() => {
    if (!completionKey) return;
    const startedAt = phaseStartedAt ? Date.parse(phaseStartedAt) : Date.now();
    const delay = Math.max(0, 3000 - (Date.now() - startedAt));
    const timer = setTimeout(() => setCompletionReadyFor(completionKey), delay);
    return () => clearTimeout(timer);
  }, [completionKey, phaseStartedAt]);

  useEffect(() => {
    if (!rejectedVoteAt) return;
    const remaining = Math.max(0, REJECTED_VOTE_REVEAL_MS - (Date.now() - Date.parse(rejectedVoteAt)));
    const timer = setTimeout(() => setRejectionRevealExpiredFor(rejectedVoteAt), remaining);
    return () => clearTimeout(timer);
  }, [rejectedVoteAt]);

  useEffect(() => {
    if (preview || !roomId || !playerIds) return;
    let active = true;
    const refresh = () => {
      void getAvalonAvatarUrls(roomId).then((result) => {
        if (!active) return;
        if (result.ok) { setAvatarUrls(result.data); setAvatarError(''); }
        else setAvatarError(result.error);
      });
    };
    refresh();
    const timer = setInterval(refresh, 50 * 60 * 1000);
    return () => { active = false; clearInterval(timer); };
  }, [roomId, playerIds, preview]);

  async function create() {
    void enableGameNotification();
    setBusy(true); setError('');
    const result = await createAvalonRoom();
    if (result.ok) {
      setShowSecret(false);
      setRoomId(result.data.id);
      const room = await getAvalonRoom(result.data.id);
      if (room.ok) { configDirty.current = false; setView(room.data.view); setConfig(room.data.view.config); }
    } else setError(result.error);
    setBusy(false);
  }
  async function join(id: string) {
    void enableGameNotification();
    setBusy(true); setError('');
    const result = await joinAvalonRoom(id);
    if (result.ok && result.data.view) { configDirty.current = false; setShowSecret(false); setRoomId(result.data.id); setView(result.data.view); setConfig(result.data.view.config); }
    else if (!result.ok) setError(result.error);
    setBusy(false);
  }
  function openStats() { setStatsOpen(true); }
  async function dissolveRoom(room: AvalonRoomSummary) {
    if (!window.confirm(`${room.hostName}님의 대기실을 해산할까요? 참가자 전원이 방에서 나가게 됩니다.`)) return;
    setBusy(true); setError('');
    const result = await dissolveAvalonRoom(room.id);
    if (result.ok) setRooms((current) => current.filter((item) => item.id !== room.id));
    else setError(result.error);
    setBusy(false);
  }
  async function refreshAfterTeamCreation() {
    setBusy(true); setError('');
    const [mine, roomList] = await Promise.all([getMyAvalonRoom(), listAvalonRooms()]);
    if (roomList.ok) setRooms(roomList.data);
    if (mine.ok && mine.data) {
      configDirty.current = false;
      setRoomId(mine.data.id);
      setView(mine.data.view);
      setConfig(mine.data.view.config);
    } else if (!mine.ok) setError(mine.error);
    setBusy(false);
  }
  async function send(move: Move) {
    if (preview) {
      if (move.type === 'excalibur' && previewScreen === 'excalibur') {
        if (previewExcaliburResult) return;
        const fixture = previewState('excalibur', previewParticipants);
        try {
          const resolved = applyMove(fixture, user.id, move);
          const result = resolved.results.at(-1);
          if (!result) throw new Error('원정 결과를 확인할 수 없습니다.');
          const original = move.target ? fixture.cards[move.target] : undefined;
          setPreviewExcaliburResult({ target: move.target, original,
            changed: original && move.target ? excaliburReplacementCard(fixture.players.find((player) => player.id === move.target)!, original) : undefined,
            success: result.success, failCount: result.failCount });
          const targetId = move.target;
          if (targetId && original) setView((current) => current ? { ...current,
            myCardPeeks: [...current.myCardPeeks, { target: targetId, card: original, source: 'excalibur', mission: current.mission }],
          } : current);
          setPreviewActionDoneKey(actionTurnKey);
          setError('');
        } catch (cause) { setError(cause instanceof Error ? cause.message : '엑스칼리버 처리에 실패했습니다.'); }
        return;
      }
      if (move.type === 'quest') { setPreviewQuestChoice(move.card); setPreviewActionDoneKey(actionTurnKey); setError(''); return; }
      if (move.type === 'vote') { setPreviewVoteChoice(move.approve); setPreviewActionDoneKey(actionTurnKey); setError(''); return; }
      if (move.type === 'best_player_vote' && previewScreen === 'best_player_vote') {
        setView((current) => {
          if (!current) return current;
          const bestPlayerVotes = { ...current.bestPlayerVotes, [user.id]: move.target ?? null };
          return { ...current, bestPlayerVotes, bestPlayerVoted: true, bestPlayerVoteCount: current.bestPlayerVoteCount + 1 };
        });
        setError('');
        return;
      }
      if (move.type === 'lady') {
        const index = previewParticipants.findIndex((person) => person.id === move.target);
        const side = (['good', 'evil', 'good', 'evil', 'good', 'good', 'evil', 'good'] as Side[])[index];
        if (side) { setPreviewLadyResult({ target: move.target, side }); setPreviewActionDoneKey(actionTurnKey); setError(''); }
        return;
      }
      if (move.type === 'gawain_check' && previewScreen === 'gawain_check') {
        const state = previewState('gawain_check', previewParticipants);
        const card = state.submittedCards?.[move.target];
        if (!card || previewGawainResult) return;
        const targetPlayer = state.players.find((player) => player.id === move.target);
        if (!targetPlayer) return;
        const unplayedCard = gawainUnplayedCard(targetPlayer, card);
        const exiled = unplayedCard !== 'success';
        setPreviewGawainResult({ target: move.target, unplayedCard });
        setPreviewActionDoneKey(actionTurnKey);
        setView((current) => {
          if (!current || current.phase !== 'gawain_check') return current;
          const event = gawainCheckEvent(current.mission, user.name, targetPlayer.name, unplayedCard);
          return { ...current, gawainExiled: exiled,
            players: exiled ? current.players.map((player) => player.id === user.id ? { ...player, publicRoles: [...player.publicRoles, 'gawain' as const] } : player) : current.players,
            myCardPeeks: [...current.myCardPeeks, { target: move.target, unplayedCard }],
            publicEvents: [...current.publicEvents, event],
            history: [...current.history, { type: 'event', index: current.publicEvents.length }],
          };
        });
        setError('');
        return;
      }
      if (move.type === 'assassinate') { setPreviewAssassination({ target: move.target, secondTarget: move.secondTarget, kind: move.targetType ?? 'merlin' }); setPreviewActionDoneKey(actionTurnKey); setError(''); return; }
      if (move.type === 'excalibur_give' && previewScreen === 'excalibur_assign') {
        try {
          applyMove(previewState('excalibur_assign', previewParticipants), user.id, move);
          setPreviewAssignedSwordHolder(move.holder ?? '');
          setPreviewActionDoneKey(actionTurnKey);
          if (!move.holder) setTarget('');
          setError('');
        } catch (cause) { setError(cause instanceof Error ? cause.message : '엑스칼리버를 맡길 수 없습니다.'); }
        return;
      }
      if (move.type === 'propose') { setPreviewProposedTeam(move.team); setPreviewActionDoneKey(actionTurnKey); setError(''); return; }
      setError('미리보기에서는 행동이 저장되지 않습니다. 위에서 다른 화면을 선택해 보세요.');
      return;
    }
    if (!roomId || busy) return;
    setBusy(true); setError('');
    const result = await moveAvalonRoom(roomId, move);
    if (result.ok && result.data.view) {
      setView(result.data.view);
      if (move.type === 'config') {
        // 저장 요청 중 추가로 편집한 초안은 서버 응답으로 덮어쓰지 않는다.
        const savedConfig = result.data.view.config;
        setConfig((current) => current && JSON.stringify(current) !== JSON.stringify(move.config) ? current : savedConfig);
      }
      if (move.type === 'stop') { configDirty.current = false; setConfig(result.data.view.config); setShowSecret(false); }
    }
    else if (!result.ok) setError(result.error);
    setBusy(false);
  }

  function showPreviewScreen(screen: PreviewScreen) {
    const actor = screen === 'assassinate' ? previewParticipants[3] : screen === 'reselect_after_rejection' ? previewParticipants[2] : user;
    setError(''); setTeam([]); setTarget(''); setSecondTarget('');
    setMissionChoice(screen === 'assassinate' || screen === 'finished' ? 5 : 3);
    setPreviewQuestChoice(null); setPreviewLadyResult(null); setPreviewGawainResult(null); setPreviewExcaliburResult(null); setPreviewAssassination(null); setPreviewProposedTeam([]); setPreviewAssignedSwordHolder(null); setPreviewVoteChoice(null); setPreviewActionDoneKey(null); setProposalPick('team');
    setPreviewTurn((turn) => turn + 1);
    setPreviewScreen(screen);
    setView(previewView(screen, previewParticipants, actor.id, screen === 'reselect_after_rejection' ? new Date().toISOString() : null));
  }

  useEffect(() => {
    if (preview) return;
    startTransition(() => {
      void getMyAvalonRoom().then((result) => { if (result.ok && result.data) { const room = result.data; setRoomId(room.id); setView(room.view); setConfig((current) => current ?? room.view.config); } });
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
        if (roomId) void getAvalonRoom(roomId).then((result) => {
          if (!active || busy) return;
          if (result.ok) setView(result.data.view);
          else if (result.error === '방 참가자가 아닙니다.' || result.error === '방을 찾을 수 없습니다.') { setRoomId(''); setView(null); setConfig(null); }
        });
      });
    };
    const channel = supabase.channel('avalon-room-signals').on('postgres_changes', { event: '*', schema: 'public', table: 'avalon_room_signals' }, refresh).subscribe();
    const timer = setInterval(refresh, 30000);
    return () => { active = false; clearInterval(timer); void supabase.removeChannel(channel); };
  }, [roomId, busy, preview]);

  useEffect(() => {
    originalTitle.current = document.title;
    return () => {
      if (document.title === lastAvalonTitle.current && originalTitle.current !== null) {
        document.title = originalTitle.current;
      }
    };
  }, []);

  const lobbyPlayers = view?.phase === 'lobby' ? view.players.length : null;
  const lobbyCapacity = view?.phase === 'lobby' ? view.config.playerCount : null;
  useEffect(() => {
    if (!roomId || lobbyPlayers === null || lobbyCapacity === null) {
      if (lastAvalonTitle.current && document.title === lastAvalonTitle.current && originalTitle.current !== null) {
        document.title = originalTitle.current;
      }
      lastAvalonTitle.current = null;
      return;
    }

    const title = `아발론 ${lobbyPlayers}/${lobbyCapacity}`;
    const setTitle = (value: string) => {
      document.title = value;
      lastAvalonTitle.current = value;
    };
    if (lobbyPlayers < lobbyCapacity) {
      setTitle(title);
      return;
    }

    let green = false;
    setTitle(`🔴 ${title}`);
    const timer = window.setInterval(() => {
      green = !green;
      setTitle(`${green ? '🟢' : '🔴'} ${title}`);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [roomId, lobbyPlayers, lobbyCapacity]);

  useEffect(() => {
    const phase = view?.phase;
    const previous = previousRoomPhase.current;
    if (!preview && roomId && phase && previous?.roomId === roomId && previous.phase === 'lobby' && phase !== 'lobby') {
      showGameNotification('AVALON 게임 시작', '게임이 시작되었습니다. 역할을 확인해 주세요.');
    }
    previousRoomPhase.current = roomId && phase ? { roomId, phase } : null;
  }, [roomId, view?.phase, preview]);

  async function enableGameNotification() {
    if (typeof Notification === 'undefined') {
      setNotificationFeedback('이 브라우저는 OS 알림을 지원하지 않습니다.');
      return;
    }
    try {
      const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      setNotificationFeedback(permission === 'granted' ? '게임 알림이 켜졌습니다.' : '알림이 차단되었습니다. 브라우저의 사이트 설정에서 허용해 주세요.');
    } catch {
      setNotificationFeedback('알림 권한을 요청하지 못했습니다. 브라우저 설정을 확인해 주세요.');
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (view?.phase === 'propose') { setTeam([]); setWatchHolder(''); setProposalPick('team'); setMissionChoice(view.mission); }
      if (view?.phase === 'assassinate') setAssassinationKind('merlin');
      if (view?.phase === 'lobby') setCompositionOpen(false);
      setTarget(''); setSecondTarget('');
    }, 0);
    return () => clearTimeout(timer);
  }, [view?.phase, view?.mission]);

  useEffect(() => {
    const timer = setTimeout(() => { setTarget(''); setPlotCardChoice(''); }, 0);
    return () => clearTimeout(timer);
  }, [plotOpportunityActor, nextPlotCard, pendingPlotCard, pendingPlotHolder]);

  const activeUser = preview && previewScreen === 'assassinate' ? previewParticipants[3] : preview && previewScreen === 'reselect_after_rejection' ? previewParticipants[2] : user;
  const me = view?.players.find((p) => p.id === activeUser.id);
  const isHost = view?.hostId === activeUser.id;
  const setConfigDraft = (next: Config) => { configDirty.current = true; setConfig(next); };
  const required = view ? TEAM_COUNTS[view.players.length]?.[missionChoice - 1] + Number(view.config.trapper) : 0;
  const selectedRoles = view?.myRole.map((r) => ROLES[r].name).join(' · ');
  const latestVote = view?.voteHistory.at(-1);
  const showingCurrentVote = view && ['plot_king', 'plot_forced', 'plot_ambush', 'excalibur_assign', 'excalibur', 'trapper'].includes(view.phase);
  const showingRejectedVote = Boolean(rejectedVoteAt && rejectionRevealExpiredFor !== rejectedVoteAt && latestVote && !latestVote.approved && latestVote.mission === view?.mission && (view.phase === 'propose' || view.phase === 'finished'));
  const boardVotes = view?.phase === 'vote' ? view.earlyVotes : showingRejectedVote && latestVote ? latestVote.votes : (view?.phase === 'quest' || showingCurrentVote) && latestVote?.approved && latestVote.mission === view.mission ? latestVote.votes : {};
  const boardTeam = view?.phase === 'propose' && me?.seat === view.leaderSeat ? team : view?.proposal ?? [];
  const canPickTeam = view?.phase === 'propose' && me?.seat === view.leaderSeat;
  const rogueWatchEnabled = Boolean(view && view.config.goodSlots.concat(view.config.evilSlots).some((slot) => slot.includes('good_rogue') || slot.includes('evil_rogue')) && (view.players.length >= 7 || missionChoice > 2));
  const canPickLady = view?.phase === 'lady' && view.ladyHolder === activeUser.id;
  const canAssassinate = view?.phase === 'assassinate' && (view.recruited ? view.recruited === activeUser.id : view.myRole.includes('assassin'));
  const canPickActionTarget = (id: string, seat: number) => {
    if (!view) return false;
    if (view.phase === 'plot_distribute') return me?.seat === view.leaderSeat && id !== activeUser.id;
    if (view.phase === 'plot_immediate') {
      const pending = view.plotPending;
      if (!pending || (pending.card === 'show_your_strength' ? me?.seat !== view.leaderSeat : pending.holder !== activeUser.id) || id === activeUser.id) return false;
      if (pending.card === 'are_you_the_one') return Math.min(Math.abs(seat - me!.seat), view.players.length - Math.abs(seat - me!.seat)) === 1;
      if (pending.card === 'restore_your_honor') return (view.plotHands[id] ?? []).length > 0;
      return true;
    }
    if (view.phase === 'plot_forced' || view.phase === 'plot_ambush') return view.plotOpportunity[0] === activeUser.id && view.proposal.includes(id);
    if (view.phase === 'excalibur_assign') return me?.seat === view.leaderSeat && view.proposal.includes(id) && id !== activeUser.id && (!preview || previewAssignedSwordHolder === null);
    if (view.phase === 'excalibur') return view.excaliburHolder === activeUser.id && view.proposal.includes(id) && id !== activeUser.id;
    if (view.phase === 'trapper') return me?.seat === view.leaderSeat && view.proposal.includes(id);
    if (view.phase === 'recruit') return view.myRole.includes('assassin') && id !== activeUser.id;
    if (view.phase === 'gawain_check') return !previewGawainResult && view.myRole.includes('gawain') && view.proposal.includes(id);
    return false;
  };
  const actionLabel = view && !(preview && previewGawainResult) ? getPendingAvalonAction(view, activeUser.id) : null;
  const actionTurnKey = actionLabel && view ? [roomId, view.phase, view.phaseStartedAt, view.mission, view.rejected,
    view.leaderSeat, view.voteHistory.length, view.results.length, view.plotOpportunity[0],
    view.plotDrawn.length, view.plotPending?.card, view.plotPending?.holder, view.pendingCheck?.target,
    view.proposal.join(','), preview ? previewTurn : ''].join(':') : null;
  const reminderActionLabel = preview && previewActionDoneKey === actionTurnKey ? null : actionLabel;

  useEffect(() => {
    if (!roomId || view?.phase === 'lobby') {
      seenActionTurns.current.clear();
      return;
    }
    if (preview || !actionTurnKey || !reminderActionLabel || seenActionTurns.current.has(actionTurnKey)) return;
    seenActionTurns.current.add(actionTurnKey);
    // 역할 확인은 게임 시작 알림에 포함된다.
    if (view?.phase !== 'reveal') showGameNotification('AVALON 내 차례', reminderActionLabel);
  }, [roomId, view?.phase, actionTurnKey, reminderActionLabel, preview]);

  useEffect(() => {
    if (!actionTurnKey || !reminderActionLabel) return;
    const timer = setTimeout(() => setReminderTurnKey(actionTurnKey), 5000);
    return () => clearTimeout(timer);
  }, [actionTurnKey, reminderActionLabel]);

  // 방장이 대기실에서 바꾼 유효한 설정은 잠시 뒤 자동으로 방에 저장한다.
  useEffect(() => {
    if (preview || busy || !isHost || view?.phase !== 'lobby' || !config || !roomId || !configDirty.current) return;
    if (JSON.stringify(config) === JSON.stringify(view.config) || validateConfig(config) || config.playerCount < view.players.length) return;
    const timer = setTimeout(() => { configDirty.current = false; void send({ type: 'config', config }); }, 500);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, view, busy, isHost, roomId, preview]);

  return <main className="min-h-screen bg-slate-100 px-4 py-5 text-slate-900 sm:px-6 sm:py-8">
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600"><ArrowLeft size={17} /> 대시보드</Link>
        <div className="flex flex-wrap items-center gap-2">
          {role === 'super_admin' && <button type="button" aria-haspopup="dialog" aria-expanded={teamAssignmentOpen} onClick={() => setTeamAssignmentOpen(true)} className="rounded-full border border-violet-200 bg-white px-3 py-1.5 text-sm font-semibold text-violet-800 focus-visible:outline-2 focus-visible:outline-violet-600">팀 편성</button>}
          <button type="button" onClick={() => setRulebookOpen(true)} className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-white px-3 py-1.5 text-sm font-semibold text-violet-800 focus-visible:outline-2 focus-visible:outline-violet-600"><BookOpen size={16} /> 룰북</button>{view && view.phase !== 'lobby' && <button type="button" aria-haspopup="dialog" aria-expanded={compositionOpen} onClick={() => setCompositionOpen(true)} className="rounded-full border border-violet-200 bg-white px-3 py-1.5 text-sm font-semibold text-violet-800 focus-visible:outline-2 focus-visible:outline-violet-600">직업 구성</button>}<span className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-sm font-semibold text-violet-800"><Shield size={15} /> 레지스탕스: 아발론</span>
        </div>
      </header>
      {preview && <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><p className="font-bold">플레이 화면 미리보기</p><p className="mt-1">예시 게임 결과를 사용합니다. 실제 방에 연결되거나 행동이 저장되지 않습니다. 참가자 이름과 프로필 이미지는 사용자 목록에서 불러옵니다. 자신의 차례에서 5초 동안 행동하지 않으면 우측 하단에 알림이 표시됩니다.</p><label className="mt-3 block font-medium">확인할 화면 <select className={`${field} mt-1 w-full`} value={previewScreen} onChange={(e) => showPreviewScreen(e.target.value as PreviewScreen)}>{previewPhases.map(({ screen, label }) => <option key={screen} value={screen}>{label}</option>)}</select></label>{previewScreen === 'reselect_after_rejection' && <button type="button" className={`${secondary} mt-3`} onClick={() => showPreviewScreen('reselect_after_rejection')}>5초 다시 보기</button>}{previewScreen === 'gawain_check' && <button type="button" className={`${secondary} mt-3`} onClick={() => showPreviewScreen('gawain_check')}>가웨인 판정 다시 보기</button>}{previewScreen === 'excalibur' && <button type="button" className={`${secondary} mt-3`} onClick={() => showPreviewScreen('excalibur')}>엑스칼리버 다시 보기</button>}</section>}
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {avatarError && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">프로필 이미지를 불러오지 못했습니다: {avatarError}</div>}

      {!view ? <section className="rounded-2xl bg-white p-5 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold">아발론 게임</h1>
        <p className="mt-2 text-sm text-slate-600">5~10명이 각자 휴대전화로 역할을 확인하고 투표합니다. 토론은 대면 또는 별도 메신저에서 진행하세요.</p>
        <button className={`${primary} mt-6 w-full`} disabled={busy} onClick={create}>새 방 만들기</button>
        <div className="mt-7 flex items-center justify-between gap-3"><h2 className="font-bold">열려 있는 방</h2><button type="button" className={secondary} onClick={openStats}>전적 보기</button></div>
        <div className="mt-3 space-y-2">{rooms.length ? rooms.map((room) => <div key={room.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">{room.hostName}님의 방 · {room.players.length}/{room.capacity}명</p><p className="mt-1 text-sm text-slate-500">{room.players.map((player) => player.name).join(', ')} · {room.phase === 'lobby' ? '대기 중' : '진행 중'}</p></div><div className="flex gap-2"><button className={secondary} disabled={busy || room.phase !== 'lobby' || room.players.length >= room.capacity} onClick={() => void join(room.id)}>{room.phase === 'lobby' ? '입장' : '진행 중'}</button>{role === 'super_admin' && room.phase === 'lobby' && <button type="button" className="rounded-xl border border-rose-200 bg-white px-4 py-3 font-medium text-rose-700 disabled:opacity-40" disabled={busy} onClick={() => void dissolveRoom(room)}>해산</button>}</div></div></div>) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">열려 있는 방이 없습니다.</p>}</div>
      </section> : <>
        <div className={view.phase === 'lobby' ? '' : 'grid items-stretch gap-5 md:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]'}>
        <section className="flex min-w-0 flex-col rounded-2xl bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-widest text-violet-600">{view.players.find((p) => p.id === view.hostId)?.name}님의 방</p><h1 className="mt-1 text-2xl font-bold">{view.phase === 'lobby' ? '대기실' : view.phase === 'finished' ? '게임 종료' : view.phase === 'best_player_vote' ? '베스트 플레이어 투표' : `${view.mission}차 원정`}</h1></div>
            {view.phase !== 'lobby' && <RejectionTrack rejected={view.rejected} active={view.phase !== 'finished' && view.phase !== 'best_player_vote'} />}
          </div>
          {view.phase !== 'lobby' && <div className="mt-auto grid grid-cols-5 gap-1.5 pt-3">{Array.from({ length: 5 }, (_, i) => {
            const result = view.results.find((r) => r.number === i + 1);
            const current = view.phase !== 'finished' && view.mission === i + 1;
            const teamSize = TEAM_COUNTS[view.players.length][i] + Number(view.config.trapper);
            const status = result ? result.success ? '성공' : '실패' : current ? '진행 중' : '대기';
            return <div key={i} aria-label={`${i + 1}차 원정 · 원정대 ${teamSize}명 · ${status}${i === 3 && view.players.length >= 7 ? ' · 실패 2명부터 실패' : ''}`} className={`relative flex min-h-20 flex-col items-center justify-start rounded-lg px-1 py-2 text-center text-xs font-bold ${result ? result.success ? 'bg-sky-100 text-sky-800' : 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-500'}`}>
              {i === 3 && view.players.length >= 7 && <span className="absolute -top-2 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded bg-gray-100 px-1 text-[11px] leading-4 text-slate-500">(실패 2명)</span>}
              <span className="text-lg leading-none">{teamSize}<span className="ml-0.5 text-xs">명</span></span>
              <span>{status}</span>
              {current && <ShieldHalf role="img" aria-label="현재 원정" className="absolute bottom-1 right-1 size-6 fill-amber-100 text-amber-700" />}
            </div>;
          })}</div>}
        </section>
        {view.phase !== 'lobby' && <section className="flex min-w-0 flex-col rounded-2xl bg-white p-2 shadow-sm sm:p-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="flex min-w-0 items-center gap-2 font-bold">{showSecret ? <Eye size={18} className="shrink-0" /> : <EyeOff size={18} className="shrink-0" />} 내 정보</h2><button type="button" aria-expanded={showSecret} onClick={() => setShowSecret((visible) => !visible)} className="shrink-0 rounded-lg border border-violet-200 px-3 py-2 text-sm font-medium text-violet-800">{showSecret ? '가리기' : '보기'}</button></div>
          {showSecret && <div id="avalon-secret" className="mt-3 min-w-0 flex-1 rounded-xl bg-violet-50 p-2 text-sm text-violet-900 md:mb-3 [overflow-wrap:anywhere]">
            <p className="font-bold text-violet-950">{selectedRoles || (view.mySide === 'good' ? '충신' : '하수인')} · {view.mySide === 'good' ? '선' : '악'} 진영</p>
            {view.myKnowledge.map((row, i) => <div key={i} className="mt-3"><p className="font-semibold">{row.label}</p><div className="mt-1 flex flex-wrap gap-1.5">{(row.players.length ? row.players : ['없음']).map((name, index) => <span key={`${name}-${index}`} className="max-w-full rounded-lg border border-violet-200 bg-white px-2 py-1 text-xs font-medium whitespace-normal [overflow-wrap:anywhere]">{name}</span>)}</div></div>)}
            {view.myFindings.map((finding, i) => <p key={i} className="mt-3">진영 조사: {view.players.find((p) => p.id === finding.target)?.name} → {finding.side === 'good' ? '선' : '악'}</p>)}
            {view.myCardPeeks.map((peek, i) => {
              const targetName = view.players.find((player) => player.id === peek.target)?.name ?? '알 수 없음';
              if ('card' in peek && peek.source === 'excalibur' && peek.mission) {
                return <p key={i} className="mt-3">{peek.mission}차 원정 - {targetName} - {cardName[peek.card]}</p>;
              }
              return <p key={i} className="mt-3">{targetName} → {'unplayedCard' in peek ? gawainPeekLabel(peek.unplayedCard) : 'submittedSuccess' in peek ? gawainPeekLabel(peek.submittedSuccess ? (peek.unplayedMagic ? 'magic' : 'fail') : 'success') : `확인한 카드: ${cardName[peek.card]}`}</p>;
            })}
          </div>}
        </section>}
        </div>

        {view.phase === 'lobby' ? <>
          <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold">참가자 {view.players.length}/{view.config.playerCount}</h2><button type="button" className={secondary} onClick={openStats}>전적 보기</button></div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">{view.players.map((p) => <div key={p.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm"><span className="flex min-w-0 items-center gap-2"><PlayerAvatar name={p.name} url={avatarUrls[p.id]} /><span className="truncate">{p.seat + 1}. {p.name}</span>{p.id === view.hostId && <Crown aria-label="방장" className="size-4 shrink-0 text-amber-600" />}</span>{isHost && p.id !== view.hostId && <button type="button" className="shrink-0 rounded-lg border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700" disabled={busy} onClick={() => void send({ type: 'kick', playerId: p.id })}>추방</button>}</div>)}</div>
            <div className="mt-4 flex flex-wrap gap-2"><button className={secondary} disabled={busy} onClick={async () => { const result = await leaveAvalonRoom(roomId); if (result.ok) { setRoomId(''); setView(null); setConfig(null); const list = await listAvalonRooms(); if (list.ok) setRooms(list.data); } else setError(result.error); }}>방 나가기</button><button type="button" className={secondary} onClick={() => void enableGameNotification()}>게임 알림 켜기</button>{isHost && <button className={primary} disabled={busy || view.players.length !== view.config.playerCount || Boolean(config && JSON.stringify(config) !== JSON.stringify(view.config))} onClick={() => void send({ type: 'start' })}>게임 시작</button>}</div>
            {notificationFeedback && <p role="status" className="mt-2 text-sm text-slate-600">{notificationFeedback}</p>}
          </section>
          <RoleComposition config={view.config} />
          {isHost && config && <ConfigEditor config={config} setConfig={setConfigDraft} busy={busy} save={() => { configDirty.current = false; void send({ type: 'config', config }); }} />}
        </> : <>
          <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
            <h2 className="font-bold">참가자와 원정 팀</h2>
            {canPickTeam && <><p className="mt-1 text-sm text-slate-600">원정 팀원 {required}명을 선택하세요. {team.length}/{required}명 선택</p><div className="mt-3 flex flex-wrap gap-2">{([['team', `원정 팀 ${team.length}/${required}`], ...(rogueWatchEnabled ? [['watch', `도적 감시: ${view.players.find((p) => p.id === watchHolder)?.name ?? '미선택'}`]] : [])] as [typeof proposalPick, string][]).map(([mode, label]) => <button key={mode} type="button" aria-pressed={proposalPick === mode} onClick={() => setProposalPick(mode)} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${proposalPick === mode ? mode === 'watch' ? 'border-violet-500 bg-violet-100 text-violet-900' : 'border-amber-500 bg-amber-100 text-amber-900' : 'border-slate-200 bg-white text-slate-600'}`}>{label}</button>)}</div><p className="mt-2 text-xs text-slate-500">{proposalPick === 'team' ? '참가자 카드를 눌러 팀을 구성하세요.' : '팀원 한 명을 눌러 감시 대상으로 지정하세요.'}</p></>}
            {canPickLady && <p className="mt-1 text-sm text-slate-600">호수의 여인으로 확인할 참가자를 선택하세요. X 표시는 이미 여인을 보유했던 사람입니다.</p>}
            {canAssassinate && <p className="mt-1 text-sm text-slate-600">선 진영 참가자를 눌러 암살 대상을 선택하세요.</p>}
            {view.phase !== 'propose' && view.phase !== 'lady' && view.phase !== 'assassinate' && view.players.some((p) => canPickActionTarget(p.id, p.seat)) && <p className="mt-1 text-sm text-slate-600">대상 참가자 카드를 직접 눌러 선택하세요.</p>}
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5 lg:grid-cols-5">{view.players.map((p) => {
              const selected = boardTeam.includes(p.id);
              const vote = boardVotes[p.id];
              const ladyCandidate = canPickLady && p.id !== activeUser.id && !view.ladyUsed.includes(p.id);
              const assassinationCandidate = canAssassinate && p.id !== activeUser.id && p.side === 'good';
              const assassinationSelected = assassinationCandidate && (target === p.id || secondTarget === p.id);
              const proposalCandidate = canPickTeam && !(view.gawainExiled && p.publicRoles.includes('gawain')) && (proposalPick === 'team' || team.includes(p.id));
              const actionCandidate = canPickActionTarget(p.id, p.seat);
              const assigningExcalibur = view.phase === 'excalibur_assign' && target === p.id && (previewAssignedSwordHolder === null || previewAssignedSwordHolder === p.id);
              const excaliburSelected = view.phase === 'excalibur' && target === p.id;
              const ownsExcalibur = view.config.excalibur && (assigningExcalibur || view.excaliburHolder === p.id);
              const otherSelected = (canPickTeam && watchHolder === p.id && rogueWatchEnabled) || (actionCandidate && view.phase !== 'excalibur_assign' && target === p.id);
              const complete = (view.phase === 'reveal' && p.seen) || (showCompletionChecks && view.phase === 'vote' && view.voteSubmitted.includes(p.id)) || (showCompletionChecks && view.phase === 'quest' && view.cardSubmitters.includes(p.id));
              const roles = p.roles.map((role) => ROLES[role].name).join(' + ') || (p.side === 'good' ? '충신' : '하수인');
              return <div key={p.id} className={`relative min-w-0 rounded-xl border p-2.5 pb-1.5 text-center text-sm ${assassinationSelected ? 'border-violet-600 bg-violet-50 ring-2 ring-inset ring-violet-600' : assigningExcalibur ? 'border-amber-500 bg-amber-50 ring-2 ring-inset ring-amber-500' : excaliburSelected ? 'border-rose-500 bg-rose-50 ring-2 ring-inset ring-rose-500' : otherSelected ? 'border-violet-500 bg-violet-50 ring-2 ring-inset ring-violet-500' : view.phase === 'finished' || view.phase === 'best_player_vote' || view.phase === 'assassinate' ? p.side === 'good' ? 'border-blue-500 bg-blue-50' : 'border-red-500 bg-red-50' : view.phase === 'lady' && p.id === view.ladyHolder ? 'lady-border-pulse border-cyan-500 bg-cyan-50' : view.phase === 'propose' && p.seat === view.leaderSeat ? `leader-border-pulse border-red-500 ${selected ? 'bg-amber-50' : 'bg-slate-50'}` : ladyCandidate && target === p.id ? 'border-emerald-500 bg-emerald-50 ring-2 ring-inset ring-emerald-500' : selected ? 'border-amber-500 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
                {ownsExcalibur && <ExcaliburSword />}
                {view.phase === 'finished' || view.phase === 'best_player_vote' ? <span className="pointer-events-none absolute inset-x-1 top-1 z-10 block whitespace-normal break-keep text-center text-[11px] leading-tight font-semibold text-violet-900 mt-3 -mb-3">{roles}</span> : <>
                  {p.seat === view.leaderSeat && <Crown role="img" aria-label="리더 토큰" className="absolute left-4 top-3.25 size-8 fill-rose-100 text-rose-600" />}
                  {excaliburSelected ? <ArrowLeftRight aria-label="엑스칼리버 대상 선택됨" className="absolute right-2 top-2 size-8 rounded-full bg-rose-100 p-1 text-rose-700" />
                    : otherSelected ? <Check aria-label="대상 선택됨" className="absolute right-2 top-2 size-8 rounded-full bg-violet-100 p-1 text-violet-700" />
                    : target === p.id && canPickLady ? <Check aria-label="여인 확인 대상 선택됨" className="absolute right-2 top-2 size-8 rounded-full bg-emerald-100 p-1 text-emerald-700" />
                    : assassinationSelected ? <Check aria-label="암살 대상 선택됨" className="absolute right-2 top-2 size-8 rounded-full bg-violet-300 p-1 text-violet-700" />
                    : view.phase === 'lady' && view.ladyUsed.includes(p.id) ? <X aria-label="호수의 여인 사용 완료" className="absolute right-2 top-2 size-8 text-slate-500" />
                    : p.id === view.ladyHolder && <LadyIcon role="img" aria-label="호수의 여인 토큰" strokeWidth={2} className="absolute right-2.5 top-1.75 h-10 w-6 text-cyan-500" />}                </>}
                <button type="button" disabled={busy || (!proposalCandidate && !ladyCandidate && !assassinationCandidate && !actionCandidate)} aria-pressed={canPickTeam ? proposalPick === 'team' ? selected : watchHolder === p.id : ladyCandidate ? target === p.id : assassinationCandidate ? assassinationSelected : actionCandidate ? target === p.id : undefined} onClick={() => {
                  if (ladyCandidate) { setTarget(target === p.id ? '' : p.id); if (preview) setPreviewLadyResult(null); }
                  else if (assassinationCandidate) {
                    if (assassinationKind !== 'merlin') {
                      if (target === p.id) { setTarget(secondTarget); setSecondTarget(''); }
                      else if (secondTarget === p.id) setSecondTarget('');
                      else if (!target) setTarget(p.id);
                      else setSecondTarget(p.id);
                    } else setTarget(target === p.id ? '' : p.id);
                    if (preview) setPreviewAssassination(null);
                  }
                  else if (canPickTeam && proposalPick === 'team') { setTeam(selected ? team.filter((id) => id !== p.id) : team.length < required ? [...team, p.id] : team); if (selected && watchHolder === p.id) setWatchHolder(''); if (preview) setPreviewProposedTeam([]); }
                  else if (canPickTeam && proposalPick === 'watch') setWatchHolder(watchHolder === p.id ? '' : p.id);
                  else if (actionCandidate) { setTarget(target === p.id ? '' : p.id); setPlotCardChoice(''); }
                }} className="w-full rounded-lg p-1 focus-visible:outline-2 focus-visible:outline-violet-600 disabled:cursor-default">
                  <span className={`flex items-center justify-center h-8`} aria-hidden="true">{view.phase === 'finished' || view.phase === 'best_player_vote' ? <span className="invisible whitespace-normal break-keep text-[11px] leading-tight">{roles}</span> : selected && <ShieldHalf className="-mt-1 size-10 fill-amber-100 text-amber-600" />}</span>
                  <span className="relative mt-1 flex h-7 min-w-0 items-center justify-center">
                    <span className="absolute -left-0.5 top-1/2 -translate-y-1/2"><PlayerAvatar name={p.name} url={avatarUrls[p.id]} /></span>
                    <span className="inline-flex max-w-[calc(100%-4.5rem)] min-w-0 items-center justify-center gap-0.5 font-semibold"><span className="truncate">{p.name}</span>{view.assassinated.includes(p.id) && <Skull aria-label="암살 대상" className="absolute right-2 size-8 shrink-0 text-red-700" />}</span>
                    {vote !== undefined &&
                      <><span role="img" aria-label={vote ? '찬성 투표' : '반대 투표'}
                        className={`absolute right-0 top-1/2 size-7 -translate-y-1/2 rounded-full border border-slate-700
                          ${vote ? 'bg-white' : 'bg-slate-900'}`} />
                        <span role="caption" aria-label={vote ? '찬성 투표' : '반대 투표'} className="absolute text-xs right-[3.5px] top-7.5">{vote ? '찬성' : '반대'}</span>
                      </>}
                    {vote === undefined && complete && <Check aria-label={view.phase === 'reveal' ? '역할 확인 완료' : view.phase === 'vote' ? '투표 완료' : '원정 카드 제출 완료'} className="absolute right-0 top-1/2 size-7 -translate-y-1/2 rounded-full bg-emerald-100 p-1 text-emerald-700" />}
                  </span>
                  {p.publicRoles.includes('king_arthur') && <span className="absolute mt-1.5 block rounded-md bg-amber-100 px-0.75 py-0.25 text-[10px] font-bold text-amber-900">아서왕</span>}
                  {view.gawainExiled && p.publicRoles.includes('gawain') && <span className="absolute mt-1.5 left-2.5 block rounded-md bg-rose-100 px-0.75 py-0.25 text-[10px] font-bold text-rose-800">원정 추방</span>}
                  <span className="block h-5 text-xs text-slate-500">{assassinationSelected ? target === p.id ? assassinationKind === 'merlin' ? '암살 대상' : '첫 번째 대상' : '두 번째 대상' : excaliburSelected ? '엑스칼리버' : otherSelected ? view.phase === 'propose' ? '감시 대상' : '선택 대상' : p.seat === view.leaderSeat ? '리더' : selected ? '원정 팀' : '\u00a0'}</span>
                </button>
                <PlayerNote name={p.name} value={notes[p.name] ?? ''} disabled={!notesReady} onChange={updateNote} />
              </div>;
            })}</div>
            {view.phase === 'propose' && <div className="mt-4 border-t border-slate-200 pt-4">{canPickTeam ? <>
              {view.config.targeting && <label className="block text-sm">원정 선택 <select className={`${field} ml-2`} value={missionChoice} onChange={(e) => { setMissionChoice(Number(e.target.value)); setTeam([]); setWatchHolder(''); setProposalPick('team'); }}>{[1, 2, 3, 4, 5].filter((n) => !view.results.some((r) => r.number === n) && (n !== 5 || view.results.filter((r) => r.success).length >= 2)).map((n) => <option key={n} value={n}>{n}차</option>)}</select></label>}
              {showingRejectedVote && <p className="mt-3 text-sm text-amber-700">투표 결과가 공개되는 5초 동안 팀을 고를 수 있습니다. 최종 제안은 잠시 뒤 가능합니다.</p>}
              <button className={`${primary} mt-4 w-full`} disabled={busy || showingRejectedVote || team.length !== required || (rogueWatchEnabled && !watchHolder)} onClick={() => void send({ type: 'propose', team, mission: missionChoice, rogueWatchHolder: watchHolder })}>팀 제안하기</button>
              {preview && previewScreen === 'reselect_after_rejection' && previewProposedTeam.length > 0 && <p role="status" className="mt-2 text-sm text-violet-700">미리보기 제안: {previewProposedTeam.map((id) => view.players.find((player) => player.id === id)?.name).join(', ')} · 실제 방에는 저장되지 않습니다.</p>}
            </> : <p className="text-sm text-slate-600">리더가 원정 팀을 고르고 있습니다.</p>}</div>}
          </section>
          {view.phase !== 'propose' && <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6"><PhaseControls view={view} user={activeUser} busy={busy} preview={preview} send={send} previewQuestChoice={preview ? previewQuestChoice : null} previewVoteChoice={preview ? previewVoteChoice : null} previewLadyResult={preview ? previewLadyResult : null} previewGawainResult={preview ? previewGawainResult : null} previewExcaliburResult={preview ? previewExcaliburResult : null} previewAssignedSwordHolder={preview ? previewAssignedSwordHolder : null} previewAssassination={preview ? previewAssassination : null} clearPreviewAssassination={() => setPreviewAssassination(null)} target={target} setTarget={setTarget} secondTarget={secondTarget} setSecondTarget={setSecondTarget} assassinationKind={assassinationKind} setAssassinationKind={setAssassinationKind} plotCardChoice={plotCardChoice} setPlotCardChoice={setPlotCardChoice} /></section>}
          {isHost && !preview && view.phase !== 'finished' && view.phase !== 'best_player_vote' && <button className={`${secondary} w-full border-rose-200 text-rose-700`} disabled={busy} onClick={() => void send({ type: 'stop' })}>게임 중단하고 대기실로</button>}
          {view.phase === 'finished' && !preview && <button className={`${secondary} w-full`} onClick={async () => { setRoomId(''); setView(null); const result = await listAvalonRooms(); if (result.ok) setRooms(result.data); }}>열린 방 목록으로</button>}
          {view.config.plot && <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6"><h2 className="font-bold">공개 플롯 카드</h2><div className="mt-2 space-y-1 text-sm text-slate-600">{view.players.map((p) => <div key={p.id}>{p.name}: {(view.plotHands[p.id] ?? []).map((card) => plotName[card]).join(', ') || '없음'}</div>)}</div></section>}
          {(view.voteHistory.length > 0 || view.results.length > 0 || view.publicEvents.length > 0) && <GameHistory view={view} />}
        </>}
      </>}
    </div>
    {!busy && reminderActionLabel && reminderTurnKey === actionTurnKey && <div role="alert" className="avalon-turn-reminder-blink pointer-events-none fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 w-[min(30rem,calc(100vw-2rem))] rounded-2xl bg-red-600 px-4 py-3 text-sm font-bold text-white shadow-xl sm:right-6 sm:bottom-6"><p>지금 행동할 차례예요</p><p className="mt-1 text-red-100">{reminderActionLabel}</p></div>}
    {teamAssignmentOpen && role === 'super_admin' && <TeamAssignmentModal onClose={() => setTeamAssignmentOpen(false)} onCreated={refreshAfterTeamCreation} />}
    {rulebookOpen && <RulebookModal onClose={() => setRulebookOpen(false)} turnKey={actionTurnKey} actionLabel={actionLabel} />}
    {compositionOpen && view && view.phase !== 'lobby' && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setCompositionOpen(false); }}><div role="dialog" aria-modal="true" aria-labelledby="avalon-composition-title" onKeyDown={(event) => { if (event.key === 'Escape') setCompositionOpen(false); }} className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"><div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4"><div><h2 id="avalon-composition-title" className="text-lg font-bold">직업 구성</h2><p className="mt-1 text-sm text-slate-500">이 게임에 포함된 직업과 적용 규칙입니다. 참가자별 직업은 공개되지 않습니다.</p></div><button type="button" autoFocus className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-violet-600" aria-label="직업 구성 닫기" onClick={() => setCompositionOpen(false)}><X size={20} /></button></div><div className="min-h-0 overflow-y-auto p-5"><RoleComposition config={view.config} embedded /></div></div></div>}
    {statsOpen && <HistoryRankingModal onClose={() => setStatsOpen(false)} />}
  </main>;
}

export function AvalonPreview({ participants = previewPeople, avatarUrls, avatarError }: { participants?: User[]; avatarUrls?: Record<string, string>; avatarError?: string }) {
  return <AvalonMain user={participants[0]} preview previewParticipants={participants} previewAvatarUrls={avatarUrls} previewAvatarError={avatarError} />;
}

function GameHistory({ view }: { view: View }) {
  const [mode, setMode] = useState<'category' | 'timeline'>('timeline');
  const nameOf = (id: string) => view.players.find((player) => player.id === id)?.name ?? '알 수 없음';
  const visibleEventIndices = new Set(view.publicEvents.flatMap((event, index) => {
    const quest = /^(\d+)차 원정 (?:성공|실패)(?:\s|$)/.exec(event);
    if (quest && view.results.some((result) => result.number === Number(quest[1]))) return [];
    const rejectedVote = /^(\d+)차 팀 투표 부결/.exec(event);
    if (rejectedVote && view.voteHistory.some((vote) => vote.mission === Number(rejectedVote[1]) && !vote.approved)) return [];
    return [index];
  }));
  const voteCard = (index: number) => {
    const vote = view.voteHistory[index];
    if (!vote) return null;
    return <article key={`vote-${index}`} className="rounded-xl bg-slate-50 p-3 text-sm">
      <p className="font-semibold">{vote.mission}차 원정 · 투표 <span className={vote.approved ? 'text-blue-700' : 'text-red-700'}>{vote.approved ? '승인' : '부결'}</span></p>
      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-5">{view.players.map((player) => <span key={player.id} className="flex min-w-0 items-center gap-1.5 rounded-lg bg-white px-2 py-1.5">{vote.leaderId === player.id ? <Crown aria-label="리더" className="size-4 shrink-0 text-red-600" /> : vote.excaliburHolder === player.id ? <GoldSword className="size-4 shrink-0" /> : vote.team.includes(player.id) ? <ShieldHalf aria-label="제안된 원정대" className="size-4 shrink-0 fill-amber-100 text-amber-600" />:<span className="w-4"/>}<span className={`truncate ${vote.team.includes(player.id) ? "text-amber-600 font-bold" : "text-slate-800"}`}>{player.name}</span><span aria-hidden="true" className={`size-3.5 shrink-0 rounded-full border border-slate-700 ml-1 ${vote.votes[player.id] ? 'bg-white' : 'bg-slate-900'}`} /><span className="text-xs text-slate-600">{vote.votes[player.id] ? '찬성' : '반대'}</span></span>)}</div>
    </article>;
  };
  const questCard = (index: number) => {
    const result = view.results[index];
    if (!result) return null;
    return <article key={`quest-${index}`} className={`rounded-xl border p-3 text-sm ${result.success ? 'border-blue-200 bg-blue-50' : 'border-red-200 bg-red-50'}`}>
      <p className="font-semibold">{result.number}차 원정 · <span className={result.success ? 'text-blue-700' : 'text-red-700'}>{result.success ? '성공' : '실패'}</span></p>
      <div aria-label="원정대 멤버와 리더" className="mt-2 flex flex-wrap gap-1.5">{result.team.map((id) => <span key={id} className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-slate-700">{result.leaderId === id && <Crown aria-label="리더" className="size-4 shrink-0 text-red-600" />}{result.excaliburHolder === id && <GoldSword className="size-4 shrink-0" />}{nameOf(id)}{result.excaliburTarget === id && <ArrowLeftRight aria-label="엑스칼리버로 카드 변경됨" className="size-4 shrink-0 text-rose-600" />}</span>)}{result.leaderId && !result.team.includes(result.leaderId) && <span className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-slate-700"><Crown aria-label="리더" className="size-4 shrink-0 text-red-600" />{nameOf(result.leaderId)}</span>}</div>
      <p className="mt-2 text-slate-600">공개된 원정 카드: {result.cards.map((card) => cardName[card]).join(' · ') || '없음'}</p>
      <p className="mt-1 text-slate-600">실패 {result.failCount}개</p>
    </article>;
  };
  return <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">진행 기록</h2><div role="group" aria-label="기록 보기 방식" className="inline-flex rounded-lg border border-slate-200 p-0.5 text-xs font-medium">
      <button type="button" aria-pressed={mode === 'category'} onClick={() => setMode('category')} className={`rounded-md px-2.5 py-1.5 ${mode === 'category' ? 'bg-violet-700 text-white' : 'text-slate-600'}`}>카테고리별</button>
      <button type="button" aria-pressed={mode === 'timeline'} onClick={() => setMode('timeline')} className={`rounded-md px-2.5 py-1.5 ${mode === 'timeline' ? 'bg-violet-700 text-white' : 'text-slate-600'}`}>시간순서</button>
    </div></div>
    {mode === 'category' ? <>
      {view.voteHistory.length > 0 && <div className="mt-4"><h3 className="text-sm font-semibold">투표 내역</h3><div className="mt-2 space-y-2">{view.voteHistory.map((_, index) => index).reverse().map(voteCard)}</div></div>}
      {view.results.length > 0 && <div className="mt-4"><h3 className="text-sm font-semibold">원정 내역</h3><div className="mt-2 space-y-2">{view.results.map((_, index) => index).reverse().map(questCard)}</div></div>}
      {visibleEventIndices.size > 0 && <div className="mt-4"><h3 className="text-sm font-semibold">기타 기록</h3><ol className="mt-2 space-y-1 text-sm text-slate-600">{[...visibleEventIndices].reverse().map((index) => <li key={index}>• {view.publicEvents[index]}</li>)}</ol></div>}
    </> : <>
      {view.historyApproximate && <p className="mt-3 text-xs text-amber-700">이 방의 이전 기록은 저장된 내역을 기준으로 순서를 복원했습니다.</p>}
      <div className="mt-3 space-y-2">{view.history.slice().reverse().filter((entry) => entry.type !== 'event' || visibleEventIndices.has(entry.index)).map((entry, position) => entry.type === 'vote' ? voteCard(entry.index) : entry.type === 'quest' ? questCard(entry.index) : <article key={`event-${position}`} className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{view.publicEvents[entry.index]}</article>)}</div>
    </>}
  </section>;
}

function RoleComposition({ config, embedded = false }: { config: Config; embedded?: boolean }) {
  const groups = [
    { side: 'good', label: '선', slots: config.goodSlots, ordinary: '충신' },
    { side: 'evil', label: '악', slots: config.evilSlots, ordinary: '하수인' },
  ] as const;
  const enabledRules = [
    ...(config.expansion ? ['확장 직업 사용'] : []),
    ...(config.lady ? ['호수의 여인'] : []),
    ...(config.lancelot === 'variant1' ? ['랜슬롯 변형 1 · 현재 악은 성공/실패 선택'] : []),
    ...(config.lancelot === 'variant2' ? ['랜슬롯 변형 2 · 현재 악은 실패만 제출'] : []),
    ...(config.targeting ? ['목표 원정 선택'] : []),
    ...(config.trapper ? ['함정꾼'] : []),
    ...(config.excalibur ? ['엑스칼리버'] : []),
    ...(config.plot ? ['플롯 카드'] : []),
    ...(config.seniorKnowsJunior ? ['상급 전령의 정보'] : []),
  ];

  return <section className={embedded ? '' : 'rounded-2xl bg-white p-4 shadow-sm sm:p-6'}>
    {!embedded && <><h2 className="font-bold">저장된 직업 구성</h2><p className="mt-1 text-sm text-slate-600">게임 시작 시 아래 직업이 참가자에게 무작위로 배정됩니다.</p></>}
    <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4">
      {groups.map(({ side, label, slots, ordinary }) => <div key={side} className="min-w-0">
        <h3 className={`rounded-lg text-sm font-bold ${side === 'good' ? 'text-blue-900' : 'text-red-900'}`}>{label} 진영 · {slots.length}명</h3>
        <ul className="mt-2 space-y-2">{slots.map((slot, index) => <li key={index} className={`min-w-0 rounded-lg border px-3 py-2 text-sm font-medium break-keep ${side === 'good' ? 'border-blue-100 bg-blue-50 text-blue-900' : 'border-red-100 bg-red-50 text-red-900'}`}>
          {slot.length ? slot.map((role) => ROLES[role].name).join(' + ') : ordinary}
        </li>)}</ul>
      </div>)}
    </div>
    {enabledRules.length > 0 && <div className="mt-5 border-t border-slate-200 pt-4">
      <h3 className="text-sm font-bold">적용 규칙</h3>
      <ul className="mt-2 flex flex-wrap gap-2">{enabledRules.map((rule) => <li key={rule} className="rounded-lg bg-violet-50 px-3 py-2 text-sm font-medium text-violet-900">{rule}</li>)}</ul>
    </div>}
  </section>;
}

function ConfigEditor({ config, setConfig, save, busy }: { config: Config; setConfig: (c: Config) => void; save: () => void; busy: boolean }) {
  const setCount = (count: number) => setConfig({ ...defaultConfig(count), expansion: config.expansion || count === 10 });
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

function PhaseControls({ view, user, busy, preview, send, previewQuestChoice, previewVoteChoice, previewLadyResult, previewGawainResult, previewExcaliburResult, previewAssignedSwordHolder, previewAssassination, clearPreviewAssassination, target, setTarget, secondTarget, setSecondTarget, assassinationKind, setAssassinationKind, plotCardChoice, setPlotCardChoice }: {
  view: View; user: User; busy: boolean; preview: boolean; send: (move: Move) => Promise<void>;
  previewQuestChoice: Card | null;
  previewVoteChoice: boolean | null;
  previewLadyResult: { target: string; side: Side } | null;
  previewGawainResult: { target: string; unplayedCard: Card } | null;
  previewExcaliburResult: PreviewExcaliburResult | null;
  previewAssignedSwordHolder: string | null;
  previewAssassination: PreviewAssassination | null;
  clearPreviewAssassination: () => void;
  target: string; setTarget: (id: string) => void; secondTarget: string; setSecondTarget: (id: string) => void;
  assassinationKind: AssassinationKind; setAssassinationKind: (kind: AssassinationKind) => void;
  plotCardChoice: PlotCard | ''; setPlotCardChoice: (card: PlotCard | '') => void;
}) {
  const me = view.players.find((p) => p.id === user.id);
  const isLeader = me?.seat === view.leaderSeat;
  const selectedName = view.players.find((p) => p.id === target)?.name;

  if (view.phase === 'reveal') return <><h2 className="font-bold">역할 확인</h2><p className="mt-2 text-sm text-slate-600">개인 정보를 확인한 뒤 준비해 주세요. {view.players.filter((p) => p.seen).length}/{view.players.length}명 확인</p><button className={`${primary} mt-4 w-full`} disabled={busy || me?.seen} onClick={() => void send({ type: 'seen' })}>{me?.seen ? '확인 완료' : '역할 확인 완료'}</button></>;
  if (view.phase === 'loyalty_check') return <><h2 className="font-bold">진영 조사 응답</h2>{view.pendingCheck?.target === user.id ? <><p className="mt-2 text-sm text-slate-600">사기꾼은 조사 결과를 선 또는 악으로 선택할 수 있습니다. 실제 진영은 바뀌지 않습니다.</p><div className="mt-4 grid grid-cols-2 gap-2"><button className={primary} disabled={busy} onClick={() => void send({ type: 'loyalty_reply', side: 'good' })}>선으로 응답</button><button className={secondary} disabled={busy} onClick={() => void send({ type: 'loyalty_reply', side: 'evil' })}>악으로 응답</button></div></> : <p className="mt-2 text-sm text-slate-600">진영 조사 응답을 기다립니다.</p>}</>;
  if (view.phase === 'plot_lead') return <><h2 className="font-bold">Lead to Victory</h2>{view.plotOpportunity[0] === user.id ? <div className="mt-3 flex gap-2"><button className={primary} disabled={busy} onClick={() => void send({ type: 'plot_use', card: 'lead_to_victory', target: 'use' })}>리더가 되기</button><button className={secondary} disabled={busy} onClick={() => void send({ type: 'plot_use', card: 'lead_to_victory' })}>넘기기</button></div> : <p className="mt-2 text-sm text-slate-600">카드 보유자의 결정을 기다립니다.</p>}</>;
  if (view.phase === 'plot_distribute') return <><h2 className="font-bold">플롯 카드 배분</h2><p className="mt-2 text-sm text-slate-600">다음 카드: {plotName[view.plotDrawn[0]]}</p>{isLeader ? <><p className="mt-3 text-sm text-violet-700">카드를 받을 참가자: {selectedName ?? '위에서 선택'}</p><button className={`${primary} mt-3 w-full`} disabled={busy || !target} onClick={() => void send({ type: 'plot_give', holder: target })}>카드 전달</button></> : <p className="mt-3 text-sm text-slate-600">리더가 카드를 배분하고 있습니다.</p>}</>;
  if (view.phase === 'plot_immediate') {
    const pending = view.plotPending;
    if (!pending) return null;
    const acting = pending.card === 'show_your_strength' ? isLeader : pending.holder === user.id;
    const otherHands = target ? view.plotHands[target] ?? [] : [];
    return <><h2 className="font-bold">{plotName[pending.card]}</h2>{acting ? <><p className="mt-2 text-sm text-slate-600">{pending.card === 'restore_your_honor' ? '다른 사람의 플롯 카드를 가져옵니다.' : '진영을 확인하거나 보여줄 대상을 선택합니다.'}</p><p className="mt-3 text-sm text-violet-700"></p>{pending.card === 'restore_your_honor' && <select className={`${field} mt-2 w-full`} value={plotCardChoice} onChange={(e) => setPlotCardChoice(e.target.value as PlotCard)}><option value="">가져올 카드</option>{otherHands.map((card, i) => <option key={`${card}-${i}`} value={card}>{plotName[card]}</option>)}</select>}<button className={`${primary} mt-3 w-full`} disabled={busy || !target || (pending.card === 'restore_your_honor' && !plotCardChoice)} onClick={() => void send({ type: 'plot_apply', target, card: plotCardChoice || undefined })}>효과 적용</button></> : <p className="mt-2 text-sm text-slate-600">카드 효과 처리를 기다립니다.</p>}</>;
  }
  if (['plot_king', 'plot_forced', 'plot_ambush'].includes(view.phase)) {
    const card: PlotCard = view.phase === 'plot_king' ? 'king_returns' : view.phase === 'plot_forced' ? 'we_found_you' : 'ambush';
    return <><h2 className="font-bold">{plotName[card]}</h2>{view.plotOpportunity[0] === user.id ? <><p className="mt-2 text-sm text-slate-600">카드를 사용하거나 넘길 수 있습니다.</p><div className="mt-3 flex gap-2"><button className={primary} disabled={busy || (card !== 'king_returns' && !target)} onClick={() => void send({ type: 'plot_use', card, target: card === 'king_returns' ? 'use' : target })}>사용</button><button className={secondary} disabled={busy} onClick={() => void send({ type: 'plot_use', card })}>넘기기</button></div></> : <p className="mt-2 text-sm text-slate-600">카드 보유자의 결정을 기다립니다.</p>}</>;
  }
  if (view.phase === 'vote') return <><h2 className="font-bold">팀 승인 투표</h2><p className="mt-2 text-sm text-slate-600">{view.voteCount}/{view.players.length}명 제출 · 모두 제출하면 투표 내용이 공개됩니다.</p>{!view.voted && previewVoteChoice === null ? <div className="mt-4 grid grid-cols-2 gap-2"><button className={primary} disabled={busy} onClick={() => void send({ type: 'vote', approve: true })}>찬성</button><button className={secondary} disabled={busy} onClick={() => void send({ type: 'vote', approve: false })}>반대</button></div> : <p className="mt-4 text-sm text-violet-700">{previewVoteChoice === null ? '투표 완료. 다른 참가자를 기다립니다.' : `미리보기 선택: ${previewVoteChoice ? '찬성' : '반대'} · 실제 방에는 저장되지 않습니다.`}</p>}</>;
  if (view.phase === 'excalibur_assign') return <><h2 className="font-bold">엑스칼리버 수여</h2>{isLeader ? <><p className="mt-2 text-sm text-slate-600">확정된 원정 팀원 한 명에게 엑스칼리버를 주거나 사용하지 않을 수 있습니다. 리더 본인은 받을 수 없습니다.</p><p className="mt-3 text-sm text-violet-700">받을 팀원: {selectedName ?? '위에서 선택'}</p><div className="mt-3 flex gap-2"><button className={primary} disabled={busy || !target || previewAssignedSwordHolder !== null} onClick={() => void send({ type: 'excalibur_give', holder: target })}>엑스칼리버 주기</button><button className={secondary} disabled={busy || previewAssignedSwordHolder !== null} onClick={() => void send({ type: 'excalibur_give' })}>사용 안 함</button></div>{previewAssignedSwordHolder !== null && <p role="status" className="mt-3 text-sm text-violet-700">미리보기: {previewAssignedSwordHolder ? `${view.players.find((player) => player.id === previewAssignedSwordHolder)?.name}님에게 수여` : '수여하지 않음'} · 실제 방에는 저장되지 않습니다.</p>}</> : <p className="mt-2 text-sm text-slate-600">리더의 엑스칼리버 결정을 기다립니다.</p>}</>;
  if (view.phase === 'quest') return <>
    <h2 className="flex items-center gap-2 font-bold"><Swords size={18} /> 원정 카드</h2>
    <p className="mt-2 text-sm text-slate-600">{view.cardCount}/{view.proposal.length}명 제출 · 두 번째 카드는 직업에 따라 실패 또는 마법으로 적용됩니다. 불가능한 선택지는 자동으로 바뀝니다.</p>
    {view.publicQuestCard && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-800">공개 카드: {view.players.find((p) => p.id === view.forcedPublicCard)?.name} · {cardName[view.publicQuestCard]}</p>}
    {view.proposal.includes(user.id) ? view.cardSubmitted ? <p className="mt-4 text-violet-700">카드 제출 완료. 다른 팀원을 기다립니다.</p> : <>
      <div className="mt-4 grid grid-cols-2 gap-2">{visibleQuestCards(view.config).map((card) => <button key={card} className={card === 'success' ? 'rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40' : card === 'fail' ? 'rounded-xl bg-red-600 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40' : primary} disabled={busy} onClick={() => {
        const submittedCard = questCardToSubmit(card, view.myAllowedCards);
        if (submittedCard) void send({ type: 'quest', card: submittedCard });
      }}>{card === 'fail' ? '실패 혹은 마법' : cardName[card]}</button>)}</div>
      {previewQuestChoice && <p className="mt-3 text-sm text-violet-700">미리보기 선택: {cardName[previewQuestChoice]} · 다시 선택할 수 있습니다.</p>}
    </> : <p className="mt-4 text-sm text-slate-600">원정 팀의 카드 제출을 기다립니다.</p>}
  </>;
  if (view.phase === 'excalibur') return <><h2 className="font-bold">엑스칼리버</h2>{view.excaliburHolder === user.id ? <><p className="mt-2 text-sm text-slate-600">다른 팀원의 카드를 바꾸거나 사용하지 않을 수 있습니다.</p><div className="mt-3 flex gap-2"><button className={primary} disabled={busy || !target || Boolean(previewExcaliburResult)} onClick={() => void send({ type: 'excalibur', target })}>카드 바꾸기</button><button className={secondary} disabled={busy || Boolean(previewExcaliburResult)} onClick={() => void send({ type: 'excalibur' })}>사용 안 함</button></div>{previewExcaliburResult && <p role="status" className="mt-3 rounded-lg bg-violet-50 p-3 text-sm text-violet-800">{previewExcaliburResult.target ? `${view.players.find((player) => player.id === previewExcaliburResult.target)?.name}님의 원래 카드: ${cardName[previewExcaliburResult.original!]} → ${cardName[previewExcaliburResult.changed!]}` : '엑스칼리버를 사용하지 않았습니다.'} · 원정 {previewExcaliburResult.success ? '성공' : '실패'} (실패 {previewExcaliburResult.failCount}장)</p>}</> : <p className="mt-2 text-sm text-slate-600">엑스칼리버 소유자의 선택을 기다립니다.</p>}</>;
  if (view.phase === 'trapper') return <><h2 className="font-bold">함정꾼</h2>{isLeader ? <><p className="mt-2 text-sm text-slate-600">원정 카드 한 장을 확인하고 판정에서 제외합니다.</p><p className="mt-3 text-sm text-violet-700">제외할 팀원: {selectedName ?? '위에서 선택'}</p><button className={`${primary} mt-3 w-full`} disabled={busy || !target} onClick={() => void send({ type: 'trapper', target })}>카드 제외</button></> : <p className="mt-2 text-sm text-slate-600">리더의 선택을 기다립니다.</p>}</>;
  if (view.phase === 'gawain_check') return <><h2 className="font-bold">가웨인의 원정 카드 확인</h2><p className="mt-2 text-sm text-slate-600">{view.mission}차 원정 {view.results.at(-1)?.success ? '성공' : '실패'} · 제출 카드가 공개되었습니다.</p>{view.myRole.includes('gawain') ? <><p className="mt-3 text-sm text-slate-600">이번 원정에 참가하지 않았으므로 팀원 한 명의 내지 않은 카드를 확인할 수 있습니다. 성공 카드를 제출했다면 추방됩니다.</p><button className={`${primary} mt-3 w-full`} disabled={busy || !selectedName || !view.proposal.includes(target) || Boolean(previewGawainResult)} onClick={() => void send({ type: 'gawain_check', target })}>{previewGawainResult ? '확인 완료' : `[ ${selectedName ?? '대상 선택'} ] 카드 확인`}</button>{previewGawainResult && <p role="status" className={`mt-3 rounded-lg p-3 text-sm font-semibold ${view.gawainExiled ? 'bg-rose-50 text-rose-800' : 'bg-blue-50 text-blue-800'}`}>[ {view.players.find((player) => player.id === previewGawainResult.target)?.name ?? '알 수 없음'} ] {gawainPeekLabel(previewGawainResult.unplayedCard)} · {view.gawainExiled ? '가웨인 추방' : '다음 원정에서도 능력 사용 가능'}</p>}<p className="mt-2 text-xs text-slate-500">확인 결과는 내 정보에서 볼 수 있습니다.</p></> : <p className="mt-3 text-sm text-slate-600">가웨인의 확인을 기다립니다.</p>}</>;
  if (view.phase === 'lady') return <><h2 className="font-bold">호수의 여인</h2>{view.ladyHolder === user.id ? <><p className="mt-2 text-sm text-slate-600">한 사람을 선택해 현재 진영을 비밀리에 확인합니다.</p><button className={`${primary} mt-3 w-full`} disabled={busy || !selectedName || target === user.id || view.ladyUsed.includes(target)} onClick={() => void send({ type: 'lady', target })}>{selectedName ? `[ ${selectedName} ] ` : ''}진영 확인</button>{previewLadyResult && <p role="status" className={`mt-3 rounded-lg p-3 text-sm font-semibold ${previewLadyResult.side === 'good' ? 'bg-blue-50 text-blue-800' : 'bg-red-50 text-red-800'}`}>{view.players.find((player) => player.id === previewLadyResult.target)?.name ?? '알 수 없음'}의 진영: {previewLadyResult.side === 'good' ? '선' : '악'}</p>}</> : <p className="mt-2 text-sm text-slate-600">호수의 여인 보유자가 조사 중입니다.</p>}</>;
  if (view.phase === 'recruit') return <><h2 className="font-bold">불신의 충신 모집</h2>{view.myRole.includes('assassin') ? <><p className="mt-2 text-sm text-slate-600">암살자가 불신의 충신을 한 번 추측합니다.</p><button className={`${primary} mt-3 w-full`} disabled={busy || !target} onClick={() => void send({ type: 'recruit', target })}>모집 시도</button></> : <p className="mt-2 text-sm text-slate-600">암살자의 선택을 기다립니다.</p>}</>;
  if (view.phase === 'assassinate') {
    const modes: { kind: AssassinationKind; label: string; confirm: string }[] = [
      { kind: 'merlin', label: '멀린 1명', confirm: '멀린 암살 확정' },
      ...(view.config.evilSlots.some((slot) => slot.includes('evil_messenger')) ? [{ kind: 'messengers' as const, label: '선 전령 2명', confirm: '전령 암살 확정' }] : []),
      ...(view.config.goodSlots.some((slot) => slot.includes('tristan')) ? [{ kind: 'lovers' as const, label: '연인 2명', confirm: '연인 암살 확정' }] : []),
    ];
    const twoTargets = assassinationKind !== 'merlin';
    const first = view.players.find((player) => player.id === target);
    const second = view.players.find((player) => player.id === secondTarget);
    const readyToAssassinate = first?.side === 'good' && (!twoTargets || (second?.side === 'good' && second.id !== first.id));
    return <>
      <h2 className="font-bold">마지막 암살</h2>
      {(view.recruited ? view.recruited === user.id : view.myRole.includes('assassin')) ? <>
        <p className="mt-2 text-sm text-slate-600">암살 방식을 고른 뒤 위 참가자 카드에서 선 진영 대상 {twoTargets ? '두 명' : '한 명'}을 선택하세요. 직업은 공개되지 않습니다.</p>
        <div role="group" aria-label="암살 방식" className="mt-3 flex flex-wrap gap-2">{modes.map((mode) => <button key={mode.kind} type="button" aria-pressed={assassinationKind === mode.kind} className={`rounded-full border px-3 py-1.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-violet-600 ${assassinationKind === mode.kind ? 'border-violet-700 bg-violet-700 text-white' : 'border-violet-200 bg-violet-50 text-violet-800'}`} onClick={() => { setAssassinationKind(mode.kind); setTarget(''); setSecondTarget(''); clearPreviewAssassination(); }}>{mode.label}</button>)}</div>
        <p className="mt-3 text-sm text-violet-800">선택한 대상 {Number(Boolean(first)) + Number(twoTargets && Boolean(second))}/{twoTargets ? 2 : 1}: {first?.name ?? '미선택'}{twoTargets && ` · ${second?.name ?? '미선택'}`}</p>
        <button className={`${primary} mt-3 w-full`} disabled={busy || !readyToAssassinate} onClick={() => void send({ type: 'assassinate', target, targetType: assassinationKind, secondTarget: twoTargets ? secondTarget : undefined })}>{modes.find((mode) => mode.kind === assassinationKind)?.confirm ?? '암살 확정'}</button>
        {previewAssassination && <p role="status" className="mt-3 text-sm text-violet-700">미리보기 {modes.find((mode) => mode.kind === previewAssassination.kind)?.label ?? '암살'} 선택: {view.players.find((player) => player.id === previewAssassination.target)?.name}{previewAssassination.secondTarget && ` · ${view.players.find((player) => player.id === previewAssassination.secondTarget)?.name}`} · 실제 방에는 저장되지 않습니다.</p>}
      </> : <p className="mt-2 text-sm text-slate-600">악 진영의 마지막 선택을 기다립니다.</p>}
    </>;
  }
  if (view.phase === 'best_player_vote') {
    const candidates = view.players.filter((player) => player.side === view.winner);
    return <><h2 className="text-lg font-bold">{view.winner === 'good' ? '선 진영 승리' : '악 진영 승리'}</h2><p className="mt-1 text-sm text-slate-600">{view.winReason}</p><p className="mt-3 text-sm text-slate-600">승리 플레이어 중 한 명에게 투표해 주세요. 투표하지 않으려면 건너뛰기를 선택하면 됩니다. {view.bestPlayerVoteCount}/{view.players.length}명 응답</p>{view.bestPlayerVoted ? <p role="status" className="mt-4 rounded-xl bg-violet-50 p-3 text-sm font-semibold text-violet-800">{preview ? '미리보기 투표를 완료했습니다. 실제 게임에는 저장되지 않습니다.' : '투표를 마쳤습니다. 다른 참가자의 응답을 기다리는 중입니다.'}</p> : <><div className="mt-4 grid gap-2 sm:grid-cols-2">{candidates.map((player) => <button key={player.id} type="button" className={secondary} disabled={busy} onClick={() => void send({ type: 'best_player_vote', target: player.id })}>{player.name}에게 투표</button>)}</div><button type="button" className="mt-2 w-full rounded-xl px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40" disabled={busy} onClick={() => void send({ type: 'best_player_vote' })}>투표 건너뛰기</button></>}</>;
  }
  if (view.phase === 'finished') {
    const counts = Object.values(view.bestPlayerVotes).reduce<Record<string, number>>((result, playerId) => { if (playerId) result[playerId] = (result[playerId] ?? 0) + 1; return result; }, {});
    const highScore = Math.max(0, ...Object.values(counts));
    const bestPlayers = view.players.filter((player) => counts[player.id] === highScore && highScore > 0);
    return <><h2 className="text-xl font-bold">{view.winner === 'good' ? '선 진영 승리' : '악 진영 승리'}</h2><p className="mt-2 text-sm text-slate-600">{view.winReason}</p><div className="mt-4 rounded-xl bg-amber-50 p-4"><h3 className="font-bold text-amber-950">베스트 플레이어 투표 결과</h3>{bestPlayers.length ? <p className="mt-1 text-sm text-amber-900">{bestPlayers.map((player) => `${player.name} ${counts[player.id]}표`).join(' · ')}</p> : <p className="mt-1 text-sm text-amber-900">베스트 플레이어 투표가 없습니다.</p>}</div></>;
  }
  return null;
}
