"use client";

import { useState, useTransition, useEffect } from "react";
import {
  assignDetailedSeat,
  deleteAllocation,
  placeBid,
  toggleLockSeat
} from "./actions";
import {
  ArrowLeftRight,
  Lock,
  LockOpen,
  ShieldIcon,
  Sparkles,
  Trash
} from "lucide-react";
import BidRecordModal from "./BidRecordModal";
import { getSeatBidTier } from "./utils/shield";
import { Shield } from "@/assets/icons";

interface SeatData {
  id: string;
  seat_code: string;
  current_group_id: string | null;
  current_group_name: string | null;
  member_left: string | null;
  member_middle: string | null;
  member_right: string | null;
  current_bid_price: number;
  is_closed: boolean;
  is_locked: boolean;
  updated_at: string;
}

const positions = ["left", "middle", "right"] as const;
const SEAT_MAP = [
  { num: 1, type: "seat", code: "가", pos: 1 },
  { num: 2, type: "seat", code: "A", pos: 0 },
  { num: 3, type: "seat", code: "A", pos: 1 },
  { num: 4, type: "seat", code: "B", pos: 0 },
  { num: 5, type: "seat", code: "B", pos: 1 },
  { num: 6, type: "seat", code: "나", pos: 1 },

  { num: 7, type: "seat", code: "C", pos: 0 },
  { num: 8, type: "seat", code: "C", pos: 1 },
  { num: 9, type: "seat", code: "D", pos: 0 },
  { num: 10, type: "seat", code: "D", pos: 1 },
  { num: 11, type: "seat", code: "E", pos: 0 },
  { num: 12, type: "seat", code: "E", pos: 1 },

  { num: 13, type: "seat", code: "F", pos: 0 },
  { num: 14, type: "seat", code: "F", pos: 1 },
  { num: 15, type: "seat", code: "G", pos: 0 },
  { num: 16, type: "seat", code: "G", pos: 1 },
  { num: 17, type: "seat", code: "H", pos: 0 },
  { num: 18, type: "seat", code: "H", pos: 1 },

  { num: 19, type: "seat", code: "I", pos: 0 },
  { num: 20, type: "seat", code: "I", pos: 1 },
  { num: 21, type: "seat", code: "J", pos: 0 },
  { num: 22, type: "seat", code: "J", pos: 1 },
  { num: 23, type: "seat", code: "K", pos: 0 },
  { num: 24, type: "seat", code: "K", pos: 1 },

  { num: 25, type: "seat", code: "다", pos: 1 },
  { num: 26, type: "seat", code: "L", pos: 0 },
  { num: 27, type: "seat", code: "L", pos: 1 },
  { num: 28, type: "seat", code: "M", pos: 0 },
  { num: 29, type: "seat", code: "M", pos: 1 },
  { num: 30, type: "thinking", name: "생각의자" }
];
const SEAT_MAP_FOR_3 = [
  { num: 1, type: "seat", code: "A", pos: 0 },
  { num: 2, type: "seat", code: "A", pos: 1 },
  { num: 3, type: "seat", code: "A", pos: 2 },
  { num: 4, type: "seat", code: "B", pos: 0 },
  { num: 5, type: "seat", code: "B", pos: 1 },
  { num: 6, type: "seat", code: "B", pos: 2 },

  { num: 7, type: "seat", code: "C", pos: 0 },
  { num: 8, type: "seat", code: "C", pos: 1 },
  { num: 9, type: "seat", code: "C", pos: 2 },
  { num: 10, type: "seat", code: "D", pos: 0 },
  { num: 11, type: "seat", code: "D", pos: 1 },
  { num: 12, type: "seat", code: "D", pos: 2 },

  { num: 13, type: "seat", code: "E", pos: 0 },
  { num: 14, type: "seat", code: "E", pos: 1 },
  { num: 15, type: "seat", code: "E", pos: 2 },
  { num: 16, type: "seat", code: "F", pos: 0 },
  { num: 17, type: "seat", code: "F", pos: 1 },
  { num: 18, type: "seat", code: "F", pos: 2 },

  { num: 19, type: "seat", code: "G", pos: 0 },
  { num: 20, type: "seat", code: "G", pos: 1 },
  { num: 21, type: "seat", code: "G", pos: 2 },
  { num: 22, type: "seat", code: "H", pos: 0 },
  { num: 23, type: "seat", code: "H", pos: 1 },
  { num: 24, type: "seat", code: "H", pos: 2 },

  { num: 25, type: "seat", code: "I", pos: 0 },
  { num: 26, type: "seat", code: "I", pos: 1 },
  { num: 27, type: "seat", code: "I", pos: 2 },
  { num: 28, type: "thinking", name: "생각의자" },
  { num: 29, type: "thinking", name: "생각의자" },
  { num: 30, type: "thinking", name: "생각의자" }
];

const CORNER_SEATS = ["가", "나", "다"];

const CODE_COLORS: Record<string, string> = {
  A: "bg-rose-50 border-rose-200 text-rose-900 hover:bg-rose-100",
  B: "bg-teal-50 border-teal-200 text-teal-900 hover:bg-teal-100",
  C: "bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100",
  D: "bg-indigo-50 border-indigo-200 text-indigo-900 hover:bg-indigo-100",
  E: "bg-orange-50 border-orange-200 text-orange-900 hover:bg-orange-100",
  F: "bg-purple-100 border-purple-300 text-purple-950 hover:bg-purple-200",
  G: "bg-yellow-50 border-yellow-200 text-yellow-900 hover:bg-yellow-100",
  H: "bg-blue-50 border-blue-200 text-blue-900 hover:bg-blue-100",
  I: "bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-100",
  J: "bg-fuchsia-100 border-fuchsia-300 text-fuchsia-950 hover:bg-fuchsia-200",
  K: "bg-lime-50 border-lime-200 text-lime-900 hover:bg-lime-100",
  L: "bg-sky-50 border-sky-200 text-sky-900 hover:bg-sky-100",
  M: "bg-green-50 border-green-200 text-green-900 hover:bg-green-100",
  가: "bg-rose-50 border-rose-200 text-rose-900 hover:bg-rose-100",
  나: "bg-teal-50 border-teal-200 text-teal-900 hover:bg-teal-100",
  다: "bg-sky-50 border-sky-200 text-sky-900 hover:bg-sky-100"
};

const MY_CODE_COLORS: Record<string, string> = {
  A: "bg-rose-500 hover:bg-rose-500 text-white hover:text-white border-rose-600 ring-3 ring-rose-300 shadow-md",
  B: "bg-teal-600 hover:bg-teal-600 text-white hover:text-white border-teal-700 ring-3 ring-teal-300 shadow-md",
  C: "bg-amber-500 hover:bg-amber-500 text-white hover:text-white border-amber-600 ring-3 ring-amber-300 shadow-md",
  D: "bg-indigo-600 hover:bg-indigo-600 text-white hover:text-white border-indigo-700 ring-3 ring-indigo-300 shadow-md",
  E: "bg-orange-500 hover:bg-orange-500 text-white hover:text-white border-orange-600 ring-3 ring-orange-300 shadow-md",
  F: "bg-purple-700 hover:bg-purple-700 text-white hover:text-white border-purple-800 ring-3 ring-purple-300 shadow-md",
  G: "bg-yellow-500 hover:bg-yellow-500 text-slate-900 hover:text-slate-900 border-yellow-600 ring-3 ring-yellow-300 shadow-md",
  H: "bg-blue-600 hover:bg-blue-600 text-white hover:text-white border-blue-700 ring-3 ring-blue-300 shadow-md",
  I: "bg-emerald-600 hover:bg-emerald-600 text-white hover:text-white border-emerald-700 ring-3 ring-emerald-300 shadow-md",
  J: "bg-fuchsia-600 hover:bg-fuchsia-600 text-white hover:text-white border-fuchsia-700 ring-3 ring-fuchsia-300 shadow-md",
  K: "bg-lime-600 hover:bg-lime-600 text-white hover:text-white border-lime-700 ring-3 ring-lime-300 shadow-md",
  L: "bg-sky-600 hover:bg-sky-600 text-white hover:text-white border-sky-700 ring-3 ring-sky-300 shadow-md",
  M: "bg-green-600 hover:bg-green-600 text-white hover:text-white border-green-700 ring-3 ring-green-300 shadow-md",
  가: "bg-rose-500 hover:bg-rose-500 text-white hover:text-white border-rose-600 ring-3 ring-rose-300 shadow-md",
  나: "bg-teal-600 hover:bg-teal-600 text-white hover:text-white border-teal-700 ring-3 ring-teal-300 shadow-md",
  다: "bg-sky-600 hover:bg-sky-600 text-white hover:text-white border-sky-700 ring-3 ring-sky-300 shadow-md"
};

export default function ClassroomGrid({
  roundId,
  seatList,
  myGroupId,
  myGroupName,
  currentUserName,
  isAdmin,
  numberPerGroup,
  loadData,
  hideDetails,
  screenShotMode,
  showMoney,
  roundTitle
}: {
  roundId: number;
  seatList: SeatData[];
  myGroupId: string;
  myGroupName: string;
  currentUserName: string;
  isAdmin: boolean;
  numberPerGroup: number;
  loadData: () => void;
  hideDetails: boolean;
  screenShotMode: boolean;
  showMoney: boolean;
  roundTitle: string;
}) {
  const [isPending, startTransition] = useTransition();

  const [hoveredSeatCode, setHoveredSeatCode] = useState<string | null>(null);
  // 💡 드래그 중인 타일의 시각적 피드백 상태 (드롭 호버 중인 구역 코드)
  const [dragOverCode, setDragOverCode] = useState<string | null>(null);
  const [tatalCost, setTotalCost] = useState<number>(0);
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const seatMap = numberPerGroup === 3 ? SEAT_MAP_FOR_3 : SEAT_MAP;

  useEffect(() => {
    let result = 0;
    seatList.forEach((s) => (result += s.current_bid_price));
    setTotalCost(result);
  }, [seatList]);
  const getSeatInfo = (code: string) =>
    seatList.find((s) => s.seat_code === code);

  // 클릭 입찰 함수
  const handleSeatClick = (code: string) => {
    // 이미 트랜지션 처리 중이면 중복 요청 차단
    if (isPending) return;
    if (CORNER_SEATS.includes(code) && myGroupName.includes(",")) {
      alert("가/나/다 구역은 1인 팀만 입찰 가능합니다.");
      return;
    }
    const seat = getSeatInfo(code);
    if (!seat) return;

    startTransition(async () => {
      try {
        await placeBid({
          allocationId: Number(seat.id),
          nextGroupId: Number(myGroupId),
          userName: currentUserName,
          prevUsers: [
            seat.member_left ?? "",
            seat.member_middle ?? "",
            seat.member_right ?? ""
          ].filter((m) => m !== ""),
          seatCode: code
        });
        loadData();
        setHoveredSeatCode(null);
      } catch (err: any) {
        alert(`입찰 실패: ${err.message}`);
      }
    });
  };

  // 💡 드래그 앤 드롭 전용 입찰/배정 처리 함수
  const handleSeatDropBid = async (code: string, targetGroupId: string) => {
    try {
      const seat = getSeatInfo(code);
      if (!seat) return;

      await placeBid({
        allocationId: Number(seat.id),
        nextGroupId: Number(targetGroupId),
        userName: currentUserName,
        seatCode: code
      });
      loadData();
    } catch (err: any) {
      alert(`드롭 배정 실패: ${err.message}`);
    }
  };

  const handleSwapClick = async (
    e: React.MouseEvent,
    seatId: string,
    swap1and2: boolean
  ) => {
    e.stopPropagation();
    const seat = seatList.find((item) => item.id === seatId);
    if (!seat) return;

    try {
      await assignDetailedSeat({
        allocationId: Number(seatId),
        memberLeft: swap1and2
          ? (seat.member_middle ?? null)
          : (seat.member_left ?? null),
        memberMiddle: swap1and2
          ? (seat.member_left ?? null)
          : (seat.member_right ?? null),
        memberRight: swap1and2
          ? (seat.member_right ?? null)
          : (seat.member_middle ?? null)
      });
      loadData();
    } catch (err: any) {
      alert(`위치 변경 실패: ${err.message}`);
    }
  };
  const handleLockClick = async (seatId: string) => {
    try {
      await toggleLockSeat(Number(seatId));
      loadData();
    } catch (err: any) {
      alert(`좌석 잠금/해제 실패: ${err.message}`);
    }
  };

  // 💡 Drag & Drop Event Handlers
  const handleDragOver = (e: React.DragEvent, code: string) => {
    e.preventDefault(); // 드롭 허용 필수
    e.dataTransfer.dropEffect = "move";
    if (dragOverCode !== code) {
      setDragOverCode(code);
    }
  };

  const handleDragLeave = (e: React.DragEvent, code: string) => {
    e.preventDefault();
    if (dragOverCode === code) {
      setDragOverCode(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, code: string) => {
    e.preventDefault();
    setDragOverCode(null);

    // 드래그 아이템에서 전달된 그룹 정보 추출
    const targetGroupId = e.dataTransfer.getData("text/plain");

    if (!targetGroupId) return;

    // 본인 그룹이거나 관리자인 경우 드롭 진행
    if (isAdmin || targetGroupId === myGroupId) {
      await handleSeatDropBid(code, targetGroupId);
    } else {
      alert("본인의 팀 카드만 드래그하여 배치할 수 있습니다.");
    }
  };

  const getTime = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getHours()}:${date.getMinutes().toString().padStart(2, "0")}`;
  };

  return (
    <div className="bg-white p-3 rounded-xl sm:p-6 sm:rounded-3xl border border-slate-200 shadow-sm space-y-2 sm:space-y-4 max-w-4xl mx-auto">
      {recordModalOpen && (
        <BidRecordModal
          roundId={roundId}
          onClose={() => setRecordModalOpen(false)}
        />
      )}
      {/* 스크린 / 문 / 강사님 */}
      <div className="text-[9px] sm:text-xs space-y-1.5 sm:space-y-3">
        <div className="grid grid-cols-12 gap-2 text-center font-bold">
          <a
            href="https://copper-zebu-fc0.notion.site/3b9e15c202ad8075828cff5bcdf83bb6"
            target="_blank"
            rel="noopener noreferrer"
            className="col-span-2 bg-slate-200 text-slate-700 py-1.5 rounded-lg sm:py-2 sm:rounded-xl border border-slate-300 block text-center"
          >
            문 (식당)
          </a>
          <a
            href="https://app.notion.com/p/3a366fe0f687805d9a4bf4cdec5299bf"
            target="_blank"
            rel="noopener noreferrer"
            className={`${screenShotMode ? "col-span-10" : "col-span-8"} bg-slate-800 text-white py-1.5 rounded-lg sm:py-2 sm:rounded-xl flex items-center justify-center gap-2`}
          >
            <Sparkles className="w-4 h-4 text-amber-400" /> 칠판 (스크린)
          </a>
          {!screenShotMode && (
            <button
              type="button"
              onClick={() => setRecordModalOpen(true)}
              className="col-span-2 bg-indigo-50 text-indigo-900 py-1.5 rounded-lg sm:py-2 sm:rounded-xl border border-indigo-300 flex items-center justify-center gap-1.5 hover:bg-indigo-100 transition-colors"
            >
              기록 보기
            </button>
          )}
        </div>
        <div className="flex justify-between">
          {showMoney ? (
            <div className="px-6 sm:w-48 bg-violet-50 border-2 border-violet-300 text-violet-900 py-1.5 rounded-lg sm:py-2 sm:rounded-xl font-bold text-center">
              총액: {(tatalCost * numberPerGroup).toLocaleString()}원
            </div>
          ) : (
            <div className="px-6 sm:w-48 bg-slate-50 border-2 border-slate-300 text-slate-900 py-1.5 rounded-lg sm:py-2 sm:rounded-xl font-bold text-center">
              {roundTitle}
            </div>
          )}
          <div className="px-6 sm:w-48 bg-amber-50 border-2 border-amber-300 text-amber-900 py-1.5 rounded-lg sm:py-2 sm:rounded-xl font-bold text-center">
            강사님 자~리
          </div>
        </div>
      </div>

      {/* 좌석 그리드 */}
      <div className="grid grid-cols-2 gap-3 sm:gap-12">
        <div className="grid grid-cols-3 gap-1 sm:gap-2 gap-y-3 sm:gap-y-6">
          {seatMap
            .filter((s) =>
              [1, 2, 3, 7, 8, 9, 13, 14, 15, 19, 20, 21, 25, 26, 27].includes(
                s.num
              )
            )
            .map(renderTile)}
        </div>
        <div className="grid grid-cols-3 gap-1 sm:gap-2 gap-y-3 sm:gap-y-6">
          {seatMap
            .filter((s) =>
              [
                4, 5, 6, 10, 11, 12, 16, 17, 18, 22, 23, 24, 28, 29, 30
              ].includes(s.num)
            )
            .map(renderTile)}
        </div>
      </div>
    </div>
  );

  function renderTile(tile: any) {
    const seatInfo = getSeatInfo(tile.code);
    if (!seatInfo || tile.type === "restricted" || tile.type === "thinking") {
      return (
        <div
          key={tile.num}
          className="bg-slate-100 border-2 border-slate-300 text-slate-400 rounded-lg p-2 sm:rounded-xl sm:p-2.5 text-center flex flex-col justify-between h-13 sm:h-20 select-none"
        >
          <span className="text-[7px] sm:text-[10px] font-mono">
            {tile.num}
          </span>
          <span className="text-[9px] sm:text-sm font-bold text-slate-500 mb-0.5">
            {tile.name}
          </span>
        </div>
      );
    }

    const isOccupied = !!seatInfo.current_group_name;

    const seatBidTier = getSeatBidTier(seatInfo.updated_at);

    // 내 그룹 소속 구역인지 체크
    const isMyGroup =
      isOccupied &&
      (seatInfo.current_group_id === myGroupId ||
        seatInfo.member_left === currentUserName ||
        seatInfo.member_middle === currentUserName ||
        seatInfo.member_right === currentUserName);
    const position = positions[tile.pos]; // 0: left, 1: middle, 2: right
    const isCorner = CORNER_SEATS.includes(tile.code);

    // 내 그룹이면 원래 구역 색상의 '진한 톤(MY_CODE_COLORS)', 아니면 '연한 톤(CODE_COLORS)' 적용
    const colorClass =
      !screenShotMode && isMyGroup
        ? MY_CODE_COLORS[tile.code] ||
          "bg-indigo-600 text-white ring-4 ring-indigo-300"
        : CODE_COLORS[tile.code] || "bg-slate-50 border-slate-200";

    const personName = isCorner
      ? seatInfo.member_left
      : seatInfo?.[`member_${position}`];
    const canSwap =
      !isCorner &&
      isOccupied &&
      (isAdmin ||
        currentUserName === seatInfo.member_left ||
        currentUserName === seatInfo.member_middle ||
        currentUserName === seatInfo.member_right);

    // 💡 드래그한 카드가 타일 위에 올라왔을 때 강조 스타일
    const isHovered = hoveredSeatCode === tile.code;
    const isCardHovered = dragOverCode === tile.code;

    return (
      <div key={tile.num} className={`relative`}>
        <div
          onClick={() => !isPending && handleSeatClick(tile.code)}
          // 💡 Drag & Drop Event Listeners 추가
          onMouseEnter={() => isMyGroup || setHoveredSeatCode(tile.code)}
          onMouseLeave={() => setHoveredSeatCode(null)}
          onDragOver={(e) => handleDragOver(e, tile.code)}
          onDragLeave={(e) => handleDragLeave(e, tile.code)}
          onDrop={(e) => handleDrop(e, tile.code)}
          className={`border-2 rounded-lg sm:rounded-xl px-0.75 py-0.5 sm:px-2 sm:py-1 flex flex-col justify-between h-13 sm:h-20 cursor-pointer transition-all z-0 select-none ${
            !screenShotMode && isMyGroup ? "z-10 scale-[1.03]" : ""
          } ${
            isCardHovered
              ? "ring-4 ring-indigo-500 border-indigo-600 scale-[1.05] z-20 shadow-lg"
              : ""
          } ${colorClass}`}
        >
          <div className="flex justify-between w-full">
            <span
              className={`text-[7px] sm:text-[10px] font-mono font-bold w-4 ${
                isMyGroup ? "opacity-80" : "opacity-60"
              }`}
            >
              {tile.num}
            </span>
            <div className="flex flex-row h-4.25 sm:h-5.5 text-xs font-extrabold justify-center items-end">
              {screenShotMode || hideDetails ? null : seatInfo.is_locked ? (
                <Lock className="w-2.75 h-2.75 sm:w-3.5 sm:h-3.5 text-red-500" />
              ) : isHovered ? (
                <span className="">
                  +
                  {seatBidTier.priceChange -
                    (seatInfo.current_group_id == null ? 500 : 0)}
                </span>
              ) : (
                <>
                  {Array.from({
                    length: Math.max(0, seatBidTier.tier - 1)
                  }).map((_, index) => {
                    if (seatBidTier.tier === 4) {
                      return (
                        <Shield
                          iconKey={tile.num * 10 + index}
                          size={index === 1 ? "17.5" : "15"}
                          className={`ml-[-0.75px] mr-[-1.25px] ${index === 1 ? "w-2.25" : "w-2"} sm:w-full`}
                        />
                      );
                    }

                    return (
                      <Shield
                        iconKey={tile.num * 10 + index}
                        size="15"
                        className="-mx-px flex justify-center w-2.5 sm:w-full"
                      />
                    );
                  })}
                </>
              )}
            </div>
            <span
              className={`text-[8px] sm:text-xs font-extrabold w-4 rounded text-right ${
                isMyGroup ? "text-white backdrop-blur-sm" : "text-slate-800"
              }`}
            >
              {!screenShotMode && !hideDetails && tile.code}
            </span>
          </div>

          {/* 사용자 이름 표시 영역 */}
          <div className="my-auto text-center mb-0.5 -mt-1.5 sm:-mt-1">
            {isOccupied ? (
              <p className="font-extrabold text-xs sm:text-lg truncate">
                {personName || "빈 자 리"}
              </p>
            ) : (
              <p
                className={`text-[8px] sm:text-sm font-semibold truncate mt-1 -mb-1 ${
                  isMyGroup ? "text-white/70" : "text-slate-400"
                }`}
              >
                {isCardHovered ? "여기에 드롭!" : "빈 자 리"}
              </p>
            )}
          </div>

          {/* 하단 가격 */}
          <div className="flex justify-between items-end text-[6px] sm:text-[10px] h-2 sm:h-3.75">
            <span className="font-bold font-mono">
              {showMoney
                ? seatInfo.current_bid_price
                  ? `${seatInfo.current_bid_price.toLocaleString()}원`
                  : "0원"
                : ""}
            </span>
            <span className="font-bold text-[6px] sm:text-[10px]">
              {!screenShotMode && !hideDetails && seatInfo.updated_at
                ? getTime(seatInfo.updated_at)
                : ""}
            </span>
          </div>
        </div>

        {/* 스위치 (<->) 버튼 */}
        {!screenShotMode &&
          canSwap &&
          !seatInfo.is_locked &&
          position !== "left" && (
            <button
              onMouseEnter={(e) => e.stopPropagation()}
              disabled={isPending}
              onClick={(e) => {
                e.preventDefault();
                handleSwapClick(e, seatInfo.id, position === "middle");
              }}
              className={`absolute top-4 sm:top-6.75 py-0.5 px-1 sm:py-1.25 sm:px-2.25 rounded sm:rounded-md border sm:border-2 transition-colors cursor-pointer ${colorClass
                .replace("bg-", "bg-white ")
                .replace("text-", "text-slate-900 ")
                .replace("ring-3", "ring-2")} ${
                tile.num % 6 === 4
                  ? "-left-4 px-1 sm:-left-10.5 sm:px-2.5"
                  : "-left-3 sm:left-[-20.75px]"
              }`}
              title="좌/우 자리 교환"
            >
              <ArrowLeftRight className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            </button>
          )}
        {!screenShotMode &&
          !hideDetails &&
          isAdmin &&
          seatInfo &&
          seatInfo.current_group_id !== null &&
          position === "middle" && (
            <>
              {
                <button
                  onMouseEnter={(e) => e.stopPropagation()}
                  disabled={isPending}
                  className={`absolute -top-2 sm:-top-2.75 p-0.5 sm:p-1 rounded-full border sm:border-2 transition-colors cursor-pointer ${colorClass
                    .replace("bg-", "bg-white ")
                    .replace("text-", "text-slate-900 ")
                    .replace("ring-3", "ring-2")} ${
                    numberPerGroup === 3 || isCorner
                      ? "left-1/2 -translate-x-1/2"
                      : tile.num % 6 === 4
                        ? "-left-3.5 sm:-left-9"
                        : "-left-2.5 sm:-left-4"
                  }`}
                  onClick={(e) => {
                    e.preventDefault();
                    handleLockClick(seatInfo.id);
                  }}
                  title={seatInfo.is_locked ? "좌석 잠금 해제" : "좌석 잠금"}
                >
                  {seatInfo.is_locked ? (
                    <Lock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-red-500" />
                  ) : (
                    <LockOpen className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  )}
                </button>
              }
              <button
                onMouseEnter={(e) => e.stopPropagation()}
                disabled={isPending}
                onClick={(e) => {
                  e.preventDefault();
                  if (confirm("정말로 이 좌석 정보를 삭제하시겠습니까?")) {
                    startTransition(async () => {
                      try {
                        await deleteAllocation(Number(seatInfo.id));
                        await loadData();
                      } catch (err: any) {
                        alert(`삭제 에러: ${err.message}`);
                      }
                    });
                  }
                }}
                className={`absolute top-9 sm:top-14.5 p-0.5 sm:p-1 rounded-full border sm:border-2 transition-colors cursor-pointer ${colorClass
                  .replace("bg-", "bg-white ")
                  .replace("text-", "text-slate-900 ")
                  .replace("ring-3", "ring-2")} ${
                  numberPerGroup === 3 || isCorner
                    ? "left-1/2 -translate-x-1/2"
                    : tile.num % 6 === 4
                      ? "-left-3.5 sm:-left-9"
                      : "-left-2.5 sm:-left-4"
                }`}
                title="좌석 삭제"
              >
                <Trash className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              </button>
            </>
          )}
      </div>
    );
  }
}
