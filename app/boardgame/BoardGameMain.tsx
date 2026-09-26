// app/page.tsx
import DiceArena from './components/DiceArena';
import Link from 'next/link';
import { ArrowLeft, Dices, PlusCircle } from 'lucide-react';

export default function BoardGameMain({ profile }: { profile: any; }) {
  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-6xl space-y-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors w-fit py-2 m-0"
        >
          <ArrowLeft className="w-4 h-4" /> 메인 화면으로
        </Link>
        {/* 1. 상단 헤더 */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full">
          <div className="w-full">
            <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2 w-full justify-between">
              <Dices className="w-7 h-7 text-rose-600" />
              보두게임
              {profile.role === "super_admin" && (
                <button
                  //onClick={()=>{console.log("새 보드게임 만들기 클릭됨")}}
                  className="flex items-center ml-auto gap-2 px-3 py-2 sm:px-4 sm:py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md transition-all self-start sm:self-auto"
                >
                  <PlusCircle className="w-4 h-4" />새 보드게임 만들기
                </button>
              )}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              우리가 직접 만들어 즐기는 주루마블
            </p>
          </div>
        </div>
        {/* <div className="text-center space-y-1">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
            3D 2.5D / Top-View Dice Arena
          </h1>
          <p className="text-sm text-slate-400">
            마우스 드래그로 화면 전체를 360도 회전하고 탑뷰와 쿼터뷰를 자유롭게 전환할 수 있습니다.
          </p>
        </div> */}

        <DiceArena />
      </div>
    </main>
  );
}