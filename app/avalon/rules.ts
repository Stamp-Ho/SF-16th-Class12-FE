export const TEAM_COUNTS: Record<number, number[]> = {
  5: [2, 3, 2, 3, 3], 6: [2, 3, 4, 3, 4],
  7: [2, 3, 3, 4, 4], 8: [3, 4, 4, 5, 5],
  9: [3, 4, 4, 5, 5], 10: [3, 4, 4, 5, 5],
};
export const GOOD_COUNTS: Record<number, number> = { 5: 3, 6: 4, 7: 4, 8: 5, 9: 6, 10: 6 };
export const REJECTED_VOTE_REVEAL_MS = 5000;

export const ROLES = {
  merlin: { name: '멀린', side: 'good', expansion: false },
  percival: { name: '퍼시벌', side: 'good', expansion: false },
  good_lancelot: { name: '선 랜슬롯', side: 'good', expansion: false },
  assassin: { name: '암살자', side: 'evil', expansion: false },
  mordred: { name: '모드레드', side: 'evil', expansion: false },
  oberon: { name: '오베론', side: 'evil', expansion: false },
  morgana: { name: '모르가나', side: 'evil', expansion: false },
  evil_lancelot: { name: '악 랜슬롯', side: 'evil', expansion: false },
  cleric: { name: '성직자', side: 'good', expansion: true },
  troublemaker: { name: '문제아', side: 'good', expansion: true },
  untrustworthy: { name: '불신의 충신', side: 'good', expansion: true },
  good_rogue: { name: '선 도적', side: 'good', expansion: true },
  good_sorcerer: { name: '선 마법사', side: 'good', expansion: true },
  good_messenger_senior: { name: '선 상급 전령', side: 'good', expansion: true },
  good_messenger_junior: { name: '선 하급 전령', side: 'good', expansion: true },
  lunatic: { name: '광인', side: 'evil', expansion: true },
  brute: { name: '폭력배', side: 'evil', expansion: true },
  revealer: { name: '폭로자', side: 'evil', expansion: true },
  trickster: { name: '사기꾼', side: 'evil', expansion: true },
  evil_rogue: { name: '악 도적', side: 'evil', expansion: true },
  evil_sorcerer: { name: '악 마법사', side: 'evil', expansion: true },
  evil_messenger: { name: '악 전령', side: 'evil', expansion: true },
} as const;

export type Role = keyof typeof ROLES;
export type Side = 'good' | 'evil';
export type Card = 'success' | 'fail' | 'magic' | 'good_message' | 'evil_message' | 'good_rogue' | 'evil_rogue';
export const PLOT_CARDS = ['are_you_the_one', 'charge', 'show_your_strength', 'show_your_true_nature', 'king_returns', 'ambush', 'lead_to_victory', 'we_found_you', 'restore_your_honor'] as const;
export type PlotCard = typeof PLOT_CARDS[number];
export type Phase = 'lobby' | 'reveal' | 'loyalty_check' | 'plot_lead' | 'plot_distribute' | 'plot_immediate' | 'plot_king' | 'plot_forced' | 'plot_ambush' | 'propose' | 'vote' | 'quest' | 'excalibur' | 'trapper' | 'lady' | 'recruit' | 'assassinate' | 'finished';
export type Player = { id: string; name: string; seat: number; roles: Role[]; side: Side; currentSide: Side; ready: boolean; seen: boolean };
export type Config = {
  playerCount: number;
  expansion: boolean;
  goodSlots: Role[][];
  evilSlots: Role[][];
  lady: boolean;
  lancelot: 'off' | 'variant1' | 'variant2';
  targeting: boolean;
  trapper: boolean;
  excalibur: boolean;
  plot: boolean;
  seniorKnowsJunior: boolean;
};
export type MissionResult = { number: number; team: string[]; success: boolean; cards: Card[]; failCount: number; vote: Record<string, boolean>; leaderId?: string };
export type HistoryEntry = { type: 'vote' | 'quest' | 'event'; index: number };
export type GameState = {
  phase: Phase; phaseStartedAt?: string; hostId: string; players: Player[]; config: Config;
  mission: number; lockedMission: number | null; leaderSeat: number; rejected: number; rejectedVoteAt?: string | null; proposal: string[];
  votes: Record<string, boolean>; cards: Record<string, Card>;
  voteHistory: { mission: number; team: string[]; votes: Record<string, boolean>; approved: boolean; leaderId?: string }[];
  results: MissionResult[]; winner: Side | null; winReason: string | null; assassinated?: string[];
  ladyHolder: string | null; ladyUsed: string[]; ladyFindings: Record<string, { target: string; side: Side }[]>;
  lancelotCards: boolean[]; lancelotApplied: number[];
  publicEvents: string[]; history?: HistoryEntry[]; historyApproximate?: boolean; recruited: string | null;
  excaliburHolder: string | null; trapperExcluded: string | null;
  rogueWatchHolder: string | null;
  messengerUses: Record<string, number>; rogueUses: Record<string, number[]>;
  cardPeeks: Record<string, { target: string; card: Card }[]>;
  pendingCheck: { checker: string; target: string; resume: 'start' | 'lady' | 'plot' } | null;
  plotDeck: PlotCard[]; plotHands: Record<string, PlotCard[]>; plotDrawn: PlotCard[];
  plotPending: { card: PlotCard; holder: string } | null;
  plotOpportunity: string[]; plotLeadUsed: boolean; plotPrepared: number[];
  forcedPublicCard: string | null; inspectedCards: string[];
};

export function defaultConfig(count = 5): Config {
  const good = GOOD_COUNTS[count], evil = count - good;
  const goodRoles: Role[][] = [['merlin'], ['percival']];
  const evilRoles: Role[][] = [['assassin'], ['morgana']];
  if (count >= 8) evilRoles.push(['mordred']);
  if (count === 10) goodRoles.push(['cleric']);
  return {
    playerCount: count, expansion: count === 10,
    goodSlots: [...goodRoles, ...Array.from({ length: good - goodRoles.length }, () => [] as Role[])],
    evilSlots: [...evilRoles, ...Array.from({ length: evil - evilRoles.length }, () => [] as Role[])],
    lady: false, lancelot: 'off', targeting: false, trapper: false,
    excalibur: false, plot: false, seniorKnowsJunior: false,
  };
}

// 과거에 저장된 방 설정에서 존재하지 않는 직업(예: 'servant')을 제거한다. 선 진영의 빈 슬롯이 충신이다.
export function normalizeConfig(c: Config): Config {
  const clean = (slots: Role[][]) => slots.map((slot) => slot.filter((r) => r in ROLES));
  return { ...c, goodSlots: clean(c.goodSlots), evilSlots: clean(c.evilSlots) };
}

export function validateConfig(c: Config): string | null {
  if (!Number.isInteger(c.playerCount) || c.playerCount < 5 || c.playerCount > 10) return '인원은 5~10명이어야 합니다.';
  if (c.goodSlots.length !== GOOD_COUNTS[c.playerCount] || c.evilSlots.length !== c.playerCount - GOOD_COUNTS[c.playerCount]) return '진영별 자리 수가 맞지 않습니다.';
  const all = [...c.goodSlots, ...c.evilSlots];
  for (let i = 0; i < all.length; i++) {
    const roles = all[i];
    if (new Set(roles).size !== roles.length) return '한 자리에서 직업이 중복되었습니다.';
    if (roles.some((r) => !(r in ROLES))) return '알 수 없는 직업이 있습니다.';
    const side = i < c.goodSlots.length ? 'good' : 'evil';
    if (roles.some((r) => ROLES[r].side !== side)) return '서로 다른 진영의 직업을 중첩할 수 없습니다.';
    if (roles.includes('merlin') && roles.length !== 1) return '멀린은 다른 직업과 중첩할 수 없습니다.';
    if (roles.some((r) => ROLES[r].expansion) && !c.expansion) return '추가 직업은 확장을 켠 뒤 선택해 주세요.';
    if (roles.includes('lunatic') && (roles.includes('brute') || roles.includes('evil_sorcerer'))) return '광인과 폭력배/악 마법사는 원정 카드 규칙이 충돌합니다.';
    if (c.lancelot === 'variant2' && roles.includes('evil_lancelot') && (roles.includes('brute') || roles.includes('evil_sorcerer'))) return '랜슬롯 변형 2와 폭력배/악 마법사는 원정 카드 규칙이 충돌합니다.';
  }
  const has = (role: Role) => all.some((s) => s.includes(role));
  const occurrences = (role: Role) => all.reduce((n, s) => n + Number(s.includes(role)), 0);
  if (occurrences('merlin') !== 1 || occurrences('assassin') !== 1) return '멀린과 암살자는 각각 한 명이어야 합니다.';
  for (const role of Object.keys(ROLES) as Role[]) if (occurrences(role) > 1) return `${ROLES[role].name}은 한 게임에 한 명만 배정할 수 있습니다.`;
  if (has('morgana') && !has('percival')) return '모르가나를 사용하려면 퍼시벌이 필요합니다.';
  if (has('good_lancelot') !== has('evil_lancelot') || has('good_lancelot') !== (c.lancelot !== 'off')) return '랜슬롯 두 명과 변형 규칙을 함께 설정해 주세요.';
  if (has('good_lancelot') && (occurrences('good_lancelot') !== 1 || occurrences('evil_lancelot') !== 1)) return '선/악 랜슬롯은 각각 한 명이어야 합니다.';
  if (has('good_sorcerer') !== has('evil_sorcerer')) return '선/악 마법사는 함께 사용합니다.';
  const messengers = ['good_messenger_senior', 'good_messenger_junior', 'evil_messenger'] as const;
  if (messengers.some(has) && !messengers.every(has)) return '전령 세 명을 함께 사용해 주세요.';
  if (c.seniorKnowsJunior && !messengers.every(has)) return '전령 규칙을 먼저 켜 주세요.';
  if (!c.expansion && (c.trapper || c.excalibur || c.plot || c.seniorKnowsJunior)) return '확장 모듈은 확장을 켠 뒤 사용해 주세요.';
  if (c.playerCount === 5 && has('percival') && !has('mordred') && !has('morgana')) return '5인 퍼시벌 게임에는 모드레드나 모르가나를 넣어 주세요.';
  if (has('good_lancelot') && c.goodSlots.some((s) => s.includes('good_lancelot') && s.includes('merlin'))) return '랜슬롯은 멀린과 중첩할 수 없습니다.';
  return null;
}

export function shuffled<T>(values: T[]): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function assignRoles(players: Player[], config: Config): Player[] {
  const ordered = shuffled(players);
  const good = shuffled(config.goodSlots), evil = shuffled(config.evilSlots);
  return ordered.map((p, i) => {
    const isGood = i < good.length;
    const side: Side = isGood ? 'good' : 'evil';
    return { ...p, roles: [...(isGood ? good[i] : evil[i - good.length])], side, currentSide: side, seen: false };
  }).sort((a, b) => a.seat - b.seat);
}

export function knows(state: GameState, actor: Player): { players: string[]; label: string }[] {
  const has = (p: Player, r: Role) => p.roles.includes(r);
  const rows: { players: string[]; label: string }[] = [];
  if (has(actor, 'merlin')) rows.push({ label: '악으로 보이는 사람', players: state.players.filter((p) => p.id !== actor.id && ((p.side === 'evil' && !has(p, 'mordred') && !has(p, 'evil_rogue')) || has(p, 'untrustworthy'))).map((p) => p.name) });
  if (has(actor, 'percival')) rows.push({ label: '멀린 후보', players: state.players.filter((p) => has(p, 'merlin') || has(p, 'morgana')).map((p) => p.name) });
  if (actor.side === 'evil' && !['oberon', 'evil_lancelot', 'evil_rogue'].some((r) => actor.roles.includes(r as Role))) rows.push({ label: '알고 있는 악 동료', players: state.players.filter((p) => p.id !== actor.id && p.side === 'evil' && !has(p, 'oberon') && !has(p, 'evil_rogue')).map((p) => p.name) });
  if (has(actor, 'untrustworthy')) rows.push({ label: '암살자', players: state.players.filter((p) => has(p, 'assassin')).map((p) => p.name) });
  if (has(actor, 'good_messenger_senior') && state.config.seniorKnowsJunior) rows.push({ label: '하급 전령', players: state.players.filter((p) => has(p, 'good_messenger_junior')).map((p) => p.name) });
  return rows;
}

export function allowedCards(player: Player, state: GameState): Card[] {
  if (player.currentSide === 'good') {
    if (player.roles.includes('good_lancelot') && state.config.lancelot === 'variant2') return ['success'];
    const cards: Card[] = ['success'];
    if (player.roles.includes('good_sorcerer')) cards.push('magic');
    if (player.roles.includes('good_messenger_senior') || player.roles.includes('good_messenger_junior')) cards.push('good_message');
    if (player.roles.includes('good_rogue') && state.rogueWatchHolder !== player.id) cards.push('good_rogue');
    return cards;
  }
  if (player.roles.includes('lunatic') || ((player.roles.includes('good_lancelot') || player.roles.includes('evil_lancelot')) && state.config.lancelot === 'variant2')) return ['fail'];
  if (player.roles.includes('evil_sorcerer')) return ['success', 'magic'];
  const cards: Card[] = ['success'];
  if (!(player.roles.includes('brute') && state.mission > 3)) cards.push('fail');
  if (player.roles.includes('evil_messenger')) cards.push('evil_message');
  if (player.roles.includes('evil_rogue') && state.rogueWatchHolder !== player.id) cards.push('evil_rogue');
  return cards;
}
