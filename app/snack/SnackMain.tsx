"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult
} from "@hello-pangea/dnd";
import {
  Cookie,
  ArrowLeft,
  Plus,
  Sparkles,
  Vote,
  X,
  Box,
  GripVertical,
  Trash,
  Trash2
} from "lucide-react";
import {
  createSnack,
  deleteArchivedSnack,
  type SnackItem,
  toggleSnackVote,
  updateSnackStatus
} from "./actions";

export default function SnackMain({
  initialSnacks,
  archivedSnacks,
  role,
  username
}: {
  initialSnacks: SnackItem[];
  archivedSnacks: SnackItem[];
  role: string;
  username: string;
}) {
  const router = useRouter();
  const [snackList, setSnackList] = useState(initialSnacks);
  const [pendingSnackId, setPendingSnackId] = useState<number | null>(null);
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [updatingSnackId, setUpdatingSnackId] = useState<number | null>(null);
  const [deletingSnackId, setDeletingSnackId] = useState<number | null>(null);

  const isAdmin = role === "super_admin";

  const adoptedSnacks = archivedSnacks.filter(
    (snack) => snack.status === "adopted"
  );
  const dismissedSnacks = archivedSnacks.filter(
    (snack) => snack.status === "dismissed"
  );

  async function handleVote(snackId: number) {
    setPendingSnackId(snackId);
    const result = await toggleSnackVote(snackId, username);
    setPendingSnackId(null);

    if (!result.success) {
      alert(result.message);
      return;
    }

    setSnackList((snacks) =>
      snacks.map((snack) =>
        snack.id === snackId
          ? {
              ...snack,
              voted_by_me: result.voted,
              vote_count: snack.vote_count + (result.voted ? 1 : -1)
            }
          : snack
      )
    );
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreating(true);
    const form = event.currentTarget;
    const result = await createSnack(new FormData(form), username);
    setIsCreating(false);

    if (!result.success) {
      alert(result.message);
      return;
    }

    form.reset();
    setIsAddFormOpen(false);
    router.refresh();
  }

  async function handleDragEnd(result: DropResult) {
    const status = result.destination?.droppableId;
    if (
      !isAdmin ||
      !status ||
      !["adopted", "dismissed"].includes(status) ||
      result.source.droppableId === status
    ) {
      return;
    }

    const snackId = Number(result.draggableId);
    setUpdatingSnackId(snackId);
    const response = await updateSnackStatus(
      snackId,
      status as "adopted" | "dismissed",
      role
    );
    setUpdatingSnackId(null);

    if (!response.success) {
      alert(response.message);
      return;
    }

    router.refresh();
  }

  async function handleDelete(snack: SnackItem) {
    if (!confirm(`'${snack.snack_name}'을(를) 삭제할까요?`)) return;

    setDeletingSnackId(snack.id);
    const response = await deleteArchivedSnack(snack.id, role);
    setDeletingSnackId(null);

    if (!response.success) {
      alert(response.message);
      return;
    }

    router.refresh();
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-12">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* 상단 네비게이션 & 헤더 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-slate-800 transition-colors mb-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> 메인 대시보드로
            </Link>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Cookie className="w-7 h-7 text-amber-600" />
              간식 센터
            </h1>
            <p className="text-xs text-slate-500 mt-1">간식 뽑기 및 신청</p>
          </div>
        </div>

        {/* 셔플 액션 컨트롤 파트 */}
        <div className="bg-linear-to-br from-amber-500/80 to-amber-600 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left z-10">
            <span className="text-xs font-semibold bg-white/20 px-3 py-1 rounded-full uppercase tracking-wider inline-flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" /> SNACK CENTER
            </span>
            <h2 className="text-2xl md:text-3xl font-extrabold">
              간식 신청하기
            </h2>
            <p className="text-amber-100 text-xs">
              간식을 밥처럼 먹지만 말아주세요...
            </p>
          </div>
        </div>

        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="grid h-[60vh] grid-cols-1 gap-8 lg:grid-cols-3">
            {/* 과자 신청 */}
            <section className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="flex items-center gap-2 text-base font-bold text-slate-800">
                    <Vote className="w-5 h-5 text-amber-500" />
                    신청 과자 목록
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    마음에 드는 과자에 투표해 주세요.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddFormOpen((isOpen) => !isOpen)}
                  aria-expanded={isAddFormOpen}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-amber-600"
                >
                  {isAddFormOpen ? (
                    <X className="h-3.5 w-3.5" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  과자 추가하기
                </button>
              </div>

              {isAddFormOpen && (
                <form
                  onSubmit={handleCreate}
                  className="my-4 flex flex-col gap-2 rounded-xl border border-amber-100 bg-amber-50/60 p-3 sm:flex-row"
                >
                  <input
                    name="snack_name"
                    required
                    maxLength={50}
                    placeholder="신청할 과자 이름"
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                  />
                  <input
                    name="description"
                    maxLength={200}
                    placeholder="설명 (선택)"
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                  />
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isCreating ? "추가 중..." : "추가"}
                  </button>
                </form>
              )}

              <Droppable droppableId="voting" isDropDisabled>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3"
                  >
                    {snackList.map((snack, index) => {
                      const isVoted = snack.voted_by_me;
                      return (
                        <Draggable
                          key={snack.id}
                          draggableId={snack.id.toString()}
                          index={index}
                          isDragDisabled={
                            !isAdmin ||
                            updatingSnackId === snack.id ||
                            deletingSnackId === snack.id
                          }
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`group flex min-h-30 flex-col justify-between rounded-xl border p-4 transition-all ${
                                isVoted
                                  ? "border-amber-400 bg-amber-50 shadow-sm"
                                  : "border-slate-200 bg-white hover:border-amber-300 hover:shadow-sm"
                              } ${snapshot.isDragging ? "rotate-1 shadow-xl" : ""}`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    {isAdmin && (
                                      <span
                                        {...provided.dragHandleProps}
                                        title="채택 또는 기각 영역으로 드래그"
                                        className="cursor-grab text-slate-400 active:cursor-grabbing"
                                      >
                                        <GripVertical className="h-4 w-4" />
                                      </span>
                                    )}
                                    <h4 className="truncate text-sm font-bold text-slate-800">
                                      {snack.snack_name}
                                    </h4>
                                  </div>
                                  {snack.description && (
                                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                                      {snack.description}
                                    </p>
                                  )}
                                </div>
                                <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
                                  {snack.vote_count}표
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleVote(snack.id)}
                                disabled={pendingSnackId === snack.id}
                                className={`mt-4 w-full rounded-lg px-3 py-2 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                  isVoted
                                    ? "bg-amber-500 text-white hover:bg-amber-600"
                                    : "bg-slate-100 text-slate-700 hover:bg-amber-100 hover:text-amber-800"
                                }`}
                              >
                                {pendingSnackId === snack.id
                                  ? "처리 중..."
                                  : isVoted
                                    ? "투표 취소"
                                    : "나도 원해요"}
                              </button>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                    {snackList.length === 0 && (
                      <div className="col-span-full border border-dashed border-slate-300 px-5 py-12 text-center">
                        <p className="text-sm font-semibold text-slate-700">
                          아직 신청된 과자가 없어요.
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          첫 번째 과자를 신청해 보세요.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            </section>
            <section className="lg:col-span-1 space-y-5 grid grid-rows-2">
              <Droppable droppableId="adopted" isDropDisabled={!isAdmin}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`rounded-2xl border bg-white p-5 shadow-sm transition-colors ${snapshot.isDraggingOver ? "border-emerald-400 bg-emerald-50" : "border-slate-200"}`}
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2 text-base">
                        <Box className="w-5 h-5 text-emerald-500" />
                        선정된 과자
                      </h3>
                    </div>
                    <div className="mt-3 space-y-2">
                      {adoptedSnacks.map((snack, index) => (
                        <Draggable
                          key={snack.id}
                          draggableId={snack.id.toString()}
                          index={index}
                          isDragDisabled={
                            !isAdmin || updatingSnackId === snack.id
                          }
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-slate-700 ${snapshot.isDragging ? "rotate-1 shadow-lg" : ""}`}
                            >
                              {isAdmin && (
                                <span
                                  {...provided.dragHandleProps}
                                  title="기각 영역으로 드래그"
                                  className="cursor-grab text-emerald-500 active:cursor-grabbing"
                                >
                                  <GripVertical className="h-4 w-4" />
                                </span>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-semibold">
                                  {snack.snack_name}
                                </div>
                                <div className="mt-1 text-xs text-emerald-700">
                                  최종 {snack.final_vote_count ?? 0}표
                                </div>
                              </div>
                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => handleDelete(snack)}
                                  disabled={deletingSnackId === snack.id}
                                  title="선정 과자 삭제"
                                  className="rounded-md p-1 text-emerald-700 hover:bg-emerald-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {adoptedSnacks.length === 0 && (
                        <p className="py-3 text-sm text-slate-500">
                          아직 선정된 과자가 없어요.
                        </p>
                      )}
                    </div>
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
              <Droppable droppableId="dismissed" isDropDisabled={!isAdmin}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`rounded-2xl border bg-white p-5 shadow-sm transition-colors ${snapshot.isDraggingOver ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2 text-base">
                        <Trash className="w-5 h-5 text-red-500" />
                        기각된 과자
                      </h3>
                    </div>
                    <div className="mt-3 space-y-2">
                      {dismissedSnacks.map((snack, index) => (
                        <Draggable
                          key={snack.id}
                          draggableId={snack.id.toString()}
                          index={index}
                          isDragDisabled={
                            !isAdmin ||
                            updatingSnackId === snack.id ||
                            deletingSnackId === snack.id
                          }
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-slate-700 ${snapshot.isDragging ? "rotate-1 shadow-lg" : ""}`}
                            >
                              {isAdmin && (
                                <span
                                  {...provided.dragHandleProps}
                                  title="선정 영역으로 드래그"
                                  className="cursor-grab text-red-500 active:cursor-grabbing"
                                >
                                  <GripVertical className="h-4 w-4" />
                                </span>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-semibold">
                                  {snack.snack_name}
                                </div>
                                <div className="mt-1 text-xs text-red-700">
                                  최종 {snack.final_vote_count ?? 0}표
                                </div>
                              </div>
                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => handleDelete(snack)}
                                  disabled={deletingSnackId === snack.id}
                                  title="기각 과자 삭제"
                                  className="rounded-md p-1 text-red-700 hover:bg-red-100 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {dismissedSnacks.length === 0 && (
                        <p className="py-3 text-sm text-slate-500">
                          아직 기각된 과자가 없어요.
                        </p>
                      )}
                    </div>
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </section>
          </div>
        </DragDropContext>
      </div>
    </main>
  );
}
