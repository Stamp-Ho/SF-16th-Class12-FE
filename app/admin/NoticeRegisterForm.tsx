"use client";

import { useState, useTransition } from "react";
import { BookmarkPlus, Loader2, CheckCircle2 } from "lucide-react";
import { createDashboardLink } from "./links/actions";

export default function NoticeRegisterForm() {
  const [isPending, startTransition] = useTransition();

  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkDesc, setLinkDesc] = useState("");
  const [linkMessage, setLinkMessage] = useState("");
  const [isFront, setIsFront] = useState(true); // true: 대시보드, false: 공지사항

  // 2. 대시보드 링크 추가 핸들러
  const handleLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLinkMessage("");

    startTransition(async () => {
      try {
        await createDashboardLink({
          title: linkTitle,
          url: linkUrl,
          description: linkDesc,
          isFront: isFront,
        });
        setLinkMessage("새로운 링크가 추가되었습니다.");
        setLinkTitle("");
        setLinkUrl("");
        setLinkDesc("");
      } catch (err: any) {
        setLinkMessage(`오류 발생: ${err.message}`);
      }
    });
  };
  return (
    <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <BookmarkPlus className="w-5 h-5 text-emerald-600" />
        <h2 className="font-bold text-slate-800">대시보드 링크/공지 추가</h2>
      </div>

      <form onSubmit={handleLinkSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            제목
          </label>
          <input
            type="text"
            value={linkTitle}
            onChange={(e) => setLinkTitle(e.target.value)}
            placeholder="예: SSAFY Notion 바로가기"
            className="w-full text-sm p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            연결 URL
          </label>
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://notion.so/..."
            className="w-full text-sm p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            부연 설명 (선택)
          </label>
          <input
            type="text"
            value={linkDesc}
            onChange={(e) => setLinkDesc(e.target.value)}
            placeholder="간단한 안내 문구"
            className="w-full text-sm p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="linkType"
              value="dashboard"
              checked={isFront}
              onChange={() => setIsFront(true)}
              className="w-4 h-4 text-emerald-600 border-slate-300 focus:ring-emerald-500"
            />
            앞에 넣기
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="linkType"
              value="notice"
              checked={!isFront}
              onChange={() => setIsFront(false)}
              className="w-4 h-4 text-emerald-600 border-slate-300 focus:ring-emerald-500"
            />
            뒤에 추가
          </label>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm py-2.5 rounded-xl transition-colors disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            "링크 추가하기"
          )}
        </button>

        {linkMessage && (
          <div className="p-3 bg-emerald-50 text-emerald-700 text-xs rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            {linkMessage}
          </div>
        )}
      </form>
    </section>
  );
}
