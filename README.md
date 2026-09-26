# SSAFY 16기 12반 대시보드

SSAFY 16기 12반의 수업과 반 활동을 지원하는 웹 서비스입니다. 로그인 후 대시보드에서 좌석 배정 경매, 노래 큐, 순서 추첨, 간식 신청, 보드게임에 접근하고 반 공지와 자주 쓰는 링크를 확인할 수 있습니다.

## 주요 기능

| 기능 | 설명 | 경로 |
| --- | --- | --- |
| 대시보드 | 사용자 인사, 서비스 바로가기, 관리자 링크, 공지 및 외부 링크 표시 | `/` |
| 자리 배정 경매 | 회차별 좌석 배정, 입찰 및 기록, 관리자 제어와 실시간 좌석 현황 관리 | `/seats` |
| 노래 큐 | 가수 대기열 등록·우선 예약·순서 변경, 노래 검색과 기록, 무대 상태 동기화 | `/song` |
| 순서 추첨 | 활성 사용자 목록(교사 제외)을 무작위로 섞어 결과 표시 | `/shuffle` |
| 간식 센터 | 간식 신청과 투표, 관리자 채택·종료 관리 | `/snack` |
| 보두게임 | 주루마블 형태의 3D 주사위 보드 화면 | `/boardgame` |
| 관리자 센터 | 사용자 권한·상태·비밀번호 관리, 대시보드 링크 등록·삭제 | `/admin` |

대시보드 주요 링크와 사용자 데이터, 좌석 경매, 노래 큐, 간식 정보는 Supabase에 저장됩니다. 노래 대기열과 무대 상태는 Supabase Realtime을 사용해 동기화합니다.

## 권한

- 로그인은 사용자 이름과 비밀번호로 진행하며, 사용자 이름에 연결된 Supabase Auth 이메일을 이용합니다.
- 일반 사용자는 서비스 화면을 이용할 수 있습니다.
- `super_admin`은 관리자 센터와 간식 관리 기능을 사용할 수 있습니다. 대시보드에서는 `class_admin`도 관리자 표시 대상입니다.
- `song_admin`과 `teacher`는 노래 큐의 운영자 기능을 사용할 수 있습니다.

## 기술 구성

- Next.js 16 App Router, React 19, TypeScript
- Tailwind CSS 4
- Supabase Auth, Postgres, Realtime (`@supabase/ssr`)
- Three.js 및 cannon-es 기반 3D 주사위 화면
- Framer Motion, `@hello-pangea/dnd`, lucide-react

서버 컴포넌트는 초기 화면 및 서버 데이터 조회에 사용하고, 사용자 상호작용이 필요한 화면은 클라이언트 컴포넌트로 구성합니다. 데이터 변경과 서버 측 처리는 각 기능 폴더의 Server Actions에서 수행합니다.

## 시작하기

### 요구 사항

- Node.js (프로젝트와 호환되는 LTS 버전 권장)
- npm
- Supabase 프로젝트 및 서비스에 필요한 환경 변수

### 설치 및 실행

```bash
npm install
npm run dev
```

프로젝트 루트에 `.env.local`을 만들고 아래 환경 변수를 설정하세요. 실제 키 값은 저장소에 커밋하지 마세요.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_YOUTUBE_API_KEY=
MATTERMOST_CLASS_WEBHOOK=
```

| 변수 | 용도 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 브라우저 및 서버에서 사용하는 Supabase publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | 관리자 사용자 관리 작업용 비밀 키. 브라우저에 노출하지 마세요. |
| `GOOGLE_YOUTUBE_API_KEY` | 노래 검색 기능의 YouTube Data API 키 |
| `MATTERMOST_CLASS_WEBHOOK` | 좌석 입찰 관련 Mattermost 알림용 웹훅 |

개발 서버 실행 후 [http://localhost:3000](http://localhost:3000)을 엽니다.

### 스크립트

```bash
npm run dev    # 개발 서버
npm run build  # 프로덕션 빌드
npm run start  # 프로덕션 서버
npm run lint   # ESLint
```

## 프로젝트 구조

```text
app/
  (auth)/       로그인 모달과 인증 Server Actions
  (main)/       대시보드 메뉴 구성
  admin/        관리자 페이지, 사용자 및 링크 관리
  seats/        좌석 경매 화면, 기록, 입찰 처리
  song/         노래 큐, 검색·기록·무대 동기화
  shuffle/      무작위 순서 추첨
  snack/        간식 신청과 투표
  boardgame/    보드게임 화면과 게임 로직
  actions.ts    대시보드에서 사용하는 공통 Server Action
utils/
  auth.ts       로그인 사용자와 프로필 확인
  supabase/     브라우저·서버·관리자 Supabase 클라이언트
docs/           기획 및 개발 현황 문서
```

## 구현 상태 참고

- 초기 기획의 범용 물품 경매는 현재 대시보드에 연결되어 있지 않으며, 구현의 중심은 좌석 배정 경매입니다.
- 추첨 결과 저장·이력 조회용 Server Action은 있으나, 현재 추첨 화면의 저장 UI는 주석 처리되어 있습니다.
- 보드게임 화면에는 3D 주사위 보드가 있지만, 새 보드게임 생성 버튼은 동작과 연결되어 있지 않습니다.
- 관리자 화면 접근은 `super_admin`으로 제한됩니다. 실제 사용 역할과 Supabase RLS 정책은 배포 환경의 설정을 따릅니다.

## 관련 문서

- [초기 기획](docs/초기%20기획.md)
- [개발 현황](docs/0908%20개발%20현황.md)
