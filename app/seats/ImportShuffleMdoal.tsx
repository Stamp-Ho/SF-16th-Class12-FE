"use client";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { getRandomDrawHistory } from "../shuffle/actions";

export default function ImportShuffleModal({
  setDrawHistory,
  onClose,
}: {
  setDrawHistory: (draws: any) => void;
  onClose: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDrawId, setSelectedDrawId] = useState("");
  const [draws, setDraws] = useState<any[]>([]);

  useEffect(() => {
    const fetchDrawHistory = async () => {
      try {
        const draws = await getRandomDrawHistory();
        setDraws(draws);
      } catch (err: any) {
        setError(`추첨 이력 로드 실패: ${err.message}`);
      }
    };

    fetchDrawHistory();
  }, []);

  const handleSelectSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    setDrawHistory(draws.filter((d) => d.id === selectedDrawId)[0]);
    onClose(); // 모달 닫기
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl">
        <h3 className="text-lg font-bold text-slate-800">새 자리 배정 시작</h3>

        <form onSubmit={handleSelectSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              기반이 될 순서 추첨 결과 선택
            </label>
            <select
              value={selectedDrawId}
              onChange={(e) => setSelectedDrawId(e.target.value)}
              className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              required
            >
              <option value="">추첨 결과를 선택하세요</option>
              {draws.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title} ({new Date(d.created_at).toLocaleDateString()})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              * 선택한 추첨 순서대로 1,2번, 3,4번이 자동으로 2인 짝으로
              매핑됩니다.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-xl"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 text-xs font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 flex items-center gap-1"
            >
              {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              명단 선택 완료
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
