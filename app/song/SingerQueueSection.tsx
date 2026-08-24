"use client";

import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult
} from "@hello-pangea/dnd";
import { GripVertical, Trash2 } from "lucide-react";
import { reorderSongRecords, cancelSongRecord } from "./actions";

export default function SingerQueueSection({
  singerList,
  setSingerList,
  user,
  isAdmin,
  fetchSingerList
}: {
  singerList: any[];
  setSingerList: React.Dispatch<React.SetStateAction<any[]>>;
  user: { name: string; role: string };
  isAdmin: boolean;
  fetchSingerList: () => void;
}) {
  // 드래그 종료 시 (끼워넣기 로직)
  const handleOnDragEnd = async (result: DropResult) => {
    if (!result.destination) return; // 드롭 영역 밖이면 무시

    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;

    if (sourceIndex === destinationIndex) return; // 위치 변화 없음

    // 1. 프론트엔드 배열 순서 변경 (Splice 방식 끼워넣기)
    const items = Array.from(singerList);
    const [reorderedItem] = items.splice(sourceIndex, 1);
    items.splice(destinationIndex, 0, reorderedItem);

    // 2. 변경된 배열 기준 display_order 재할당 (예: 1000, 1001, 1002...)
    const updatedListWithNewOrder = items.map((singer, idx) => ({
      ...singer,
      display_order: (idx + 1) * 10 // 여유 있게 10단위 간격 재정렬
    }));

    // 3. UI 즉시 갱신 (Optimistic Update)
    setSingerList(updatedListWithNewOrder);

    // 4. DB 일괄 업데이트
    try {
      await reorderSongRecords(
        updatedListWithNewOrder.map((s) => ({
          id: s.id,
          display_order: s.display_order
        }))
      );
    } catch (error) {
      console.error("순서 업데이트 실패:", error);
      fetchSingerList(); // 에러 발생 시 원복
    }
  };

  return (
    <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800">가수 대기실</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            무대에 오를 다음 가수를 기다리고 있습니다.
          </p>
        </div>
        <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-full">
          총 {singerList.length}명
        </span>
      </div>

      {singerList.length === 0 ? (
        <div className="py-12 text-center border-2 border-dashed border-slate-100 rounded-xl">
          <p className="text-slate-400 text-sm font-medium">
            현재 대기 중인 가수가 없습니다.
          </p>
        </div>
      ) : (
        <DragDropContext onDragEnd={handleOnDragEnd}>
          <Droppable droppableId="singers-queue">
            {(provided) => (
              <ul
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="space-y-2.5"
              >
                {singerList.map((singer, index) => {
                  const isFirst = index === 0;
                  return (
                    <Draggable
                      key={singer.id}
                      draggableId={singer.id.toString()}
                      index={index}
                      isDragDisabled={!isAdmin} // 어드민만 드래그 가능
                    >
                      {(provided, snapshot) => (
                        <li
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`flex items-center justify-between p-3.5 rounded-xl border-2 transition-all ${
                            snapshot.isDragging
                              ? "bg-blue-50/80 border-ssafy-blue shadow-lg ring-2 ring-ssafy-blue/20"
                              : isFirst
                                ? "bg-gradient-to-r from-ssafy-blue/10 to-transparent border-ssafy-blue/40 shadow-sm"
                                : "bg-white border-2 border-slate-100 hover:border-slate-200"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {/* 🎯 어드민 전용 드래그 앤 드롭 손잡이 아이콘 */}
                            {isAdmin && (
                              <div
                                {...provided.dragHandleProps}
                                className="p-1 text-slate-300 hover:text-slate-600 cursor-grab active:cursor-grabbing rounded-lg hover:bg-slate-100 transition-colors"
                                title="드래그하여 순서 변경"
                              >
                                <GripVertical className="w-5 h-5" />
                              </div>
                            )}

                            {/* 순번 아이콘 */}
                            <div
                              className={`font-black text-sm rounded-xl h-10 w-10 flex items-center justify-center flex-shrink-0 ${
                                isFirst
                                  ? "bg-ssafy-blue text-white shadow-md shadow-ssafy-blue/30"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {index + 1}
                            </div>

                            {/* 가수 정보 */}
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-slate-800 text-base">
                                  {singer.name}
                                </p>
                                {isFirst && (
                                  <span className="px-2 py-0.5 bg-ssafy-blue text-white text-[10px] font-black rounded-md uppercase tracking-wide">
                                    NEXT 🎤
                                  </span>
                                )}
                              </div>
                              {singer.reason && (
                                <p className="text-slate-400 text-xs font-medium mt-0.5">
                                  {singer.reason}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* 어드민 전용 삭제 버튼 */}
                          {isAdmin && (
                            <button
                              onClick={async () => {
                                await cancelSongRecord(singer.id);
                                fetchSingerList();
                              }}
                              className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                              title="대기열에서 제거"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          )}
                        </li>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </ul>
            )}
          </Droppable>
        </DragDropContext>
      )}
    </section>
  );
}
