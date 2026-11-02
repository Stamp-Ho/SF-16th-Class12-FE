import { notFound } from 'next/navigation';
import { requireAuth } from '@/utils/auth';
import { createClient } from '@/utils/supabase/server';
import { AvalonPreview } from '../AvalonMain';
import { PREVIEW_FALLBACK_IDS, PREVIEW_NAMES } from '../previewData';

export default async function AvalonPreviewPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  const { profile } = await requireAuth();
  if (!profile) return <AvalonPreview avatarError="로그인하면 본인 프로필 이미지를 확인할 수 있습니다." />;
  const supabase = await createClient();
  const { data: profiles, error: profileError } = await supabase.from('users')
    .select('id, username').in('username', [...PREVIEW_NAMES]);
  const idsByName = new Map((profiles ?? []).map((person) => [person.username, String(person.id)]));
  const participants = PREVIEW_NAMES.map((name, index) => ({ id: idsByName.get(name) ?? PREVIEW_FALLBACK_IDS[index], name }));
  const signed = await Promise.all(participants.map(async (person) => {
    const { data, error } = await supabase.storage.from('profileImage').createSignedUrl(`${person.id}.jpg`, 3600);
    return { id: person.id, name: person.name, url: data?.signedUrl, error: error?.message };
  }));
  const avatarUrls = Object.fromEntries(signed.filter((entry) => entry.url).map((entry) => [entry.id, entry.url as string]));
  const failed = signed.find((entry) => entry.error);
  const avatarError = profileError?.message ?? (failed ? `${failed.name}: ${failed.error}` : undefined);
  return <AvalonPreview participants={participants} avatarUrls={avatarUrls} avatarError={avatarError} />;
}
