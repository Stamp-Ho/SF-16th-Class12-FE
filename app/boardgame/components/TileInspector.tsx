// components/TileInspector.tsx
import React from 'react';
import { BoardTileData, TileActionType } from '../types/board';

interface TileInspectorProps {
  tile: BoardTileData | null;
  onUpdate: (updated: Partial<BoardTileData>) => void;
  onDelete: (tileId: string) => void;
  onClose: () => void;
}

export default function TileInspector({ tile, onUpdate, onDelete, onClose }: TileInspectorProps) {
  if (!tile) return null;

  const handleActionTypeChange = (type: TileActionType) => {
    onUpdate({
      action: {
        type,
        params:
          type === 'MOVE_STEPS'
            ? { steps: 2 }
            : type === 'CUSTOM_SCRIPT'
              ? { promptMessage: 'test' }
              : {},
      },
    });
  };

  return (
    <div className="pointer-events-auto min-h-0 w-full flex-1 overflow-y-auto rounded-2xl border border-slate-700/80 bg-slate-900/95 p-5 text-slate-200 shadow-2xl">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30">
              {tile.category}
            </span>
            <h3 className="font-bold text-sm text-white">타일 속성 편집</h3>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">ID: {tile.id}</p>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 text-sm"
        >
          ✕
        </button>
      </div>

      {/* 1. 기본 표시 정보 */}
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-300">
          타일 라벨 (텍스트)
          <input
            type="text"
            value={tile.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
            placeholder="예: 원샷, 한 칸 앞으로"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-300">
          서브 설명 (작은 글씨)
          <input
            type="text"
            value={tile.subLabel || ''}
            onChange={(e) => onUpdate({ subLabel: e.target.value })}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
            placeholder="상세 규칙이나 부연 설명"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-300">
          배경 색상
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={tile.color || '#1e293b'}
              onChange={(e) => onUpdate({ color: e.target.value })}
              className="w-8 h-8 rounded border border-slate-700 bg-transparent cursor-pointer"
            />
            <span className="text-xs text-slate-400 font-mono">{tile.color || '#1e293b'}</span>
          </div>
        </label>

        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-300">
          제목 텍스트 색상
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={tile.textColor || '#ffffff'}
              onChange={(e) => onUpdate({ textColor: e.target.value })}
              className="w-8 h-8 rounded border border-slate-700 bg-transparent cursor-pointer"
            />
            <span className="text-xs text-slate-400 font-mono">{tile.textColor || '#ffffff'}</span>
          </div>
        </label>

        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-300">
          설명 텍스트 색상
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={tile.subLabelColor || '#94a3b8'}
              onChange={(e) => onUpdate({ subLabelColor: e.target.value })}
              className="w-8 h-8 rounded border border-slate-700 bg-transparent cursor-pointer"
            />
            <span className="text-xs text-slate-400 font-mono">
              {tile.subLabelColor || '#94a3b8'}
            </span>
          </div>
        </label>
      </div>

      {/* 2. 각도 조정 */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-slate-300">타일 텍스처 방향 (Y 회전)</span>
        <div className="grid grid-cols-4 gap-1">
          {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((rot, idx) => (
            <button
              key={rot}
              type="button"
              onClick={() => onUpdate({ rotationY: rot })}
              className={`py-1 text-xs rounded border transition-all ${
                Math.abs(tile.rotationY - rot) < 0.01
                  ? 'bg-blue-600 border-blue-400 text-white font-bold'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              {[0, 90, 180, 270][idx]}°
            </button>
          ))}
        </div>
      </div>

      {/* 3. 특수 기능(액션) 지정 */}
      <div className="flex flex-col gap-2 border-t border-slate-800 pt-3">
        <span className="text-xs font-semibold text-slate-300">도착 시 특수 기능</span>
        <select
          value={tile.action.type}
          onChange={(e) => handleActionTypeChange(e.target.value as TileActionType)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
        >
          <option value="NONE">일반 칸 (액션 없음)</option>
          <option value="MOVE_STEPS">칸 이동 (앞으로/뒤로)</option>
          <option value="TELEPORT">특정 타일로 워프</option>
          <option value="DRAW_GOLD_CARD">황금카드 뽑기</option>
          <option value="CUSTOM_SCRIPT">커스텀 룰/미션</option>
        </select>

        {/* 액션별 세부 옵션 UI */}
        {tile.action.type === 'MOVE_STEPS' && (
          <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/50 flex flex-col gap-1.5 mt-1">
            <span className="text-[11px] text-slate-400">이동할 칸 수 (음수는 뒤로)</span>
            <input
              type="number"
              value={tile.action.params?.steps ?? 2}
              onChange={(e) =>
                onUpdate({
                  action: {
                    ...tile.action,
                    params: { ...tile.action.params, steps: Number(e.target.value) },
                  },
                })
              }
              className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
            />
          </div>
        )}

        {tile.action.type === 'TELEPORT' && (
          <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/50 flex flex-col gap-1.5 mt-1">
            <span className="text-[11px] text-slate-400">목표 타일 ID</span>
            <input
              type="text"
              value={tile.action.params?.targetTileId ?? ''}
              onChange={(e) =>
                onUpdate({
                  action: {
                    ...tile.action,
                    params: { ...tile.action.params, targetTileId: e.target.value },
                  },
                })
              }
              placeholder="예: outer_0"
              className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
            />
          </div>
        )}

        {tile.action.type === 'CUSTOM_SCRIPT' && (
          <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/50 flex flex-col gap-1.5 mt-1">
            <span className="text-[11px] text-slate-400">알림 메시지</span>
            <input
              type="text"
              value={tile.action.params?.promptMessage ?? ''}
              onChange={(e) =>
                onUpdate({
                  action: {
                    ...tile.action,
                    params: { ...tile.action.params, promptMessage: e.target.value },
                  },
                })
              }
              placeholder="예: 오른쪽 사람과 러브샷!"
              className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
            />
          </div>
        )}
      </div>

      {/* 4. 하단 버튼 영역 */}
      <div className="mt-auto pt-3 border-t border-slate-800 flex items-center justify-between">
        {!tile.isLocked ? (
          <button
            type="button"
            onClick={() => onDelete(tile.id)}
            className="px-3 py-1.5 rounded-lg bg-rose-600/20 border border-rose-500/40 text-rose-300 hover:bg-rose-600 hover:text-white text-xs font-semibold transition-all"
          >
            타일 삭제
          </button>
        ) : (
          <span className="text-[11px] text-slate-500">외곽 기본 타일(삭제 불가)</span>
        )}
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white ml-auto"
        >
          완료
        </button>
      </div>
    </div>
  );
}