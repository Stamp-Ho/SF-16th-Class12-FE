"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  getTargetUsers,
} from "./actions";
import {
  Dices,
  Shuffle,
  ArrowLeft,
  Loader2,
  Sparkles,
  Trophy
} from "lucide-react";
interface UserItem {
  id: string;
  name: string;
}
export default function ShuffleMain() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [shuffledList, setShuffledList] = useState<
    { order: number; name: string }[]
  >([]);

  const [isShuffling, setIsShuffling] = useState(false);

  // 1. 초기 유저 데이터 로드
  useEffect(() => {
    async function load() {
      try {
        const data = await getTargetUsers();
        setUsers(data);
        // 초기 고정 순서 설정
        setShuffledList(
          data.map((u, idx) => ({ order: idx + 1, name: u.name }))
        );
      } catch (err: any) {
        console.error(err);
      }
    }
    load();
  }, []);

  // 2. 셔플(Fisher-Yates) 함수 및 애니메이션 효과
  const handleShuffle = () => {
    if (users.length === 0 || isShuffling) return;

    setIsShuffling(true);

    let count = 0;
    const maxTicks = 20; // 셔플 회전 횟수

    const interval = setInterval(() => {
      // Fisher-Yates Shuffle
      const arr = [...users];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }

      setShuffledList(arr.map((u, idx) => ({ order: idx + 1, name: u.name })));

      count++;
      if (count >= maxTicks) {
        clearInterval(interval);
        setIsShuffling(false);
      }
    }, 80); // 80ms 간격으로 틱 변경
  };

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-12">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* 상단 네비게이션 & 헤더 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-slate-800 transition-colors mb-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> 메인 대시보드로
            </Link>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Dices className="w-7 h-7 text-emerald-600" />
              순서 무작위 추첨 (Randomizer)
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              전체 {users.length}명의 순서를 공정하게 무작위로 섞습니다.
            </p>
          </div>

        </div>

        {/* 셔플 액션 컨트롤 파트 */}
        <div className="bg-linear-to-r from-emerald-600 to-teal-700 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left z-10">
            <span className="text-xs font-semibold bg-white/20 px-3 py-1 rounded-full uppercase tracking-wider inline-flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Ready to
              Shuffle
            </span>
            <h2 className="text-2xl md:text-3xl font-extrabold">
              순서 섞을 준비가 되셨나요?
            </h2>
            <p className="text-emerald-100 text-xs">
              버튼을 누르면 전체 인원의 순서가 무작위로 무작위 셔플됩니다.
            </p>
          </div>

          <button
            onClick={handleShuffle}
            disabled={isShuffling || users.length === 0}
            className="z-10 flex items-center gap-3 px-8 py-4 bg-amber-400 hover:bg-amber-300 text-slate-900 font-extrabold text-base rounded-2xl shadow-lg hover:shadow-amber-400/30 transition-all transform active:scale-95 disabled:opacity-50"
          >
            <Shuffle
              className={`w-6 h-6 ${isShuffling ? "animate-spin" : ""}`}
            />
            {isShuffling ? "랜덤 섞는 중..." : "순서 섞기 시작!"}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 1. 추첨 결과 리스트 카드 (2열 차지) */}
          <section className="lg:col-span-3 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 text-base">
                <Trophy className="w-5 h-5 text-amber-500" />
                확정 순서 결과 ({shuffledList.length}명)
              </h3>
              {isShuffling && (
                <span className="text-xs text-emerald-600 font-semibold animate-pulse flex items-center gap-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Shuffling...
                </span>
              )}
            </div>

            {/* 순서 격자 배치 */}
            <div className="grid grid-cols-5 sm:grid-cols-5 gap-3">
              {shuffledList.map((item) => (
                <div
                  key={item.order}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    isShuffling
                      ? "bg-slate-50 border-slate-100 scale-98"
                      : item.order === 1
                        ? "bg-amber-50/60 border-amber-200 shadow-sm"
                        : "bg-white border-slate-200"
                  }`}
                >
                  <span
                    className={`w-7 h-7 rounded-lg font-bold flex items-center justify-center text-xs flex-shrink-0 ${
                      item.order === 1
                        ? "bg-amber-500 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {item.order}
                  </span>
                  <span className="font-bold text-slate-800 text-sm truncate">
                    {item.name}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* 2. 결과 DB 저장 폼 (1열 차지) */}
          {/* <section className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4 h-fit">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Save className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-slate-800 text-base">
                결과 저장하기
              </h3>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  추첨 회차 / 제목 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="예: 1차시 발표 순서"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  부연 설명 / 메모 (선택)
                </label>
                <textarea
                  rows={3}
                  placeholder="추첨 목적이나 참고사항 기록"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={isPending || isShuffling || !title.trim()}
                className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs py-3 rounded-xl transition-colors disabled:opacity-50"
              >
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "DB에 결과 저장"
                )}
              </button>

              {saveMessage && (
                <div className="p-3 bg-emerald-50 text-emerald-700 text-xs rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  {saveMessage}
                </div>
              )}
            </form>
          </section> */}
        </div>

        {/* 히스토리 모달 */}
        {/* <HistoryModal
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          history={history}
        /> */}
      </div>
    </main>
  );
}
