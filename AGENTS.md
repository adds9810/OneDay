# AGENTS.md - AI 에이전트 작업 지침

## 프로젝트 개요

개인 생산성 향상 앱 (입코딩 대회 2026)
- 투두리스트 (1~3개) 작성 및 완료 체크
- 저녁 회고 작성
- Copilot SDK + Azure OpenAI로 AI 회고 분석 및 응원 메시지 생성

## 기술 스택

- 백엔드: Python Flask (포트 8080)
- 프론트엔드: HTML, CSS, JavaScript (포트 3000)
- 데이터베이스: SQLite
- AI: GitHub Copilot SDK + Azure OpenAI
- 배포: Azure

## 작업 순서

1. 백엔드 Flask 앱 뼈대 생성 (`app.py`)
2. SQLite DB 모델 정의 (투두, 회고)
3. REST API 엔드포인트 구현
4. 프론트엔드 HTML/CSS/JS 구현
5. Copilot SDK 연동 (회고 분석 기능)
6. Azure 배포 설정

## 코딩 규칙

- 모든 주석은 한국어로 작성
- 에러 메시지도 한국어로 작성
- 코드는 간결하게, 기능 구현 우선
- CORS 설정 필수 (백엔드)
- SQL 인젝션, XSS 방어 필수

## API 설계

- `GET /api/todos` - 투두 목록 조회
- `POST /api/todos` - 투두 추가 (최대 3개 제한)
- `PATCH /api/todos/<id>` - 완료 상태 토글
- `POST /api/retrospective` - 회고 저장 및 AI 분석 요청
- `GET /api/retrospective/today` - 오늘 회고 조회

## 파일 구조

```
OneDay/
├── app.py              # Flask 메인 앱
├── database.py         # SQLite DB 초기화 및 모델
├── ai_service.py       # Copilot SDK 연동
├── requirements.txt    # Python 의존성
├── static/
│   ├── index.html
│   ├── style.css
│   └── app.js
└── .github/
    └── copilot-instructions.md
```

## 주의사항

- 투두는 하루 최대 3개로 제한
- AI 응답 실패 시 사용자에게 한국어 에러 메시지 표시
- Azure OpenAI API 키는 환경변수로 관리 (`.env`)
- `.env` 파일은 절대 커밋하지 않음
