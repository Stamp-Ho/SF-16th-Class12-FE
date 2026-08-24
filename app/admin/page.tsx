import { redirect } from "next/navigation";
import AdminView from "./AdminView"; // 어드민 화면 컴포넌트
import { requireAuth } from "@/utils/auth";

export default async function AdminPage() {
  const { status, profile } = await requireAuth();

  // Admin이 아니면 메인으로 튕겨내기 (unauthorized 쿼리 파라미터 전달)
  if (status === 'UNAUTHENTICATED' || profile?.role !== "super_admin")
    redirect("/?unauthorized=true");

  return (
    <AdminView/>
  );
}
