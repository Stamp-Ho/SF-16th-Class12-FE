// import LoginModal from "@/app/(auth)/LoginModal";
// import { requireAuth } from "@/utils/auth";
// import GroupDraw from "./GroupDraw";

export default async function GroupsPage() {
  return (
    <div className="p-12 text-center text-slate-500">폐쇄된 페이지입니다.</div>
  );
  // const { status, profile } = await requireAuth();
  // if (status === "UNAUTHENTICATED") return <LoginModal />;
  // if (status === "FORBIDDEN")
  //   return (
  //     <div className="p-12 text-center text-red-500">접근 권한이 없습니다.</div>
  //   );
  // return <GroupDraw userName={profile.username} />;
}
