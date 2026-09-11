"use client";

import { useMemo, useState } from "react";
import HistoryList from "./HistoryList";
import { BidHistoryRecord } from "./historyTypes";

// 이동/입찰 기록 뷰: 카테고리 칩으로 세부 필터링
export default function BidHistory({
  records
}: {
  records: BidHistoryRecord[];
}) {
  const [categoryFilter, setCategoryFilter] = useState<string[]>([
    "이동",
    "입찰"
  ]);

  const handleCategoryFilterChange = (category: string) => {
    setCategoryFilter((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  const filteredRecords = useMemo(
    () =>
      records.filter(
        (record) =>
          record.category !== "도박" && categoryFilter.includes(record.category)
      ),
    [records, categoryFilter]
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-row gap-2 mr-auto ml-4 py-4 shrink-0">
        {["이동", "입찰"].map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => handleCategoryFilterChange(category)}
            className={`rounded-full px-3 py-1 text-sm font-semibold transition-colors ${
              categoryFilter.includes(category)
                ? "bg-emerald-500 text-white hover:bg-emerald-600"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {category}
          </button>
        ))}
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
