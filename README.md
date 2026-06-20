# OneDay
개인 생산성 향상 앱 - 오늘 딱 이것만 투두 & AI 회고

## 실행 방법

### 1) 백엔드 (Flask, 8080)
```bash
cd /home/runner/work/OneDay/OneDay/backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Azure OpenAI 사용 시 환경변수:
- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_DEPLOYMENT`
- (선택) `AZURE_OPENAI_API_VERSION`

### 2) 프론트엔드 (정적 서버, 3000)
```bash
cd /home/runner/work/OneDay/OneDay/frontend
python -m http.server 3000
```

브라우저에서 `http://localhost:3000` 접속.
