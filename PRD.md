# OneDay PRD

## 제품 개요
OneDay는 개인 생산성 향상을 위한 웹앱이다. 사용자는 하루 1~3개의 핵심 투두를 등록하고 완료 체크를 하며, 저녁 회고를 작성하고 AI 분석/응원 메시지를 받을 수 있다.

## 시스템 구성
- 백엔드: Python Flask (`localhost:8080`)
- 프론트엔드: HTML/CSS/JavaScript (`localhost:3000`)
- 데이터베이스: SQLite
- AI: Copilot SDK 스타일 프롬프트 + Azure OpenAI 연동

## 핵심 기능
1. 투두 등록/조회/완료 체크
   - 하루 최대 3개 등록
   - 완료 체크 상태 변경 가능
2. 저녁 회고 작성
   - 텍스트 저장
3. AI 회고 분석 및 응원 메시지 생성
   - Azure OpenAI 설정 시 LLM 분석
   - 미설정 시 로컬 fallback 분석
4. CORS 설정
   - `http://localhost:3000`에서 백엔드 API 호출 허용

## API 요약
- `GET /api/todos`
- `POST /api/todos`
- `PATCH /api/todos/{id}`
- `POST /api/retrospectives`
- `GET /api/retrospectives/latest`
- `POST /api/retrospectives/analyze`
