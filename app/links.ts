
import {
  Armchair,
  Dices,
  MicVocal,
  Cookie,
  Shuffle
} from "lucide-react";
    
export const MainLinks = [
    {
      badge: "SEAT AUCTION",
      title: "자리 배정 경매",
      description: "A~M 구역 선점 및 실시간 입찰",
      url: "/seats",
      icon: Armchair,
      bgColor:
        "from-indigo-400/80 to-indigo-600 hover:from-indigo-600/80 hover:to-indigo-400/70 transition-colors duration-750",
      desColor: "text-indigo-100"
    },
    {
      badge: "SONG QUEUE",
      title: "노래 큐",
      description: "12반의 노래방",
      url: "/song",
      icon: MicVocal,
      bgColor:
        "from-ssafy-blue/80 to-ssafy-blue-dark hover:from-ssafy-blue-dark hover:to-ssafy-blue/70 transition-colors duration-750",
      desColor: "text-teal-100"
    },
    {
      badge: "RANDOMIZER",
      title: "제비뽑기",
      description: "학생들 무작위 순서 뽑기",
      url: "/shuffle",
      icon: Shuffle,
      bgColor:
        "from-emerald-400/80 to-emerald-600 hover:from-emerald-600/80 hover:to-emerald-400/70 transition-colors duration-750",
      desColor: "text-emerald-100"
    },
    {
      badge: "SNACK CENTER",
      title: "간식 센터",
      description: "간식 뽑기 및 신청",
      url: "/snack",
      icon: Cookie,
      bgColor:
        "from-amber-400/80 to-amber-600 hover:from-amber-600/80 hover:to-amber-400/70 transition-colors duration-750",
      desColor: "text-amber-100"
    },
    {
      badge: "BOARD GAME",
      title: "보두게임",
      description: "보두게임 제작 및 플레이",
      url: "/boardgame",
      icon: Dices,
      bgColor:
        "from-rose-400/80 to-rose-600 hover:from-rose-600/80 hover:to-rose-400/70 transition-colors duration-750",
      desColor: "text-rose-100"
    }
  ];