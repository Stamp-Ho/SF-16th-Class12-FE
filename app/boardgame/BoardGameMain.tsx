// app/page.tsx
import DiceArena from './components/DiceArena';

export default function BoardGameMain() {
  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-4xl space-y-4">
        <div className="text-center space-y-1">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
            3D 2.5D / Top-View Dice Arena
          </h1>
          <p className="text-sm text-slate-400">
            마우스 드래그로 화면 전체를 360도 회전하고 탑뷰와 쿼터뷰를 자유롭게 전환할 수 있습니다.
          </p>
        </div>

        <DiceArena />
      </div>
    </main>
  );
}