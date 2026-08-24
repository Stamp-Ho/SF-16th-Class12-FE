"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

// 공지/링크 추가
export async function createDashboardLink(formData: {
  title: string;
  url: string;
  description: string;
  isFront: boolean;
}) {
  const supabase = await createClient();

  const {data: existingLinks, error: existingError} = await supabase
    .from("dashboard_links")
    .select("*")
    .order("display_order", { ascending: true });

  let newDisplayOrder = 1000;// 기본값
  if (existingLinks && existingLinks.length > 0) {
    if(formData.isFront) {
      // Deque push_front: 현재 최소값보다 작게 설정
      newDisplayOrder = existingLinks[0].display_order - 1;
    } else {
      // Deque push_back: 현재 최대값보다 크게 설정
      newDisplayOrder = existingLinks[existingLinks.length - 1].display_order + 1;
    }
  }

  const { error } = await supabase.from("dashboard_links").insert({
    title: formData.title,
    url: formData.url,
    description: formData.description || "",
    display_order: newDisplayOrder,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/");
  return { success: true };
}

// 공지/링크 삭제
export async function deleteDashboardLink(linkId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("dashboard_links")
    .delete()
    .eq("id", linkId);

  if (error) throw new Error(error.message);

  revalidatePath("/");
  return { success: true };
}
