"use client";

import { useState, useEffect } from "react";
import { getSongRecords } from "./actions";
import { CheckCircle2, Music2, XCircle, X } from "lucide-react";

export default function RecordModal({
  onClose
}: {
  onClose: () => void;
}) {
  const [records, setRecords] = useState<any[]>([]);

  useEffect(() => {
    const fetchSingerList = async () => {
      try {
        const data = await getSongRecords();
        setRecords(
          (data ?? [])
            .filter(
              (record) =>
                record.status === "completed" || record.status === "canceled"
            )
            .sort(
              (a, b) =>
                new Date(b.updated_at).getTime() -
                new Date(a.updated_at).getTime()
            )
        );
        //'pending', 'singing', 'completed', 'canceled'
      } catch (error) {
        console.error(error);
        setRecords([]); // 오류 발생 시 빈 배열로 초기화
      }
    };
    fetchSingerList();
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-150">
        {/* 모달 상단 헤더 */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-ssafy-blue/10 rounded-xl text-ssafy-blue">
              <Music2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                지난 노래 기록
              </h2>
              <p className="text-xs text-slate-400">
                완료되거나 취소된 곡 목록입니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 기록 목록 영역 */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-2.5">
          {records.length === 0 ? (
            <div className="py-12 text-center border-2 border-dashed border-slate-100 rounded-xl">
              <p className="text-slate-400 text-sm font-medium">
                아직 종료된 노래 기록이 없습니다.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {records.map((record) => {
                const isCompleted = record.status === "completed";
                return (
                  <li
                    key={record.id}
                    className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
                      isCompleted
                        ? "bg-ssafy-blue/30 border-slate-100"
                        : "bg-red-300/40 border-red-100"
                    }`}
                  >
                    <div className="flex flex-col min-w-0 mr-3">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-bold text-slate-700 text-sm truncate">
                          {record.user_name}
                        </span>
                      </div>
                      {record.song_name && (
                        <p className="text-slate-900 font-bold text-md truncate w-150">
                          {record.song_name}
                        </p>
                      )}
                      {record.reason && (
                        <p className="text-xs text-slate-400 truncate">
                          노래 사유: {record.reason}
                        </p>
                      )}
                    </div>

                    {/* 상태 뱃지 */}
                    {isCompleted ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-600 border border-emerald-200/60 rounded-lg text-xs font-bold flex-shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5" /> 완료
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-500 border border-rose-200/60 rounded-lg text-xs font-bold flex-shrink-0">
                        <XCircle className="w-3.5 h-3.5" /> 취소
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* 하단 닫기 버튼 */}
        <div className="pt-4 border-t border-slate-100 mt-4">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl transition-all active:scale-[0.99]"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
