"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownWideNarrow,
  Crown,
  Dices,
  Filter,
  Gavel,
  History,
  LineChart,
  Loader2,
  MapPin,
  User,
  X
} from "lucide-react";
import { getHistoriesByRound } from "../actions";
import { createClient } from "@/utils/supabase/client";
import { BidHistoryRecord } from "./historyTypes";
import BidHistory from "./BidHistory";
import GambleHistory from "./GambleHistory";
import PriceGraph from "./PriceGraph";

type RankingData = {
  user_name: string;
  bid_count: number;
  raised_money: number;
  success_count: number;
  fail_count: number;
};

type RankByType =
  | "bid_count"
  | "raised_money"
  | "gamble_success_rate"
  | "gamble_count";

type RawBidHistory = Omit<BidHistoryRecord, "category">;

function toBidHistoryRecord(record: RawBidHistory): BidHistoryRecord {
  return {
    ...record,
    category:
      record.method === "BID"
        ? record.prev_group_name === null
          ? "이동"
          : "입찰"
        : "도박"
  };
}

// 단일 기록을 기존 랭킹 목록에 반영한 새 배열을 반환
function applyRecordToRanking(
  rankingData: RankingData[],
  record: RawBidHistory
): RankingData[] {
  const next = rankingData.map((r) => ({ ...r }));

  if (record.method === "GAMBLE") {
    const existingRanking = next.find((r) => r.user_name === record.user_name);
    if (existingRanking) {
      if (record.price_change < 0) existingRanking.success_count += 1;
      else existingRanking.fail_count += 1;
    } else {
      next.push({
        user_name: record.user_name,
        bid_count: 0,
        raised_money: 0,
        success_count: record.price_change < 0 ? 1 : 0,
        fail_count: record.price_change < 0 ? 0 : 1
      });
    }
  }

  if (record.method === "BID" && record.price_change > 0) {
    const existingRanking = next.find((r) => r.user_name === record.user_name);
    if (existingRanking) {
      existingRanking.bid_count += 1;
      existingRanking.raised_money += record.price_change;
      if (record.user_name === "조동휘") console.log(record);
    } else {
      next.push({
        user_name: record.user_name,
        bid_count: 1,
        raised_money: record.price_change,
        success_count: 0,
        fail_count: 0
      });
    }
  }

  return next;
}

// 좌석 코드/사용자 필터를 select 대신 여러 줄로 감싸지는 칩 목록으로 표시
function ChipFilterGroup({
  icon: Icon,
  options,
  value,
  onChange
}: {
  icon: typeof MapPin;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Icon className="h-4 w-4 shrink-0 mr-1 text-slate-400" />
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
            value === option
              ? "bg-indigo-500 text-white"
              : "border border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export default function BidRecordModal({
  roundId,
  onClose
}: {
  roundId: number;
  onClose: () => void;
}) {
  const [records, setRecords] = useState<BidHistoryRecord[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "bid" | "gamble" | "graph" | "ranking"
  >("bid");

  const [showFilters, setShowFilters] = useState(false);
  const [seatCodeFilter, setSeatCodeFilter] = useState<string | null>(null);
  const [userNameFilter, setUserNameFilter] = useState<string | null>(null);
  const [filteredRecords, setFilteredRecords] = useState<BidHistoryRecord[]>(
    []
  );

  const [rankingData, setRankingData] = useState<RankingData[]>([]);
  const [sortedRankingData, setSortedRankingData] = useState<RankingData[]>([]);
  const [rankBy, setRankBy] = useState<RankByType>("bid_count");
  const [rankOrder, setRankOrder] = useState<"asc" | "desc">("desc");

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (rankingData.length > 0) {
      const dir = rankOrder === "desc" ? 1 : -1;
      const sortedData = [...rankingData].sort((a, b) => {
        switch (rankBy) {
          case "bid_count":
            return (b.bid_count - a.bid_count) * dir;
          case "raised_money":
            return (b.raised_money - a.raised_money) * dir;
          case "gamble_success_rate": {
            const aTotal = a.success_count + a.fail_count;
            const bTotal = b.success_count + b.fail_count;
            // 시도 횟수가 0인 값은 정렬 방향과 무관하게 항상 최후순위
            if (aTotal === 0 && bTotal === 0) return 0;
            if (aTotal === 0) return 1;
            if (bTotal === 0) return -1;
            const aRate = a.success_count / aTotal;
            const bRate = b.success_count / bTotal;
            if (bRate === aRate) return (bTotal - aTotal) * dir;
            return (bRate - aRate) * dir;
          }
          case "gamble_count":
            return (
              (b.success_count +
                b.fail_count -
                (a.success_count + a.fail_count)) *
              dir
            );
        }
      });
      setSortedRankingData(sortedData);
    }
  }, [rankingData, rankBy, rankOrder]);

  useEffect(() => {
    let isActive = true;

    const loadHistory = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const result = await getHistoriesByRound(roundId);
        if (!result.success) {
          if (isActive) setErrorMessage(result.message);
          return;
        }
        const history = result.data;
        if (isActive) setRecords(history.map(toBidHistoryRecord));

        let initialRankingData: RankingData[] = [];
        for (const record of history) {
          initialRankingData = applyRecordToRanking(
            initialRankingData,
            record as RawBidHistory
          );
        }
        if (isActive) setRankingData(initialRankingData);
      } catch (error) {
        if (isActive) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "기록을 불러오지 못했습니다."
          );
        }
      } finally {
        if (isActive) setIsLoading(false);
      }
    };

    void loadHistory();

    // 신규 입찰/도박/이동 기록을 실시간으로 반영
    const channel = supabase
      .channel(`seat_bid_histories-round-${roundId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "seat_bid_histories",
          filter: `round_id=eq.${roundId}`
        },
        (payload) => {
          const newRecord = payload.new as RawBidHistory;
          if (!isActive) return;

          setRecords((prev) => [toBidHistoryRecord(newRecord), ...prev]);
          setRankingData((prev) => applyRecordToRanking(prev, newRecord));
        }
      )
      .subscribe();

    return () => {
      isActive = false;
      supabase.removeChannel(channel);
    };
  }, [roundId, supabase]);

  useEffect(() => {
    setFilteredRecords(
      records.filter(
        (record) =>
          (seatCodeFilter == null || record.seat_code === seatCodeFilter) &&
          (userNameFilter == null || record.user_name === userNameFilter)
      )
    );
  }, [records, seatCodeFilter, userNameFilter]);

  const rankByDict: Record<string, RankByType> = {
    "입찰 횟수": "bid_count",
    "상향 입찰액": "raised_money",
    "도박 횟수": "gamble_count",
    "도박 성공률": "gamble_success_rate"
  };
  const tabIcons = {
    bid: Gavel,
    gamble: Dices,
    graph: LineChart,
    ranking: Crown
  } as const;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="flex h-[70vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-slate-50 px-5 pt-3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
            <History className="h-5 w-5 text-indigo-600" />
            기록
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
            title="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="shrink-0 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["bid", "입찰 기록"],
                ["gamble", "도박 기록"],
                ["graph", "가격 그래프"],
                ["ranking", "랭킹"]
              ] as const
            ).map(([tab, label]) => {
              const TabIcon = tabIcons[tab];
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold transition-colors ${
                    activeTab === tab
                      ? "bg-indigo-500 text-white hover:bg-indigo-600"
                      : "bg-white text-slate-600 border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50"
                  }`}
                >
                  <TabIcon className="h-3.5 w-3.5" />
                  {label}
                </button>
              );
            })}
            {(activeTab === "bid" || activeTab === "gamble") && (
              <button
                type="button"
                onClick={() => setShowFilters((prev) => !prev)}
                className={`ml-auto flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold transition-colors ${
                  showFilters
                    ? "bg-indigo-500 text-white hover:bg-indigo-600"
                    : "bg-white text-slate-600 border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50"
                }`}
              >
                <Filter className="h-4 w-4" />
                필터
              </button>
            )}
          </div>

          {(activeTab === "bid" || activeTab === "gamble") && showFilters && (
            <div className="mt-3 flex flex-col gap-2">
              <ChipFilterGroup
                icon={MapPin}
                options={[
                  "전체",
                  "A",
                  "B",
                  "C",
                  "D",
                  "E",
                  "F",
                  "G",
                  "H",
                  "I",
                  "J",
                  "K",
                  "L",
                  "M",
                  "가",
                  "나",
                  "다"
                ]}
                value={seatCodeFilter ?? "전체"}
                onChange={(value) =>
                  setSeatCodeFilter(value === "전체" ? null : value)
                }
              />
              <ChipFilterGroup
                icon={User}
                options={[
                  "전체",
                  ...Array.from(
                    new Set(records.map((record) => record.user_name))
                  ).sort((a, b) => a.localeCompare(b))
                ]}
                value={userNameFilter ?? "전체"}
                onChange={(value) =>
                  setUserNameFilter(value === "전체" ? null : value)
                }
              />
            </div>
          )}
        </div>
        <div
          className={`min-h-0 flex-1 ${activeTab === "ranking" ? "overflow-hidden" : "overflow-y-auto"}`}
        >
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              기록을 불러오는 중...
            </div>
          ) : errorMessage ? (
            <p className="py-12 text-center text-sm text-rose-500">
              {errorMessage}
            </p>
          ) : activeTab === "ranking" ? (
            <div className="px-2 pb-2 flex h-full min-h-0 flex-col">
              <div className="grid shrink-0 grid-cols-[0.4fr_repeat(4,minmax(0,1fr))] gap-x-2 border-b border-slate-200 bg-slate-50 pl-4 pr-6 py-3 text-center text-xs font-bold text-slate-600">
                <span className="text-left ml-2">이름</span>
                {Object.keys(rankByDict).map((title) => (
                  <div
                    key={title}
                    className={`cursor-pointer ${rankBy === rankByDict[title] ? "bg-indigo-500 text-white rounded-full py-1.5 -my-1.5 mx-1" : ""}`}
                    onClick={() => {
                      if (rankBy === rankByDict[title]) {
                        setRankOrder((prev) =>
                          prev === "desc" ? "asc" : "desc"
                        );
                      } else {
                        setRankBy(rankByDict[title]);
                        setRankOrder("desc");
                      }
                    }}
                  >
                    {title}
                    <ArrowDownWideNarrow
                      className={`inline-block h-4 w-4 ml-1 -mr-5 transition-transform ${rankBy === rankByDict[title] ? "text-white" : "text-slate-400/90"} ${rankBy === rankByDict[title] && rankOrder === "asc" ? "rotate-180" : ""}`}
                    />
                  </div>
                ))}
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pt-3 pb-2">
                {rankingData.length === 0 ? (
                  <p className="py-12 text-center text-sm text-slate-400">
                    랭킹 데이터가 없습니다.
                  </p>
                ) : (
                  sortedRankingData.map((record, index) => {
                    const user = record.user_name;
                    const bidCount = record.bid_count;
                    const raisedMoney = record.raised_money;
                    const successCount = record.success_count;
                    const failCount = record.fail_count;

                    return (
                      <div
                        key={`${String(record.user_name ?? index)}-${index}`}
                        className="grid grid-cols-[0.4fr_repeat(4,minmax(0,1fr))] items-center gap-x-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm shadow-sm"
                      >
                        <div className="contents">
                          {user != null && (
                            <span className="truncate text-left font-bold text-slate-800">
                              {String(user)}
                            </span>
                          )}
                          <span className="font-semibold text-amber-600">
                            {bidCount}회
                          </span>
                          <span className="font-semibold text-emerald-600">
                            + {raisedMoney}
                          </span>
                          <span className="font-semibold text-slate-600">
                            {successCount + failCount}회
                          </span>
                          <span className="flex items-center justify-end gap-1 font-semibold text-slate-600">
                            {(
                              (successCount /
                                Math.max(successCount + failCount, 1)) *
                              100
                            ).toFixed(2)}
                            %<span className="text-slate-400">(</span>
                            <span className="text-emerald-600 w-3.75">
                              {successCount}
                            </span>
                            <span className="text-slate-400">/</span>
                            <span className="text-rose-600 w-3.75">
                              {failCount}
                            </span>
                            <span className="text-slate-400">)</span>
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : activeTab === "bid" ? (
            <BidHistory records={filteredRecords} />
          ) : activeTab === "gamble" ? (
            <GambleHistory records={filteredRecords} />
          ) : (
            <PriceGraph records={records} />
          )}
        </div>
      </div>
    </div>
  );
}
