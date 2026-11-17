'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';

type Preview = { members: string[]; completions: number };
export default function GroupPreview({ assignments, userName, avatars }: { assignments: string[][]; userName: string; avatars: Record<string, string> }) {
  const [result, setResult] = useState<{total: number; previews: Preview[]; error?: string} | null>(null);
  useEffect(() => {
    const worker = new Worker(new URL('./preview.worker.ts', import.meta.url));
    worker.onmessage = ({data}) => setResult(data);
    worker.onerror = () => setResult({total:0, previews:[], error:'미리보기를 계산하지 못했어요. 모달을 닫고 다시 시도해주세요.'});
    worker.postMessage({assignments, person:userName});
    return () => worker.terminate();
  }, [assignments, userName]);
  return <section className="min-h-0 flex-1 overflow-auto p-5">
    <h3 className="text-lg font-bold">{userName}이 포함된 편성 가능한 조</h3>
    <p className="mt-2 text-sm leading-6 text-slate-500">현재 고정 배정을 반영해 나머지 24명까지 모두 편성할 수 있는 조만 표시해요. 확률은 해당 조가 포함된 전체 편성 수 ÷ 가능한 전체 편성 수예요. 조 번호는 구분하지 않아요.</p>
    {!result ? <p role="status" className="mt-10 flex items-center gap-2 text-indigo-600"><LoaderCircle size={18} className="animate-spin"/>가능한 조와 정확한 확률을 계산하고 있어요.</p> : result.error ? <p role="alert" className="mt-5 text-red-600">{result.error}</p> : !result.total ? <p className="mt-5 rounded-xl bg-amber-50 p-4 text-amber-800">현재 고정 배정으로 가능한 전체 편성이 없어요. 배정을 변경해주세요.</p> : <>
      <p role="status" className="my-5 text-sm font-semibold text-indigo-700">내 조 {result.previews.length.toLocaleString('ko-KR')}가지 · 전체 편성 {result.total.toLocaleString('ko-KR')}가지 · 확률 높은 순</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{result.previews.map((preview, index) => {
        const probability = preview.completions / result.total * 100;
        return <article key={preview.members.join('|')} className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-4 flex items-center justify-between"><span className="text-xs text-slate-400">후보 {index+1}</span><strong className="text-lg tabular-nums text-indigo-600" title={probability+'%'}>{probability > 0 && probability < 0.01 ? '< 0.01' : probability.toLocaleString('ko-KR',{minimumFractionDigits:2, maximumFractionDigits:2})}%</strong></div>
          <ul className="space-y-2">{[userName,...preview.members.filter(n=>n!==userName)].map(name => <li key={name} className="flex items-center gap-3 text-sm font-semibold"><span className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-50 text-indigo-700">{name.slice(-2)}{avatars[name] && <Image src={avatars[name]} alt="" width={40} height={40} unoptimized className="absolute inset-0 size-full object-cover" onError={e=>{e.currentTarget.style.display='none';}}/>}</span>{name}{name===userName&&<span className="text-xs font-normal text-slate-400">나</span>}</li>)}</ul>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-indigo-50"><div className="h-full rounded-full bg-indigo-400" style={{width:probability+'%'}}/></div>
          <p className="mt-2 text-xs text-slate-500">{preview.completions.toLocaleString('ko-KR')} / {result.total.toLocaleString('ko-KR')}개 편성</p>
        </article>;
      })}</div>
    </>}
  </section>;
}
