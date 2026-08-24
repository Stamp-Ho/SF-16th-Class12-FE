'use client';

import { useState, useEffect, useRef } from 'react';
import { gambleBid } from './actions';
import { Dices, Sparkles } from 'lucide-react';

interface GambleModalProps {
  seatId: string;
  userName: string;
  onClose: () => void;
}

export default function GambleModal({ seatId, userName, onClose }: GambleModalProps) {
  const [isSpinning, setIsSpinning] = useState(true);
  const [result, setResult] = useState<"loss" | "win" | null>(null);

  // 초기 12개 슬롯 세팅
  const defaultItems = Array.from({ length: 12 }, (_, i) =>
    i % 3 === 0 ? "+3,000" : "-500"
  );
  const [reelItems, setReelItems] = useState<string[]>(defaultItems);
  const [targetRotation, setTargetRotation] = useState(0);

  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frame1Ref = useRef<number | null>(null);
  const frame2Ref = useRef<number | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    let isCancelled = false;

    const startGamble = async () => {
      try {
        const plus3000 = Math.random() < 0.2; // 20% 확률로 +3,000 당첨
        // 1. 서버에서 즉시 DB 변경 및 결과 수령
        await gambleBid({
          allocationId: Number(seatId),
          userName,
          priceChange: plus3000 ? 3000 : -500,
        });

        if (isCancelled) return;

        const finalResult = plus3000 ? "win" : "loss";
        const targetSymbol = plus3000 ? "+3,000" : "-500";

        // 2. 당첨 기호를 정면(0번)에 배치
        const totalSlots = 12;
        const items = Array.from({ length: totalSlots }, (_, i) =>
          i % 3 === 0 ? "+3,000" : "-500"
        );
        items[0] = targetSymbol;
        setReelItems(items);
        setTargetRotation(0);
        setIsSpinning(true);
        setResult(null);

        // 3. 브라우저 랜더링 프레임을 확실히 잡고 3D 회전 시작 (requestAnimationFrame)
        frame1Ref.current = requestAnimationFrame(() => {
          frame2Ref.current = requestAnimationFrame(() => {
            if (isCancelled) return;
            // 5바퀴 (1800도) 회전
            setTargetRotation(1800);
          });
        });

        // 4. 회전 완료(5초) 후 결과 출력 및 닫기
        resultTimerRef.current = setTimeout(() => {
          if (isCancelled) return;
          setIsSpinning(false);
          setResult(finalResult);

          closeTimerRef.current = setTimeout(() => {
            if (isCancelled) return;
            onCloseRef.current();
          }, 1000);
        }, 5100);

      } catch (error) {
        console.error("Gamble 처리 에러:", error);
        if (!isCancelled) {
          onCloseRef.current();
        }
      }
    };

    // Strict Mode 개발 환경에서 첫 번째 mount는 즉시 unmount 되므로,
    // 서버 액션 호출을 한 틱 지연해 cleanup에서 안전하게 취소한다.
    startTimerRef.current = setTimeout(() => {
      if (isCancelled) return;
      void startGamble();
    }, 0);

    return () => {
      isCancelled = true;

      if (startTimerRef.current) {
        clearTimeout(startTimerRef.current);
      }

      if (resultTimerRef.current) {
        clearTimeout(resultTimerRef.current);
      }
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
      if (frame1Ref.current !== null) {
        cancelAnimationFrame(frame1Ref.current);
      }
      if (frame2Ref.current !== null) {
        cancelAnimationFrame(frame2Ref.current);
      }
    };
  }, [seatId]);

  const getThemeColor = () => {
    if (isSpinning) return "text-yellow-400 border-yellow-500/50";
    return result === "loss"
      ? "text-emerald-400 border-emerald-500 bg-emerald-950/20 shadow-emerald-500/20"
      : "text-rose-500 border-rose-500 bg-rose-950/20 shadow-rose-500/20";
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl w-full max-w-sm shadow-2xl flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-2 mb-6">
          <Dices className="w-6 h-6 text-yellow-400 animate-bounce" />
          <h2 className="text-xl font-black text-white">행운 노리기</h2>
        </div>

        {/* 🎰 3D 원통 슬롯 전광판 */}
        <div
          className={`w-full h-28 bg-slate-950 border-2 rounded-2xl my-2 shadow-inner relative overflow-hidden flex items-center justify-center transition-all duration-300 ${getThemeColor()}`}
        >
          <div className="absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-slate-950 via-slate-950/80 to-transparent z-20 pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent z-20 pointer-events-none" />

          {/* 🎡 3D 회전 원통 영역 */}
          <div className="h-full w-full relative [perspective:500px] flex items-center justify-center">
            <div
              className="w-full h-full absolute [transform-style:preserve-3d] transition-transform duration-[5000ms] ease-[cubic-bezier(0.15,0.85,0.35,0.96)]"
              style={{
                transform: `rotateX(-${targetRotation}deg)`,
              }}
            >
              {reelItems.map((symbol, idx) => {
                const angle = (360 / reelItems.length) * idx;
                return (
                  <div
                    key={idx}
                    className="absolute inset-0 flex items-center justify-center text-3xl font-black [backface-visibility:hidden]"
                    style={{
                      transform: `rotateX(${angle}deg) translateZ(80px)`,
                    }}
                  >
                    {symbol}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 h-6 flex items-center justify-center">
          {isSpinning ? (
            <p className="text-sm font-medium text-slate-400 animate-pulse">
              빙글빙글... 운명을 결정하는 중!
            </p>
          ) : result === "loss" ? (
            <p className="text-md font-extrabold text-emerald-400 flex items-center gap-1 animate-in slide-in-from-bottom-2">
              <Sparkles className="w-4 h-4" /> 축하합니다! (-500)
            </p>
          ) : (
            <p className="text-md font-extrabold text-rose-500 flex items-center gap-1 animate-in slide-in-from-bottom-2">
              <Sparkles className="w-4 h-4" /> 고맙습니다! (+3,000)
            </p>
          )}
        </div>
      </div>
    </div>
  );
}