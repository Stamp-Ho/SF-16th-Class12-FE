import { Coins, Skull, Sword } from "lucide-react";
import { BidHistoryRecord, formatDate, formatTime } from "./historyTypes";

// 입찰/이동/도박 기록 한 건을 렌더링하는 공통 리스트 아이템
export default function HistoryList({
  records,
  emptyMessage = "저장된 기록이 없습니다."
}: {
  records: BidHistoryRecord[];
  emptyMessage?: string;
}) {
  if (records.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-slate-400">{emptyMessage}</p>
    );
  }

  return (
    <div className="px-2 pb-2 space-y-3">
      {records.map((record, index) => {
        const date = record.created_at;
        const user = record.user_name;
        const seat = record.seat_code;
        const price = record.bid_price;

        return (
          <div
            key={`${String(record.id ?? index)}-${index}`}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 shadow-sm"
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <p
                className={`text-slate-600 text-xs border-2 rounded-full px-1.5 py-0.5 font-semibold
                                        ${record.category === "이동" ? "bg-slate-100 border-slate-300" : record.category === "입찰" ? "bg-emerald-100 border-emerald-300 !text-emerald-600" : "bg-rose-100 border-rose-300 !text-rose-800"}`}
              >
                {record.category}
              </p>
              <p className="text-slate-600 text-md font-semibold mx-1">
                {seat != null ? `${String(seat)}` : ""}
              </p>
              {user != null && (
                <span className="font-bold text-slate-800">{String(user)}</span>
              )}

              {/* 상향 입찰 기록 */}
              {record.prev_group_name != null &&
                record.next_group_name != record.prev_group_name && (
                  <div className="flex flex-row gap-1 items-center">
                    <Sword className={`mx-1 h-4 w-4 text-rose-400`} />
                    {seat != null && `${record.prev_group_name}`}{" "}
                  </div>
                )}
              {/* 도박 기록 */}
              {record.method === "GAMBLE" && (
                <div className="flex flex-row gap-1 items-center">
                  {record.price_change < 0 ? (
                    <>
                      <Coins className="h-5 w-5 text-amber-400" />
                      성공
                    </>
                  ) : (
                    <>
                      <Skull className="h-5 w-5 text-rose-400" />
                      실패
                    </>
                  )}
                </div>
              )}

              {price != null && (
                <span className="ml-auto font-semibold text-amber-600">
                  {String(price)}원
                </span>
              )}
              {/* 금액 변동 */}
              <p
                className={`-ml-1.75 w-16 ${!!Number(record.price_change) && Number(record.price_change) > 0 ? "text-emerald-600" : "text-rose-600"}`}
              >
                {!!Number(record.price_change) &&
                  (Number(record.price_change) > 0
                    ? `(+${String(record.price_change)})`
                    : `(${String(record.price_change)})`)}
              </p>
              {date != null && (
                <div className=" text-xs text-slate-400 flex flex-row items-center -my-1">
                  <p>{formatDate(date)}</p>
                  <p>{formatTime(date)}</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
