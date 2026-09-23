import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Play, 
  Wrench, 
  Box, 
  Compass, 
  RotateCcw, 
  Dice5, 
  Beer, 
  Crown, 
  Sparkles, 
  Plus, 
  Trash2, 
  ArrowRight, 
  GitFork, 
  Settings2, 
  X, 
  ShieldAlert, 
  Flame, 
  Check, 
  HelpCircle,
  Volume2,
  Trophy
} from 'lucide-react';

export type ActionType = 
  | 'DRINK_FIXED' 
  | 'MOVE_OFFSET' 
  | 'ROULETTE' 
  | 'MINIGAME' 
  | 'GLOBAL_RULE' 
  | 'POT_DEPOSIT' 
  | 'POT_CLAIM'
  | 'NONE';

export interface TileActionPayload {
  shots?: number;
  target?: 'SELF' | 'CHOICE' | 'ALL' | 'BOTH_SIDES';
  steps?: number;
  ruleTitle?: string;
  ruleDurationTurns?: number;
  rouletteOptions?: string[];
  minigameName?: string;
}

export interface BoardTile {
  id: string;
  gridX: number; // 0 to 7
  gridY: number; // 0 to 7
  title: string;
  description: string;
  actionType: ActionType;
  actionPayload: TileActionPayload;
  colorScheme: 'soju' | 'beer' | 'golden' | 'danger' | 'purple' | 'cyan';
  nextTileIds: string[]; // Supports branching / shortcuts
  isStart?: boolean;
}

export interface Player {
  id: string;
  name: string;
  avatar: string;
  color: string;
  currentTileId: string;
  drinksCount: number;
}

const INITIAL_TILES: BoardTile[] = [
  // Outer perimeter (0,0) -> (7,0) -> (7,7) -> (0,7) -> (0,1)
  { id: 't-0', gridX: 0, gridY: 0, title: '출발점! 🎉', description: '기분 좋게 한 모금 적시고 시작!', actionType: 'DRINK_FIXED', actionPayload: { shots: 0.5, target: 'ALL' }, colorScheme: 'golden', nextTileIds: ['t-1'], isStart: true },
  { id: 't-1', gridX: 1, gridY: 0, title: '소주 반 잔', description: '혼자 가볍게 털어넣기', actionType: 'DRINK_FIXED', actionPayload: { shots: 0.5, target: 'SELF' }, colorScheme: 'soju', nextTileIds: ['t-2'] },
  { id: 't-2', gridX: 2, gridY: 0, title: '황금 벌주 적립 🍯', description: '중앙 항아리에 벌주 1잔 누적!', actionType: 'POT_DEPOSIT', actionPayload: { shots: 1 }, colorScheme: 'golden', nextTileIds: ['t-3'] },
  { id: 't-3', gridX: 3, gridY: 0, title: '지목 원샷 🎯', description: '눈 마주친 1명에게 1잔 선물', actionType: 'DRINK_FIXED', actionPayload: { shots: 1, target: 'CHOICE' }, colorScheme: 'danger', nextTileIds: ['t-4'] },
  { id: 't-4', gridX: 4, gridY: 0, title: '랜덤 룰렛 🎡', description: '운명의 룰렛을 돌려보자', actionType: 'ROULETTE', actionPayload: { rouletteOptions: ['1잔 마시기', '좌우 러브샷', '면제권 획득', '지목 2잔'] }, colorScheme: 'purple', nextTileIds: ['t-5'] },
  { id: 't-5', gridX: 5, gridY: 0, title: '영어 금지령 👑', description: '2턴 동안 영어 말하면 즉시 1잔', actionType: 'GLOBAL_RULE', actionPayload: { ruleTitle: '영어 금지령 (No English)', ruleDurationTurns: 4 }, colorScheme: 'cyan', nextTileIds: ['t-6'] },
  { id: 't-6', gridX: 6, gridY: 0, title: '양옆과 짠 🍻', description: '좌우 친구와 다정하게 건배', actionType: 'DRINK_FIXED', actionPayload: { shots: 1, target: 'BOTH_SIDES' }, colorScheme: 'beer', nextTileIds: ['t-7'] },
  { id: 't-7', gridX: 7, gridY: 0, title: '코너 분기점 ⚡', description: '지름길(중앙통로) or 외곽정주행?', actionType: 'NONE', actionPayload: {}, colorScheme: 'danger', nextTileIds: ['t-8', 't-s1'] }, // Branch to shortcut!

  // Shortcut crossing center (t-s1 to t-s3)
  { id: 't-s1', gridX: 6, gridY: 2, title: '중앙 지름길 진입', description: '위험하지만 빠른 중앙 코스', actionType: 'DRINK_FIXED', actionPayload: { shots: 1, target: 'SELF' }, colorScheme: 'purple', nextTileIds: ['t-s2'] },
  { id: 't-s2', gridX: 5, gridY: 4, title: '폭탄주 챌린지 💣', description: '중앙을 지나는 자는 각오하라', actionType: 'MINIGAME', actionPayload: { minigameName: '병뚜껑 꼬리치기 대결' }, colorScheme: 'danger', nextTileIds: ['t-s3'] },
  { id: 't-s3', gridX: 3, gridY: 6, title: '지름길 탈출구 🏃‍♂️', description: '단숨에 하단 구역으로 합류!', actionType: 'MOVE_OFFSET', actionPayload: { steps: 1 }, colorScheme: 'cyan', nextTileIds: ['t-17'] },

  // Outer Right Edge
  { id: 't-8', gridX: 7, gridY: 1, title: '맥주 반캔', description: '시원하게 목 축이기', actionType: 'DRINK_FIXED', actionPayload: { shots: 0.5, target: 'SELF' }, colorScheme: 'beer', nextTileIds: ['t-9'] },
  { id: 't-9', gridX: 7, gridY: 2, title: '초성 퀴즈 🧠', description: '패배자 1잔 원샷', actionType: 'MINIGAME', actionPayload: { minigameName: '술자리 초성 퀴즈 3초 컷' }, colorScheme: 'purple', nextTileIds: ['t-10'] },
  { id: 't-10', gridX: 7, gridY: 3, title: '벌주 2잔 적립 🌋', description: '중앙 팟이 불타오릅니다!', actionType: 'POT_DEPOSIT', actionPayload: { shots: 2 }, colorScheme: 'golden', nextTileIds: ['t-11'] },
  { id: 't-11', gridX: 7, gridY: 4, title: '뒤로 2칸 🔙', description: '발걸음을 뒤로 돌리세요', actionType: 'MOVE_OFFSET', actionPayload: { steps: -2 }, colorScheme: 'danger', nextTileIds: ['t-12'] },
  { id: 't-12', gridX: 7, gridY: 5, title: '흑기사 소환 🛡️', description: '원하는 흑기사를 지정해 대신 마시게 함', actionType: 'DRINK_FIXED', actionPayload: { shots: 1, target: 'CHOICE' }, colorScheme: 'soju', nextTileIds: ['t-13'] },
  { id: 't-13', gridX: 7, gridY: 6, title: '다 같이 원샷 🌊', description: '분위기 UP! 모두 한잔씩!', actionType: 'DRINK_FIXED', actionPayload: { shots: 1, target: 'ALL' }, colorScheme: 'beer', nextTileIds: ['t-14'] },
  
  // Outer Bottom Edge
  { id: 't-14', gridX: 7, gridY: 7, title: '대망의 잭팟 칸 💰', description: '중앙 누적 벌주를 전부 마셔라!!', actionType: 'POT_CLAIM', actionPayload: {}, colorScheme: 'golden', nextTileIds: ['t-15'] },
  { id: 't-15', gridX: 6, gridY: 7, title: '웃음 금지령 🤐', description: '3턴 동안 웃으면 1잔!', actionType: 'GLOBAL_RULE', actionPayload: { ruleTitle: '웃음 금지 (Deadpan Face)', ruleDurationTurns: 3 }, colorScheme: 'cyan', nextTileIds: ['t-16'] },
  { id: 't-16', gridX: 5, gridY: 7, title: '밸런스 게임 ⚖️', description: '소수파 1잔 마시기', actionType: 'MINIGAME', actionPayload: { minigameName: '지옥의 밸런스 토론' }, colorScheme: 'purple', nextTileIds: ['t-17'] },
  { id: 't-17', gridX: 4, gridY: 7, title: '소주 1잔', description: '깔끔하게 1잔!', actionType: 'DRINK_FIXED', actionPayload: { shots: 1, target: 'SELF' }, colorScheme: 'soju', nextTileIds: ['t-18'] },
  { id: 't-18', gridX: 3, gridY: 7, title: '앞으로 2칸 ⏩', description: '부스트를 받아 전진!', actionType: 'MOVE_OFFSET', actionPayload: { steps: 2 }, colorScheme: 'cyan', nextTileIds: ['t-19'] },
  { id: 't-19', gridX: 2, gridY: 7, title: '중앙 팟 1잔 적립', description: '아슬아슬한 적립 레이스', actionType: 'POT_DEPOSIT', actionPayload: { shots: 1 }, colorScheme: 'golden', nextTileIds: ['t-20'] },
  { id: 't-20', gridX: 1, gridY: 7, title: '술자리 노래자랑 🎤', description: '한 소절 부르고 면제받기', actionType: 'MINIGAME', actionPayload: { minigameName: '노래 하이라이트 5초 부르기' }, colorScheme: 'purple', nextTileIds: ['t-21'] },

  // Outer Left Edge
  { id: 't-21', gridX: 0, gridY: 7, title: '반시계 벌칙 🔄', description: '내 오른쪽 사람이 1잔', actionType: 'DRINK_FIXED', actionPayload: { shots: 1, target: 'CHOICE' }, colorScheme: 'danger', nextTileIds: ['t-22'] },
  { id: 't-22', gridX: 0, gridY: 6, title: '물 한잔 휴식 💧', description: '숙취 해소용 물 한잔 들이키기', actionType: 'NONE', actionPayload: {}, colorScheme: 'cyan', nextTileIds: ['t-23'] },
  { id: 't-23', gridX: 0, gridY: 5, title: '랜덤 룰렛 2 🎡', description: '두 번째 기회의 룰렛', actionType: 'ROULETTE', actionPayload: { rouletteOptions: ['모두 원샷', '내가 2잔', '왼쪽과 하이파이브', '벌주 팟 3잔 추가'] }, colorScheme: 'purple', nextTileIds: ['t-24'] },
  { id: 't-24', gridX: 0, gridY: 4, title: '소주 2잔 데인저 ☠️', description: '오늘 밤 주인공은 너!', actionType: 'DRINK_FIXED', actionPayload: { shots: 2, target: 'SELF' }, colorScheme: 'danger', nextTileIds: ['t-25'] },
  { id: 't-25', gridX: 0, gridY: 3, title: '손병호 게임 🖐️', description: '접지 못한 자 1잔!', actionType: 'MINIGAME', actionPayload: { minigameName: '손병호 다섯 손가락 접기' }, colorScheme: 'beer', nextTileIds: ['t-26'] },
  { id: 't-26', gridX: 0, gridY: 2, title: '중앙 팟 2잔 추가', description: '마지막 코너 전 긴장감 조성', actionType: 'POT_DEPOSIT', actionPayload: { shots: 2 }, colorScheme: 'golden', nextTileIds: ['t-27'] },
  { id: 't-27', gridX: 0, gridY: 1, title: '마지막 전력질주 💨', description: '출발선이 눈앞이다!', actionType: 'MOVE_OFFSET', actionPayload: { steps: 1 }, colorScheme: 'cyan', nextTileIds: ['t-0'] }
];

const COLOR_MAP: Record<BoardTile['colorScheme'], { border: string; bg: string; text: string; glow: string; track: string }> = {
  soju: { border: 'border-emerald-500', bg: 'bg-emerald-950/80', text: 'text-emerald-400', glow: 'shadow-[0_0_15px_rgba(16,185,129,0.35)]', track: '#10b981' },
  beer: { border: 'border-amber-500', bg: 'bg-amber-950/80', text: 'text-amber-400', glow: 'shadow-[0_0_15px_rgba(245,158,11,0.35)]', track: '#f59e0b' },
  golden: { border: 'border-yellow-400', bg: 'bg-yellow-950/80', text: 'text-yellow-300', glow: 'shadow-[0_0_20px_rgba(250,204,21,0.5)]', track: '#facc15' },
  danger: { border: 'border-rose-500', bg: 'bg-rose-950/80', text: 'text-rose-400', glow: 'shadow-[0_0_15px_rgba(244,63,94,0.4)]', track: '#f43f5e' },
  purple: { border: 'border-purple-500', bg: 'bg-purple-950/80', text: 'text-purple-400', glow: 'shadow-[0_0_15px_rgba(168,85,247,0.35)]', track: '#a855f7' },
  cyan: { border: 'border-cyan-500', bg: 'bg-cyan-950/80', text: 'text-cyan-400', glow: 'shadow-[0_0_15px_rgba(6,182,212,0.35)]', track: '#06b6d4' }
};

export default function BoardSection() {
  const [tiles, setTiles] = useState<BoardTile[]>(INITIAL_TILES);
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');
  const [mode, setMode] = useState<'play' | 'edit'>('play');
  const [editTool, setEditTool] = useState<'select' | 'connect' | 'create'>('select');

  // Game Play State
  const [players, setPlayers] = useState<Player[]>([
    { id: 'p1', name: '영희 🐰', avatar: '🐰', color: '#ec4899', currentTileId: 't-0', drinksCount: 0 },
    { id: 'p2', name: '철수 🐯', avatar: '🐯', color: '#3b82f6', currentTileId: 't-0', drinksCount: 0 },
    { id: 'p3', name: '민수 🦊', avatar: '🦊', color: '#10b981', currentTileId: 't-0', drinksCount: 0 }
  ]);
  const [currentTurnIdx, setCurrentTurnIdx] = useState<number>(0);
  const [diceValue, setDiceValue] = useState<number | null>(null);
  const [isRolling, setIsRolling] = useState<boolean>(false);
  const [penaltyPotShots, setPenaltyPotShots] = useState<number>(3); // Accumulated pot
  const [activeGlobalRule, setActiveGlobalRule] = useState<{ title: string; remainingTurns: number } | null>({
    title: '영어 금지령 (No English)',
    remainingTurns: 3
  });
  const [logMessages, setLogMessages] = useState<string[]>([
    '🍻 주루마블 파티가 시작되었습니다! 주사위를 굴려보세요.'
  ]);

  // Modal & Selection States
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [isTileModalOpen, setIsTileModalOpen] = useState<boolean>(false);
  const [connectionSourceId, setConnectionSourceId] = useState<string | null>(null);
  const [currentEventAlert, setCurrentEventAlert] = useState<{
    title: string;
    description: string;
    actionText: string;
    type: ActionType;
  } | null>(null);

  // Branching dialog state when moving
  const [branchChoice, setBranchChoice] = useState<{
    pendingSteps: number;
    options: string[];
  } | null>(null);

  const boardGridSize = 8;
  const boardRef = useRef<HTMLDivElement>(null);

  // Tile lookup helpers
  const tileMap = useMemo(() => {
    const map = new Map<string, BoardTile>();
    tiles.forEach(t => map.set(t.id, t));
    return map;
  }, [tiles]);

  const tileCoordMap = useMemo(() => {
    const map = new Map<string, BoardTile>();
    tiles.forEach(t => map.set(`${t.gridX},${t.gridY}`, t));
    return map;
  }, [tiles]);

  // Converts 0..7 grid index to percentage for SVG & absolute tile layout
  const getTileCenterPct = (gridCoord: number) => {
    // 8x8 cells: each is 12.5% wide/high. Center is at (coord * 12.5) + 6.25%
    return gridCoord * 12.5 + 6.25;
  };

  const renderPathSegments = useMemo(() => {
    const paths: { d: string; color: string; id: string; isBranch: boolean }[] = [];

    tiles.forEach(tile => {
      const startX = getTileCenterPct(tile.gridX);
      const startY = getTileCenterPct(tile.gridY);

      tile.nextTileIds.forEach((nextId, index) => {
        const nextTile = tileMap.get(nextId);
        if (!nextTile) return;

        const endX = getTileCenterPct(nextTile.gridX);
        const endY = getTileCenterPct(nextTile.gridY);

        // Calculate smooth curve control points
        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;
        const dx = endX - startX;
        const dy = endY - startY;

        // Apply a gentle perpendicular offset for natural curvature
        const curveOffset = (index > 0 || Math.abs(dx) > 12.5 && Math.abs(dy) > 12.5) ? 4 : 0;
        const ctrlX = midX - (dy !== 0 ? Math.sign(dy) * curveOffset : 0);
        const ctrlY = midY + (dx !== 0 ? Math.sign(dx) * curveOffset : 0);

        const d = `M ${startX} ${startY} Q ${ctrlX} ${ctrlY} ${endX} ${endY}`;
        const isBranch = tile.nextTileIds.length > 1;

        paths.push({
          d,
          color: COLOR_MAP[tile.colorScheme].track,
          id: `${tile.id}->${nextId}`,
          isBranch
        });
      });
    });

    return paths;
  }, [tiles, tileMap]);

  const getAutotilingShape = (tile: BoardTile) => {
    // Detect incoming connections
    const incoming = tiles.filter(t => t.nextTileIds.includes(tile.id));
    const outgoing = tile.nextTileIds.map(id => tileMap.get(id)).filter(Boolean) as BoardTile[];

    // Calculate predominant directions: 'N', 'S', 'E', 'W'
    const getDir = (from: BoardTile, to: BoardTile) => {
      const dx = to.gridX - from.gridX;
      const dy = to.gridY - from.gridY;
      if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'E' : 'W';
      return dy > 0 ? 'S' : 'N';
    };

    const inDirs = incoming.map(src => getDir(src, tile));
    const outDirs = outgoing.map(dst => getDir(tile, dst));

    // Corner detection: round specific corners for a flowing stone bridge look
    const isCorner = inDirs.length > 0 && outDirs.length > 0 && inDirs[0] !== outDirs[0];
    return {
      isCorner,
      roundedClasses: isCorner ? 'rounded-2xl' : 'rounded-xl',
      badge: tile.nextTileIds.length > 1 ? 'FORK' : tile.isStart ? 'START' : null
    };
  };

  const activePlayer = players[currentTurnIdx];

  const triggerTileAction = (tile: BoardTile, player: Player) => {
    let alertData = {
      title: `${player.name}: [${tile.title}] 도착!`,
      description: tile.description,
      actionText: '확인',
      type: tile.actionType
    };

    switch (tile.actionType) {
      case 'DRINK_FIXED': {
        const shots = tile.actionPayload.shots || 1;
        const target = tile.actionPayload.target || 'SELF';
        const targetText = target === 'ALL' ? '모두' : target === 'CHOICE' ? '지목된 사람' : target === 'BOTH_SIDES' ? '양옆 사람' : player.name;
        alertData.description = `${targetText}에게 ${shots}잔 벌칙! 🍻 (${tile.description})`;

        if (target === 'SELF') {
          setPlayers(prev => prev.map(p => p.id === player.id ? { ...p, drinksCount: p.drinksCount + shots } : p));
        } else if (target === 'ALL') {
          setPlayers(prev => prev.map(p => ({ ...p, drinksCount: p.drinksCount + shots })));
        }
        break;
      }
      case 'POT_DEPOSIT': {
        const shots = tile.actionPayload.shots || 1;
        setPenaltyPotShots(prev => prev + shots);
        alertData.description = `중앙 황금 잔에 ${shots}잔이 적립되었습니다! 현재 누적: ${penaltyPotShots + shots}잔 🔥`;
        break;
      }
      case 'POT_CLAIM': {
        const claimed = penaltyPotShots;
        setPenaltyPotShots(0);
        setPlayers(prev => prev.map(p => p.id === player.id ? { ...p, drinksCount: p.drinksCount + claimed } : p));
        alertData.title = `🚨 잭팟 폭발!! 🚨`;
        alertData.description = `${player.name}님이 중앙 누적 벌주 ${claimed}잔을 모두 획득했습니다! 살아서 돌아오세요! 🍺😱`;
        break;
      }
      case 'GLOBAL_RULE': {
        if (tile.actionPayload.ruleTitle) {
          setActiveGlobalRule({
            title: tile.actionPayload.ruleTitle,
            remainingTurns: tile.actionPayload.ruleDurationTurns || 3
          });
          alertData.description = `새로운 왕의 칙령 발동: "${tile.actionPayload.ruleTitle}" (${tile.actionPayload.ruleDurationTurns || 3}턴 유지)`;
        }
        break;
      }
      case 'MOVE_OFFSET': {
        const steps = tile.actionPayload.steps || 0;
        alertData.description = `${steps > 0 ? '앞' : '뒤'}으로 ${Math.abs(steps)}칸 강제 이동합니다!`;
        setTimeout(() => {
          executeStepMove(player.id, tile.id, steps, false);
        }, 800);
        break;
      }
      case 'ROULETTE': {
        const options = tile.actionPayload.rouletteOptions || ['1잔', '통과', '2잔'];
        const outcome = options[Math.floor(Math.random() * options.length)];
        alertData.title = `🎡 운명의 룰렛 결과!`;
        alertData.description = `당첨 결과: [${outcome}] !`;
        break;
      }
      case 'MINIGAME': {
        alertData.title = `🎮 미니게임 타임!`;
        alertData.description = `종목: [${tile.actionPayload.minigameName || '순발력 배틀'}]! 테이블에서 진행하세요.`;
        break;
      }
      default:
        break;
    }

    setLogMessages(prev => [`[${player.name}] ${tile.title} -> ${alertData.description}`, ...prev.slice(0, 15)]);
    setCurrentEventAlert(alertData);
  };

  const executeStepMove = (playerId: string, currentTileId: string, remainingSteps: number, checkBranch = true) => {
    const currentTile = tileMap.get(currentTileId);
    if (!currentTile) return;

    if (remainingSteps === 0) {
      // Arrived at destination!
      const finalPlayer = players.find(p => p.id === playerId);
      if (finalPlayer) {
        triggerTileAction(currentTile, finalPlayer);
      }
      return;
    }

    const nextOptions = currentTile.nextTileIds;
    if (nextOptions.length === 0) return;

    // Check for branch choice (Shortcut vs Main Road)
    if (checkBranch && nextOptions.length > 1) {
      setBranchChoice({
        pendingSteps: remainingSteps,
        options: nextOptions
      });
      return;
    }

    const nextId = nextOptions[0];
    setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, currentTileId: nextId } : p));

    // Next step after transition timeout
    setTimeout(() => {
      executeStepMove(playerId, nextId, remainingSteps - 1, checkBranch);
    }, 280);
  };

  const handleBranchSelect = (chosenNextId: string) => {
    if (!branchChoice) return;
    const { pendingSteps } = branchChoice;
    setBranchChoice(null);

    setPlayers(prev => prev.map(p => p.id === activePlayer.id ? { ...p, currentTileId: chosenNextId } : p));
    setTimeout(() => {
      executeStepMove(activePlayer.id, chosenNextId, pendingSteps - 1, true);
    }, 280);
  };

  const handleRollDice = () => {
    if (isRolling || branchChoice) return;
    setIsRolling(true);

    let rollCount = 0;
    const interval = setInterval(() => {
      setDiceValue(Math.floor(Math.random() * 6) + 1);
      rollCount++;
      if (rollCount > 8) {
        clearInterval(interval);
        const finalValue = Math.floor(Math.random() * 6) + 1;
        setDiceValue(finalValue);
        setIsRolling(false);

        // Turn rule decay
        if (activeGlobalRule) {
          if (activeGlobalRule.remainingTurns <= 1) {
            setActiveGlobalRule(null);
            setLogMessages(prev => [`👑 왕의 칙령 [${activeGlobalRule.title}]이 종료되었습니다.`, ...prev]);
          } else {
            setActiveGlobalRule(prev => prev ? { ...prev, remainingTurns: prev.remainingTurns - 1 } : null);
          }
        }

        // Start step motion
        executeStepMove(activePlayer.id, activePlayer.currentTileId, finalValue, true);
      }
    }, 70);
  };

  const nextTurn = () => {
    setCurrentEventAlert(null);
    setCurrentTurnIdx((prev) => (prev + 1) % players.length);
  };

  const handleGridCellClick = (x: number, y: number) => {
    if (mode !== 'edit') return;
    const existing = tileCoordMap.get(`${x},${y}`);

    if (editTool === 'create') {
      if (existing) {
        setSelectedTileId(existing.id);
        setIsTileModalOpen(true);
      } else {
        // Create new tile at coordinates
        const newId = `t-${Date.now().toString().slice(-4)}`;
        const newTile: BoardTile = {
          id: newId,
          gridX: x,
          gridY: y,
          title: `새 타일 (${x},${y})`,
          description: '새로운 벌칙 또는 이벤트를 설정하세요.',
          actionType: 'DRINK_FIXED',
          actionPayload: { shots: 1, target: 'SELF' },
          colorScheme: 'soju',
          nextTileIds: []
        };
        setTiles(prev => [...prev, newTile]);
        setSelectedTileId(newId);
        setIsTileModalOpen(true);
      }
    } else if (editTool === 'connect') {
      if (!existing) return;
      if (!connectionSourceId) {
        setConnectionSourceId(existing.id);
      } else {
        if (connectionSourceId !== existing.id) {
          // Link source -> existing
          setTiles(prev => prev.map(t => {
            if (t.id === connectionSourceId) {
              const nexts = t.nextTileIds.includes(existing.id)
                ? t.nextTileIds.filter(id => id !== existing.id)
                : [...t.nextTileIds, existing.id];
              return { ...t, nextTileIds: nexts };
            }
            return t;
          }));
        }
        setConnectionSourceId(null);
      }
    } else {
      // Select
      if (existing) {
        setSelectedTileId(existing.id);
        setIsTileModalOpen(true);
      }
    }
  };

  const handleUpdateTile = (updated: BoardTile) => {
    setTiles(prev => prev.map(t => t.id === updated.id ? updated : t));
    setIsTileModalOpen(false);
  };

  const handleDeleteTile = (id: string) => {
    setTiles(prev => prev.filter(t => t.id !== id).map(t => ({
      ...t,
      nextTileIds: t.nextTileIds.filter(nid => nid !== id)
    })));
    setIsTileModalOpen(false);
  };

  const selectedTile = tiles.find(t => t.id === selectedTileId);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none overflow-x-hidden">
      {/* Top Navigation Bar */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Beer className="w-5 h-5 text-slate-950 font-bold" />
          </div>
          <div>
            <h1 className="font-black text-lg tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300 bg-clip-text text-transparent">
              주루마블 STUDIO
            </h1>
            <p className="text-xs text-slate-400 font-medium hidden sm:block">하이브리드 패스 & 중앙 인터랙션 엔진</p>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mode Switcher */}
          <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => setMode('play')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === 'play' ? 'bg-emerald-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              플레이
            </button>
            <button
              onClick={() => setMode('edit')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === 'edit' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              제작 모드
            </button>
          </div>

          {/* Perspective View Toggle */}
          <button
            onClick={() => setViewMode(v => v === '3d' ? '2d' : '3d')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
            title="2D 평면 / 2.5D 아이소메트릭 전환"
          >
            <Box className={`w-3.5 h-3.5 ${viewMode === '3d' ? 'text-cyan-400' : 'text-slate-400'}`} />
            <span className="hidden sm:inline">{viewMode === '3d' ? '2.5D 입체' : '2D 평면'}</span>
          </button>
        </div>
      </header>

      {/* Editor Sub-Toolbar */}
      {mode === 'edit' && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex flex-wrap items-center justify-between text-xs gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-amber-400 flex items-center gap-1">
              <Settings2 className="w-3.5 h-3.5" /> 편집 툴:
            </span>
            <button
              onClick={() => setEditTool('select')}
              className={`px-2.5 py-1 rounded-md font-medium border ${
                editTool === 'select' ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold' : 'border-slate-700 text-slate-300'
              }`}
            >
              타일 선택/수정
            </button>
            <button
              onClick={() => setEditTool('create')}
              className={`px-2.5 py-1 rounded-md font-medium border ${
                editTool === 'create' ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold' : 'border-slate-700 text-slate-300'
              }`}
            >
              칸 추가/제거
            </button>
            <button
              onClick={() => { setEditTool('connect'); setConnectionSourceId(null); }}
              className={`px-2.5 py-1 rounded-md font-medium border ${
                editTool === 'connect' ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold' : 'border-slate-700 text-slate-300'
              }`}
            >
              선 연결 / 분기(Fork)
            </button>
          </div>
          <span className="text-slate-400 text-[11px]">
            {editTool === 'connect' 
              ? (connectionSourceId ? '연결할 대상 타일을 클릭하세요' : '시작 타일을 클릭하세요') 
              : '그리드 셀을 클릭하여 편집할 수 있습니다.'}
          </span>
        </div>
      )}

      {/* King's Decree Global Rule Banner */}
      {activeGlobalRule && (
        <div className="bg-gradient-to-r from-purple-900/60 via-indigo-900/60 to-purple-900/60 border-b border-purple-500/30 px-4 py-2 flex items-center justify-center gap-2 text-xs font-semibold text-purple-200">
          <Crown className="w-4 h-4 text-yellow-400 animate-bounce" />
          <span>현재 발동 중인 왕의 칙령:</span>
          <span className="bg-purple-950/80 px-2.5 py-0.5 rounded-full border border-purple-400/40 text-yellow-300 font-bold">
            {activeGlobalRule.title}
          </span>
          <span className="text-purple-400">({activeGlobalRule.remainingTurns}턴 남음)</span>
        </div>
      )}

      {/* Main Workspace Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Left Side: Game Board Viewport */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-4 sm:p-8 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black relative">
          {/* Subtle Grid Ambient Glow */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b0f_1px,transparent_1px),linear-gradient(to_bottom,#1e293b0f_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />

          {/* Isometric Perspective Wrapper */}
          <div 
            className="w-full max-w-[700px] aspect-square transition-transform duration-700 ease-out relative select-none"
            style={{
              perspective: '1200px',
              perspectiveOrigin: '50% 50%'
            }}
          >
            <div 
              ref={boardRef}
              className="w-full h-full relative rounded-3xl bg-slate-900/60 backdrop-blur-sm border-2 border-slate-800 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)]"
              style={{
                transform: viewMode === '3d' 
                  ? 'rotateX(38deg) rotateZ(-12deg) scale(0.92)' 
                  : 'rotateX(0deg) rotateZ(0deg) scale(1)',
                transformStyle: 'preserve-3d',
                transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)'
              }}
            >
              {/* 1. Underlying SVG Spline Path Curves */}
              <svg 
                className="absolute inset-0 w-full h-full pointer-events-none z-10" 
                viewBox="0 0 100 100" 
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="50%" stopColor="#a855f7" />
                    <stop offset="100%" stopColor="#f59e0b" />
                  </linearGradient>
                  <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>

                {/* Render All Connected Splines */}
                {renderPathSegments.map(p => (
                  <g key={p.id}>
                    {/* Shadow/Glow Path */}
                    <path
                      d={p.d}
                      fill="none"
                      stroke={p.color}
                      strokeWidth="2.8"
                      strokeLinecap="round"
                      strokeOpacity="0.4"
                      filter="url(#neonGlow)"
                    />
                    {/* Main Core Path */}
                    <path
                      d={p.d}
                      fill="none"
                      stroke={p.isBranch ? '#f43f5e' : p.color}
                      strokeWidth="1.2"
                      strokeDasharray={p.isBranch ? '2 1.5' : 'none'}
                      strokeLinecap="round"
                    />
                  </g>
                ))}
              </svg>

              {/* 2. Interactive 8x8 Grid System for Editor */}
              <div className="absolute inset-0 grid grid-cols-8 grid-rows-8 z-0">
                {Array.from({ length: 64 }).map((_, idx) => {
                  const x = idx % 8;
                  const y = Math.floor(idx / 8);
                  const hasTile = tileCoordMap.has(`${x},${y}`);

                  return (
                    <div
                      key={idx}
                      onClick={() => handleGridCellClick(x, y)}
                      className={`relative border border-slate-800/30 transition-all ${
                        mode === 'edit' ? 'hover:bg-amber-500/10 cursor-pointer' : ''
                      } ${hasTile ? '' : 'hover:border-slate-700/50'}`}
                    >
                      {mode === 'edit' && !hasTile && editTool === 'create' && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          <Plus className="w-3 h-3 text-amber-400" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 3. Central Hub: Penalty Drink Pot & Dynamic Widgets */}
              <div 
                className="absolute z-20 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-950/90 border border-slate-700/70 p-3 shadow-2xl flex flex-col items-center justify-between"
                style={{
                  left: '26%',
                  top: '26%',
                  width: '48%',
                  height: '48%',
                  transform: viewMode === '3d' ? 'translateZ(20px)' : 'none',
                  transition: 'transform 0.4s ease'
                }}
              >
                {/* Central Pot Header */}
                <div className="w-full flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <div className="flex items-center gap-1.5 text-yellow-400 font-bold text-xs">
                    <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                    <span>황금 벌주 항아리</span>
                  </div>
                  <span className="text-[10px] bg-yellow-500/20 text-yellow-300 font-extrabold px-1.5 py-0.5 rounded-full border border-yellow-500/30">
                    {penaltyPotShots} 잔 누적
                  </span>
                </div>

                {/* Animated Liquid Pot Gauge */}
                <div className="relative w-24 h-24 my-1 flex items-center justify-center">
                  {/* Glass Bowl Container */}
                  <div className="w-20 h-20 rounded-full border-2 border-yellow-500/40 bg-slate-950 overflow-hidden relative shadow-[inset_0_0_15px_rgba(234,179,8,0.2)]">
                    {/* Rising Liquid with Wave Simulation */}
                    <div 
                      className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-amber-600 via-yellow-500 to-amber-400 transition-all duration-700 ease-out"
                      style={{ 
                        height: `${Math.min(100, Math.max(12, penaltyPotShots * 12))}%` 
                      }}
                    >
                      {/* Floating Bubbles */}
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,_rgba(255,255,255,0.4)_2px,_transparent_0)] bg-[size:10px_10px]" />
                    </div>
                    {/* Centered Shot Counter */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white drop-shadow-md z-10">
                      <span className="text-xl font-black">{penaltyPotShots}</span>
                      <span className="text-[9px] font-semibold text-amber-200">SHOTS</span>
                    </div>
                  </div>
                </div>

                {/* Central Live Action / Dice Roller */}
                <div className="w-full flex flex-col items-center gap-1">
                  {mode === 'play' ? (
                    <div className="w-full flex items-center gap-2">
                      <button
                        onClick={handleRollDice}
                        disabled={isRolling || branchChoice !== null}
                        className={`flex-1 py-2 px-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-lg ${
                          isRolling || branchChoice !== null
                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            : 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 hover:brightness-110 active:scale-95 shadow-emerald-500/25'
                        }`}
                      >
                        <Dice5 className={`w-4 h-4 ${isRolling ? 'animate-spin' : ''}`} />
                        <span>{isRolling ? '굴리는 중...' : `${activePlayer.name} 주사위 굴리기`}</span>
                      </button>

                      {diceValue && !isRolling && (
                        <div className="w-9 h-9 rounded-xl bg-slate-800 border border-emerald-500/50 flex items-center justify-center text-emerald-400 font-black text-sm shadow-md">
                          {diceValue}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center text-[10px] text-slate-400">
                      🛠️ 에디터 모드: 타일을 자유롭게 클릭해 규칙을 변경하세요.
                    </div>
                  )}
                </div>
              </div>

              {/* 4. Render Board Tiles (Stepping Stones) */}
              {tiles.map(tile => {
                const styling = COLOR_MAP[tile.colorScheme];
                const { roundedClasses, badge } = getAutotilingShape(tile);
                const isSelected = selectedTileId === tile.id;
                const isConnectSource = connectionSourceId === tile.id;

                // Players present on this tile
                const tilePlayers = players.filter(p => p.currentTileId === tile.id);

                return (
                  <div
                    key={tile.id}
                    onClick={() => handleGridCellClick(tile.gridX, tile.gridY)}
                    className={`absolute z-30 transition-transform duration-300 flex flex-col justify-between p-1 cursor-pointer select-none ${roundedClasses} border-2 ${styling.border} ${styling.bg} ${styling.glow}`}
                    style={{
                      left: `${tile.gridX * 12.5 + 0.6}%`,
                      top: `${tile.gridY * 12.5 + 0.6}%`,
                      width: '11.3%',
                      height: '11.3%',
                      // 3D extrusion stepping stone effect
                      transform: viewMode === '3d' 
                        ? (isSelected ? 'translateZ(30px) scale(1.05)' : 'translateZ(14px)') 
                        : (isSelected ? 'scale(1.05)' : 'none'),
                      boxShadow: viewMode === '3d' 
                        ? '0 10px 15px -3px rgba(0,0,0,0.6), 0 4px 6px -2px rgba(0,0,0,0.4)' 
                        : undefined
                    }}
                  >
                    {/* Badge Indicator for Start / Forks */}
                    {badge && (
                      <span className={`absolute -top-2 -right-1 text-[8px] font-black px-1 rounded shadow-sm ${
                        badge === 'START' ? 'bg-yellow-400 text-slate-950' : 'bg-rose-500 text-white'
                      }`}>
                        {badge}
                      </span>
                    )}

                    {/* Connection highlighting in editor */}
                    {isConnectSource && (
                      <span className="absolute -top-2 left-0 text-[8px] bg-amber-400 text-slate-950 font-black px-1 rounded animate-pulse">
                        SOURCE
                      </span>
                    )}

                    {/* Title */}
                    <div className="w-full text-center">
                      <p className={`font-black text-[9px] sm:text-[10px] leading-tight line-clamp-1 ${styling.text}`}>
                        {tile.title}
                      </p>
                    </div>

                    {/* Description preview */}
                    <p className="text-[7px] text-slate-300/80 line-clamp-1 text-center hidden sm:block">
                      {tile.description}
                    </p>

                    {/* Token Placement inside Tile */}
                    <div className="flex items-center justify-center gap-0.5 min-h-[14px]">
                      {tilePlayers.map(p => (
                        <div 
                          key={p.id}
                          className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] shadow-lg border border-white/80 animate-bounce"
                          style={{ backgroundColor: p.color }}
                          title={`${p.name} (마신 잔: ${p.drinksCount})`}
                        >
                          {p.avatar}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Side: Game Status & Control Sidebar */}
        <aside className="w-full lg:w-80 bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col p-4 gap-4 z-40">
          {/* Player Cards */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
              <span>플레이어 상태</span>
              <span className="text-[10px] text-emerald-400">턴: {activePlayer.name}</span>
            </h2>
            <div className="space-y-2">
              {players.map((p, idx) => {
                const isTurn = idx === currentTurnIdx;
                return (
                  <div
                    key={p.id}
                    className={`p-2.5 rounded-xl border transition-all flex items-center justify-between ${
                      isTurn 
                        ? 'bg-slate-800/90 border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.2)]' 
                        : 'bg-slate-950/40 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div 
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-sm shadow-md"
                        style={{ backgroundColor: p.color }}
                      >
                        {p.avatar}
                      </div>
                      <div>
                        <div className="text-xs font-bold flex items-center gap-1.5">
                          <span>{p.name}</span>
                          {isTurn && <span className="text-[9px] bg-emerald-500 text-slate-950 px-1 rounded font-black">TURN</span>}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          현재: {tileMap.get(p.currentTileId)?.title || '출발'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-black text-amber-400 flex items-center gap-1 justify-end">
                        <Beer className="w-3 h-3" />
                        <span>{p.drinksCount} 잔</span>
                      </div>
                      <span className="text-[9px] text-slate-500">누적 음주량</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Preset Control & Reset */}
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">게임 초기화</span>
            <button
              onClick={() => {
                setPlayers(prev => prev.map(p => ({ ...p, currentTileId: 't-0', drinksCount: 0 })));
                setCurrentTurnIdx(0);
                setPenaltyPotShots(3);
                setDiceValue(null);
                setLogMessages(['게임을 리셋했습니다.']);
              }}
              className="px-2.5 py-1 text-xs rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> 리셋
            </button>
          </div>

          {/* Realtime Event Log Feed */}
          <div className="flex-1 flex flex-col min-h-[160px] bg-slate-950 rounded-xl border border-slate-800 p-3 overflow-hidden">
            <h3 className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>실시간 주류 일지</span>
            </h3>
            <div className="flex-1 overflow-y-auto space-y-1.5 text-xs text-slate-300 pr-1">
              {logMessages.map((msg, i) => (
                <div key={i} className="text-[11px] leading-relaxed p-1.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                  {msg}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* 5. Branch Choice Fork Modal (Shortcuts vs Main Track) */}
      {branchChoice && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/50 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <GitFork className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-rose-300">갈림길 선택!</h3>
              <p className="text-xs text-slate-300 mt-1">
                중앙 지름길 코스로 가시겠습니까, 아니면 안전한 정규 코스로 가시겠습니까?
              </p>
            </div>
            <div className="space-y-2 pt-2">
              {branchChoice.options.map(optId => {
                const t = tileMap.get(optId);
                if (!t) return null;
                const isShortcut = t.id.includes('s');
                return (
                  <button
                    key={optId}
                    onClick={() => handleBranchSelect(optId)}
                    className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-between border transition-all ${
                      isShortcut 
                        ? 'bg-rose-950/60 border-rose-500 text-rose-300 hover:bg-rose-900/80' 
                        : 'bg-emerald-950/60 border-emerald-500 text-emerald-300 hover:bg-emerald-900/80'
                    }`}
                  >
                    <span>{t.title}</span>
                    <span className="text-[10px] font-normal opacity-80">
                      {isShortcut ? '⚡ 익스트림 지름길' : '🛡️ 일반 코스'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 6. Tile Action Penalty Alert Popup */}
      {currentEventAlert && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-amber-500 rounded-3xl p-6 max-w-sm w-full shadow-[0_0_40px_rgba(245,158,11,0.3)] text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-3xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
              <Beer className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-black text-amber-300">{currentEventAlert.title}</h3>
              <p className="text-xs text-slate-200 mt-2 bg-slate-950/80 p-3 rounded-xl border border-slate-800 leading-relaxed">
                {currentEventAlert.description}
              </p>
            </div>
            <button
              onClick={nextTurn}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-xs hover:brightness-110 active:scale-95 shadow-lg shadow-amber-500/20 transition-all"
            >
              벌칙 수행 완료 & 다음 턴 넘기기
            </button>
          </div>
        </div>
      )}

      {/* 7. Tile Editor Modal (Action & Payload configuration) */}
      {isTileModalOpen && selectedTile && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold">타일 속성 및 로직 설정</h3>
              </div>
              <button 
                onClick={() => setIsTileModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Fields */}
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">타일 제목</label>
                <input
                  type="text"
                  value={selectedTile.title}
                  onChange={(e) => setSelectedTileId(selectedTile.id)}
                  onBlur={(e) => handleUpdateTile({ ...selectedTile, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">타일 설명 (벌칙 내용)</label>
                <textarea
                  rows={2}
                  value={selectedTile.description}
                  onChange={(e) => handleUpdateTile({ ...selectedTile, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">실행 액션 심볼</label>
                  <select
                    value={selectedTile.actionType}
                    onChange={(e) => handleUpdateTile({ ...selectedTile, actionType: e.target.value as ActionType })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100"
                  >
                    <option value="DRINK_FIXED">DRINK_FIXED (음주 벌칙)</option>
                    <option value="POT_DEPOSIT">POT_DEPOSIT (중앙 잔 적립)</option>
                    <option value="POT_CLAIM">POT_CLAIM (중앙 잔 잭팟)</option>
                    <option value="GLOBAL_RULE">GLOBAL_RULE (왕의 칙령)</option>
                    <option value="MOVE_OFFSET">MOVE_OFFSET (앞/뒤 이동)</option>
                    <option value="ROULETTE">ROULETTE (랜덤 룰렛)</option>
                    <option value="MINIGAME">MINIGAME (미니게임)</option>
                    <option value="NONE">NONE (일반 발판)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">테마 컬러</label>
                  <select
                    value={selectedTile.colorScheme}
                    onChange={(e) => handleUpdateTile({ ...selectedTile, colorScheme: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100"
                  >
                    <option value="soju">소주 에메랄드</option>
                    <option value="beer">맥주 앰버</option>
                    <option value="golden">황금 옐로우</option>
                    <option value="danger">폭탄 로즈</option>
                    <option value="purple">미니게임 퍼플</option>
                    <option value="cyan">특수 칙령 시안</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Payload Configuration */}
              {selectedTile.actionType === 'DRINK_FIXED' && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <span className="font-semibold text-emerald-400 block">벌주 상세 설정</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400">벌주 잔 수</label>
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        max="5"
                        value={selectedTile.actionPayload.shots || 1}
                        onChange={(e) => handleUpdateTile({
                          ...selectedTile,
                          actionPayload: { ...selectedTile.actionPayload, shots: parseFloat(e.target.value) || 1 }
                        })}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400">대상 지정</label>
                      <select
                        value={selectedTile.actionPayload.target || 'SELF'}
                        onChange={(e) => handleUpdateTile({
                          ...selectedTile,
                          actionPayload: { ...selectedTile.actionPayload, target: e.target.value as any }
                        })}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5"
                      >
                        <option value="SELF">본인</option>
                        <option value="CHOICE">지목 1인</option>
                        <option value="BOTH_SIDES">양옆 사람</option>
                        <option value="ALL">전체 모두</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Delete / Finish Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <button
                  onClick={() => handleDeleteTile(selectedTile.id)}
                  className="px-3 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-lg text-xs flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> 삭제
                </button>
                <button
                  onClick={() => setIsTileModalOpen(false)}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs"
                >
                  저장 완료
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}