# FinScope 무료 포트폴리오 배포 — Vercel Hobby

FinScope 화면은 Vercel의 정적 파일로, DART·KRX·ECOS 등을 호출하는 API는 서울(`icn1`)의 Node.js Function 하나로 배포합니다. 기존 `node server.mjs`와 `START_LOCAL.cmd`는 그대로 동작합니다. 공개 주소에서는 PC의 CMD 없이 사이트와 설치형 웹앱(PWA)을 사용할 수 있습니다.

> Vercel Hobby는 개인·비상업 프로젝트용 무료 플랜입니다. 공개 URL을 만든다는 뜻이지 모든 외부 데이터의 재배포 권한을 얻는다는 뜻은 아닙니다. KRX·DART·공공데이터포털 등의 이용 조건을 확인하고, 상업 서비스나 커뮤니티 운영으로 확대하기 전에는 별도 계획이 필요합니다.

## 1. 비공개 GitHub 저장소 연결

1. <https://vercel.com/new>에서 본인 GitHub 계정으로 로그인합니다.
2. 개인 계정 `bjhevent87-byte`의 비공개 `finscope` 저장소를 선택합니다. GitHub App 설치 화면이 나오면 **이 저장소에만** 접근하도록 선택합니다. 다른 비공개 저장소 전체에 대한 접근은 허용할 필요가 없습니다.
3. 프로젝트 이름은 `finscope` 또는 원하는 이름으로 설정하고, 플랜이 **Hobby**인지 확인합니다. 유료 업그레이드나 결제수단 입력은 필요하지 않습니다.
4. 저장소 최상위가 프로젝트 루트입니다. Framework Preset은 **Other**, Root Directory는 `./`로 둡니다. `vercel.json`이 `/`를 `/home.html`로 이동시키고, `/api/*`를 서버리스 함수로 연결합니다. Vercel에서는 `index.html`이 `/`보다 우선 제공되므로 루트 경로에는 rewrite가 아닌 redirect를 사용합니다.
5. 배포 버튼을 누르기 전에 아래 환경변수를 등록합니다. 키 값은 GitHub 파일·채팅·스크린샷에 넣지 않습니다.

## 2. 서버 환경변수

Vercel 프로젝트의 **Settings → Environment Variables**에서 다음 이름과 본인의 키 값을 등록합니다. 최소한 Production에 넣고, Preview 배포에서도 실제 API를 시험하려면 Preview에도 따로 설정합니다.

| 변수 | 용도 |
| --- | --- |
| `OPEN_DART_API_KEY` | DART 재무·공시 |
| `DATA_GO_KR_SERVICE_KEY` | 금융위원회 시세·지수 |
| `KRX_AUTH_KEY` | KRX 업종·ETF |
| `ECOS_API_KEY` | 한국은행 지표 |
| `KOREA_EXIM_API_KEY` | 수출입은행 환율·금리 |
| `FRED_API_KEY` | 미국 경제지표 |

선택값 `CACHE_TTL_MINUTES=360`, `RATE_LIMIT_PER_MINUTE=60`을 추가할 수 있습니다. 단, Vercel 함수의 메모리 캐시와 요청 제한은 인스턴스마다 별개이고 재시작 시 초기화됩니다. 공개 트래픽·호출량을 안정적으로 통제하려면 영속 캐시와 공용 요청 제한 저장소가 필요합니다.

### 선택 기능: AI 길잡이

AI 길잡이의 용어·화면 안내는 무료이며 OpenAI API 키가 없어도 작동합니다. 자유 질문의 목적을 AI로 분류하려면 **별도 OpenAI API 과금 계정**이 필요합니다. ChatGPT 구독이나 Vercel Hobby 무료 플랜에 API 사용료가 포함되는 것은 아닙니다. 먼저 OpenAI 프로젝트에서 지출 한도를 설정하고, 필요한 경우에만 `OPENAI_API_KEY`와 `FINSCOPE_AI_ENABLED=true`를 Vercel 환경변수에 등록한 뒤 재배포하세요. `FINSCOPE_AI_MODEL`은 기본 `gpt-6-luna`입니다. 키와 질문 원문은 GitHub나 로그에 저장하지 않습니다. `/api/ai-guide/status`는 활성화 여부만 공개하며 키 값은 반환하지 않습니다.

이 기능은 질문에서 방문할 화면을 고를 뿐, 회사 재무수치나 투자 의견을 생성하지 않습니다. 인스턴스 메모리의 호출 제한은 Vercel 전체의 확정 비용 한도가 아니므로 실제 공개 운영 전에는 OpenAI 측 하드 지출 한도와 모니터링이 필요합니다.

## 3. 배포 후 확인

1. Vercel의 Production URL에서 `/api/health`를 열어 `ok: true`, `companyData: true` 및 필요한 공급자 `Configured: true`를 확인합니다. 이 화면은 **키 설정 여부**만 나타내며 실제 외부 API의 작동까지 보증하지 않습니다.
2. `/` 홈, 기업 검색, 기업 분석, 데이터 실험실의 공식 지표 조회, CSV 다운로드를 실제로 확인합니다. 특히 첫 비교 분석은 외부 API 호출이 많아 느리거나 함수 시간 제한에 걸릴 수 있습니다.
3. 휴대전화와 다른 인터넷 연결에서도 접속해 봅니다. 정적 화면은 CDN에서 빠르게 제공될 수 있지만, 외부 API 응답·함수 시작 시간 때문에 동적 분석이 항상 빠르다고 보장할 수는 없습니다.
4. 배포 URL을 Chrome·Edge에서 열고 **앱으로 설치**를 선택하면 PC 재부팅 후에도 아이콘으로 열 수 있습니다. 분석 데이터 갱신에는 인터넷이 필요합니다.

같은 저장소의 `main`에 수정본을 push하면 Vercel이 자동으로 다시 배포합니다. 로컬 파일 수정만으로는 공개 사이트가 변경되지 않습니다. 기존 로컬 실행은 계속 유지할 수 있습니다.

## 제한과 주의

- Hobby는 개인·비상업 프로젝트용입니다. 포트폴리오·교육용 사용 범위를 벗어나면 플랜과 원천 데이터 이용 허가를 재검토해야 합니다.
- Function 실행 시간, 월 사용량, 응답 크기 제한이 있습니다. 특히 10개 기업의 5개년 재무 비교처럼 외부 호출이 많은 기능은 배포 뒤 실제로 검증해야 합니다.
- `data/companies.json`은 배포 함수에 포함되지만 자동 갱신되지는 않습니다. 목록을 갱신하려면 로컬에서 `npm run build:data`를 실행하고 변경 파일을 커밋해야 합니다.
- 비공개 저장소라도 `.env`, 인증키, 개인 메모를 커밋하지 않습니다. 결제·플랜 업그레이드는 이 배포 절차의 일부가 아닙니다.
