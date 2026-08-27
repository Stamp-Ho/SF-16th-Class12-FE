import { requireAuth } from '@/utils/auth';
import { redirect } from 'next/navigation';
import SnackMain from './SnackMain';

export default async function SnackPage() {
	const { status, profile } = await requireAuth();
	if (!profile) {
		redirect('/');
	}
	return <SnackMain profile={profile} />;
}
