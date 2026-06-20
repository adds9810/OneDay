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
