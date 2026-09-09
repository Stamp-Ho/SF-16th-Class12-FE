import { requireAuth } from "@/utils/auth";
import SnackMain from "./SnackMain";
import { getSnacks } from "./actions";
import LoginModal from "../(auth)/LoginModal";

export default async function SnackPage() {
  const { status, profile } = await requireAuth();

  if (status === "UNAUTHENTICATED") return <LoginModal />;
  if (status === "FORBIDDEN")
    return <div className="text-center text-red-500">권한이 없습니다.</div>;

  const [snacks, archivedSnacks] = await Promise.all([
    getSnacks("voting", profile.username),
    getSnacks("archived", profile.username)
  ]);
  return (
    <SnackMain
      key={[...snacks, ...archivedSnacks]
        .map((snack) => `${snack.id}-${snack.status}-${snack.created_at}`)
        .join(",")}
      initialSnacks={snacks}
      archivedSnacks={archivedSnacks}
      username={profile.username}
      role={profile.role}
    />
  );
}
