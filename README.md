# OneDay

개인 생산성 향상 앱 - 오늘 딱 이것만 투두 & AI 회고

## 빠른 시작

### 1) 백엔드 실행 (Flask + SQLite)

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

- API 주소: http://localhost:8080
- 헬스체크: http://localhost:8080/api/health

### 2) 프론트엔드 실행 (정적 서버)

새 터미널에서 아래 명령을 실행하세요.

```bash
python3 -m http.server 3000 -d static
```

- 웹 주소: http://localhost:3000
- 히스토리: http://localhost:3000/history.html
- 기록 상세: http://localhost:3000/history-detail.html?day=YYYY-MM-DD

## OpenAI 연결 전 사전 세팅

키보드 사용이 가능해지면 아래 3가지만 입력하면 됩니다.

1. `.env.example` 파일을 복사해 `.env` 생성
2. Azure OpenAI 값 입력 (`AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT`)
3. 서버 재시작

AI 키를 아직 넣지 않아도 앱은 폴백 로직으로 동작합니다.

## 시간 게이트 빠른 설정

회고/AI 패널은 기본적으로 오후 3시 이후에 열립니다. 테스트가 필요하면 아래 방식으로 빠르게 강제할 수 있습니다.

- 백엔드 강제 오픈: `.env`에 `FORCE_AFTER_THREE_PM=true`
- 백엔드 강제 닫기: `.env`에 `FORCE_AFTER_THREE_PM=false`
- 프론트 임시 오픈 URL: `http://localhost:3000/index.html?force_pm=true`
- 프론트 임시 닫기 URL: `http://localhost:3000/index.html?force_pm=false`

URL의 `force_pm` 값은 브라우저에 저장되어 다음 접속에도 유지됩니다.

## 프론트 API 주소 빠른 설정

프론트는 기본적으로 로컬에서 `http://localhost:8080`을 사용합니다.
배포 API를 붙일 때는 아래처럼 한 번 접속하면 주소가 브라우저에 저장됩니다.

- `http://localhost:3000/index.html?api_base=https://<APP_NAME>.azurewebsites.net`
- `https://<FRONTEND_DOMAIN>/index.html?api_base=https://<APP_NAME>.azurewebsites.net`

## Azure 배포 빠른 경로 (App Service)

사전 준비

- Azure CLI 로그인
- 구독 선택

```bash
az login
az account set --subscription "<SUBSCRIPTION_ID_OR_NAME>"
```

리소스 생성 및 배포

```bash
az group create -n oneday-rg -l koreacentral
az appservice plan create -g oneday-rg -n oneday-plan --sku B1 --is-linux
az webapp create -g oneday-rg -p oneday-plan -n <APP_NAME> --runtime "PYTHON|3.11"
az webapp config appsettings set -g oneday-rg -n <APP_NAME> --settings SCM_DO_BUILD_DURING_DEPLOYMENT=true CORS_ORIGINS="https://<FRONTEND_DOMAIN>"
az webapp config set -g oneday-rg -n <APP_NAME> --startup-file "gunicorn app:app --bind 0.0.0.0:$PORT"
az webapp deploy -g oneday-rg -n <APP_NAME> --src-path .
```

배포 후 OpenAI 키 설정

```bash
az webapp config appsettings set -g oneday-rg -n <APP_NAME> --settings \
AZURE_OPENAI_ENDPOINT="https://<RESOURCE>.openai.azure.com/" \
AZURE_OPENAI_API_KEY="<KEY>" \
AZURE_OPENAI_DEPLOYMENT="<DEPLOYMENT_NAME>"
```

검증

- API 헬스체크: `https://<APP_NAME>.azurewebsites.net/api/health`
- 프론트 첫 접속 시 `?api_base=https://<APP_NAME>.azurewebsites.net`를 붙여 저장

## 주요 기능

- 투두 1~3개 등록 및 완료 체크
- 오후 3시 이후 AI 조언 받기
- 오후 3시 이후 저녁 회고 작성
- 어제 미완료 항목을 오늘 할 일에 추가할지 선택
- 히스토리 페이지(아이콘 상태 + 연속 달성 일자)

## API 요약

- `GET /api/todos`
- `POST /api/todos`
- `PATCH /api/todos/<id>`
- `GET /api/todos/pending-from-yesterday`
- `POST /api/todos/pending-decision`
- `POST /api/advice`
- `POST /api/retrospective`
- `GET /api/retrospective/today`
- `GET /api/history`

## 보안/규칙 반영

- CORS 설정 적용 (localhost:3000 -> localhost:8080)
- SQL 파라미터 바인딩으로 SQL 인젝션 방어
- 프론트에서 `textContent` 사용으로 XSS 방어
- `.env`는 `.gitignore`에 포함되어 커밋에서 제외
