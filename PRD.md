# OneDay - 개인 생산성 향상 앱

## � 제작 배경

> "생각이 너무 많아서 아무것도 못 하는 날이 반복됐다."

하루에 해야 할 일이 머릿속에 너무 많이 쌓이면, 오히려 아무것도 시작하지 못하는 경험을 반복했습니다. 그래서 **하루에 딱 3개, 최소 1개만 실천해보자**는 생각에서 이 앱을 만들었습니다.

### 기능을 추가한 이유

**AI 우선순위 추천 기능**
막상 3개를 정해놓아도 어떤 걸 먼저 해야 할지 잘못 선택하는 경우가 많았습니다. 내 상황을 말해주면 AI가 순서를 잡아주는 기능이 있으면 좋겠다고 생각했고, Copilot SDK를 활용해 구현했습니다.

**히스토리 기능**
오늘 잘 실천했는지를 눈으로 확인하고 싶었습니다. 며칠을 연속으로 달성했는지, 패턴이 어떤지를 보면 스스로 동기부여가 된다는 걸 알았기 때문입니다.

---

## �📱 프로젝트 개요

**오늘 딱 이것만 투두 & AI 회고**

개인의 일일 생산성을 향상시키는 미니멀한 앱입니다.

- 아침: 오늘의 투두 1~3개 입력 + 우선순위 AI 추천
- 저녁 3시 이후: 회고 작성 + AI 분석 & 응원 메시지
- 매일: 연속 달성 추적 + 히스토리 조회

---

## ✨ 핵심 기능

### 1. 투두 관리

- ✅ 하루 최대 3개 투두 등록
- ✅ 완료 체크박스
- ✅ 투두별 우선순위 선택 (1~3순위)
- ✅ 투두 수정 (모달)

### 2. AI 우선순위 추천

- 투두 2개 이상일 때 활성화
- Copilot SDK (Semantic Kernel) + Azure OpenAI
- 규칙 기반 폴백 (AI 미설정 시)
- **AI 환각 경고 표시**

### 3. 저녁 회고 & 분석 (오후 3시 이후)

- 📝 회고 작성 (자유로운 기록)
- 🤖 AI 분석 (감정 키워드 감지)
  - "힘들/피곤" → 공감 메시지
  - "좋음/뿌듯" → 응원 메시지
  - 기본 → 기본 메시지
- **AI 조언 환각 경고 표시**

### 4. 히스토리 & 연속 달성 추적

- 📊 일일 기록 조회 (투두/회고 상태)
- 🔥 연속 달성 일수 (완전 달성 = 투두 완료 + 회고 작성)
- 🎯 연속 달성 시 AI 추천 메시지

### 5. 시간 게이트 (오후 3시)

- URL 파라미터로 빠른 테스트: `?force_pm=true`
- 로컬스토리지 자동 저장
- 환경변수 `FORCE_AFTER_THREE_PM` 지원

---

## 🛠 기술 스택

### 백엔드

- **Python 3.11+** with Flask 3.0.3
- **SQLite** (경량 로컬 DB)
- **Copilot SDK**: `semantic-kernel>=0.9.0b1`
- **Azure OpenAI SDK**: `openai==1.51.2` (옵션)
- **Gunicorn 22.0.0** (프로덕션 WSGI)

### 프론트엔드

- HTML / CSS / Vanilla JavaScript
- localStorage 활용 (UI 상태 저장)
- 반응형 디자인 (모바일 친화)

### 배포

- **Azure App Service** (프로덕션)
- **Python 3.11 런타임**
- **Gunicorn** 진입점

---

## 📂 파일 구조

```
OneDay/
├── app.py                    # Flask REST API 서버 (270줄)
├── database.py               # SQLite ORM 계층 (680줄)
├── ai_service.py             # Copilot SDK 통합 (180줄+)
├── requirements.txt          # Python 의존성
├── Procfile                  # Azure 배포 진입점
├── .env.example              # 환경변수 템플릿
├── README.md                 # 배포 및 설정 가이드
├── static/
│   ├── index.html            # 메인 앱 페이지
│   ├── history.html          # 히스토리 목록
│   ├── history-detail.html   # 일일 상세 기록
│   ├── app.js                # 메인 로직 (800줄+)
│   └── style.css             # 모든 스타일
└── .github/
    └── copilot-instructions.md  # 개발 가이드
```

---

## 🔌 REST API 설계

| 메서드   | 엔드포인트                 | 설명                 |
| -------- | -------------------------- | -------------------- |
| `GET`    | `/api/health`              | 서버 헬스체크        |
| `GET`    | `/api/todos`               | 오늘 투두 조회       |
| `POST`   | `/api/todos`               | 투두 추가 (최대 3개) |
| `PATCH`  | `/api/todos/<id>`          | 투두 완료 토글       |
| `DELETE` | `/api/todos/<id>`          | 투두 삭제            |
| `POST`   | `/api/advice`              | AI 우선순위 추천     |
| `GET`    | `/api/retrospective/today` | 오늘 회고 조회       |
| `POST`   | `/api/retrospective`       | 회고 저장 & AI 분석  |
| `GET`    | `/api/history`             | 지난 기록 목록       |
| `GET`    | `/api/history/<day>`       | 일일 상세 기록       |

**보안:**

- SQL 인젝션 방어: 모든 쿼리에 parameter binding (?) 사용
- XSS 방어: 모든 DOM 업데이트에 `textContent` 사용
- 날짜 검증: `_safe_day_key()` (YYYY-MM-DD 형식 검증)

---

## 🚀 배포 준비 완료

### 사전 설정

1. `.env.example` → `.env` 복사
2. Azure OpenAI 값 입력:
   ```env
   AZURE_OPENAI_ENDPOINT=...
   AZURE_OPENAI_API_KEY=...
   AZURE_OPENAI_DEPLOYMENT=...
   ```
3. 옵션: CORS, FORCE_AFTER_THREE_PM 설정

### Azure App Service 배포

> ✅ **배포 완료**: [https://onedaygj0620.azurewebsites.net](https://onedaygj0620.azurewebsites.net)

```bash
# 1. 리소스 생성
az group create -n oneday-rg -l koreacentral
az appservice plan create -g oneday-rg -n oneday-plan --sku B1 --is-linux
az webapp create -g oneday-rg -p oneday-plan -n <APP_NAME> --runtime "PYTHON|3.11"

# 2. 설정
az webapp config appsettings set -g oneday-rg -n <APP_NAME> \
  --settings SCM_DO_BUILD_DURING_DEPLOYMENT=true

# 3. zip 배포
zip -r /tmp/oneday.zip . -x '.git/*' '.venv/*' '__pycache__/*' '*.pyc' 'oneday.db'
az webapp deploy -g oneday-rg -n <APP_NAME> --src-path /tmp/oneday.zip --type zip

# 4. OpenAI 키 설정
az webapp config appsettings set -g oneday-rg -n <APP_NAME> \
  --settings AZURE_OPENAI_ENDPOINT="..." AZURE_OPENAI_API_KEY="..." AZURE_OPENAI_DEPLOYMENT="..."
```

---

## 📊 데이터 모델

### todos 테이블

```sql
id, day_key, content, completed, priority_rank
```

### retrospectives 테이블

```sql
day_key, content, analysis, cheer_message
```

### 연속 달성 계산

- 첫 번째 완전 달성 날짜부터 시작
- 일일 기준: 투두 전체 완료 + 회고 작성

---

## 🎨 UI/UX 특징

### 명확한 상태 표시

- ✅ 비활성화 버튼: 회색 (`#c5c5c5`)
- ✅ 활성화 버튼: 초록색 (`#0f8a78`)
- ✅ 로딩 상태: 스켈레톤 UI + 스피너

### 보안 경고

- "AI 응답은 부정확할 수 있어요. 중요한 결정 전에는 직접 한 번 더 확인해 주세요."
- "AI 조언은 참고용이며, 사실과 다를 수 있습니다."

### 빠른 설정

- URL 파라미터: `?force_pm=true` (시간 게이트)
- URL 파라미터: `?api_base=https://...` (API 주소)
- 로컬스토리지에 자동 저장

---

## ✅ 완료 사항

- ✅ 투두 CRUD
- ✅ 우선순위 선택 (localStorage 저장)
- ✅ AI 우선순위 추천 + 폴백 + 입력 문구에 따른 순위 변경
- ✅ 우선순위 추천 전후 비교 애니메이션
- ✅ 회고 작성 & 저장
- ✅ AI 감정 분석 (키워드 감지)
- ✅ 히스토리 & 연속 달성 추적
- ✅ 시간 게이트 (오후 3시)
- ✅ SQL 인젝션 방어
- ✅ XSS 방어
- ✅ 환경변수 설정
- ✅ Copilot SDK (Semantic Kernel) 통합
- ✅ Azure App Service 배포 완료 (onedaygj0620.azurewebsites.net)
- ✅ 모든 보안 경고 표시
- ✅ 비활성화 버튼 스타일 개선
- ✅ AI 사용 여부 출처 표시 ("AI가 분석한 추천이에요." / "기본 추천")

---

## 📝 코딩 규칙

- 모든 주석 & 에러메시지: **한국어**
- 코드 스타일: 간결하고 기능 우선
- 데이터베이스: parameter binding으로 100% SQL 인젝션 방어
- DOM 업데이트: textContent만 사용 (XSS 방어)
- 환경변수: 모든 설정값을 env 기반으로 관리
