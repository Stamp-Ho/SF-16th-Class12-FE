export type TileActionType =
  | 'NONE'
  | 'MOVE_STEPS'
  | 'TELEPORT'
  | 'SPLIT_CHOICE'
  | 'DRAW_GOLD_CARD'
  | 'CUSTOM_SCRIPT';

export interface TileAction {
  type: TileActionType;
  params?: {
    steps?: number;
    targetTileId?: string;
    deckId?: string;
    promptTitle?: string;
    promptMessage?: string;
    [key: string]: any;
  };
}

export type TileCategory = 'OUTER' | 'INNER' | 'SPECIAL_DECK';

export interface BoardTileData {
  id: string;                      // 타일 고유 ID (예: 'outer_0', 'inner_3_4')
  category: TileCategory;          // 외곽 타일, 내부 타일, 특수 덱 타일
  gridR: number;                   // 그리드 행 (Row)
  gridC: number;                   // 그리드 열 (Col)

  // 3D 위치 및 회전 (편집 모드에서 조작 가능)
  position: { x: number; y: number; z: number };
  rotationY: number;               // 텍스처/타일 방향

  // 비주얼 / 표시 정보
  label: string;                   // 타일에 적힐 텍스트
  subLabel?: string;               // 세부 설명
  color?: string;                  // 타일 테마 색상 (hex)
  textColor?: string;              // 제목 텍스트 색상 (hex)
  subLabelColor?: string;          // 서브 텍스트 색상 (hex)
  icon?: string;                   // 아이콘 식별자

  // 그래프 연결 (말의 이동 경로)
  // 다음으로 갈 수 있는 타일 ID 목록 (일반적으론 1개, 갈림길은 2개 이상)
  nextTileIds: string[];

  // 타일 도착 시 발동할 액션
  action: TileAction;

  // 시스템 플래그
  isLocked?: boolean;              // 외곽 타일은 삭제 불가 처리
}

// 4. 황금카드 덱 오브젝트 (보드 내부 전용 타일 4칸을 묶은 구조)
export interface GoldCardDeckConfig {
  id: string;
  name: string;
  centerPos: { x: number; z: number }; // 4칸의 중심점
  rotationY: number;                   // 덱 전체 회전
  tileIds: string[];                   // 덱을 구성하는 타일 ID 4개 (2x2 크기)
}
