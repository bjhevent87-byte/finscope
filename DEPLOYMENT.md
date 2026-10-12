# 무료 공개 배포 안내 — Render

이 프로젝트는 별도 유료 데이터베이스 없이 Render의 무료 Web Service로 공개할 수 있습니다. 2026년 10월 기준 무료 서버는 15분 동안 요청이 없으면 절전 상태가 되고, 다음 첫 접속 때 다시 켜지는 데 약 1분이 걸릴 수 있습니다. 무료 정책은 Render에서 변경될 수 있습니다.

> Render는 배포 가능한 방식 중 하나입니다. 배포 URL은 PC를 재부팅해도 그대로 열리고, 방문자는 CMD나 Node.js를 설치할 필요가 없습니다. API 키가 필요한 현재 구조는 단일 HTML 파일로 바꾸면 키 노출 또는 기능 중단이 생기므로 권장하지 않습니다. Koyeb을 이용하려면 [`DEPLOYMENT_KOYEB.md`](DEPLOYMENT_KOYEB.md)를 참고하세요.

## 1. GitHub 저장소 만들기

1. GitHub에서 새 저장소를 만듭니다. 공개 저장소여도 API 키는 올리지 않습니다.
2. `current` 폴더 안의 파일을 저장소 최상위에 업로드합니다.
3. `.env`와 `stock/.env`는 절대로 업로드하지 않습니다. 이 프로젝트의 `.gitignore`가 `.env`를 제외합니다.

## 2. Render에 연결하기

1. <https://render.com>에 GitHub 계정으로 가입 또는 로그인합니다.
2. **New + → Blueprint**를 선택합니다.
3. 위에서 만든 GitHub 저장소를 연결합니다.
4. 저장소 최상위의 `render.yaml`을 인식시키고 **Apply**를 누릅니다.
5. 요금제는 `Free`인지 확인합니다.

Blueprint 대신 **Web Service**로 만들 경우 Build Command는 `npm ci --omit=dev && npm test`, Start Command는 `npm start`, Health Check Path는 `/api/health`로 설정합니다.

## 3. API 키 등록하기

Render 서비스의 **Environment**에서 다음 값을 Secret으로 등록합니다.

- `OPEN_DART_API_KEY`: DART 인증키
- `DATA_GO_KR_SERVICE_KEY`: 금융위원회 API에 사용하는 공공데이터포털 일반 인증키(Decoding 키 권장)
- `KRX_AUTH_KEY`: KRX OPEN API 인증키
- `ECOS_API_KEY`: 한국은행 ECOS 인증키
- `KOREA_EXIM_API_KEY`: 한국수출입은행 Open API 인증키
- `FRED_API_KEY`: 미국 세인트루이스 연은 FRED 인증키

키는 GitHub 파일, README, 화면 또는 채팅에 붙여 넣지 않습니다. `CACHE_TTL_MINUTES=360`, `RATE_LIMIT_PER_MINUTE=60`은 `render.yaml`에 기본값이 들어 있습니다.

## 4. 공개 링크 확인하기

배포가 끝나면 Render가 `https://서비스이름.onrender.com` 형태의 주소를 만듭니다.

1. `/api/health`에서 `ok: true`와 여섯 데이터 소스의 `Configured: true`를 확인합니다.
2. 메인 화면에서 기업 검색, 분석, 업종 목록, CSV 다운로드를 각각 한 번 확인합니다.
3. 휴대전화에서 표 가로 스크롤, 검색, 그래프 툴팁을 점검합니다.
4. 확인한 주소를 패들렛에 공유합니다.

## CMD 없이 앱처럼 실행하기

공개 URL 배포가 끝나면 로컬 서버와 `START_LOCAL.cmd`는 더 이상 필요하지 않습니다.

1. Chrome 또는 Edge에서 배포된 FinScope 주소를 엽니다.
2. 상단의 **앱으로 설치** 버튼을 누릅니다. 버튼이 보이지 않으면 브라우저 주소창 오른쪽의 설치 아이콘을 누릅니다.
3. 설치를 승인하면 바탕화면과 시작 메뉴에 **FinScope**가 등록됩니다.
4. 이후에는 FinScope 아이콘만 눌러 실행합니다. PC를 재부팅해도 CMD나 Node.js를 실행할 필요가 없습니다.

앱 화면 자체는 설치되지만 최신 금융 데이터 조회에는 인터넷 연결이 필요합니다. 서버 또는 인터넷 연결이 끊긴 경우에는 전용 오프라인 안내 화면이 표시됩니다.

## 운영 전 확인

- 현재 메모리 캐시는 무료 서버가 재시작되면 초기화됩니다. 교육용·소규모 공유에는 적합하지만 이용자가 늘면 Redis 같은 영속 캐시가 필요합니다.
- Render 무료 작업공간에는 월 750시간의 무료 인스턴스 시간이 제공됩니다. 결제수단을 등록하지 않은 상태에서 무료 한도를 넘으면 추가 결제 대신 서비스가 해당 기간 정지될 수 있습니다.
- 사용자별 분당 60회 API 요청 제한이 적용됩니다.
- 공개·상업 이용 전에는 KRX, DART 및 공공데이터포털 각 데이터의 이용·재배포 조건을 다시 확인해야 합니다.
- 이 서비스는 투자 권유가 아닌 교육·정보 제공용이며, 결과 화면의 기준일과 원문 공시를 함께 확인해야 합니다.

## 이미 만든 Render 사이트 수정하기

현재 Render 서비스와 연결된 **같은 GitHub 저장소**의 파일을 이번 수정본으로 교체하면 됩니다.

1. GitHub 저장소에서 **Add file → Upload files**를 누릅니다.
2. 이 폴더 안의 파일과 폴더를 모두 끌어다 놓습니다. `public`, `data`, `scripts` 폴더도 포함하고, `.env`는 올리지 않습니다.
3. 화면 아래 **Commit changes**를 눌러 `main` 브랜치에 반영합니다.
4. Render의 `investment-screener` 서비스에서 **Deploys**를 엽니다.
5. 자동 배포가 켜져 있으면 새 배포가 시작됩니다. 시작되지 않으면 **Manual Deploy → Deploy latest commit**을 누릅니다.
6. 상태가 **Live**가 되면 기존 공개 주소를 새로고침합니다. 주소와 API 환경변수는 바뀌지 않습니다.

화면에 이전 디자인이 남아 있으면 브라우저에서 `Ctrl+F5`로 강력 새로고침합니다. 배포 실패 시 Render의 **Logs**에서 첫 번째 오류 메시지를 확인합니다.
