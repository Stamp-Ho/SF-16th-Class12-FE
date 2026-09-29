'use client';

import type { ReactNode, RefObject } from 'react';
import { BoardTileData } from '../types/board';
import TileEventPopup from './TileEventPopup';
import EventNoticePopup from './EventNoticePopup';
import ArenaViewToggle from './ArenaViewToggle';

/**
 * 3D 캔버스와 그 위에 겹쳐 표시되는 팝업·뷰 전환 버튼·상태 메시지·단축키 안내.
 * children은 이벤트 팝업들 다음, 뷰 전환 버튼 앞에 렌더링된다 (황금카드 모달 자리).
 */
export default function ArenaViewport({
	containerRef,
	canvasRef,
	isFullscreen,
	tileEvent,
	eventCountdown,
	onConfirmTileEvent,
	eventNotice,
	onCloseEventNotice,
	popupConfirmButtonRef,
	viewMode,
	onSwitchView,
	status,
	children,
}: {
	containerRef: RefObject<HTMLDivElement | null>;
	canvasRef: RefObject<HTMLCanvasElement | null>;
	isFullscreen: boolean;
	tileEvent: BoardTileData | null;
	eventCountdown: number | null;
	onConfirmTileEvent: () => void;
	eventNotice: { title: string; message: string } | null;
	onCloseEventNotice: () => void;
	popupConfirmButtonRef: RefObject<HTMLButtonElement | null>;
	viewMode: '2.5d' | 'top';
	onSwitchView: (mode: '2.5d' | 'top') => void;
	status: string;
	children?: ReactNode;
}) {
	return (
		<div
			ref={containerRef}
			className={`relative min-w-0 flex-1 overflow-hidden bg-slate-950 ${
				isFullscreen ? 'min-h-0' : 'min-h-[700px]'
			}`}
		>
			{/* 3D 뷰포트 */}
			<canvas
				ref={canvasRef}
				tabIndex={0}
				className="w-full h-full cursor-grab active:cursor-grabbing outline-none"
			/>

			{tileEvent && (
				<TileEventPopup
					tile={tileEvent}
					countdown={eventCountdown}
					confirmButtonRef={popupConfirmButtonRef}
					onConfirm={onConfirmTileEvent}
				/>
			)}

			{eventNotice && (
				<EventNoticePopup
					notice={eventNotice}
					confirmButtonRef={popupConfirmButtonRef}
					onClose={onCloseEventNotice}
				/>
			)}

			{children}

			<ArenaViewToggle viewMode={viewMode} onSwitchView={onSwitchView} />

			{status && (
				<div className="pointer-events-none absolute right-4 top-4 w-[min(10,calc(100%-2rem))] rounded-xl border border-slate-700/60 bg-slate-900/80 px-3 py-2 text-right shadow-lg backdrop-blur-md">
					<p className="text-[11px] text-slate-300">{status}</p>
				</div>
			)}

			<div className="absolute bottom-2 left-6 hidden text-[11px] text-slate-500 pointer-events-none md:block">
				Space: 주사위 굴리기 | WASD: 화면 이동 | Q/E: 회전 | Z/X:
				확대·축소 | R: 현재 뷰 초기화 | 드래그: 화면 회전 | 휠: 확대·축소
			</div>
		</div>
	);
}
