import LoginModal from '@/app/(auth)/LoginModal';
import { requireAuth } from '@/utils/auth';
import GroupDraw from './GroupDraw';

export default async function GroupsPage() {
  const { status } = await requireAuth();
  if (status === 'UNAUTHENTICATED') return <LoginModal />;
  if (status === 'FORBIDDEN') return <div className="p-12 text-center text-red-500">접근 권한이 없습니다.</div>;
  return <GroupDraw />;
}
