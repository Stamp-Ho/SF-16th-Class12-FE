'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BookOpen, X } from 'lucide-react';
import { GOOD_COUNTS, PLOT_CARDS, ROLES, TEAM_COUNTS, type PlotCard, type Role } from './rules';
import type { AvalonView } from './engine';
import styles from './RulebookModal.module.css';

const roleRules: Record<Role, string> = {
  merlin: '시작할 때 악 후보를 본다. 모드레드·악 도적 등 은폐 능력은 보이지 않고, 불신의 충신은 악처럼 보인다.',
  percival: '멀린을 본다. 모르가나가 있으면 두 후보를 구별할 수 없다.',
  good_lancelot: '악 랜슬롯과 한 쌍이다. 충성심 카드에 따라 현재 진영이 바뀔 수 있다.',
  assassin: '선이 원정 3개를 성공하면 멀린 또는 선택 규칙의 선 전령 두 명을 지목한다.',
  mordred: '멀린에게 보이지 않는 악이다.',
  oberon: '다른 악을 보지 못하고 다른 악에게도 보이지 않는다.',
  morgana: '퍼시벌에게 멀린 후보로 보인다.',
  evil_lancelot: '시작할 때 다른 악을 보지 못한다. 충성심 카드에 따라 현재 진영이 바뀔 수 있다.',
  cleric: '시작 리더의 진영을 비밀리에 확인한다.',
  troublemaker: '진영을 조사받으면 실제와 반대 진영으로 응답한다.',
  untrustworthy: '암살자를 안다. 멀린에게 악처럼 보이며 선 3승 뒤 암살자에게 모집될 수 있다.',
  good_rogue: '전용 성공 카드로 세 번째 성공 원정과 앞선 성공 원정에 참여하면 개인 승리를 노린다.',
  good_sorcerer: '원정에서 마법 카드를 낼 수 있다.',
  good_messenger_senior: '게임 중 최대 두 번 선 전령 카드를 낸다. 설정에 따라 하급 전령을 안다.',
  good_messenger_junior: '게임 중 최대 두 번 선 전령 카드를 낸다.',
  lunatic: '참여한 원정마다 반드시 실패 카드를 낸다.',
  brute: '1~3차 원정에서만 실패 카드를 낼 수 있다.',
  revealer: '두 번째 원정 실패 직후 정체가 공개된다.',
  trickster: '진영을 조사받을 때 선 또는 악으로 응답할 수 있다.',
  evil_rogue: '다른 악과 멀린에게 보이지 않는다. 전용 실패 카드로 개인 승리를 노린다.',
  evil_sorcerer: '원정에서 성공 또는 마법 카드만 낸다.',
  evil_messenger: '악 전령 카드를 낸다. 선 3승 뒤 선 전령 두 명이 암살 대상이 될 수 있다.',
};

const plotRules: Record<PlotCard, string> = {
  are_you_the_one: '받은 사람이 인접한 한 사람의 진영을 비밀리에 조사한다.',
  charge: '받은 사람의 투표를 다른 참가자보다 먼저 공개한다. 게임 끝까지 유지한다.',
  show_your_strength: '리더가 다른 한 사람에게 자신의 진영을 비밀리에 보여준다.',
  show_your_true_nature: '받은 사람이 고른 한 사람에게 자신의 진영을 비밀리에 보여준다.',
  king_returns: '승인된 원정대를 부결 처리한다. 다섯 번째 부결에도 포함된다.',
  ambush: '제출된 원정 카드 한 장을 비밀리에 확인한다.',
  lead_to_victory: '현재 리더가 행동하기 전에 사용해 새 리더가 된다.',
  we_found_you: '지정한 원정 팀원의 원정 카드를 공개 제출하게 한다.',
  restore_your_honor: '다른 사람이 보유한 플롯 카드 한 장을 가져온다.',
};

const plotNames: Record<PlotCard, string> = {
  are_you_the_one: 'Are You the One?', charge: 'Charge!', show_your_strength: 'Show Your Strength',
  show_your_true_nature: 'Show Your True Nature', king_returns: 'The King Returns', ambush: 'Ambush',
  lead_to_victory: 'Lead to Victory', we_found_you: 'We Found You!', restore_your_honor: 'Restore Your Honor',
};

export function getPendingAvalonAction(view: AvalonView, userId: string): string | null {
  const me = view.players.find((player) => player.id === userId);
  if (!me) return null;
  const isLeader = me.seat === view.leaderSeat;
  switch (view.phase) {
    case 'reveal': return me.seen ? null : '역할 확인';
    case 'loyalty_check': return view.pendingCheck?.target === userId ? '진영 조사 응답' : null;
    case 'plot_lead': return view.plotOpportunity[0] === userId ? '리더 카드 결정' : null;
    case 'plot_distribute': return isLeader && view.plotDrawn.length > 0 ? '플롯 카드 배분' : null;
    case 'plot_immediate': return view.plotPending && (view.plotPending.card === 'show_your_strength' ? isLeader : view.plotPending.holder === userId) ? '플롯 카드 효과' : null;
    case 'plot_king': case 'plot_forced': case 'plot_ambush': return view.plotOpportunity[0] === userId ? '플롯 카드 결정' : null;
    case 'propose': return isLeader ? '원정 팀 제안' : null;
    case 'vote': {
      if (view.voted) return null;
      const chargeHolders = view.players.filter((player) => (view.plotHands[player.id] ?? []).includes('charge'));
      if (chargeHolders.some((player) => !view.voteSubmitted.includes(player.id)) && !chargeHolders.some((player) => player.id === userId)) return null;
      return '원정 팀 투표';
    }
    case 'quest': return view.proposal.includes(userId) && !view.cardSubmitted ? '원정 카드 제출' : null;
    case 'excalibur': return view.excaliburHolder === userId ? '엑스칼리버 결정' : null;
    case 'trapper': return isLeader ? '함정꾼 카드 제외' : null;
    case 'lady': return view.ladyHolder === userId ? '호수의 여인 조사' : null;
    case 'recruit': return view.myRole.includes('assassin') ? '불신의 충신 모집' : null;
    case 'assassinate': return view.recruited ? view.recruited === userId ? '마지막 암살' : null : view.myRole.includes('assassin') ? '마지막 암살' : null;
    default: return null;
  }
}

function RuleSection({ title, children, initiallyOpen = false }: { title: string; children: ReactNode; initiallyOpen?: boolean }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => { if (initiallyOpen && detailsRef.current) detailsRef.current.open = true; }, [initiallyOpen]);
  return <details ref={detailsRef} className="rounded-xl border border-slate-200 bg-white p-3 open:border-violet-200 open:bg-violet-50/30">
    <summary className="cursor-pointer text-base font-semibold text-slate-900">{title}</summary>
    <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-700">{children}</div>
  </details>;
}

export default function RulebookModal({ onClose, turnKey, actionLabel }: { onClose: () => void; turnKey: string | null; actionLabel: string | null }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [toast, setToast] = useState<{ key: string; label: string } | null>(null);
  const [showExpansionRoles, setShowExpansionRoles] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);

  useEffect(() => {
    if (!turnKey || !actionLabel) return;
    const show = setTimeout(() => setToast({ key: turnKey, label: actionLabel }), 0);
    const hide = setTimeout(() => setToast((current) => current?.key === turnKey ? null : current), 5000);
    return () => { clearTimeout(show); clearTimeout(hide); };
  }, [turnKey, actionLabel]);

  return <dialog ref={dialogRef} onCancel={(event) => { event.preventDefault(); onClose(); }} aria-labelledby="avalon-rulebook-title" className={`fixed inset-0 m-auto max-h-[90dvh] w-[min(94vw,52rem)] max-w-none overflow-hidden rounded-2xl border-2 border-violet-300 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/70 ${turnKey ? styles.attention : ''}`}>
    {toast?.key === turnKey && <div role="alert" className="fixed left-1/2 top-4 z-50 w-max max-w-[90vw] -translate-x-1/2 rounded-xl bg-red-600 px-4 py-3 text-center text-sm font-bold text-white shadow-xl">지금 내 차례예요 · {toast.label}</div>}
    <div className="flex max-h-[88dvh] flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <h2 id="avalon-rulebook-title" className="flex items-center gap-2 text-lg font-bold"><BookOpen size={20} /> 아발론 룰북</h2>
        <button type="button" onClick={onClose} aria-label="룰북 닫기" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-violet-600"><X size={20} /></button>
      </div>
      <div className="min-h-0 space-y-3 overflow-y-auto overscroll-contain p-4 sm:p-6">
        <RuleSection title="기본 진행과 승리 조건" initiallyOpen>
          <p>5~10명이 선과 악으로 나뉩니다. 리더가 원정대를 제안하고 전원이 찬반 투표를 합니다. 과반수가 찬성하면 원정대가 카드를 제출합니다. 동률은 부결입니다.</p>
          <p className="font-bold text-violet-700">선은 원정 3개 성공 후 마지막 암살을 피하면 승리합니다. 악은 원정 3개 실패, 같은 원정에서 팀 5회 부결, 또는 멀린 암살 성공으로 승리합니다.</p>
          <p>선은 보통 성공 카드를 내야 하고 악은 성공 또는 실패를 고릅니다. 7명 이상일 때 4차 원정은 실패 카드가 2장 이상이어야 실패합니다. 특수 직업과 모듈은 아래 효과를 적용합니다.</p>
          <p>토론은 대면 대화나 별도 메신저에서 진행합니다. 비밀 원정 카드를 누가 냈는지는 규칙에 명시된 공개 효과를 제외하고 드러나지 않습니다.</p>
        </RuleSection>
        <RuleSection title="인원별 원정대 크기">
          <ul className="space-y-1">{Object.entries(TEAM_COUNTS).map(([count, sizes]) => <li key={count} className="rounded-lg bg-slate-50 px-3 py-2"><strong>{count}명</strong> · 선 {GOOD_COUNTS[Number(count)]} / 악 {Number(count) - GOOD_COUNTS[Number(count)]} · 1~5차 {sizes.join(' / ')}명</li>)}</ul>
        </RuleSection>
        <RuleSection title="기본 직업과 확장 직업">
          <p>멀린과 암살자는 필수입니다. 나머지 직업은 방 설정에서 선택합니다. 일반 선은 충신, 일반 악은 하수인으로 표시됩니다.</p>
          {(['good', 'evil'] as const).map((side) => <div key={side}><h3 className={`font-bold ${side === 'good' ? 'text-blue-700' : 'text-red-700'}`}>{side === 'good' ? '선 진영' : '악 진영'}</h3><dl className="mt-2 space-y-2">{side === 'good' && <div className="rounded-lg bg-slate-50 px-3 py-2"><dt className="font-semibold">충신</dt><dd>특별한 시작 정보나 능력이 없는 선 진영입니다. 원정에 참여하면 성공 카드를 제출합니다.</dd></div>}{(Object.keys(ROLES) as Role[]).filter((role) => ROLES[role].side === side && !ROLES[role].expansion).map((role) => <div key={role} className="rounded-lg bg-slate-50 px-3 py-2"><dt className="font-semibold">{ROLES[role].name}</dt><dd>{roleRules[role]}</dd></div>)}</dl></div>)}
          <div className="rounded-xl border border-violet-200 bg-white p-3">
            <div className="flex items-center justify-between gap-3"><h3 className="font-bold text-violet-900">확장 직업</h3><button type="button" aria-expanded={showExpansionRoles} aria-controls="avalon-expansion-roles" onClick={() => setShowExpansionRoles((visible) => !visible)} className="rounded-lg border border-violet-300 px-3 py-1.5 text-xs font-semibold text-violet-800 focus-visible:outline-2 focus-visible:outline-violet-600">{showExpansionRoles ? '확장 접기' : '확장 보기'}</button></div>
            {showExpansionRoles && <div id="avalon-expansion-roles" className="mt-3 space-y-3">{(['good', 'evil'] as const).map((side) => <div key={side}><h4 className={`font-bold ${side === 'good' ? 'text-blue-700' : 'text-red-700'}`}>{side === 'good' ? '선 진영' : '악 진영'}</h4><dl className="mt-2 space-y-2">{(Object.keys(ROLES) as Role[]).filter((role) => ROLES[role].side === side && ROLES[role].expansion).map((role) => <div key={role} className="rounded-lg bg-slate-50 px-3 py-2"><dt className="font-semibold">{ROLES[role].name}</dt><dd>{roleRules[role]}</dd></div>)}</dl></div>)}</div>}
          </div>
        </RuleSection>
        <RuleSection title="호수의 여인과 랜슬롯">
          <p>호수의 여인은 시작 리더의 오른쪽 사람이 갖습니다. 2·3·4차 원정이 끝나면 보유자가 다른 사람의 현재 진영을 비밀리에 확인하고 토큰을 넘깁니다. 이미 여인 능력을 사용한 사람은 대상이 될 수 없습니다.</p>
          <p>랜슬롯을 사용하면 선·악 랜슬롯을 한 명씩 넣습니다. 2·3·4차 원정 뒤 여인 확인을 마친 후 충성심 카드를 한 장 공개합니다. 덱은 전환 2장과 변화 없음 5장으로 구성되며, 전환이면 두 랜슬롯의 현재 진영이 함께 바뀝니다. 이미 얻은 시작 정보와 직업 자체는 바뀌지 않습니다.</p>
          <p>변형 1에서는 현재 악 랜슬롯이 성공/실패를 선택합니다. 변형 2에서는 현재 악 랜슬롯이 실패만 제출하고 현재 선 랜슬롯은 성공만 제출합니다.</p>
        </RuleSection>
        <RuleSection title="확장 모듈과 특수 원정 카드">
          <p><strong>목표 원정 선택:</strong> 리더가 아직 수행하지 않은 원정을 고릅니다. 5차 원정은 다른 원정 2개 이상 성공해야 선택할 수 있습니다.</p>
          <p><strong>함정꾼:</strong> 팀을 한 명 크게 만들고, 제출 후 리더가 원정 카드 한 장을 비밀리에 보고 판정에서 제외합니다.</p>
          <p><strong>엑스칼리버:</strong> 리더가 자신이 아닌 팀원에게 줍니다. 소유자는 다른 팀원 한 명의 카드를 반대 카드로 바꾸고 원래 카드를 혼자 확인할 수 있습니다.</p>
          <p><strong>도적:</strong> 감시 대상 도적은 전용 카드를 낼 수 없습니다. 전용 카드로 세 번째 같은 결과의 원정과 앞선 원정에 참여하면 개인 승리합니다.</p>
          <p><strong>마법사:</strong> 마법 카드가 홀수 장이면 기본 판정을 뒤집고, 짝수 장이면 그대로 둡니다.</p>
          <p><strong>전령:</strong> 선 전령 카드는 성공, 악 전령 카드는 실패로 취급합니다. 5차 원정에는 누적 전령 카드 수에 따른 실패 수 보정이 적용됩니다.</p>
        </RuleSection>
        <RuleSection title="플롯 카드 9종">
          <p>리더가 원정마다 다른 사람에게 플롯 카드를 배분합니다. 5~6명은 1장, 7~8명은 2장, 9~10명은 3장입니다. 카드는 공개 정보입니다.</p>
          <dl className="space-y-2">{PLOT_CARDS.map((card) => <div key={card} className="rounded-lg bg-slate-50 px-3 py-2"><dt className="font-semibold">{plotNames[card]}</dt><dd>{plotRules[card]}</dd></div>)}</dl>
        </RuleSection>
        <RuleSection title="이 게임의 직업 중첩 규칙">
          <p>멀린을 제외한 직업은 같은 진영의 다른 직업과 중첩될 수 있습니다. 한 사람은 직업을 여러 개 가져도 한 자리, 한 표, 원정 카드 한 장으로 계산합니다.</p>
          <p>정보를 보는 능력과 남에게 보이는 능력은 각각 적용합니다. 예를 들어 모드레드 + 오베론은 다른 악을 볼 수 없고, 다른 악과 멀린에게도 보이지 않습니다. 진영 전환 후 조사와 최종 승리는 현재 진영을 따릅니다.</p>
        </RuleSection>
      </div>
    </div>
  </dialog>;
}
