# NGSL Talk

NGSL(New General Service List) 핵심 단어를 실제 대화에서 써 보며 익히는 영어 회화 앱입니다.
Google **Gemini Live API**로 AI 튜터와 실시간 음성 대화를 합니다.

## 구조

```
ngsl-app/
├─ backend/    Node + TypeScript (Hono, Postgres)
│  ├─ src/index.ts      REST API (/api/*)
│  ├─ src/gemini.ts     Gemini Live 임시 토큰 발급
│  ├─ src/ngsl.ts       단어 목록 로딩, 밴드, 활용형 매칭
│  ├─ src/scenarios.ts  회화 상황과 튜터 시스템 프롬프트
│  ├─ src/db.ts         Postgres (Supabase, 로컬은 PGlite)
│  └─ data/             단어 CSV, app.db
└─ frontend/   React + Vite + TypeScript
   ├─ src/live/         Gemini Live 연결, 마이크/재생 오디오 처리
   └─ src/screens/      홈, 회화, 실시간 대화, 결과, 단어장, 나
```

### 음성 대화 흐름

1. 프론트가 `POST /api/live/token`으로 상황, 목표 단어, 난이도를 보냅니다.
2. 백엔드는 튜터 시스템 프롬프트를 만들고, 모델과 설정을 잠근 **1회용 임시 토큰**을 발급합니다. API 키는 서버 밖으로 나가지 않습니다.
3. 브라우저가 그 토큰으로 Live API에 WebSocket을 직접 엽니다. 마이크 소리는 16kHz PCM으로 보내고, 튜터 목소리는 24kHz PCM으로 받아 재생합니다.
4. 입출력 음성의 전사 결과로 자막을 표시하고, 목표 단어를 썼는지 실시간으로 체크합니다.
5. 대화가 끝나면 `POST /api/sessions`로 기록을 보내고, 서버가 사용한 NGSL 표제어를 집계해 숙련도를 갱신합니다.

### 참고한 UX 패턴

| 앱 | 가져온 패턴 | 이 앱에서 |
|---|---|---|
| Duolingo | 연속 학습일, 일일 목표, 단계형 경로 | 🔥 연속 학습, 목표 링, 단어 밴드 경로 |
| Speak | 오늘의 수업, 말하기 우선 | 홈의 "오늘의 미션" |
| Praktika | AI 튜터 아바타, 실시간 자막 | 음량에 반응하는 오브, 자막 |
| Babbel | 단어 복습 목록 | 단어장 숙련도 점 |
| ELSA | 점수 피드백 | 결과 화면의 목표 달성 점수 |

## 시작하기

필요한 것: Node.js 24 이상

```bash
npm install
cp backend/.env.example backend/.env   # GEMINI_API_KEY 입력
npm run dev
```

- 웹: http://localhost:5173
- API: http://localhost:8787/api/meta

API 키가 없어도 화면, 단어장, 기록 기능은 동작합니다. 음성 대화만 비활성화됩니다.

### 휴대폰에서 테스트하기 (같은 Wi-Fi)

휴대폰 브라우저는 HTTPS 주소에서만 마이크를 허용합니다. 아래 명령은 자체 서명 인증서로 HTTPS 서버를 띄웁니다.

```bash
npm run dev:mobile
```

터미널에 표시되는 `Network: https://192.168.x.x:5173` 주소를 휴대폰에서 엽니다. 인증서 경고가 나오면 "고급 → 계속"을 누릅니다.
Windows 방화벽이 Node.js 허용 여부를 물으면 **개인 네트워크**를 허용하세요.

### 공식 NGSL 단어 목록 가져오기

저장소에는 동작 확인용 **샘플 단어 목록**(`backend/data/ngsl-sample.csv`, 공식 순위 아님)만 들어 있습니다.
[newgeneralservicelist.com](https://www.newgeneralservicelist.com/)에서 NGSL CSV를 받은 뒤 아래 명령을 실행하세요.

```bash
npm run import:ngsl -w backend -- path/to/NGSL.csv
```

NGSL은 Browne, Culligan & Phillips가 만든 목록이며 CC BY-SA 4.0 라이선스입니다.

## 배포 (Render 무료 + Supabase 무료)

백엔드 하나가 API와 빌드된 프론트엔드를 함께 제공합니다(`Dockerfile`). 학습 기록은 Supabase Postgres에 저장합니다.

**무료 플랜의 한계**
- Render 무료 서버는 15분 동안 접속이 없으면 잠들고, 다시 열 때 약 1분이 걸립니다. 서버 안의 파일은 재시작하면 사라집니다.
- Supabase 무료 프로젝트는 1주일 동안 쓰지 않으면 일시 정지됩니다. 대시보드에서 다시 켤 수 있습니다.

### 1. Supabase (DB)
1. [supabase.com](https://supabase.com)에서 **New project**를 만듭니다. 지역은 **Northeast Asia (Seoul)**.
2. 프로젝트 상단의 **Connect** → **Transaction pooler** 주소를 복사합니다. `[YOUR-PASSWORD]` 부분을 DB 비밀번호로 바꿉니다.
   - 형식: `postgresql://postgres.<프로젝트ID>:<비밀번호>@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres`
3. 테이블은 서버가 처음 시작할 때 자동으로 만듭니다.

### 2. Render (서버)
1. [render.com](https://render.com)에 GitHub 계정으로 가입합니다.
2. **New → Blueprint**에서 이 저장소를 고릅니다. `render.yaml`이 인식됩니다.
3. 입력 칸에 값을 넣습니다.

   | 변수 | 값 |
   |---|---|
   | `GEMINI_API_KEY` | Google AI Studio 키 |
   | `APP_PASSWORD` | 접속 비밀번호 (**반드시 설정**) |
   | `DATABASE_URL` | 위에서 만든 Supabase 주소 |
   | `SESSION_SECRET` | Render가 자동 생성 |

4. 배포가 끝나면 `https://ngsl-talk-xxxx.onrender.com` 주소로 접속합니다. 휴대폰에서도 바로 열립니다.

이후에는 `main` 브랜치에 push할 때마다 자동으로 다시 배포됩니다.

> ⚠️ `APP_PASSWORD` 없이 배포하면 누구나 내 Gemini API 사용량을 쓸 수 있습니다.

### 로컬에서도 같은 DB 쓰기
`backend/.env`에 같은 `DATABASE_URL`을 넣으면 PC와 휴대폰이 같은 학습 기록을 봅니다. 비워 두면 로컬 전용 내장 Postgres(PGlite)를 `backend/data/pglite`에 만듭니다.

## 다음 할 일

- [ ] 세션 재개(session resumption)로 10분 넘는 대화 지원
- [ ] 여러 사용자 계정과 사용자별 데이터 (`user_id`) — 지금은 비밀번호 하나로 접속하는 1인용입니다
- [ ] 대화 후 튜터의 문법/표현 피드백 요약
- [ ] 간격 반복(SRS)으로 목표 단어 선택 개선
- [ ] PWA 설치, 모바일 앱(React Native/Flutter) 검토
