// app/(auth)/actions.ts
'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function getUsers() {
	const supabase = await createClient();
	const { data: users, error } = await supabase
		.from('users')
		.select('id, username, email');
	if (error) {
		throw new Error(`Failed to fetch users: ${error.message}`);
	}
	return users.sort((a, b) => a.username.localeCompare(b.username));
}

export async function loginWithName(formData: FormData) {
	const name = formData.get('ssafy12banName') as string;
	const password = formData.get('password') as string;

	if (!name || !password) {
		return { error: '이름과 비밀번호를 모두 입력해 주세요.' };
	}

	const supabase = await createClient();

	// 1. 이름(name)으로 users 테이블에서 유저의 가상 이메일 조회
	const { data: profile, error: profileError } = await supabase
		.from('users')
		.select('email')
		.eq('username', name.trim())
		.single();
	if (profileError || !profile || !profile.email) {
		return {
			error: '이름이 정확한지 확인해 주세요.',
		};
	}
	console.log('Found user email:', profile.email);

	// 2. DB에서 조회해온 가상 이메일로 Supabase Auth 로그인 실행
	const { error: signInError } = await supabase.auth.signInWithPassword({
		email: profile.email,
		password: password,
	});
	console.log('Sign-in error:', signInError);
	console.log('email, password:', profile.email, password);

	if (signInError) {
		return { error: '비밀번호가 올바르지 않습니다.' };
	}

	revalidatePath('/', 'layout');
	return { success: true };
}
// 로그아웃 Action
export async function logout() {
	const supabase = await createClient();
	await supabase.auth.signOut();
	revalidatePath('/', 'layout');
}
