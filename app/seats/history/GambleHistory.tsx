"use client";

import { useMemo } from "react";
import HistoryList from "./HistoryList";
import { BidHistoryRecord } from "./historyTypes";

// 도박 기록만 보여주는 뷰
export default function GambleHistory({
  records
}: {
  records: BidHistoryRecord[];
}) {
  const filteredRecords = useMemo(
    () => records.filter((record) => record.category === "도박"),
    [records]
  );

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pt-2">
      <HistoryList
        records={filteredRecords}
        emptyMessage="저장된 도박 기록이 없습니다."
      />
    </div>
  );
}
