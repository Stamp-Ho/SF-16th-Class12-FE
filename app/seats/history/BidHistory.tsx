"use client";

import { useMemo, useState } from "react";
import HistoryList from "./HistoryList";
import { BidHistoryRecord } from "./historyTypes";

// 이동/입찰 기록 뷰: "이동" 포함 여부만 토글로 필터링 (입찰은 항상 표시)
export default function BidHistory({
  records
}: {
  records: BidHistoryRecord[];
}) {
  const [includeMove, setIncludeMove] = useState(true);

  const filteredRecords = useMemo(
    () =>
      records.filter(
        (record) =>
          record.category !== "도박" &&
          (record.category !== "이동" || includeMove)
      ),
    [records, includeMove]
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center py-3 pl-4">
        <label className="flex cursor-pointer items-center gap-2 select-none">
          <span
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
              includeMove ? "bg-emerald-500" : "bg-slate-300"
            }`}
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={includeMove}
              onChange={() => setIncludeMove((prev) => !prev)}
            />
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                includeMove ? "translate-x-4" : "translate-x-1"
              }`}
            />
          </span>
          <span className="text-sm font-semibold text-slate-600">
            이동 기록 포함
          </span>
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <HistoryList
          records={filteredRecords}
          emptyMessage="저장된 입찰 기록이 없습니다."
        />
      </div>
    </div>
  );
}
