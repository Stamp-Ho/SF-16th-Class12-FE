import LoginModal from '@/app/(auth)/LoginModal';
import { requireAuth } from '@/utils/auth';
import AvalonMain from './AvalonMain';

export default async function AvalonPage() {
  const { status, profile, user } = await requireAuth();
  if (status === 'UNAUTHENTICATED') return <LoginModal />;
  if (status === 'FORBIDDEN' || !user || !profile) return <div className="p-8 text-center text-red-600">권한이 없습니다.</div>;
  return <AvalonMain user={{ id: user.id, name: String(profile.username) }} role={String(profile.role)} />;
}
