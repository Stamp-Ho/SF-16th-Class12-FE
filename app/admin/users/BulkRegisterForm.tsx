"use client";
import { useState, useTransition } from "react";
import { bulkRegisterUsers } from "./actions";
import { UserPlus, Loader2, CheckCircle2 } from "lucide-react";

export default function BulkRegisterForm({
  onRegisterSuccess
}: {
  onRegisterSuccess?: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  // 일괄 회원 등록 상태
  const [userNames, setUserNames] = useState("");
  const [userMessage, setUserMessage] = useState("");

  // 1. 회원 일괄 등록 핸들러
  const handleUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUserMessage("");

    startTransition(async () => {
      try {
        const res = await bulkRegisterUsers(
          userNames
        );
        setUserMessage(
          `성공: ${res.successCount}명 / 실패: ${res.failCount}명`
        );
        setUserNames("");
        onRegisterSuccess?.();
      } catch (err: any) {
        setUserMessage(`오류 발생: ${err.message}`);
      }
    });
  };

  return (
    <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <UserPlus className="w-5 h-5 text-indigo-600" />
        <h2 className="font-bold text-slate-800">회원 일괄 등록</h2>
      </div>

      <form onSubmit={handleUserSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            이름 목록 (Comma-separated)
          </label>
          <textarea
            rows={4}
            value={userNames}
            onChange={(e) => setUserNames(e.target.value)}
            placeholder="홍길동, 김철수, 이영희..."
            className="w-full text-sm p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
          <p className="text-[11px] text-slate-400 mt-1">
            * 초기 비밀번호는 모두{" "}
            <code className="bg-slate-100 px-1 rounded">ssafy16</code>로
            설정됩니다.
          </p>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm py-2.5 rounded-xl transition-colors disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            "일괄 계정 생성"
          )}
        </button>

        {userMessage && (
          <div className="p-3 bg-indigo-50 text-indigo-700 text-xs rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            {userMessage}
          </div>
        )}
      </form>
    </section>
  );
}
