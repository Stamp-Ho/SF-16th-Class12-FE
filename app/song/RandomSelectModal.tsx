"use client";

import { useEffect, useState } from "react";
import { getUsers } from "../(auth)/actions";
import { Dices, Sparkles } from "lucide-react";

export default function RandomSelectModal({
  onClose,
  setSingerName,
  setSingerReason
}: {
  onClose: () => void;
  setSingerName: React.Dispatch<React.SetStateAction<string>>;
  setSingerReason: React.Dispatch<React.SetStateAction<string>>;
}) {
  const [winner, setWinner] = useState<string | null>(null);
  const [isSpinning, setIsSpinning] = useState(true);

  // 롤링 트랙 상태
  const [reelItems, setReelItems] = useState<string[]>([]);
  const [targetOffset, setTargetOffset] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const initSlot = async () => {
      try {
        const users = await getUsers();
        if (!users || users.length === 0 || !isMounted) return;

        const names = users.map((u) => u.username);

        // 1. 당첨자 선출
        const winnerIndex = Math.floor(Math.random() * names.length);
        const selectedWinner = names[winnerIndex];

        // 2. 적절한 회전수를 위한 트랙 구성 (딱 2바퀴만 돌고 당첨자에서 멈춤)
        const repeatedNames: string[] = [
          ...names,
          ...names.slice(0, -1),
          selectedWinner
        ];
        setReelItems(repeatedNames);

        // 3. 이동할 높이 계산 (마지막 당첨자 인덱스 위치까지만 적당히 이동)
        const itemHeight = 64; // 개별 아이템 높이
        const finalWinnerIndex = repeatedNames.length / 2 - 0.5; // 마지막 당첨자 인덱스
        const totalDistance = finalWinnerIndex * itemHeight;

        // 4. 슬롯 롤링 시작
        const spinTimer = setTimeout(() => {
          if (!isMounted) return;
          setTargetOffset(totalDistance);
        }, 100);

        // 5. 2.2초 후 애니메이션 종료 및 처리
        const stopTimer = setTimeout(() => {
          if (!isMounted) return;
          setWinner(selectedWinner);
          setIsSpinning(false);

          // 1초 후 Form 반영 및 닫기
          setTimeout(() => {
            if (!isMounted) return;
            setSingerName(selectedWinner);
            setSingerReason("🎰 운이 너무 좋음 (랜덤 지명)");
            onClose();
          }, 1000);
        }, 3300);

        return () => {
          clearTimeout(spinTimer);
          clearTimeout(stopTimer);
        };
      } catch (error) {
        console.error("유저 불러오기 실패:", error);
      }
    };

    initSlot();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-border-custom p-8 rounded-3xl w-full max-w-sm shadow-2xl flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
        {/* 타이틀 */}
        <div className="flex items-center gap-2 mb-6">
          <Dices className="w-6 h-6 text-ssafy-blue animate-bounce" />
          <h2 className="text-xl font-extrabold text-foreground">
            운명의 가수를 뽑는 중!
          </h2>
        </div>

        {/* 🎰 슬롯 전광판 */}
        <div className="w-full h-16 bg-slate-950 border-2 border-ssafy-blue/50 rounded-2xl my-2 shadow-inner relative overflow-hidden flex items-center justify-center">
          {/* 입체감 상하 섀도우 */}
          <div className="absolute inset-x-0 top-0 h-3 bg-gradient-to-b from-slate-950 to-transparent z-10 pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 h-3 bg-gradient-to-t from-slate-950 to-transparent z-10 pointer-events-none" />

          {/* 📜 롤링 트랙 */}
          <div
            className="w-full will-change-transform"
            style={{
              transform: `translateY(-${targetOffset}px)`,
              transitionProperty: "transform",
              transitionDuration: isSpinning ? "3000ms" : "0ms", // 2초 동안 짧고 시원하게 롤링
              transitionTimingFunction: "cubic-bezier(0.1, 0.9, 0.2, 1.0)" // 착 감기는 감속
            }}
          >
            {reelItems.map((name, idx) => (
              <div
                key={idx}
                className="h-16 flex items-center justify-center text-2xl font-black tracking-wide text-ssafy-blue"
                style={{ color: "var(--ssafy-blue, #6dc4e8)" }}
              >
                {name}
              </div>
            ))}
          </div>
        </div>

        {/* 하단 캡션 */}
        <div className="mt-6 h-6 flex items-center justify-center">
          {isSpinning ? (
            <p className="text-md font-semibold text-foreground/60 animate-pulse">
              드르륵... 과연 누구의 목이 풀릴 것인가!
            </p>
          ) : (
            <p className="text-md font-extrabold text-emerald-400 flex items-center gap-1 animate-in slide-in-from-bottom-2">
              <Sparkles className="w-4 h-4" /> 축하합니다! {winner}님 당첨!
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
