'use server';

import { requireAuth } from '@/utils/auth';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { names } from './data';

export async function getRelationshipAvatars() {
  const { status } = await requireAuth();
  if (status !== 'AUTHORIZED') throw new Error('로그인이 필요합니다.');
  const { data: people, error } = await createAdminClient().from('users').select('id, username').in('username', names);
  if (error) throw new Error('얼굴 사진 정보를 불러오지 못했습니다.');
  const supabase = await createClient();
  const signed = await Promise.all((people ?? []).map(async person => {
    const { data } = await supabase.storage.from('profileImage').createSignedUrl(`${person.id}.jpg`, 3600);
    return [String(person.username), data?.signedUrl ?? ''] as const;
  }));
  return Object.fromEntries(signed);
}
