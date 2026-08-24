import LoginModal from "@/app/(auth)/LoginModal";

import SeatsMain from "./SeatsMain";
import { requireAuth } from "@/utils/auth";

export default async function SeatAuctionPage() {
  const { status, profile } = await requireAuth();

  if (status === 'UNAUTHENTICATED') return <LoginModal />;
  if (status === 'FORBIDDEN') return <div className="text-center text-red-500">권한이 없습니다.</div>;
  return <SeatsMain profile={{name: profile.username, role: profile.role}} />;
}
