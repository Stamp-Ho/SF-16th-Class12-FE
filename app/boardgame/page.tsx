import LoginModal from "@/app/(auth)/LoginModal";

import BoardGameMain from "./BoardGameMain";
import { requireAuth } from "@/utils/auth";

export default async function BoardGamePage() {
  const { status, profile } = await requireAuth();

  if (status === 'UNAUTHENTICATED') return <LoginModal />;
  if (status === 'FORBIDDEN') return <div className="text-center text-red-500">권한이 없습니다.</div>;
  return <BoardGameMain profile={{name: profile.username, role: profile.role}} />;
}
