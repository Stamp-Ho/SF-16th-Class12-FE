import { allowedCards, assignRoles, defaultConfig, knows, normalizeConfig, REJECTED_VOTE_REVEAL_MS, shuffled, TEAM_COUNTS, validateConfig, type Card, type Config, type GameState, type HistoryEntry, type Player, type PlotCard, type Side } from './rules';

export type Move =
  | { type: 'ready'; ready: boolean }
  | { type: 'config'; config: Config }
  | { type: 'start' }
  | { type: 'kick'; playerId: string }
  | { type: 'stop' }
  | { type: 'seen' }
  | { type: 'propose'; team: string[]; mission?: number; excaliburHolder?: string; rogueWatchHolder?: string }
  | { type: 'vote'; approve: boolean }
  | { type: 'quest'; card: Card }
  | { type: 'gawain_check'; target: string }
  | { type: 'excalibur'; target?: string }
  | { type: 'trapper'; target: string }
  | { type: 'lady'; target: string }
  | { type: 'loyalty_reply'; side: Side }
  | { type: 'plot_give'; holder: string }
  | { type: 'plot_apply'; target?: string; card?: PlotCard }
  | { type: 'plot_use'; card: PlotCard; target?: string }
  | { type: 'recruit'; target: string }
  | { type: 'assassinate'; target: string; targetType?: 'merlin' | 'messengers' | 'lovers'; secondTarget?: string };

const fail = (message: string): never => { throw new Error(message); };
const has = (p: Player, role: string) => p.roles.includes(role as Player['roles'][number]);
const isFailureCard = (card: Card | undefined) => card === 'fail' || card === 'evil_message' || card === 'evil_rogue';
const isSuccessCard = (card: Card) => card === 'success' || card === 'good_message' || card === 'good_rogue';
const cardLabel: Record<Card, string> = { success: '성공', fail: '실패', magic: '마법', good_message: '선 전령', evil_message: '악 전령', good_rogue: '선 도적', evil_rogue: '악 도적' };
export function gawainCheckEvent(mission: number, checkerName: string, targetName: string, card: Card): string {
  const result = isSuccessCard(card) ? '성공' : isFailureCard(card) ? '실패' : cardLabel[card];
  return `${mission}차 원정 가웨인 검사: ${checkerName} → ${targetName} [${result}] 카드 확인 · ${isSuccessCard(card) ? '추방' : '계속 사용 가능'}`;
}
const plotLabel: Record<PlotCard, string> = { are_you_the_one: 'Are You the One?', charge: 'Charge!', show_your_strength: 'Show Your Strength', show_your_true_nature: 'Show Your True Nature', king_returns: 'The King Returns', ambush: 'Ambush', lead_to_victory: 'Lead to Victory', we_found_you: 'We Found You!', restore_your_honor: 'Restore Your Honor' };
const score = (s: GameState) => ({ good: s.results.filter((r) => r.success).length, evil: s.results.filter((r) => !r.success).length });
const nextSeat = (s: GameState) => (s.leaderSeat + 1) % s.players.length;
const playerById = (s: GameState, id: string) => s.players.find((p) => p.id === id);
const publicEvent = (s: GameState, message: string) => {
  const history = historyFromState(s);
  s.publicEvents.push(message);
  s.history = [...history, { type: 'event', index: s.publicEvents.length - 1 }];
};
const removePlot = (s: GameState, holder: string, card: PlotCard) => {
  const hand = s.plotHands[holder] ?? [];
  const index = hand.indexOf(card);
  if (index < 0) throw new Error('보유하지 않은 플롯 카드입니다.');
  hand.splice(index, 1);
};

const PLOT_FIVE: PlotCard[] = ['are_you_the_one', 'charge', 'show_your_strength', 'show_your_true_nature', 'king_returns', 'ambush', 'lead_to_victory'];
const PLOT_SEVEN: PlotCard[] = [...PLOT_FIVE, 'we_found_you', 'restore_your_honor', 'are_you_the_one', 'charge', 'king_returns', 'ambush', 'lead_to_victory', 'show_your_true_nature'];

function drawPlot(s: GameState) {
  const count = s.players.length <= 6 ? 1 : s.players.length <= 8 ? 2 : 3;
  s.plotDrawn = s.plotDeck.splice(0, count);
  s.plotPrepared.push(s.results.length);
  s.phase = s.plotDrawn.length ? 'plot_distribute' : 'propose';
}

function prepareRound(s: GameState) {
  if (!s.config.plot || s.plotPrepared.includes(s.results.length)) { s.phase = 'propose'; return; }
  s.plotLeadUsed = false;
  s.plotOpportunity = s.players.filter((p) => (s.plotHands[p.id] ?? []).includes('lead_to_victory')).map((p) => p.id);
  if (s.plotOpportunity.length) s.phase = 'plot_lead';
  else drawPlot(s);
}

function continuePlotDeal(s: GameState) {
  s.plotPending = null;
  s.phase = s.plotDrawn.length ? 'plot_distribute' : 'propose';
}

function beginQuestEffects(s: GameState) {
  if (!s.config.plot) { s.phase = 'quest'; return; }
  s.plotOpportunity = s.players.filter((p) => (s.plotHands[p.id] ?? []).includes('we_found_you')).map((p) => p.id);
  s.phase = s.plotOpportunity.length ? 'plot_forced' : 'quest';
}

function afterQuestCards(s: GameState) {
  if (s.config.plot) {
    s.plotOpportunity = s.players.filter((p) => (s.plotHands[p.id] ?? []).includes('ambush')).map((p) => p.id);
    if (s.plotOpportunity.length) { s.phase = 'plot_ambush'; return; }
  }
  if (s.config.excalibur) s.phase = 'excalibur';
  else if (s.config.trapper) s.phase = 'trapper';
  else resolveQuest(s);
}

function afterAmbush(s: GameState) {
  if (s.plotOpportunity.length) { s.phase = 'plot_ambush'; return; }
  if (s.config.excalibur) s.phase = 'excalibur';
  else if (s.config.trapper) s.phase = 'trapper';
  else resolveQuest(s);
}

export function initialState(host: { id: string; name: string }): GameState {
  return {
    phase: 'lobby', hostId: host.id,
    players: [{ id: host.id, name: host.name, seat: 0, roles: [], side: 'good', currentSide: 'good', ready: false, seen: false }],
    config: defaultConfig(), mission: 1, lockedMission: null, leaderSeat: 0, rejected: 0, rejectedVoteAt: null, proposal: [], votes: {}, cards: {}, submittedCards: {}, voteHistory: [], results: [],
    winner: null, winReason: null, assassinated: [], ladyHolder: null, ladyUsed: [], ladyFindings: {},
    lancelotCards: [], lancelotApplied: [], publicEvents: [], history: [], recruited: null,
    excaliburHolder: null, trapperExcluded: null, rogueWatchHolder: null, messengerUses: {}, rogueUses: {}, cardPeeks: {}, pendingCheck: null,
    plotDeck: [], plotHands: {}, plotDrawn: [], plotPending: null, plotOpportunity: [], plotLeadUsed: false, plotPrepared: [],
    forcedPublicCard: null, inspectedCards: [], gawainExiled: false,
  };
}

export function joinRoom(state: GameState, actor: { id: string; name: string }): GameState {
  const s = structuredClone(state);
  if (s.players.some((p) => p.id === actor.id)) return s;
  if (s.phase !== 'lobby') fail('이미 시작한 게임에는 입장할 수 없습니다.');
  if (s.players.length >= s.config.playerCount) fail('방이 가득 찼습니다.');
  s.players.push({ id: actor.id, name: actor.name, seat: s.players.length, roles: [], side: 'good', currentSide: 'good', ready: false, seen: false });
  return s;
}

export function leaveRoom(state: GameState, actorId: string): GameState {
  const s = structuredClone(state);
  if (s.phase !== 'lobby') fail('시작한 게임에서는 퇴장할 수 없습니다.');
  s.players = s.players.filter((p) => p.id !== actorId).map((p, seat) => ({ ...p, seat }));
  if (!s.players.length) fail('방장은 빈 방을 삭제해 주세요.');
  if (s.hostId === actorId) s.hostId = s.players[0].id;
  return s;
}

function resetToLobby(s: GameState): GameState {
  const fresh = initialState({ id: s.players[0].id, name: s.players[0].name });
  fresh.hostId = s.hostId;
  fresh.players = s.players.map((p, seat) => ({ ...p, seat, roles: [], side: 'good', currentSide: 'good', ready: false, seen: false }));
  fresh.config = s.config;
  return fresh;
}

function finish(s: GameState, winner: Side, reason: string) {
  s.phase = 'finished'; s.winner = winner; s.winReason = reason;
  s.publicEvents.push(reason);
  if (s.results.length === 5 && !reason.includes('도적 개인 승리')) {
    for (const p of s.players) {
      if (p.currentSide === winner && has(p, winner === 'good' ? 'good_rogue' : 'evil_rogue')) s.publicEvents.push(`${p.name}님의 도적 부분 승리`);
    }
  }
}

function drawLancelotCard(s: GameState) {
  if (s.config.lancelot === 'off') return;
  const quest = s.results.at(-1)?.number;
  if (!quest || quest < 2 || quest > 4 || s.lancelotApplied.includes(quest)) return;
  const switches = s.lancelotCards[s.lancelotApplied.length];
  s.lancelotApplied.push(quest);
  s.publicEvents.push(`${quest}차 원정 후 랜슬롯 충성심 카드: ${switches ? '진영 전환' : '변화 없음'}`);
  if (switches) for (const p of s.players) if (has(p, 'good_lancelot') || has(p, 'evil_lancelot')) p.currentSide = p.currentSide === 'good' ? 'evil' : 'good';
}

function advanceAfterQuest(s: GameState) {
  const totals = score(s);
  if (totals.evil >= 3) return finish(s, 'evil', '원정 3회 실패로 악 진영 승리');
  if (totals.good >= 3) return toEndgame(s);
  const latest = s.results[s.results.length - 1];
  if (latest.number >= 2 && latest.number <= 4 && s.config.lady && s.ladyHolder && s.ladyUsed.length < 3) {
    s.phase = 'lady'; return;
  }
  drawLancelotCard(s);
  s.mission = s.config.targeting ? ([1, 2, 3, 4, 5].find((n) => !s.results.some((r) => r.number === n)) ?? 5) : s.results.length + 1;
  s.leaderSeat = nextSeat(s); s.rejected = 0; s.lockedMission = null; s.phase = 'propose';
  s.proposal = []; s.votes = {}; s.cards = {}; s.submittedCards = {}; s.excaliburHolder = null; s.trapperExcluded = null; s.rogueWatchHolder = null;
  s.forcedPublicCard = null; s.inspectedCards = [];
  prepareRound(s);
}

function toEndgame(s: GameState) {
  if (s.players.some((p) => has(p, 'untrustworthy'))) s.phase = 'recruit';
  else s.phase = 'assassinate';
}

function recordCheck(s: GameState, checker: string, target: Player, side: Side) {
  (s.ladyFindings[checker] ??= []).push({ target: target.id, side });
}

function afterLady(s: GameState) {
  drawLancelotCard(s);
  s.mission = s.config.targeting ? ([1, 2, 3, 4, 5].find((n) => !s.results.some((r) => r.number === n)) ?? 5) : s.results.length + 1;
  s.leaderSeat = nextSeat(s); s.rejected = 0; s.lockedMission = null; s.phase = 'propose';
  s.proposal = []; s.votes = {}; s.cards = {}; s.submittedCards = {}; s.excaliburHolder = null; s.trapperExcluded = null; s.rogueWatchHolder = null;
  s.forcedPublicCard = null; s.inspectedCards = [];
  prepareRound(s);
}

function beginCheck(s: GameState, checker: string, target: Player, resume: 'start' | 'lady' | 'plot') {
  if (has(target, 'trickster')) { s.pendingCheck = { checker, target: target.id, resume }; s.phase = 'loyalty_check'; return; }
  recordCheck(s, checker, target, has(target, 'troublemaker') ? 'evil' : target.currentSide);
  if (resume === 'start') prepareRound(s);
  else if (resume === 'lady') afterLady(s);
  else continuePlotDeal(s);
}

function finishAfterQuest(s: GameState) {
  const success = s.results.at(-1)?.success;
  if (success === undefined) fail('완료된 원정이 없습니다.');
  const side: Side = success ? 'good' : 'evil';
  if (score(s)[side] === 3) {
    const rogue = s.players.find((p) => has(p, side === 'good' ? 'good_rogue' : 'evil_rogue') && (s.rogueUses[p.id] ?? []).filter((n) => s.results.some((r) => r.number === n && r.success === success)).length >= 2 && (s.rogueUses[p.id] ?? []).includes(s.mission));
    if (rogue) return finish(s, side, `${rogue.name}의 도적 개인 승리`);
  }
  advanceAfterQuest(s);
}

function resolveQuest(s: GameState) {
  const entries = Object.entries(s.cards).filter(([id]) => id !== s.trapperExcluded);
  const cards = shuffled(entries.map(([, card]) => card));
  let failCount = cards.filter(isFailureCard).length;
  for (const [id, card] of entries) {
    if (card === 'good_message' || card === 'evil_message') s.messengerUses[id] = (s.messengerUses[id] ?? 0) + 1;
    if (card === 'good_rogue' || card === 'evil_rogue') s.rogueUses[id] = [...(s.rogueUses[id] ?? []), s.mission];
  }
  if (s.mission === 5 && s.players.some((p) => has(p, 'evil_messenger'))) {
    const goodMessages = Object.entries(s.messengerUses).reduce((n, [id, count]) => n + (playerById(s, id)?.roles.some((r) => r.startsWith('good_messenger')) ? count : 0), 0);
    const evilMessages = Object.entries(s.messengerUses).reduce((n, [id, count]) => n + (has(playerById(s, id)!, 'evil_messenger') ? count : 0), 0);
    if (goodMessages >= 3 && evilMessages < 2) failCount = Math.max(0, failCount - 1);
    if (evilMessages >= 2 && goodMessages < 3) failCount++;
  }
  const threshold = s.players.length >= 7 && s.mission === 4 ? 2 : 1;
  let success = failCount < threshold;
  if (cards.filter((c) => c === 'magic').length % 2) success = !success;
  const result = { number: s.mission, team: [...s.proposal], success, cards, failCount, vote: { ...s.votes }, leaderId: s.players[s.leaderSeat].id };
  s.results.push(result);
  s.publicEvents.push(`${s.mission}차 원정 ${success ? '성공' : '실패'} (실패 ${failCount}장)`);
  if (s.results.filter((r) => !r.success).length === 2) for (const p of s.players) if (has(p, 'revealer')) s.publicEvents.push(`폭로자: ${p.name}`);

  const gawain = s.players.find((p) => has(p, 'gawain'));
  const hasSubmittedFailure = s.proposal.some((id) => isFailureCard(s.submittedCards?.[id] ?? s.cards[id]));
  if (gawain && !s.gawainExiled && !s.proposal.includes(gawain.id) && hasSubmittedFailure) { s.phase = 'gawain_check'; return; }
  finishAfterQuest(s);
}

export function applyMove(state: GameState, actorId: string, move: Move): GameState {
  const s = structuredClone(state);
  s.config = normalizeConfig(s.config);
  const actor = playerById(s, actorId);
  if (!actor) throw new Error('방 참가자가 아닙니다.');
  if (move.type === 'ready') {
    if (s.phase !== 'lobby') fail('대기 중에만 준비를 바꿀 수 있습니다.');
    actor.ready = move.ready; return s;
  }
  if (move.type === 'kick') {
    if (s.phase !== 'lobby' || actorId !== s.hostId) fail('방장만 대기실에서 추방할 수 있습니다.');
    if (move.playerId === actorId) fail('방장은 자신을 추방할 수 없습니다.');
    if (!playerById(s, move.playerId)) fail('참가자를 찾을 수 없습니다.');
    s.players = s.players.filter((p) => p.id !== move.playerId).map((p, seat) => ({ ...p, seat }));
    return s;
  }
  if (move.type === 'stop') {
    if (actorId !== s.hostId || s.phase === 'lobby' || s.phase === 'finished') fail('진행 중인 게임은 방장만 종료할 수 있습니다.');
    return resetToLobby(s);
  }
  if (move.type === 'config') {
    if (s.phase !== 'lobby' || actorId !== s.hostId) fail('방장만 대기 중에 설정할 수 있습니다.');
    const error = validateConfig(move.config); if (error) fail(error);
    if (move.config.playerCount < s.players.length) fail('현재 참가자보다 적은 인원으로 설정할 수 없습니다.');
    s.config = move.config; return s;
  }
  if (move.type === 'start') {
    if (s.phase !== 'lobby' || actorId !== s.hostId) fail('방장만 시작할 수 있습니다.');
    const error = validateConfig(s.config); if (error) fail(error);
    if (s.players.length !== s.config.playerCount) fail('설정한 인원이 모두 입장해야 합니다.');
    s.gameId = crypto.randomUUID();
    s.players = assignRoles(s.players, s.config); s.leaderSeat = Math.floor(Math.random() * s.players.length);
    s.ladyHolder = s.config.lady ? s.players[(s.leaderSeat + s.players.length - 1) % s.players.length].id : null;
    if (s.ladyHolder) publicEvent(s, `호수의 여인 시작 소유자: ${playerById(s, s.ladyHolder)?.name}`);
    const arthur = s.players.find((p) => has(p, 'king_arthur'));
    if (arthur) publicEvent(s, `아서왕 공개: ${arthur.name}`);
    s.lancelotCards = s.config.lancelot === 'off' ? [] : shuffled([true, true, false, false, false, false, false]);
    s.plotDeck = s.config.plot ? shuffled(s.players.length <= 6 ? PLOT_FIVE : PLOT_SEVEN) : [];
    s.phase = 'reveal'; return s;
  }
  if (move.type === 'seen') {
    if (s.phase !== 'reveal') fail('역할 확인 단계가 아닙니다.');
    actor.seen = true;
    if (s.players.every((p) => p.seen)) {
      const cleric = s.players.find((p) => has(p, 'cleric'));
      if (cleric) beginCheck(s, cleric.id, s.players[s.leaderSeat], 'start');
      else prepareRound(s);
    }
    return s;
  }
  if (move.type === 'plot_use') {
    if (!s.config.plot) fail('플롯 카드를 사용하지 않습니다.');
    if (s.phase === 'plot_lead') {
      if (s.plotOpportunity[0] !== actorId || move.card !== 'lead_to_victory') fail('지금 리더 카드를 사용할 수 없습니다.');
      if (move.target === 'use') { removePlot(s, actorId, 'lead_to_victory'); s.leaderSeat = actor.seat; s.plotLeadUsed = true; s.publicEvents.push(`${actor.name}님이 리더가 되었습니다.`); drawPlot(s); }
      else { s.plotOpportunity.shift(); if (!s.plotOpportunity.length) drawPlot(s); }
      return s;
    }
    if (!['plot_king', 'plot_forced', 'plot_ambush'].includes(s.phase) || s.plotOpportunity[0] !== actorId) fail('지금 사용할 수 없는 카드입니다.');
    const phase = s.phase;
    const expected: PlotCard = phase === 'plot_king' ? 'king_returns' : phase === 'plot_forced' ? 'we_found_you' : 'ambush';
    if (move.card !== expected) fail('카드 종류를 확인해 주세요.');
    if (move.target && move.target !== 'pass') {
      removePlot(s, actorId, expected);
      if (phase === 'plot_king') {
        s.rejected++; s.publicEvents.push('The King Returns: 승인된 팀이 부결되었습니다.');
        s.rejectedVoteAt = new Date().toISOString();
        if (s.voteHistory.length) s.voteHistory[s.voteHistory.length - 1].approved = false;
        if (s.rejected >= 5) finish(s, 'evil', '같은 원정에서 팀 5회 부결로 악 진영 승리');
        else { s.leaderSeat = nextSeat(s); s.phase = 'propose'; s.proposal = []; }
        return s;
      }
      if (!s.proposal.includes(move.target)) fail('원정 팀원을 선택해 주세요.');
      if (phase === 'plot_forced') { s.forcedPublicCard = move.target; s.publicEvents.push(`${playerById(s, move.target)?.name}님의 원정 카드가 공개 제출됩니다.`); }
      else {
        if (s.inspectedCards.includes(move.target)) fail('이 팀원의 카드는 이미 확인되었습니다.');
        s.inspectedCards.push(move.target);
        (s.cardPeeks[actorId] ??= []).push({ target: move.target, card: s.cards[move.target] });
        s.publicEvents.push(`${actor.name}님이 원정 카드 한 장을 비밀 확인했습니다.`);
      }
    }
    s.plotOpportunity.shift();
    if (phase === 'plot_king' && !s.plotOpportunity.length) beginQuestEffects(s);
    if (phase === 'plot_forced' && !s.plotOpportunity.length) s.phase = 'quest';
    if (phase === 'plot_ambush') afterAmbush(s);
    return s;
  }
  if (move.type === 'plot_give') {
    if (s.phase !== 'plot_distribute' || actor.seat !== s.leaderSeat || !s.plotDrawn.length || move.holder === actorId || !playerById(s, move.holder)) fail('플롯 카드를 받을 사람을 선택해 주세요.');
    const card = s.plotDrawn.shift()!;
    (s.plotHands[move.holder] ??= []).push(card);
    s.publicEvents.push(`${actor.name}님이 ${playerById(s, move.holder)?.name}님에게 ${plotLabel[card]} 카드를 전달했습니다.`);
    if (['are_you_the_one', 'show_your_strength', 'show_your_true_nature', 'restore_your_honor'].includes(card)) { s.plotPending = { card, holder: move.holder }; s.phase = 'plot_immediate'; }
    else continuePlotDeal(s);
    if (card === 'restore_your_honor' && !s.players.some((p) => p.id !== move.holder && (s.plotHands[p.id] ?? []).length)) { removePlot(s, move.holder, card); continuePlotDeal(s); }
    return s;
  }
  if (move.type === 'plot_apply') {
    const pending = s.plotPending;
    if (s.phase !== 'plot_immediate' || !pending) throw new Error('처리할 플롯 카드가 없습니다.');
    const { card, holder } = pending;
    const requiredActor = card === 'show_your_strength' ? s.players[s.leaderSeat].id : holder;
    if (actorId !== requiredActor) fail('현재 카드 행동을 할 수 없습니다.');
    if (!move.target) throw new Error('대상을 선택해 주세요.');
    const target = playerById(s, move.target);
    if (!target) throw new Error('참가자를 선택해 주세요.');
    if (card === 'restore_your_honor') {
      if (target.id === holder || !move.card || !(s.plotHands[target.id] ?? []).includes(move.card)) throw new Error('다른 사람의 보유 카드를 선택해 주세요.');
      removePlot(s, target.id, move.card); (s.plotHands[holder] ??= []).push(move.card);
      publicEvent(s, `${playerById(s, holder)?.name}님이 ${plotLabel[card]} 카드를 사용했습니다.`);
      removePlot(s, holder, card); continuePlotDeal(s); return s;
    }
    if (card === 'are_you_the_one') {
      const seat = playerById(s, holder)!.seat;
      if (![ (seat + 1) % s.players.length, (seat + s.players.length - 1) % s.players.length ].includes(target.seat)) fail('인접한 사람만 조사할 수 있습니다.');
      publicEvent(s, `${playerById(s, holder)?.name}님이 ${plotLabel[card]} 카드를 사용했습니다.`);
      removePlot(s, holder, card); s.plotPending = null; beginCheck(s, holder, target, 'plot'); return s;
    }
    if (card === 'show_your_strength') {
      if (target.id === actorId) fail('다른 사람에게 보여 주세요.');
      publicEvent(s, `${playerById(s, holder)?.name}님이 ${plotLabel[card]} 카드를 사용했습니다.`);
      removePlot(s, holder, card); s.plotPending = null; beginCheck(s, target.id, actor, 'plot'); return s;
    }
    if (card === 'show_your_true_nature') {
      if (target.id === holder) fail('다른 사람에게 보여 주세요.');
      publicEvent(s, `${playerById(s, holder)?.name}님이 ${plotLabel[card]} 카드를 사용했습니다.`);
      removePlot(s, holder, card); s.plotPending = null; beginCheck(s, target.id, playerById(s, holder)!, 'plot'); return s;
    }
    return fail('지원하지 않는 플롯 카드입니다.');
  }
  if (move.type === 'propose') {
    if (s.phase !== 'propose' || actor.seat !== s.leaderSeat) fail('현재 리더만 팀을 제안할 수 있습니다.');
    if (s.rejectedVoteAt && Date.now() - Date.parse(s.rejectedVoteAt) < REJECTED_VOTE_REVEAL_MS) fail('부결 투표 결과를 5초간 공개한 뒤 팀을 제안할 수 있습니다.');
    const mission = s.config.targeting ? (move.mission ?? s.mission) : s.mission;
    if (!Number.isInteger(mission) || mission < 1 || mission > 5 || s.results.some((r) => r.number === mission)) fail('선택할 수 없는 원정입니다.');
    if (s.lockedMission !== null && mission !== s.lockedMission) fail('이번 원정의 목표는 이미 정해졌습니다.');
    if (s.config.targeting && mission === 5 && s.results.filter((r) => r.success).length < 2) fail('5차 원정은 다른 원정 2개가 성공해야 선택할 수 있습니다.');
    const size = TEAM_COUNTS[s.players.length][mission - 1] + Number(s.config.trapper);
    if (move.team.length !== size || new Set(move.team).size !== size || move.team.some((id) => !playerById(s, id))) fail(`팀원 ${size}명을 선택해 주세요.`);
    if (s.gawainExiled && move.team.some((id) => has(playerById(s, id)!, 'gawain'))) fail('추방된 가웨인은 원정대에 참가할 수 없습니다.');
    if (s.config.excalibur && (!move.excaliburHolder || !move.team.includes(move.excaliburHolder) || move.excaliburHolder === actorId)) fail('엑스칼리버는 리더가 아닌 팀원에게 주세요.');
    const watchNeeded = s.players.some((p) => has(p, 'good_rogue') || has(p, 'evil_rogue')) && (s.players.length >= 7 || mission > 2);
    if (watchNeeded && (!move.rogueWatchHolder || !move.team.includes(move.rogueWatchHolder))) fail('감시 대상을 원정 팀에서 선택해 주세요.');
    s.mission = mission; s.lockedMission = mission; s.proposal = [...move.team]; s.excaliburHolder = s.config.excalibur ? move.excaliburHolder! : null;
    s.rogueWatchHolder = watchNeeded ? move.rogueWatchHolder! : null;
    if (s.excaliburHolder) publicEvent(s, `${mission}차 원정 엑스칼리버: ${actor.name} → ${playerById(s, s.excaliburHolder)?.name}`);
    if (s.rogueWatchHolder) publicEvent(s, `${mission}차 원정 도적 감시 대상: ${playerById(s, s.rogueWatchHolder)?.name}`);
    s.votes = {}; s.rejectedVoteAt = null; s.phase = 'vote'; return s;
  }
  if (move.type === 'vote') {
    if (s.phase !== 'vote' || actorId in s.votes) fail('투표할 수 없습니다.');
    const charged = s.players.filter((p) => (s.plotHands[p.id] ?? []).includes('charge'));
    if (charged.some((p) => !(p.id in s.votes)) && !charged.some((p) => p.id === actorId)) fail('Charge! 보유자의 공개 투표를 기다려 주세요.');
    s.votes[actorId] = move.approve;
    if (Object.keys(s.votes).length === s.players.length) {
      const approvals = Object.values(s.votes).filter(Boolean).length;
      s.voteHistory.push({ mission: s.mission, team: [...s.proposal], votes: { ...s.votes }, approved: approvals > s.players.length / 2, leaderId: s.players[s.leaderSeat].id });
      if (approvals > s.players.length / 2) {
        s.rejectedVoteAt = null;
        if (s.config.plot) {
          s.plotOpportunity = s.players.filter((p) => (s.plotHands[p.id] ?? []).includes('king_returns')).map((p) => p.id);
          if (s.plotOpportunity.length) s.phase = 'plot_king'; else beginQuestEffects(s);
        } else s.phase = 'quest';
      }
      else {
        s.rejected++; s.publicEvents.push(`${s.mission}차 팀 투표 부결 (${s.rejected}/5)`);
        s.rejectedVoteAt = new Date().toISOString();
        if (s.rejected === 5) finish(s, 'evil', '같은 원정에서 팀 5회 부결로 악 진영 승리');
        else { s.leaderSeat = nextSeat(s); s.phase = 'propose'; s.proposal = []; }
      }
    }
    return s;
  }
  if (move.type === 'quest') {
    if (s.phase !== 'quest' || !s.proposal.includes(actorId) || actorId in s.cards) fail('원정 카드를 낼 수 없습니다.');
    if (!allowedCards(actor, s).includes(move.card) || (actor.id === s.rogueWatchHolder && (move.card === 'good_rogue' || move.card === 'evil_rogue'))) fail('이 직업은 해당 원정 카드를 낼 수 없습니다.');
    if (move.card === 'good_message' && (s.messengerUses[actorId] ?? 0) >= 2) fail('선 전령 카드는 게임 중 두 번만 쓸 수 있습니다.');
    s.cards[actorId] = move.card;
    (s.submittedCards ??= {})[actorId] = move.card;
    if (s.forcedPublicCard === actorId) publicEvent(s, `${s.mission}차 원정 공개 제출: ${actor.name} → ${cardLabel[move.card]}`);
    if (Object.keys(s.cards).length === s.proposal.length) {
      afterQuestCards(s);
    }
    return s;
  }
  if (move.type === 'gawain_check') {
    if (s.phase !== 'gawain_check' || !has(actor, 'gawain') || s.gawainExiled || s.proposal.includes(actorId)) fail('이번 원정에 참가하지 않은 가웨인만 카드를 확인할 수 있습니다.');
    if (!s.proposal.includes(move.target) || !(move.target in s.cards)) fail('이번 원정의 팀원을 선택해 주세요.');
    const inspectedCard = s.submittedCards?.[move.target] ?? s.cards[move.target];
    (s.cardPeeks[actorId] ??= []).push({ target: move.target, card: inspectedCard });
    const foundSuccess = isSuccessCard(inspectedCard);
    if (foundSuccess) {
      s.gawainExiled = true;
    }
    publicEvent(s, gawainCheckEvent(s.mission, actor.name, playerById(s, move.target)!.name, inspectedCard));
    finishAfterQuest(s);
    return s;
  }
  if (move.type === 'excalibur') {
    if (s.phase !== 'excalibur' || actorId !== s.excaliburHolder) fail('엑스칼리버 소유자만 사용할 수 있습니다.');
    if (move.target) {
      if (!s.proposal.includes(move.target) || move.target === actorId) fail('다른 팀원을 선택해 주세요.');
      const previous = s.cards[move.target];
      s.cards[move.target] = previous === 'success' ? 'fail' : 'success';
      (s.cardPeeks[actorId] ??= []).push({ target: move.target, card: previous });
      publicEvent(s, `${s.mission}차 원정 엑스칼리버: ${actor.name}님이 ${playerById(s, move.target)?.name}님의 카드를 교체했습니다.`);
    } else {
      publicEvent(s, `${s.mission}차 원정 엑스칼리버: ${actor.name}님이 사용하지 않았습니다.`);
    }
    if (s.config.trapper) s.phase = 'trapper'; else resolveQuest(s);
    return s;
  }
  if (move.type === 'trapper') {
    if (s.phase !== 'trapper' || actor.seat !== s.leaderSeat || !s.proposal.includes(move.target)) fail('리더가 제외할 카드를 선택해 주세요.');
    s.trapperExcluded = move.target;
    (s.cardPeeks[actorId] ??= []).push({ target: move.target, card: s.cards[move.target] });
    publicEvent(s, `${s.mission}차 원정 함정꾼: 리더가 카드 한 장을 판정에서 제외했습니다.`);
    resolveQuest(s); return s;
  }
  if (move.type === 'lady') {
    if (s.phase !== 'lady' || actorId !== s.ladyHolder || move.target === actorId || s.ladyUsed.includes(move.target)) fail('호수의 여인 조사 대상을 선택할 수 없습니다.');
    const target = playerById(s, move.target); if (!target) throw new Error('참가자를 선택해 주세요.');
    s.ladyUsed.push(actorId); s.ladyHolder = target.id;
    publicEvent(s, `${s.mission}차 원정 후 호수의 여인: ${actor.name} → ${target.name}`);
    beginCheck(s, actorId, target, 'lady');
    return s;
  }
  if (move.type === 'loyalty_reply') {
    const pending = s.pendingCheck;
    if (s.phase !== 'loyalty_check' || !pending || pending.target !== actorId || !has(actor, 'trickster')) throw new Error('진영 응답을 선택할 수 없습니다.');
    recordCheck(s, pending.checker, actor, move.side);
    s.pendingCheck = null;
    if (pending.resume === 'start') prepareRound(s);
    else if (pending.resume === 'lady') afterLady(s);
    else continuePlotDeal(s);
    return s;
  }
  if (move.type === 'recruit') {
    if (s.phase !== 'recruit' || !has(actor, 'assassin')) fail('암살자만 모집할 수 있습니다.');
    const target = playerById(s, move.target); if (!target || target.id === actorId) throw new Error('대상을 선택해 주세요.');
    if (has(target, 'untrustworthy')) { target.currentSide = 'evil'; s.recruited = target.id; s.publicEvents.push('불신의 충신이 악 진영에 모집되었습니다.'); }
    s.phase = 'assassinate'; return s;
  }
  if (move.type === 'assassinate') {
    if (s.phase !== 'assassinate' || (!has(actor, 'assassin') && actorId !== s.recruited) || (s.recruited && actorId !== s.recruited)) fail('암살 담당자만 선택할 수 있습니다.');
    const target = playerById(s, move.target); if (!target || target.id === actorId || target.currentSide !== 'good') throw new Error('선 진영 참가자를 선택해 주세요.');
    if (move.targetType === 'lovers') {
      if (!s.players.some((p) => has(p, 'tristan')) || !s.players.some((p) => has(p, 'isolde')) || !move.secondTarget || move.secondTarget === move.target || playerById(s, move.secondTarget)?.currentSide !== 'good') throw new Error('서로 다른 선 진영 연인 후보 두 명을 선택해 주세요.');
      const second = playerById(s, move.secondTarget)!;
      const correct = [target, second].some((p) => has(p, 'tristan')) && [target, second].some((p) => has(p, 'isolde'));
      s.assassinated = [target.id, second.id];
      finish(s, correct ? 'evil' : 'good', correct ? '트리스탄과 이졸데 암살 성공' : '트리스탄과 이졸데 암살 실패');
      return s;
    }
    if (move.targetType === 'messengers') {
      if (!s.players.some((p) => has(p, 'evil_messenger')) || !move.secondTarget || move.secondTarget === move.target || playerById(s, move.secondTarget)?.currentSide !== 'good') throw new Error('서로 다른 선 진영 전령 후보 두 명을 선택해 주세요.');
      const second = playerById(s, move.secondTarget)!;
      const correct = [target, second].every((p) => has(p, 'good_messenger_senior') || has(p, 'good_messenger_junior'));
      s.assassinated = [target.id, second.id];
      finish(s, correct ? 'evil' : 'good', correct ? '선 전령 두 명 암살 성공' : '선 전령 암살 실패');
      return s;
    }
    s.assassinated = [target.id];
    finish(s, has(target, 'merlin') ? 'evil' : 'good', has(target, 'merlin') ? '멀린 암살 성공' : '멀린 암살 실패');
    return s;
  }
  return fail('현재 단계에서 사용할 수 없는 행동입니다.');
}

export function historyFromState(s: GameState): HistoryEntry[] {
  if (s.history) return s.history;
  const history: HistoryEntry[] = [];
  const usedResults = new Set<number>();
  s.voteHistory.forEach((vote, index) => {
    history.push({ type: 'vote', index });
    const resultIndex = s.results.findIndex((result, candidate) => !usedResults.has(candidate) && result.number === vote.mission);
    if (vote.approved && resultIndex !== -1) {
      history.push({ type: 'quest', index: resultIndex });
      usedResults.add(resultIndex);
    }
  });
  s.results.forEach((_, index) => { if (!usedResults.has(index)) history.push({ type: 'quest', index }); });
  s.publicEvents.forEach((_, index) => history.push({ type: 'event', index }));
  return history;
}

export function publicView(s: GameState, actorId: string) {
  const actor = playerById(s, actorId);
  if (!actor) throw new Error('방 참가자가 아닙니다.');
  const finished = s.phase === 'finished';
  const revealSides = finished || s.phase === 'assassinate';
  return {
    phase: s.phase, phaseStartedAt: s.phaseStartedAt ?? null, hostId: s.hostId, config: normalizeConfig(s.config), mission: s.mission, lockedMission: s.lockedMission, gawainExiled: s.gawainExiled ?? false,
    leaderSeat: s.leaderSeat, rejected: s.rejected, rejectedVoteAt: s.rejectedVoteAt ?? null, proposal: s.proposal,
    players: s.players.map((p) => ({ id: p.id, name: p.name, seat: p.seat, ready: p.ready, seen: p.seen,
      publicRoles: [
        ...(has(p, 'king_arthur') && s.phase !== 'lobby' ? ['king_arthur' as const] : []),
        ...(s.gawainExiled && has(p, 'gawain') ? ['gawain' as const] : []),
      ],
      roles: finished || p.id === actorId ? p.roles : [],
      side: revealSides || p.id === actorId ? p.currentSide : null })),
    myRole: s.phase === 'lobby' ? [] : actor.roles, mySide: s.phase === 'lobby' ? null : actor.currentSide,
    myKnowledge: s.phase === 'lobby' ? [] : knows(s, actor),
    myFindings: s.ladyFindings[actorId] ?? [],
    pendingCheck: s.pendingCheck && { target: s.pendingCheck.target, checker: s.pendingCheck.checker },
    myCardPeeks: s.cardPeeks[actorId] ?? [],
    myAllowedCards: s.phase === 'quest' && s.proposal.includes(actorId) ? allowedCards(actor, s) : [],
    voted: actorId in s.votes, voteCount: Object.keys(s.votes).length, voteSubmitted: Object.keys(s.votes),
    votes: s.phase === 'vote' ? null : s.votes,
    earlyVotes: s.phase === 'vote' && s.players.filter((p) => (s.plotHands[p.id] ?? []).includes('charge')).every((p) => p.id in s.votes)
      ? Object.fromEntries(Object.entries(s.votes).filter(([id]) => (s.plotHands[id] ?? []).includes('charge'))) : {},
    cardSubmitted: actorId in s.cards, cardCount: Object.keys(s.cards).length, cardSubmitters: Object.keys(s.cards),
    results: s.results.map(({ number, team, success, cards, failCount, vote, leaderId }) => ({ number, team, success, cards, failCount, vote, leaderId })),
    voteHistory: s.voteHistory,
    winner: s.winner, winReason: s.winReason, assassinated: finished ? s.assassinated ?? [] : [], ladyHolder: s.ladyHolder,
    ladyUsed: s.ladyUsed, lancelotCards: s.lancelotCards.slice(0, s.lancelotApplied.length),
    publicEvents: s.publicEvents, history: historyFromState(s), historyApproximate: s.historyApproximate ?? !s.history, recruited: s.recruited, excaliburHolder: s.excaliburHolder, rogueWatchHolder: s.rogueWatchHolder,
    plotHands: s.plotHands, plotDrawn: s.plotDrawn, plotPending: s.plotPending,
    plotOpportunity: s.plotOpportunity, forcedPublicCard: s.forcedPublicCard,
    publicQuestCard: s.forcedPublicCard ? s.cards[s.forcedPublicCard] ?? null : null,
  };
}

export type AvalonView = ReturnType<typeof publicView>;
