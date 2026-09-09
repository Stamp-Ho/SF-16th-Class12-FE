// app/actions/snack.ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server"; // 프로젝트 내 Supabase SSR 서버 클라이언트 경로

export type SnackItem = {
  id: number;
  snack_name: string;
  description: string | null;
  created_by: string;
  status: "voting" | "adopted" | "dismissed";
  final_vote_count: number | null;
  vote_count: number;
  voted_by_me: boolean | undefined;
  created_at: string;
};

type SnackRecord = Omit<SnackItem, "vote_count" | "voted_by_me"> & {
  final_vote_count: number | null;
  closed_at: string | null;
};

type SnackVoteRecord = {
  snack_id: number;
  user_name: string;
};

// ===================================================================
// 1. 간식 목록 조회 (내 투표 여부 + 실시간 집계)
// ===================================================================
export async function getSnacks(
  statusFilter: "voting" | "archived" = "voting",
  name: string
) {
  const supabase = await createClient();

  // 2) snacks 조회
  let query = supabase.from("snacks").select(`
      id,
      snack_name,
      description,
      created_by,
      status,
      final_vote_count,
      created_at,
      closed_at
    `);

  if (statusFilter === "voting") {
    query = query.eq("status", "voting");
  } else {
    query = query
      .in("status", ["adopted", "dismissed"])
      .order("closed_at", { ascending: false });
  }

  const { data: snackData, error } = await query;
  if (error) {
    console.error("Fetch error:", error);
    return [];
  }

  const snacks = snackData as SnackRecord[];
  const snackIds = snacks.map((snack) => snack.id);
  const { data: voteData, error: voteError } = await supabase
    .from("snack_votes")
    .select("snack_id, user_name")
    .in("snack_id", snackIds);

  if (voteError) {
    console.error("Vote fetch error:", voteError);
    return [];
  }

  const votesBySnack = new Map<number, SnackVoteRecord[]>();
  for (const vote of voteData as SnackVoteRecord[]) {
    const votes = votesBySnack.get(vote.snack_id) || [];
    votes.push(vote);
    votesBySnack.set(vote.snack_id, votes);
  }

  // 3) 클라이언트 친화적인 포맷으로 가공
  const items: SnackItem[] = snacks.map((item) => {
    const isVoting = item.status === "voting";
    const votes = votesBySnack.get(item.id) || [];
    const voteCount = isVoting ? votes.length : (item.final_vote_count ?? 0);
    const votedByMe = votes.some((vote) => vote.user_name === name);

    return {
      id: item.id,
      snack_name: item.snack_name,
      description: item.description,
      created_by: item.created_by,
      status: item.status,
      final_vote_count: item.final_vote_count,
      vote_count: voteCount,
      voted_by_me: votedByMe,
      created_at: item.created_at
    };
  });

  // 투표 중인 목록은 득표 순 정렬
  if (statusFilter === "voting") {
    items.sort(
      (a, b) =>
        b.vote_count - a.vote_count ||
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  return items;
}

// ===================================================================
// 2. 새 간식 등록
// ===================================================================
export async function createSnack(formData: FormData, name: string) {
  const supabase = await createClient();

  const snackName = formData.get("snack_name")?.toString().trim();
  const description = formData.get("description")?.toString().trim() || null;

  if (!snackName) {
    return { success: false, message: "간식 이름을 입력해주세요." };
  }

  const { error } = await supabase.from("snacks").insert({
    snack_name: snackName,
    description: description,
    created_by: name
  });

  if (error) {
    console.error(error);
    return { success: false, message: "간식 등록에 실패했습니다." };
  }

  revalidatePath("/snack");
  return { success: true };
}

// ===================================================================
// 3. 투표 토글 (RPC 호출)
// ===================================================================
export async function toggleSnackVote(snackId: number, name: string) {
  const supabase = await createClient();

  // DB에 선언해둔 RPC 함수 호출
  const { data: hasVoted, error } = await supabase.rpc("toggle_snack_vote", {
    p_snack_id: snackId,
    p_user_name: name
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/snack");
  return { success: true, voted: hasVoted as boolean };
}

// ===================================================================
// 4. 관리자: 상태 변경 (채택 / 기각 & RPC 호출)
// ===================================================================
export async function updateSnackStatus(
  snackId: number,
  status: "adopted" | "dismissed",
  role: string
) {
  const supabase = await createClient();
  const isAdmin = role === "super_admin";
  if (!isAdmin) {
    return { success: false, message: "관리자 권한이 필요합니다." };
  }

  // DB의 close_snack_vote RPC 실행
  const { error } = await supabase.rpc("close_snack_vote", {
    p_snack_id: snackId,
    p_status: status
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/snack");
  return { success: true };
}

// ===================================================================
// 5. 관리자: 보관 간식 삭제
// ===================================================================
export async function deleteArchivedSnack(snackId: number, role: string) {
  const supabase = await createClient();

  if (role !== "super_admin") {
    return { success: false, message: "관리자 권한이 필요합니다." };
  }

  const { error: voteError } = await supabase
    .from("snack_votes")
    .delete()
    .eq("snack_id", snackId);

  if (voteError) {
    return { success: false, message: voteError.message };
  }

  const { error: snackError } = await supabase
    .from("snacks")
    .delete()
    .eq("id", snackId)
    .in("status", ["adopted", "dismissed"]);

  if (snackError) {
    return { success: false, message: snackError.message };
  }

  revalidatePath("/snack");
  return { success: true };
}

// ===================================================================
// 6. 투표자 명단 열람
// ===================================================================
export async function getSnackVoters(snackId: number) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("snack_votes")
    .select("user_name, created_at")
    .eq("snack_id", snackId)
    .order("created_at", { ascending: false });

  if (error) {
    return { success: false, message: error.message };
  }

  return { success: true, data };
}
