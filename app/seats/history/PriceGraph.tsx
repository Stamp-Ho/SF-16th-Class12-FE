"use client";

import { useEffect, useMemo, useRef, useState, WheelEvent } from "react";
import {
  ChartCandlestick,
  ChartLine,
  LineChart,
  Sword,
  Wallet
} from "lucide-react";
import { BidHistoryRecord, formatDate, formatTime } from "./historyTypes";

const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
// 위/아래 여백(%): 최댓값/최솟값이 테두리에 가리지 않도록
const Y_PADDING = 12;
// 좌우 여백(%): 처음/마지막 기록이 테두리에 가리지 않도록
const X_PADDING = 6;
const TICK_COUNT = 4;

// "전체 그룹 비교" 모드에서 그룹별로 순환 배정하는 색상 팔레트
const GROUP_COLORS = [
  { border: "border-indigo-500", stroke: "#6366f1" },
  { border: "border-emerald-500", stroke: "#10b981" },
  { border: "border-amber-500", stroke: "#f59e0b" },
  { border: "border-rose-500", stroke: "#f43f5e" },
  { border: "border-sky-500", stroke: "#0ea5e9" },
  { border: "border-fuchsia-500", stroke: "#d946ef" },
  { border: "border-lime-500", stroke: "#84cc16" },
  { border: "border-orange-500", stroke: "#f97316" }
];

type ChartMarker = {
  key: string;
  x: number;
  value: number;
  colorClass: string;
  title: string;
  hoverLabel: string;
};

type ChartSeries = {
  key: string;
  label: string;
  strokeColor: string;
  markers: ChartMarker[];
};

type Candle = {
  key: string;
  x: number;
  open: number;
  high: number;
  low: number;
  close: number;
  isUp: boolean;
  title: string;
  hoverLabel: string;
};

const BASE_CANDLE_COUNT = 20;
const MAX_CANDLE_COUNT = 60;

const toIndexX = (index: number, total: number) =>
  total <= 1 ? 50 : X_PADDING + (index / (total - 1)) * (100 - X_PADDING * 2);

const toTimeX = (time: number, minTime: number, maxTime: number) => {
  const range = maxTime - minTime || 1;
  return X_PADDING + ((time - minTime) / range) * (100 - X_PADDING * 2);
};

// 활동 시간대(08:00~19:00) 외 구간(야간)은 그래프에서 건너뛰도록 누적 활동 시간을 계산
const ACTIVE_START_HOUR = 8;
const ACTIVE_END_HOUR = 19;

function activeElapsedMs(fromMs: number, toMs: number): number {
  if (toMs <= fromMs) return 0;

  let elapsed = 0;
  const cursor = new Date(fromMs);
  cursor.setHours(0, 0, 0, 0);

  while (cursor.getTime() < toMs) {
    const dayStart = new Date(cursor);
    dayStart.setHours(ACTIVE_START_HOUR, 0, 0, 0);
    const dayEnd = new Date(cursor);
    dayEnd.setHours(ACTIVE_END_HOUR, 0, 0, 0);

    const overlapStart = Math.max(dayStart.getTime(), fromMs);
    const overlapEnd = Math.min(dayEnd.getTime(), toMs);
    if (overlapEnd > overlapStart) elapsed += overlapEnd - overlapStart;

    cursor.setDate(cursor.getDate() + 1);
  }

  return elapsed;
}

const toY = (price: number, min: number, max: number) => {
  const range = max - min || 1;
  const normalized = (price - min) / range;
  return Y_PADDING + (1 - normalized) * (100 - Y_PADDING * 2);
};

const changeColorClass = (change: number) =>
  change > 0
    ? "border-emerald-500"
    : change < 0
      ? "border-rose-500"
      : "border-slate-400";

// 그룹 이름은 쉼표로 구분된 인원을 나타내므로 인원 수 = 쉼표 개수 + 1
const groupMemberCount = (groupName: string) => groupName.split(",").length;

type ActivityStats = {
  bidCount: number;
  moveCount: number;
  gambleCount: number;
  gambleSuccessCount: number;
};

// 기록 목록에서 입찰/이동/도박 횟수와 도박 성공 횟수를 집계
function computeActivityStats(
  recordsSubset: BidHistoryRecord[]
): ActivityStats {
  let bidCount = 0;
  let moveCount = 0;
  let gambleCount = 0;
  let gambleSuccessCount = 0;

  for (const record of recordsSubset) {
    if (record.category === "입찰") bidCount += 1;
    else if (record.category === "이동") moveCount += 1;
    else if (record.category === "도박") {
      gambleCount += 1;
      if (record.price_change < 0) gambleSuccessCount += 1;
    }
  }

  return { bidCount, moveCount, gambleCount, gambleSuccessCount };
}

// 그룹 전체/구성원별 통계 한 줄
function StatsRow({
  label,
  stats,
  highlight = false
}: {
  label: string;
  stats: ActivityStats;
  highlight?: boolean;
}) {
  const successRate =
    stats.gambleCount > 0
      ? Math.round((stats.gambleSuccessCount / stats.gambleCount) * 100)
      : null;

  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg px-3 py-1.5 text-xs ${
        highlight
          ? "bg-indigo-50 font-bold text-indigo-800"
          : "bg-slate-50 text-slate-600"
      }`}
    >
      <span className="min-w-16 truncate">{label}</span>
      <span>입찰 {stats.bidCount}회</span>
      <span>이동 {stats.moveCount}회</span>
      <span>
        도박 {stats.gambleCount}회
        {successRate != null && ` (성공률 ${successRate}%)`}
      </span>
    </div>
  );
}

// 그룹의 가격 변동 추이를 그래프로 보여주는 뷰
export default function PriceGraph({
  records
}: {
  records: BidHistoryRecord[];
}) {
  const [mode, setMode] = useState<"group" | "total" | "all">("total");
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [candleView, setCandleView] = useState(false);
  const [zoom, setZoom] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const zoomAnchorRef = useRef<{ ratio: number; mouseX: number } | null>(null);

  const groups = useMemo(
    () =>
      Array.from(
        new Set(
          records
            .map((record) => record.next_group_name)
            .filter((name): name is string => name != null)
        )
      ).sort((a, b) => {
        // 혼자만 있는 그룹(인원 1명)은 최후순위로 배치
        const soloDiff =
          Number(groupMemberCount(a) === 1) - Number(groupMemberCount(b) === 1);
        if (soloDiff !== 0) return soloDiff;
        return a.localeCompare(b);
      }),
    [records]
  );

  // 그룹별 기록: 시간순 정렬 (그룹 상세 / 전체 그룹 비교 모드에서 공용으로 사용)
  const recordsByGroup = useMemo(() => {
    const map = new Map<string, BidHistoryRecord[]>();
    for (const group of groups) {
      map.set(
        group,
        records
          .filter((record) => record.next_group_name === group)
          .sort(
            (a, b) =>
              new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime()
          )
      );
    }
    return map;
  }, [records, groups]);

  // 그룹 상세 모드에서 공용하는 선택된 그룹의 시간순 기록
  const selectedGroupRecords = useMemo(
    () => (selectedGroup ? (recordsByGroup.get(selectedGroup) ?? []) : []),
    [selectedGroup, recordsByGroup]
  );

  // 그룹 상세 모드에서 보여줄 그룹 전체/구성원별 통계
  const groupStats = useMemo(() => {
    if (mode !== "group" || selectedGroup == null) return null;
    const groupRecords = selectedGroupRecords;
    const members = selectedGroup.split(",").map((m) => m.trim());

    return {
      overall: computeActivityStats(groupRecords),
      members: members.map((member) => ({
        name: member,
        stats: computeActivityStats(
          groupRecords.filter((record) => record.user_name === member)
        )
      }))
    };
  }, [mode, selectedGroup, selectedGroupRecords]);

  // 전체 그룹 비교 모드에서 보여줄 전체 합산 통계
  const allStats = useMemo(() => {
    if (mode !== "all") return null;
    const allGroupRecords = groups.flatMap(
      (group) => recordsByGroup.get(group) ?? []
    );
    return computeActivityStats(allGroupRecords);
  }, [mode, groups, recordsByGroup]);

  const title = useMemo(() => {
    if (mode === "group") return selectedGroup ?? "";
    if (mode === "total") return "총액 변화";
    if (mode === "all") return "전체 그룹 비교";
    return "";
  }, [mode, selectedGroup]);

  // 모드별 시리즈 계산 (Y축 범위는 현재 보이는 구간에 맞춰 뜻에서 다시 계산)
  const series = useMemo((): ChartSeries[] => {
    if (mode === "group") {
      const groupRecords = selectedGroupRecords;
      if (groupRecords.length === 0) return [];

      const markers: ChartMarker[] = groupRecords.map((record, index) => ({
        key: `${record.id}-${index}`,
        x: toIndexX(index, groupRecords.length),
        value: record.bid_price,
        colorClass: changeColorClass(record.price_change),
        title: `${record.user_name} · ${formatDate(record.created_at)} ${formatTime(record.created_at)}`,
        hoverLabel: `${record.category} (${record.price_change > 0 ? "+" : ""}${record.price_change}) ${record.bid_price}원`
      }));

      return [{ key: "group", label: title, strokeColor: "#cbd5e1", markers }];
    }

    if (mode === "total") {
      const timeline = records
        .filter((record) => record.next_group_name != null)
        .sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      if (timeline.length === 0) return [];

      const latestByGroup = new Map<string, number>();
      const totalPoints: {
        time: number;
        total: number;
        record: BidHistoryRecord;
      }[] = [];
      for (const record of timeline) {
        latestByGroup.set(record.next_group_name as string, record.bid_price);
        const total = Array.from(latestByGroup.entries()).reduce(
          (sum, [groupName, price]) =>
            sum + price * groupMemberCount(groupName),
          0
        );
        totalPoints.push({
          time: new Date(record.created_at).getTime(),
          total,
          record
        });
      }

      const minTime = totalPoints[0].time;
      const maxTime = totalPoints[totalPoints.length - 1].time;
      const activeSpan = activeElapsedMs(minTime, maxTime);

      const markers: ChartMarker[] = totalPoints.map((point, index) => {
        const prevTotal =
          index > 0 ? totalPoints[index - 1].total : point.total;
        const delta = point.total - prevTotal;
        return {
          key: `${point.record.id}-${index}`,
          x: toTimeX(activeElapsedMs(minTime, point.time), 0, activeSpan),
          value: point.total,
          colorClass: changeColorClass(delta),
          title: `${point.record.user_name} · ${formatDate(point.record.created_at)} ${formatTime(point.record.created_at)}`,
          hoverLabel: `${point.record.category} (${delta > 0 ? "+" : ""}${delta}) ${point.total}원`
        };
      });

      return [{ key: "total", label: "총액", strokeColor: "#6366f1", markers }];
    }

    if (mode === "all") {
      const allGroupRecords = groups.flatMap(
        (group) => recordsByGroup.get(group) ?? []
      );
      if (allGroupRecords.length === 0) return [];

      const times = allGroupRecords.map((record) =>
        new Date(record.created_at).getTime()
      );
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      const activeSpan = activeElapsedMs(minTime, maxTime);

      const series: ChartSeries[] = groups.map((group, groupIndex) => {
        const groupRecords = recordsByGroup.get(group) ?? [];
        const color = GROUP_COLORS[groupIndex % GROUP_COLORS.length];
        const markers: ChartMarker[] = groupRecords.map((record, index) => ({
          key: `${record.id}-${index}`,
          x: toTimeX(
            activeElapsedMs(minTime, new Date(record.created_at).getTime()),
            0,
            activeSpan
          ),
          value: record.bid_price,
          colorClass: color.border,
          title: `${record.user_name} · ${formatDate(record.created_at)} ${formatTime(record.created_at)}`,
          hoverLabel: `${record.category} (${record.price_change > 0 ? "+" : ""}${record.price_change}) ${record.bid_price}원`
        }));
        return {
          key: group,
          label: group,
          strokeColor: color.stroke,
          markers
        };
      });

      return series;
    }

    return [];
  }, [mode, selectedGroup, records, groups, recordsByGroup, title]);

  // 그룹 상세 모드 전용: 연속된 기록을 묶어 주식차트쳘럼 시가/고가/저가/종가(OHLC)를 계산
  const candles = useMemo((): Candle[] => {
    if (mode !== "group" || !candleView || selectedGroupRecords.length === 0) {
      return [];
    }

    // 확대할수록 더 잘게 묶어 최대 40개까지 캔들 수가 늘어난다
    const candleCount = Math.min(
      MAX_CANDLE_COUNT,
      Math.max(1, Math.round(BASE_CANDLE_COUNT * zoom))
    );
    const bucketSize = Math.max(
      1,
      Math.ceil(selectedGroupRecords.length / candleCount)
    );
    const buckets: BidHistoryRecord[][] = [];
    for (let i = 0; i < selectedGroupRecords.length; i += bucketSize) {
      buckets.push(selectedGroupRecords.slice(i, i + bucketSize));
    }

    return buckets.map((bucket, index) => {
      const prices = bucket.map((record) => record.bid_price);
      const open = prices[0];
      const close = prices[prices.length - 1];
      const high = Math.max(...prices);
      const low = Math.min(...prices);
      const first = bucket[0];
      const last = bucket[bucket.length - 1];

      return {
        key: `${first.id}-${last.id}-${index}`,
        x: toIndexX(index, buckets.length),
        open,
        high,
        low,
        close,
        isUp: close >= open,
        title: `${formatDate(first.created_at)} ${formatTime(first.created_at)} ~ ${formatTime(last.created_at)}`,
        hoverLabel: `시가 ${open} · 고가 ${high} · 저가 ${low} · 종가 ${close}`
      };
    });
  }, [mode, candleView, selectedGroupRecords, zoom]);

  // 캔들 차트의 가격 축 범위/눈금
  const { candleMin, candleMax, candleYTicks } = useMemo(() => {
    if (candles.length === 0) {
      return { candleMin: 0, candleMax: 0, candleYTicks: [] };
    }
    const values = candles.flatMap((c) => [c.high, c.low]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const yTicks = Array.from({ length: TICK_COUNT + 1 }, (_, i) => {
      const value = min + ((max - min) * i) / TICK_COUNT;
      return { value: Math.round(value), y: toY(value, min, max) };
    });
    return { candleMin: min, candleMax: max, candleYTicks: yTicks };
  }, [candles]);

  // 현재 스크롤/줄 상태에서 보이는 구간(0~100, 전체 도메인 기준)
  const [viewport, setViewport] = useState({ start: 0, end: 100 });

  const updateViewport = () => {
    const container = scrollRef.current;
    if (!container || container.scrollWidth === 0) {
      setViewport({ start: 0, end: 100 });
      return;
    }
    const start = (container.scrollLeft / container.scrollWidth) * 100;
    const visible = (container.clientWidth / container.scrollWidth) * 100;
    setViewport({ start, end: start + visible });
  };

  // 보이는 구간의 마커만 남기고, 그 구간의 값으로 가격 상/하한(Y축)을 다시 계산
  const VIEWPORT_BUFFER = 3;
  const { renderSeries, yTicks } = useMemo((): {
    renderSeries: {
      key: string;
      label: string;
      strokeColor: string;
      markers: (ChartMarker & { y: number })[];
    }[];
    yTicks: { value: number; y: number }[];
  } => {
    const visibleValues: number[] = [];
    for (const s of series) {
      for (const m of s.markers) {
        if (
          m.x >= viewport.start - VIEWPORT_BUFFER &&
          m.x <= viewport.end + VIEWPORT_BUFFER
        ) {
          visibleValues.push(m.value);
        }
      }
    }

    const allValues =
      visibleValues.length > 0
        ? visibleValues
        : series.flatMap((s) => s.markers.map((m) => m.value));
    if (allValues.length === 0) return { renderSeries: [], yTicks: [] };

    const min = Math.min(...allValues);
    const max = Math.max(...allValues);

    const renderSeries = series.map((s) => ({
      ...s,
      markers: s.markers
        .filter(
          (m) =>
            m.x >= viewport.start - VIEWPORT_BUFFER &&
            m.x <= viewport.end + VIEWPORT_BUFFER
        )
        .map((m) => ({ ...m, y: toY(m.value, min, max) }))
    }));

    const yTicks = Array.from({ length: TICK_COUNT + 1 }, (_, i) => {
      const value = min + ((max - min) * i) / TICK_COUNT;
      return { value: Math.round(value), y: toY(value, min, max) };
    });

    return { renderSeries, yTicks };
  }, [series, viewport]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    if (zoom <= MIN_ZOOM) {
      container.scrollLeft = 0;
      updateViewport();
      return;
    }
    const anchor = zoomAnchorRef.current;
    if (!anchor) return;
    container.scrollLeft = anchor.ratio * container.scrollWidth - anchor.mouseX;
    updateViewport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, series]);

  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const container = scrollRef.current;
    if (!container) return;

    // 마우스 위치를 중심으로 확대/축소되도록 앵커 좌표를 계산
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const contentX = container.scrollLeft + mouseX;
    const ratio =
      container.scrollWidth > 0 ? contentX / container.scrollWidth : 0;
    zoomAnchorRef.current = { ratio, mouseX };

    setZoom((prev) => {
      const next = prev * (e.deltaY < 0 ? 1.15 : 1 / 1.15);
      return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    });
  };

  // 캔들 차트는 스크롤/패닝 없이 확대 배율만으로 캔들 해상도(최대 40개)를 조절
  const handleCandleWheel = (e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    setZoom((prev) => {
      const next = prev * (e.deltaY < 0 ? 1.15 : 1 / 1.15);
      return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    });
  };

  const selectMode = (nextMode: "total" | "all" | "group", group?: string) => {
    setMode(nextMode);
    setSelectedGroup(nextMode === "group" ? (group ?? null) : null);
    setCandleView(false);
    setZoom(1);
    setViewport({ start: 0, end: 100 });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* 총액 변화/전체 그룹 비교: 전체를 조망하는 상위 계층 */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 bg-slate-50 px-4 pt-4 pb-2.5">
        <button
          type="button"
          onClick={() => selectMode("total")}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold transition-colors ${
            mode === "total"
              ? "bg-indigo-500 text-white shadow-sm"
              : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
          }`}
        >
          <Wallet className="h-4 w-4" />
          총액 변화
        </button>
        <button
          type="button"
          onClick={() => selectMode("all")}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold transition-colors ${
            mode === "all"
              ? "bg-slate-700 text-white shadow-sm"
              : "bg-slate-200 text-slate-700 hover:bg-slate-300"
          }`}
        >
          <LineChart className="h-4 w-4" />
          전체 그룹 비교
        </button>
      </div>

      {/* 그룹별 상세 보기: 하위 계층 */}
      <span className="mr-1 ml-5 text-xs font-semibold text-slate-400">
        그룹별 보기
      </span>
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-slate-100 px-4 pt-2 pb-3">
        {groups.map((group) => (
          <button
            key={group}
            type="button"
            onClick={() => selectMode("group", group)}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
              mode === "group" && selectedGroup === group
                ? "bg-indigo-500 text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50"
            }`}
          >
            <ChartLine className="h-3 w-3" />
            {group}
          </button>
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-2 px-4 pt-3">
        <span className="font-bold text-slate-800">{title}</span>
        {mode === "group" && (
          <button
            type="button"
            onClick={() => setCandleView((prev) => !prev)}
            className={`ml-auto flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              candleView
                ? "bg-indigo-500 text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50"
            }`}
          >
            <ChartCandlestick className="h-3.5 w-3.5" />
            캔들 그래프로 보기
          </button>
        )}
        <span
          className={`${mode === "group" ? "" : "ml-auto"} text-xs text-slate-400`}
        >
          {mode === "group" && candleView
            ? `스크롤로 캔들 개수 조절 (${candles.length}개)`
            : `마우스 위치 기준 스크롤로 확대/축소 (${Math.round(zoom * 100)}%)`}
        </span>
      </div>

      {mode === "all" && series.length > 0 && (
        <div className="flex shrink-0 flex-wrap gap-x-3 gap-y-1 px-4 pt-2 text-xs text-slate-500">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: s.strokeColor }}
              />
              {s.label}
            </span>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {mode === "group" && candleView ? (
          candles.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">
              해당 그룹의 기록이 없습니다.
            </p>
          ) : (
            <div className="flex h-64 w-full">
              {/* 가격 축 */}
              <div className="relative mr-1 w-12 shrink-0">
                {candleYTicks.map((tick) => (
                  <span
                    key={tick.value}
                    className="absolute right-1 -translate-y-1/2 text-[10px] text-slate-400"
                    style={{ top: `${tick.y}%` }}
                  >
                    {tick.value}
                  </span>
                ))}
              </div>

              <div
                className="relative h-full flex-1"
                onWheel={handleCandleWheel}
              >
                {/* 가격 축 눈금선 */}
                {candleYTicks.map((tick) => (
                  <div
                    key={tick.value}
                    className="absolute inset-x-0 border-t border-dashed border-slate-100"
                    style={{ top: `${tick.y}%` }}
                  />
                ))}

                {candles.map((candle) => {
                  const highY = toY(candle.high, candleMin, candleMax);
                  const lowY = toY(candle.low, candleMin, candleMax);
                  const openY = toY(candle.open, candleMin, candleMax);
                  const closeY = toY(candle.close, candleMin, candleMax);
                  const bodyTop = Math.min(openY, closeY);
                  const bodyHeight = Math.max(Math.abs(closeY - openY), 0.5);
                  const colorClass = candle.isUp
                    ? "bg-emerald-500"
                    : "bg-rose-500";

                  return (
                    <div
                      key={candle.key}
                      className="group absolute inset-y-0 -translate-x-1/2"
                      style={{ left: `${candle.x}%` }}
                      title={candle.title}
                    >
                      {/* 고가~저가 꼬리 */}
                      <div
                        className={`absolute left-1/2 w-px -translate-x-1/2 ${colorClass}`}
                        style={{
                          top: `${highY}%`,
                          height: `${lowY - highY}%`
                        }}
                      />
                      {/* 시가~종가 몸통 */}
                      <div
                        className={`absolute left-1/2 w-2 -translate-x-1/2 rounded-sm ${colorClass}`}
                        style={{
                          top: `${bodyTop}%`,
                          height: `${bodyHeight}%`
                        }}
                      />
                      {/* 마우스를 올렸을 때만 상세 정보 표시 */}
                      <span
                        className="z-30 pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-full rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                        style={{ top: `${highY}%` }}
                      >
                        {candle.hoverLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        ) : series.length === 0 ||
          series.every((s) => s.markers.length === 0) ? (
          <p className="py-12 text-center text-sm text-slate-400">
            해당 그래프의 기록이 없습니다.
          </p>
        ) : (
          <div className="flex h-64 w-full">
            {/* 가격 축 */}
            <div className="relative mr-1 w-12 shrink-0">
              {yTicks.map((tick) => (
                <span
                  key={tick.value}
                  className="absolute right-1 -translate-y-1/2 text-[10px] text-slate-400"
                  style={{ top: `${tick.y}%` }}
                >
                  {tick.value}
                </span>
              ))}
            </div>

            <div
              ref={scrollRef}
              className={`relative h-full flex-1 overflow-y-hidden [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-track]:bg-slate-100 hover:[&::-webkit-scrollbar-thumb]:bg-slate-400 ${
                zoom > 1 ? "overflow-x-auto" : "overflow-x-hidden"
              }`}
              onWheel={handleWheel}
              onScroll={updateViewport}
            >
              <div
                className="relative h-full"
                style={{ width: `${zoom * 100}%`, minWidth: "100%" }}
              >
                {/* 가격 축 눈금선 */}
                {yTicks.map((tick) => (
                  <div
                    key={tick.value}
                    className="absolute inset-x-0 border-t border-dashed border-slate-100"
                    style={{ top: `${tick.y}%` }}
                  />
                ))}

                <svg
                  className="absolute inset-0 h-full w-full"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  {renderSeries.map((s) => (
                    <polyline
                      key={s.key}
                      points={s.markers.map((m) => `${m.x},${m.y}`).join(" ")}
                      fill="none"
                      stroke={s.strokeColor}
                      strokeWidth="1"
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                </svg>
                {renderSeries.flatMap((s) =>
                  s.markers.map((marker) => (
                    <div
                      key={`${s.key}-${marker.key}`}
                      className="group absolute -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
                      title={marker.title}
                    >
                      {/* 전체 추세(총액/전체 그룹 비교)에서는 점 없이 선만 표시 */}
                      <div
                        className={
                          mode === "group"
                            ? `h-2 w-2 rounded-full border-2 bg-white ${marker.colorClass}`
                            : "h-2 w-2"
                        }
                      />
                      {/* 마우스를 올렸을 때만 상세 정보 표시 */}
                      <span className="z-30 pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                        {marker.hoverLabel}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
        {groupStats && (
          <div className="shrink-0 space-y-2 px-4 pt-2">
            {/* 그룹 전체 정보 */}
            <StatsRow label="그룹 전체" stats={groupStats.overall} highlight />
            {/* 구성원별 정보 */}
            {groupStats.members.map((member) => (
              <StatsRow
                key={member.name}
                label={member.name}
                stats={member.stats}
              />
            ))}
          </div>
        )}
        {allStats && (
          <div className="shrink-0 px-4 pt-2">
            <StatsRow label="전체 합산" stats={allStats} highlight />
          </div>
        )}
      </div>
    </div>
  );
}
