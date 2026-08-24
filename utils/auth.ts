import { cache } from 'react';
import { createClient } from '@/utils/supabase/server';

export interface UserProfile {
  id: string;
  name: string;
  role: 'ADMIN' | 'USER' | string;
  class_id?: number | null;
  [key: string]: any;
}

/**
 * 현재 로그인 유저와 public.users 프로필을 한 번에 조회 (렌더링 당 1회 캐싱)
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, profile: null };
  }

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('username', user.user_metadata.name) // 또는 name/auth_user_id 매핑 컬럼
    .single();

  return {
    user,
    profile: (profile as UserProfile) || null,
  };
});

/**
 * 특정 조건(예: class_id 필수) 검증 헬퍼
 */
export const requireAuth = cache(async () => {
  const { user, profile } = await getCurrentUser();

  if (!user) return { status: 'UNAUTHENTICATED' as const, user: null, profile: null };
  if (!profile) return { status: 'FORBIDDEN' as const, user, profile };

  return { status: 'AUTHORIZED' as const, user, profile };
});