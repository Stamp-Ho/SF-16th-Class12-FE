import { createClient } from "@/utils/supabase/server";
import LoginModal from "@/app/(auth)/LoginModal";
import StageSync from "./StageSync";
import { requireAuth } from "@/utils/auth";

export default async function SongPage() {
  const supabase = await createClient();
  const { status, profile } = await requireAuth();

  if (status === 'UNAUTHENTICATED') return <LoginModal />;
  if (status === 'FORBIDDEN') return <div className="text-center text-red-500">권한이 없습니다.</div>;


  // 3. 현재 라이브 중(singing)인 노래가 있는지 초기 조회
  // (single 대신 maybeSingle을 사용해야 결과가 없을 때 에러가 나지 않습니다)
  const { data: stageData } = await supabase
    .from("song_records")
    .select("*")
    .eq("status", "singing")
    .maybeSingle();

  const userInfo = {
    name: profile.username,
    role: profile.role
  };

  // 4. 실시간 동기화 클라이언트 래퍼로 렌더링
  return <StageSync initialStageData={stageData} user={userInfo} />;
}
