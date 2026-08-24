"use server";

import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";

function getVirtualEmail(name: string) {
  const hexName = Buffer.from(name.trim()).toString("hex");
  return `ssafy16_${hexName}@ssafy.local`;
}

// 1. Comma-separated 회원 일괄 등록
export async function bulkRegisterUsers(
  commaSeparatedNames: string,
) {
  // 💡 세션을 변경하지 않는 Admin 전용 클라이언트 사용
  const supabaseAdmin = createAdminClient();

  const names = commaSeparatedNames
    .split(/[\s,]+/) // 공백(스페이스, 엔터, 탭) 및 쉼표를 기준으로 자름
    .map((name) => name.trim())
    .filter(Boolean);

  const results = { successCount: 0, failCount: 0, errors: [] as string[] };

  for (const name of names) {
    const virtualEmail = getVirtualEmail(name);

    // signUp 대신 admin.createUser 사용
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: virtualEmail,
      password: "ssafy16",
      email_confirm: true, // 이메일 인증 완료 상태로 설정 (메일 미발송)
      user_metadata: { name, email: virtualEmail } // Supabase Trigger(handle_new_user)로 users에 name 자동 삽입
    });
    console.log(data, error);

    if (error || !data.user) {
      results.failCount++;
      results.errors.push(`${name}: ${error?.message ?? "Unknown error"}`);
    } else {
      // 2. 트리거로 생성된 users 레코드에 email 수동 업데이트
      await supabaseAdmin
        .from("users")
        .update({ email: virtualEmail})
        .eq("id", data.user.id);
      results.successCount++;
    }
  }

  revalidatePath("/admin/users");
  return results;
}
export async function getAllUsers() {
  const supabase = createAdminClient();

  // 1. 공통 기본 쿼리 작성 (전체 조회 기준)
  let query = supabase
    .from("users")
    .select("username, role, status, id")
    .order("username", { ascending: true });
 

  // 3. 쿼리 실행
  const { data: users, error } = await query;

  if (error) {
    throw new Error(`유저 목록 조회 실패: ${error.message}`);
  }

  return users || [];
}
// 2. 유저 권한 및 상태 변경 (Admin 전용)
export async function updateUserStatus(
  userName: string,
  role: "class_admin" | "user" | "song_admin" | "teacher",
  status: "ACTIVE" | "INACTIVE"
) {
  const supabaseAdmin = createAdminClient();

  const { error } = await supabaseAdmin
    .from("users")
    .update({ role, status })
    .eq("username", userName);

  if (error) {
    throw new Error(`상태 업데이트 실패: ${error.message}`);
  }

  revalidatePath("/admin");
  return { success: true };
}

export async function resetUserPassword(username: string, newPassword: string) {
  if (!newPassword || newPassword.length < 6) {
    throw new Error("비밀번호는 최소 6자리 이상이어야 합니다.");
  }

  const supabaseAdmin = createAdminClient();
  const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (listError) {
    throw new Error(`Auth 사용자 조회 실패: ${listError.message}`);
  }

  const authUser = authUsers.users.find((user) => user.user_metadata.name === username);

  if (!authUser) {
    throw new Error(`${username}에 연결된 Auth 사용자를 찾을 수 없습니다.`);
  }

  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
    authUser.id,
    { password: newPassword }
  );

  if (error) {
    throw new Error(`비밀번호 초기화 실패: ${error.message}`);
  }

  return { success: true };
}

export async function getClasses() {
  const supabase = createAdminClient();
  const { data: classes, error } = await supabase
    .from("classes")
    .select("id, name")
    .order("name", { ascending: true });
  if (error) {
    throw new Error(`반 목록 조회 실패: ${error.message}`);
  }
  return classes || [];
}

