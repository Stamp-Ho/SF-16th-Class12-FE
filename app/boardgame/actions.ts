"use server";

import { requireAuth } from "@/utils/auth";
import { createClient } from "@/utils/supabase/server";
import type { BoardTileData, TileActionType } from "./types/board";
import type { GoldCardData, GoldCardEventType } from "./gold-cards/types";

export type BoardgameResult<T> =
  | { success: true; data: T }
  | { success: false; message: string };

export interface BoardgameSummary {
  id: string;
  name: string;
  grid_rows: number;
  grid_cols: number;
  maker_user_name: string;
  can_edit: boolean;
  is_maker: boolean;
	editors: string[];
}

export interface BoardgameSnapshot {
  id: string;
  name: string;
  grid_rows: number;
  grid_cols: number;
	tiles: BoardTileData[];
  gold_cards: GoldCardData[];
}

const failure = <T = never>(message: string): BoardgameResult<T> => ({
  success: false,
  message,
});

async function getActor() {
  const auth = await requireAuth();
  if (auth.status !== "AUTHORIZED" || !auth.profile?.username) return null;
  return {
    userName: String(auth.profile.username),
    role: String(auth.profile.role ?? ""),
  };
}

async function canEditBoardgame(
  boardgameId: string,
  userName: string,
  makerOnly = false,
) {
  const supabase = await createClient();
  const { data: game, error } = await supabase
    .from("boardgames")
    .select("maker_user_name")
    .eq("id", boardgameId)
    .maybeSingle();

  if (error || !game) return { allowed: false, error: error?.message };
  if (game.maker_user_name === userName) return { allowed: true };
  if (makerOnly) return { allowed: false };

  const { data: editor, error: editorError } = await supabase
    .from("boardgame_editors")
    .select("id")
    .eq("boardgame_id", boardgameId)
    .eq("user_name", userName)
    .maybeSingle();

  return {
    allowed: Boolean(editor),
    error: editorError?.message,
  };
}

export async function listBoardgames(): Promise<BoardgameResult<BoardgameSummary[]>> {
  const actor = await getActor();
  if (!actor) return failure("로그인이 필요합니다.");

  const supabase = await createClient();
  const [{ data: games, error }, { data: edits, error: editError }] =
    await Promise.all([
      supabase
        .from("boardgames")
        .select(
			"id, name, grid_rows, grid_cols, maker_user_name",
        )
        .order("updated_at", { ascending: false }),
      supabase
        .from("boardgame_editors")
        .select("boardgame_id, user_name"),
    ]);

  if (error) return failure(error.message);
  if (editError) return failure(editError.message);

  const editableIds = new Set(
    (edits ?? [])
      .filter((edit) => edit.user_name === actor.userName)
      .map((edit) => edit.boardgame_id),
  );
  return {
    success: true,
    data: (games ?? []).map((game) => ({
      ...game,
      is_maker: game.maker_user_name === actor.userName,
      can_edit:
        game.maker_user_name === actor.userName || editableIds.has(game.id),
		editors: (edits ?? [])
        .filter((edit) => edit.boardgame_id === game.id)
        .map((edit) => edit.user_name),
    })),
  };
}

export async function createBoardgame(input: {
  name: string;
  gridRows: number;
  gridCols: number;
}): Promise<BoardgameResult<BoardgameSummary>> {
  const actor = await getActor();
  if (!actor) return failure("로그인이 필요합니다.");
  if (actor.role !== "super_admin") {
    return failure("새 보드게임은 관리자만 만들 수 있습니다.");
  }

  const name = input.name.trim();
  if (!name) return failure("게임 이름을 입력해 주세요.");
  if (
    !Number.isInteger(input.gridRows) ||
    !Number.isInteger(input.gridCols) ||
    input.gridRows < 3 || input.gridRows > 20 ||
    input.gridCols < 3 || input.gridCols > 20
  ) {
    return failure("행과 열은 3부터 20 사이의 정수여야 합니다.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("boardgames")
    .insert({
      name,
      grid_rows: input.gridRows,
      grid_cols: input.gridCols,
      maker_user_name: actor.userName,
	})
    .select(
		"id, name, grid_rows, grid_cols, maker_user_name",
    )
    .single();

  if (error) return failure(error.message);
  return {
    success: true,
    data: {
      ...data,
      can_edit: true,
      is_maker: true,
		editors: [],
    },
  };
}

export async function getBoardgame(
  boardgameId: string,
): Promise<BoardgameResult<BoardgameSnapshot>> {
  const actor = await getActor();
  if (!actor) return failure("로그인이 필요합니다.");

  const supabase = await createClient();
  const [gameResult, tileResult, linkResult, cardResult] = await Promise.all([
    supabase
		.from("boardgames")
		.select("id, name, grid_rows, grid_cols")
      .eq("id", boardgameId)
      .maybeSingle(),
    supabase.from("boardgame_tiles").select("*").eq("boardgame_id", boardgameId),
    supabase
      .from("boardgame_tile_next")
      .select("source_tile_id, target_tile_id, sort_order")
      .eq("boardgame_id", boardgameId)
      .order("sort_order"),
    supabase
      .from("boardgame_gold_cards")
      .select("*")
      .eq("boardgame_id", boardgameId)
      .order("sort_order"),
  ]);

  const queryError =
    gameResult.error || tileResult.error || linkResult.error || cardResult.error;
  if (queryError) return failure(queryError.message);
  if (!gameResult.data) return failure("보드게임을 찾을 수 없습니다.");

  const nextIdsBySource = new Map<string, string[]>();
  for (const link of linkResult.data ?? []) {
    const ids = nextIdsBySource.get(link.source_tile_id) ?? [];
    ids.push(link.target_tile_id);
    nextIdsBySource.set(link.source_tile_id, ids);
  }

  const tiles: BoardTileData[] = (tileResult.data ?? []).map((tile) => ({
    id: tile.id,
    category: tile.category,
    gridR: tile.grid_row,
    gridC: tile.grid_col,
    // 월드 좌표와 회전은 현재 격자 크기에서 다시 계산한다.
    position: { x: 0, y: 0.2, z: 0 },
    rotationY: 0,
    label: tile.label,
    subLabel: tile.sub_label,
    color: tile.color ?? undefined,
    textColor: tile.text_color ?? undefined,
    icon: tile.icon ?? undefined,
    nextTileIds: nextIdsBySource.get(tile.id) ?? [],
    action: {
      type: tile.action_type as TileActionType,
      params: tile.action_params ?? {},
    },
		isLocked: tile.is_locked,
		lockedByUserName: tile.locked_by_user_name,
	}));

  const gold_cards: GoldCardData[] = (cardResult.data ?? []).map((card) => ({
    id: card.id,
    title: card.title,
    description: card.description,
    event: {
      type: card.event_type as GoldCardEventType,
      ...(card.event_params ?? {}),
    },
  }));

  return {
    success: true,
    data: { ...gameResult.data, tiles, gold_cards },
  };
}

export async function saveBoardgame(input: {
  id: string;
  gridRows: number;
  gridCols: number;
  tiles: BoardTileData[];
  goldCards: GoldCardData[];
  saveGridSize?: boolean;
  saveGoldCards?: boolean;
  tileIdRenames?: Array<{ from: string; to: string }>;
}): Promise<BoardgameResult<null>> {
  const actor = await getActor();
  if (!actor) return failure("로그인이 필요합니다.");
  const permission = await canEditBoardgame(input.id, actor.userName);
  if (!permission.allowed) {
    return failure(permission.error ?? "이 보드게임을 수정할 권한이 없습니다.");
  }

  const supabase = await createClient();
  if (
    !Number.isInteger(input.gridRows) || !Number.isInteger(input.gridCols) ||
    input.gridRows < 3 || input.gridRows > 20 ||
    input.gridCols < 3 || input.gridCols > 20
  ) {
    return failure("격자 크기를 확인해 주세요.");
  }

  const tileIds = new Set(input.tiles.map((tile) => tile.id));
  const occupiedCells = new Set<string>();
  for (const tile of input.tiles) {
		if (tile.action.type === 'SKIP_TURNS') {
			const turns = tile.action.params?.turns;
			if (typeof turns !== 'number' || !Number.isSafeInteger(turns) || turns < 1 || turns > 99) {
				return failure(`타일 ${tile.id}의 멈춤 턴 수는 1부터 99 사이의 정수여야 합니다.`);
			}
		}
    if (
      !Number.isInteger(tile.gridR) || !Number.isInteger(tile.gridC) ||
      tile.gridR < 0 || tile.gridR >= input.gridRows ||
      tile.gridC < 0 || tile.gridC >= input.gridCols
    ) {
      return failure(`타일 ${tile.id}의 격자 위치가 범위를 벗어났습니다.`);
    }
    const cell = `${tile.gridR}:${tile.gridC}`;
    if (occupiedCells.has(cell)) return failure("같은 격자 위치에 타일이 중복되었습니다.");
    occupiedCells.add(cell);
    if (tile.nextTileIds.some((id) => !tileIds.has(id))) {
      return failure(`타일 ${tile.id}의 다음 칸 설정에 없는 타일이 포함되어 있습니다.`);
    }
  }

  if (input.saveGridSize) {
    const { error: gameError } = await supabase
      .from("boardgames")
      .update({
        grid_rows: input.gridRows,
        grid_cols: input.gridCols,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id);
    if (gameError) return failure(gameError.message);
  }

  const { data: storedTiles, error: storedTilesError } = await supabase
    .from("boardgame_tiles")
    .select("id, locked_by_user_name")
    .eq("boardgame_id", input.id);
  if (storedTilesError) return failure(storedTilesError.message);
  const storedById = new Map((storedTiles ?? []).map((tile) => [tile.id, tile]));
  const ownedTileIds = new Set(
    (storedTiles ?? [])
      .filter((tile) => tile.locked_by_user_name === actor.userName)
      .map((tile) => tile.id),
  );
  const tilesToSave = input.tiles.filter(
    (tile) => ownedTileIds.has(tile.id) || !storedById.has(tile.id),
  );
  const tileRows = tilesToSave.map((tile) => ({
    boardgame_id: input.id,
    id: tile.id,
    category: tile.category,
    grid_row: tile.gridR,
    grid_col: tile.gridC,
    label: tile.label,
    sub_label: tile.subLabel ?? "",
    color: tile.color ?? null,
    text_color: tile.textColor ?? null,
    icon: tile.icon ?? null,
    action_type: tile.action.type,
    action_params: tile.action.params ?? {},
    is_locked: tile.isLocked ?? false,
  }));

  if (tileRows.length) {
    const { error } = await supabase
      .from("boardgame_tiles")
      .upsert(tileRows, { onConflict: "boardgame_id,id" });
    if (error) return failure(error.message);
  }

  for (const rename of input.tileIdRenames ?? []) {
    if (rename.from === rename.to) continue;
    const { error } = await supabase
      .from("boardgame_tile_next")
      .update({ target_tile_id: rename.to })
      .eq("boardgame_id", input.id)
      .eq("target_tile_id", rename.from);
    if (error) return failure(error.message);
  }

  const removedTileIds = [...ownedTileIds].filter((id) => !tileIds.has(id));
  const savedSourceIds = new Set(tilesToSave.map((tile) => tile.id));
  const clearSourceIds = [...savedSourceIds].filter((id) => storedById.has(id));
  if (clearSourceIds.length) {
    const { error: clearLinksError } = await supabase
      .from("boardgame_tile_next")
      .delete()
      .eq("boardgame_id", input.id)
      .in("source_tile_id", clearSourceIds);
    if (clearLinksError) return failure(clearLinksError.message);
  }

  const linkRows = tilesToSave.flatMap((tile) =>
    tile.nextTileIds.map((targetTileId, sortOrder) => ({
      boardgame_id: input.id,
      source_tile_id: tile.id,
      target_tile_id: targetTileId,
      sort_order: sortOrder,
    })),
  );
  if (linkRows.length) {
    const { error } = await supabase.from("boardgame_tile_next").insert(linkRows);
    if (error) return failure(error.message);
  }

  if (removedTileIds.length) {
    const { error } = await supabase
      .from("boardgame_tiles")
      .delete()
      .eq("boardgame_id", input.id)
      .in("id", removedTileIds);
    if (error) return failure(error.message);
  }

  if (input.saveGoldCards) {
    const cardRows = input.goldCards.map((card, sortOrder) => ({
      boardgame_id: input.id,
      id: card.id,
      title: card.title,
      description: card.description,
      sort_order: sortOrder,
      event_type: card.event.type,
      event_params: Object.fromEntries(
        Object.entries(card.event).filter(([key]) => key !== "type"),
      ),
    }));
    if (cardRows.length) {
      const { error } = await supabase
        .from("boardgame_gold_cards")
        .upsert(cardRows, { onConflict: "boardgame_id,id" });
      if (error) return failure(error.message);
    }

    const { data: currentCards, error: currentCardsError } = await supabase
      .from("boardgame_gold_cards")
      .select("id")
      .eq("boardgame_id", input.id);
    if (currentCardsError) return failure(currentCardsError.message);
    const cardIds = new Set(input.goldCards.map((card) => card.id));
    const removedCardIds = (currentCards ?? [])
      .map((card) => card.id)
      .filter((id) => !cardIds.has(id));
    if (removedCardIds.length) {
      const { error } = await supabase
        .from("boardgame_gold_cards")
        .delete()
        .eq("boardgame_id", input.id)
        .in("id", removedCardIds);
      if (error) return failure(error.message);
    }
  }

  const { error: releaseError } = await supabase
    .from("boardgame_tiles")
    .update({ locked_by_user_name: null })
    .eq("boardgame_id", input.id)
    .eq("locked_by_user_name", actor.userName);
  if (releaseError) return failure(releaseError.message);

  return { success: true, data: null };
}

export async function acquireBoardgameTileEditLock(
  boardgameId: string,
  tileId: string,
): Promise<BoardgameResult<string>> {
  const actor = await getActor();
  if (!actor) return failure("로그인이 필요합니다.");
  const permission = await canEditBoardgame(boardgameId, actor.userName);
  if (!permission.allowed) {
    return failure(permission.error ?? "이 보드게임을 편집할 권한이 없습니다.");
  }

  const supabase = await createClient();
  const { data: current, error: currentError } = await supabase
    .from("boardgame_tiles")
    .select("locked_by_user_name")
    .eq("id", tileId)
    .eq("boardgame_id", boardgameId)
    .maybeSingle();
  if (currentError) return failure(currentError.message);
  if (!current) return { success: true, data: actor.userName };
  if (current.locked_by_user_name === actor.userName) return { success: true, data: actor.userName };
  if (current.locked_by_user_name) return failure(`다른 사용자가 편집 중입니다: ${current.locked_by_user_name}`);

  const { data: claimed, error } = await supabase
    .from("boardgame_tiles")
    .update({ locked_by_user_name: actor.userName })
    .eq("boardgame_id", boardgameId)
    .eq("id", tileId)
    .is("locked_by_user_name", null)
    .select("id")
    .maybeSingle();
  if (error) return failure(error.message);
  if (!claimed) return failure("다른 사용자가 먼저 편집을 시작했습니다.");
  return { success: true, data: actor.userName };
}

export async function grantBoardgameEditor(
  boardgameId: string,
  userName: string,
): Promise<BoardgameResult<null>> {
  const actor = await getActor();
  if (!actor) return failure("로그인이 필요합니다.");
  const permission = await canEditBoardgame(boardgameId, actor.userName, true);
  if (!permission.allowed) return failure("수정 권한은 제작자만 부여할 수 있습니다.");

  const supabase = await createClient();
  const { error } = await supabase.from("boardgame_editors").insert({
    boardgame_id: boardgameId,
    user_name: userName.trim(),
  });
  if (error) return failure(error.message);
  return { success: true, data: null };
}

export async function revokeBoardgameEditor(
  boardgameId: string,
  userName: string,
): Promise<BoardgameResult<null>> {
  const actor = await getActor();
  if (!actor) return failure("로그인이 필요합니다.");
  const permission = await canEditBoardgame(boardgameId, actor.userName, true);
  if (!permission.allowed) return failure("수정 권한은 제작자만 회수할 수 있습니다.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("boardgame_editors")
    .delete()
    .eq("boardgame_id", boardgameId)
    .eq("user_name", userName.trim());
  if (error) return failure(error.message);
  return { success: true, data: null };
}

export async function deleteBoardgame(
  boardgameId: string,
): Promise<BoardgameResult<null>> {
  const actor = await getActor();
  if (!actor) return failure("로그인이 필요합니다.");
  const permission = await canEditBoardgame(boardgameId, actor.userName, true);
  if (!permission.allowed) return failure("게임 삭제는 제작자만 할 수 있습니다.");

  const supabase = await createClient();
  const { error } = await supabase.from("boardgames").delete().eq("id", boardgameId);
  if (error) return failure(error.message);
  const { error: editorError } = await supabase.from("boardgame_editors").delete().eq("boardgame_id", boardgameId);
  if (editorError) return failure(editorError.message);
  const { error: nextTileError } = await supabase.from("boardgame_tile_next").delete().eq("boardgame_id", boardgameId);
  if (nextTileError) return failure(nextTileError.message);
  const { error: tileError } = await supabase.from("boardgame_tiles").delete().eq("boardgame_id", boardgameId);
  if (tileError) return failure(tileError.message);
  const { error: goldCardError } = await supabase.from("boardgame_gold_cards").delete().eq("boardgame_id", boardgameId);
  if (goldCardError) return failure(goldCardError.message);
  return { success: true, data: null };
}
