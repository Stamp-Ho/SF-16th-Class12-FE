"use client";

import Link from "next/link";
import RelationshipModal from "./RelationshipModal";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  LoaderCircle,
  LockKeyhole,
  Shuffle,
  Users,
} from "lucide-react";
import { count, names } from "./data";

export default function GroupDraw({ userName }: { userName: string }) {
  const [showRelationships, setShowRelationships] = useState(false);
  const [assignments, setAssignments] = useState<string[][]>(() => Array.from({ length: 9 }, () => ["", "", ""]));
  const [checking, setChecking] = useState(true);
  const [groups, setGroups] = useState<string[][] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [round, setRound] = useState(0);
  const worker = useRef<Worker | null>(null);
  useEffect(() => {
    const instance = new Worker(new URL("./draw.worker.ts", import.meta.url));
    worker.current = instance;
    instance.onmessage = ({ data }: MessageEvent<{ type?: 'check' | 'draw'; error?: string; groups?: string[][]; total: number }>) => {
      setChecking(false); setBusy(false);
      if (data.error) { setError(data.error); return; }
      setTotal(data.total);
      if (data.groups) { setGroups(data.groups); setRound(r => r + 1); setCopied(false); }
    };
    instance.onerror = () => { setChecking(false); setBusy(false); setError("편성을 계산하지 못했어요. 새로고침 후 다시 시도해주세요."); };
    instance.postMessage({ type: 'check', assignments });
    return () => { instance.terminate(); worker.current = null; };
  }, [assignments]);

  function canAssign(group: number, slot: number, name: string) {
    if (!name) return true;
    return !assignments.some((g, i) => g.some((n, j) => (i !== group || j !== slot) && n === name))
      && assignments[group].every((n, j) => j === slot || !n || count[names.indexOf(name)][names.indexOf(n)] === 0);
  }
  function changeAssignment(group: number, slot: number, name: string) {
    if (!canAssign(group, slot, name)) return;
    setAssignments(current => current.map((g, i) => i === group ? g.map((n, j) => j === slot ? name : n) : g));
    setGroups(null); setTotal(null); setChecking(true); setBusy(false); setError(""); setCopied(false);
  }
  function draw() {
    if (!worker.current || checking || !total || busy || error) return;
    setBusy(true); setError("");
    worker.current.postMessage({ type: 'draw', assignments });
  }
  async function copy() {
    if (!groups) return;
    try {
      await navigator.clipboard.writeText(
        groups.map((g, i) => `${i + 1}조\t${g.join("\t")}`).join("\n"),
      );
      setCopied(true);
    } catch {
      setError("복사 권한이 없어요. 아래 결과를 선택해서 복사해주세요.");
    }
  }
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-900 sm:px-10 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/"
          className="mb-10 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft size={16} /> 대시보드
        </Link>
        <button
          onClick={() => setShowRelationships(true)}
          className="mb-5 flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
        >
          <Users size={16} />
          만남 이력 및 관계도
        </button>
        {showRelationships && (
          <RelationshipModal
            onClose={() => setShowRelationships(false)}
            userName={userName}
            assignments={assignments}
          />
        )}
        <header className="mb-9 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="mb-3 text-xs font-bold tracking-[0.2em] text-indigo-600">
              12BAN / TEAM DRAW
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              새로운 조, 새로운 만남
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              함께한 적 없는 세 사람을 연결해요. 고정 조원을 정하고 나머지는
              추첨에 맡겨보세요.
            </p>
          </div>
          <span className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm">
            <Users size={16} className="text-indigo-500" />
            27명 · 3명씩 · 9개 조
          </span>
        </header>
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="self-start rounded-3xl border border-slate-200 bg-white p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <LockKeyhole size={18} className="text-indigo-500" /> 고정 조원
            </h2>
            <p className="mb-6 mt-2 text-xs leading-5 text-slate-500">원하는 조원을 직접 배정하고, 남은 자리는 무작위 추첨으로 채워보세요.</p>
            <div className="space-y-3">
              {assignments.map((members, i) => <fieldset key={i} className="rounded-xl border border-slate-200 p-3">
                <legend className="px-1 text-sm font-semibold text-slate-600">{i + 1}조</legend>
                <div className="grid gap-2">{members.map((name, slot) => <select key={slot}
                  aria-label={`${i + 1}조 ${slot + 1}번째 고정 조원`}
                  value={name} disabled={busy} onChange={e => changeAssignment(i, slot, e.target.value)}
                  className="min-w-0 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-indigo-500 disabled:opacity-60">
                  <option value="">선택하지 않음</option>
                  {names.filter(n => canAssign(i, slot, n)).map(n => <option key={n} value={n}>{n}</option>)}
                </select>)}</div>
              </fieldset>)}
            </div>
            <p className="mt-4 text-xs text-slate-400">한 조에 최대 3명까지 고정할 수 있어요. 이미 배정된 조원 모두와 첫 만남인 사람만 선택할 수 있어요.</p>
            <p role="status" aria-live="polite" className="mt-3 text-xs text-slate-500">{checking ? '남은 인원의 편성 가능 여부를 확인하고 있어요.' : error ? '편성 확인에 실패했어요.' : total === 0 ? '남은 인원으로 조건을 만족하는 편성을 만들 수 없어요. 고정 조원을 변경해주세요.' : `가능한 편성 ${total?.toLocaleString('ko-KR')}가지`}</p>
            <button disabled={busy || checking || !total || !!error} onClick={draw}
              className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">
              {busy || checking ? <LoaderCircle size={18} className="animate-spin" /> : <Shuffle size={18} />}
              {checking ? '가능한 조합 확인 중' : total === 0 ? '불가능한 조합' : error ? '편성 확인 실패' : busy ? '조 뽑는 중' : groups ? '다시 뽑기' : '랜덤으로 조 뽑기'}
            </button>
            <p className="mt-3 text-center text-xs leading-5 text-slate-400">
              가능한 전체 편성 중 동일한 확률로 추첨해요.
              <br />
              다시 뽑으면 같은 결과가 나올 수도 있어요.
            </p>
          </aside>
          <section aria-label="추첨 결과" className="min-w-0">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">
                {groups ? `${round}번째 추첨 결과` : "추첨 결과"}
              </h2>
              <button
                onClick={copy}
                disabled={!groups || busy}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium disabled:opacity-40"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "복사 완료" : "결과 복사"}
              </button>
            </div>
            {error && (
              <p
                role="alert"
                className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700"
              >
                {error}
              </p>
            )}
            <div aria-live="polite" aria-busy={busy}>
              {groups ? (
                <>
                  <div className="mb-5 flex flex-wrap gap-2">
                    <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
                      ✓ 모든 조원 간 이전 만남 0회
                    </span>
                    <span className="rounded-full bg-white px-3 py-1.5 text-xs text-slate-500">
                      가능한 편성 {total?.toLocaleString("ko-KR")}가지
                    </span>
                  </div>
                  <div
                    className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-3 ${busy ? "opacity-40" : ""}`}
                  >
                    {groups.map((g, i) => (
                      <article
                        key={i}
                        className="rounded-2xl border border-slate-200 bg-white p-5"
                      >
                        <div className="mb-5 flex items-center justify-between">
                          <span className="text-xs font-bold tracking-wider text-indigo-500">
                            GROUP {String(i + 1).padStart(2, "0")}
                          </span>
                          <span className="text-xs text-slate-400">3명</span>
                        </div>
                        <ul className="space-y-3">
                          {g.map((name) => (
                            <li
                              key={name}
                              className="flex items-center justify-between text-base font-semibold"
                            >
                              {name}
                              {assignments[i].includes(name) && (
                                <span className="flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-1 text-[10px] font-medium text-indigo-600">
                                  <LockKeyhole size={10} /> 고정
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </article>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex min-h-[470px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white/60 px-6 text-center">
                  <div className="mb-5 rounded-2xl bg-indigo-50 p-5">
                    <Shuffle size={32} className="text-indigo-400" />
                  </div>
                  <h3 className="text-lg font-bold">
                    이번에는 누구와 함께할까요?
                  </h3>
                  <p className="mt-3 max-w-xs text-sm leading-6 text-slate-500">
                    왼쪽에서 고정 조원을 확인한 뒤<br />조 뽑기 버튼을
                    눌러주세요.
                  </p>
                </div>
              )}
            </div>
            <p className="mt-5 text-xs leading-6 text-slate-400">
              기존 104개 조와 추가 63개 조의 만남 이력을 반영했어요. 추첨 결과는
              만남 이력에 자동으로 추가되지 않습니다.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
