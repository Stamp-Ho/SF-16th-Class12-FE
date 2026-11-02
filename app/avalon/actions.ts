'use server';

import { requireAuth } from '@/utils/auth';
import { createAdminClient } from '@/utils/supabase/admin';
import { applyMove, initialState, joinRoom, leaveRoom, publicView, type Move } from './engine';
import type { GameState } from './rules';

type Actor = { id: string; name: string };
type Result<T> = { ok: true; data: T } | { ok: false; error: string };
export type AvalonRoomSummary = { id: string; hostName: string; players: string[]; capacity: number; phase: string };

async function actor(): Promise<Actor> {
  const auth = await requireAuth();
  if (auth.status !== 'AUTHORIZED' || !auth.user || !auth.profile?.username) throw new Error('로그인이 필요합니다.');
  return { id: auth.user.id, name: String(auth.profile.username) };
}
async function findRoom(roomId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roomId)) throw new Error('방을 확인해 주세요.');
  const { data, error } = await createAdminClient().from('avalon_rooms').select('id, state, version').eq('id', roomId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('방을 찾을 수 없습니다.');
  return data as { id: string; state: GameState; version: number };
}

async function findMine(userId: string) {
  const { data, error } = await createAdminClient().from('avalon_rooms').select('id, state, version, created_at')
    .contains('state', { players: [{ id: userId }] }).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).find((row) => (row.state as GameState).phase !== 'finished') as { id: string; state: GameState; version: number } | undefined;
}

export async function listAvalonRooms(): Promise<Result<AvalonRoomSummary[]>> {
  try {
    await actor();
    const { data, error } = await createAdminClient().from('avalon_rooms').select('id, state').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return { ok: true, data: (data ?? []).filter((row) => (row.state as GameState).phase !== 'finished').map((row) => {
      const s = row.state as GameState;
      return { id: row.id, hostName: s.players.find((p) => p.id === s.hostId)?.name ?? '방장', players: s.players.map((p) => p.name), capacity: s.config.playerCount, phase: s.phase };
    }) };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : '방 목록을 불러오지 못했습니다.' }; }
}

export async function getMyAvalonRoom(): Promise<Result<{ id: string; view: ReturnType<typeof publicView> } | null>> {
  try {
    const user = await actor();
    const row = await findMine(user.id);
    return { ok: true, data: row ? { id: row.id, view: publicView(row.state, user.id) } : null };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : '참여 중인 방을 불러오지 못했습니다.' }; }
}

export async function createAvalonRoom(): Promise<Result<{ id: string }>> {
  try {
    const user = await actor();
    const db = createAdminClient();
    const existing = await findMine(user.id);
    if (existing) return { ok: true, data: { id: existing.id } };
    const { data, error } = await db.from('avalon_rooms').insert({ host_user_id: user.id, state: initialState(user) }).select('id').single();
    if (error || !data) throw new Error(error?.message ?? '방을 생성하지 못했습니다.');
    return { ok: true, data: { id: data.id } };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : '방 생성에 실패했습니다.' }; }
}

async function mutate(roomId: string, transform: (state: GameState, user: Actor) => GameState): Promise<Result<{ id: string; view: ReturnType<typeof publicView> }>> {
  try {
    const user = await actor();
    for (let attempt = 0; attempt < 6; attempt++) {
      const row = await findRoom(roomId);
      const state = transform(row.state, user);
      const { data, error } = await createAdminClient().from('avalon_rooms')
        .update({ state, version: row.version + 1, updated_at: new Date().toISOString() })
        .eq('id', row.id).eq('version', row.version).select('id').maybeSingle();
      if (error) throw new Error(error.message);
      if (data) return { ok: true, data: { id: row.id, view: publicView(state, user.id) } };
    }
    throw new Error('동시에 변경된 내용이 있습니다. 다시 시도해 주세요.');
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : '요청을 처리하지 못했습니다.' }; }
}

export async function joinAvalonRoom(roomId: string) {
  try {
    const user = await actor();
    const existing = await findMine(user.id);
    if (existing && existing.id !== roomId) return { ok: false as const, error: '이미 다른 진행 중인 방에 참가하고 있습니다.' };
  } catch (error) { return { ok: false as const, error: error instanceof Error ? error.message : '입장할 수 없습니다.' }; }
  return mutate(roomId, (state, user) => joinRoom(state, user));
}

export async function leaveAvalonRoom(roomId: string) {
  try {
    const user = await actor();
    const row = await findRoom(roomId);
    if (row.state.phase === 'lobby' && row.state.players.length === 1 && row.state.players[0].id === user.id) {
      const { data, error } = await createAdminClient().from('avalon_rooms').delete().eq('id', row.id).eq('version', row.version).select('id').maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error('방이 변경되었습니다. 다시 시도해 주세요.');
      return { ok: true as const, data: { id: row.id, view: null } };
    }
  } catch (error) { return { ok: false as const, error: error instanceof Error ? error.message : '퇴장하지 못했습니다.' }; }
  return mutate(roomId, (state, user) => leaveRoom(state, user.id));
}

export async function moveAvalonRoom(roomId: string, move: Move) {
  return mutate(roomId, (state, user) => applyMove(state, user.id, move));
}

export async function getAvalonRoom(roomId: string): Promise<Result<{ id: string; view: ReturnType<typeof publicView> }>> {
  try {
    const user = await actor();
    const row = await findRoom(roomId);
    return { ok: true, data: { id: row.id, view: publicView(row.state, user.id) } };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : '방을 불러오지 못했습니다.' }; }
}

