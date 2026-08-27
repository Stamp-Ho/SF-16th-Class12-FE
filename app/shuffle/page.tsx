import LoginModal from '@/app/(auth)/LoginModal';
import ShuffleMain from './ShuffleMain';
import { requireAuth } from '@/utils/auth';

export default async function RandomizerPage() {
	const { status } = await requireAuth();

	if (status === 'UNAUTHENTICATED') return <LoginModal />;
	if (status === 'FORBIDDEN')
		return <div className="text-center text-red-500">권한이 없습니다.</div>;

	return <ShuffleMain />;
}
