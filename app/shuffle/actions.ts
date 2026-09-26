'use server';

import { createClient } from '@/utils/supabase/server';

// 1. 추첨 대상이 될 전체 유저 이름 목록 조회
export async function getTargetUsers() {
	const supabase = await createClient();

	const { data: users, error } = await supabase
		.from('users')
		.select('id, username, role')
		.eq('status', 'ACTIVE')
		.order('username', { ascending: true });
	console.log(users);

	if (error) throw new Error(`유저 목록 조회 실패: ${error.message}`);
	return users
		.filter((profile) => profile.role !== 'teacher')
		.map((profile) => ({
			id: profile.id,
			name: profile.username,
			role: profile.role,
		}));
}
