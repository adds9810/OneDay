import os
from typing import Any
from datetime import datetime

from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv

from ai_service import (
    analyze_retrospective,
    generate_afternoon_advice,
    generate_streak_recommendation,
)
from database import (
    add_todo,
    apply_pending_decision,
    count_todos,
    get_history,
    get_history_detail,
    get_latest_streak_recommendation,
    get_pending_from_yesterday,
    get_today_retrospective,
    get_todo,
    get_todos,
    init_db,
    save_retrospective,
    save_streak_recommendation,
    update_todo,
    update_todo_content,
)

# .env 파일의 환경변수를 로드합니다.
load_dotenv()

app = Flask(__name__)


def _parse_cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", "http://localhost:3000")
    origins = [origin.strip() for origin in raw.split(",") if origin.strip()]
    return origins if origins else ["http://localhost:3000"]


CORS(app, resources={r"/api/*": {"origins": _parse_cors_origins()}})


# 앱 시작 시 DB를 초기화합니다.
init_db()


def _safe_text(value: Any, max_len: int) -> str:
    text = str(value or "").strip()
    if not text:
        raise ValueError("내용을 입력해 주세요.")
    if len(text) > max_len:
        raise ValueError(f"입력 길이는 최대 {max_len}자까지 가능합니다.")
    return text


def _after_three_pm() -> bool:
    forced = os.getenv("FORCE_AFTER_THREE_PM", "").strip().lower()
    if forced in {"1", "true", "yes", "on"}:
        return True
    if forced in {"0", "false", "no", "off"}:
        return False
    return datetime.now().hour >= 15


def _safe_day_key(value: str) -> str:
    text = str(value or "").strip()
    try:
        datetime.strptime(text, "%Y-%m-%d")
    except ValueError as error:
        raise ValueError("날짜 형식이 올바르지 않습니다. YYYY-MM-DD 형식으로 요청해 주세요.") from error
    return text


@app.get("/api/health")
def health() -> Any:
    return jsonify({"message": "서버가 정상 동작 중입니다."})


@app.get("/api/todos")
def list_todos() -> Any:
    return jsonify({"todos": get_todos()})


@app.get("/api/todos/pending-from-yesterday")
def pending_from_yesterday() -> Any:
    return jsonify(get_pending_from_yesterday())


@app.post("/api/todos/pending-decision")
def pending_decision() -> Any:
    try:
        payload = request.get_json(silent=True) or {}
        action = str(payload.get("action") or "").strip()
        result = apply_pending_decision(action)
        return jsonify(result)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except Exception:
        return jsonify({"error": "이월 항목 처리 중 오류가 발생했습니다."}), 500


@app.post("/api/todos")
def create_todo() -> Any:
    try:
        if count_todos() >= 3:
            return jsonify({"error": "투두는 하루 최대 3개까지 등록할 수 있습니다."}), 400

        payload = request.get_json(silent=True) or {}
        content = _safe_text(payload.get("content"), 120)
        todo = add_todo(content)
        return jsonify(todo), 201
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except Exception:
        return jsonify({"error": "투두 등록 중 오류가 발생했습니다."}), 500


@app.patch("/api/todos/<int:todo_id>")
def patch_todo(todo_id: int) -> Any:
    try:
        existing = get_todo(todo_id)
        if existing is None:
            return jsonify({"error": "해당 투두를 찾을 수 없습니다."}), 404

        payload = request.get_json(silent=True) or {}
        updated = existing

        if "content" in payload:
            content = _safe_text(payload.get("content"), 120)
            updated = update_todo_content(todo_id, content)
            if updated is None:
                return jsonify({"error": "해당 투두를 찾을 수 없습니다."}), 404

        if "completed" in payload:
            completed = bool(payload.get("completed"))
            updated = update_todo(todo_id, completed)
        elif "content" not in payload:
            # 기존 동작을 유지하기 위해 값이 없으면 완료 상태를 토글합니다.
            completed = not existing["completed"]
            updated = update_todo(todo_id, completed)

        return jsonify(updated)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except Exception:
        return jsonify({"error": "투두 수정 중 오류가 발생했습니다."}), 500


@app.post("/api/retrospective")
def create_retrospective() -> Any:
    try:
        if not _after_three_pm():
            return jsonify({"error": "회고는 오후 3시 이후에 작성할 수 있습니다."}), 400

        if count_todos() < 1:
            return jsonify({"error": "회고 전 오늘의 투두를 최소 1개 등록해 주세요."}), 400

        payload = request.get_json(silent=True) or {}
        content = _safe_text(payload.get("content"), 2000)
        regenerate_ai = bool(payload.get("regenerate_ai", False))

        existing = get_today_retrospective()
        should_refresh_ai = existing is None or regenerate_ai

        if should_refresh_ai:
            todos = get_todos()
            ai_result = analyze_retrospective(content, todos)
        else:
            # 회고 본문만 수정할 때는 기존 분석/응원 메시지를 유지합니다.
            ai_result = {
                "analysis": existing["analysis"],
                "cheer_message": existing["cheer_message"],
            }

        saved = save_retrospective(
            content=content,
            analysis=ai_result["analysis"],
            cheer_message=ai_result["cheer_message"],
        )
        saved["ai_refreshed"] = should_refresh_ai
        return jsonify(saved), 201
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except Exception:
        return jsonify({"error": "회고 분석 중 오류가 발생했습니다."}), 500


@app.post("/api/advice")
def afternoon_advice() -> Any:
    try:
        todos = get_todos()
        if len(todos) < 2:
            return jsonify({"error": "우선순위 추천은 할 일을 2개 이상 등록해야 받을 수 있습니다."}), 400

        payload = request.get_json(silent=True) or {}
        # 상황 메모는 선택 사항이므로 빈 값도 허용합니다.
        context = str(payload.get("content") or "").strip()[:200]

        retrospective_written = get_today_retrospective() is not None
        advice = generate_afternoon_advice(context, todos, retrospective_written)
        return jsonify({"advice": advice})
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except Exception:
        return jsonify({"error": "AI 조언 생성 중 오류가 발생했습니다."}), 500


@app.get("/api/retrospective/today")
def get_retrospective_today() -> Any:
    retrospective = get_today_retrospective()
    if retrospective is None:
        return jsonify({"message": "아직 오늘 회고가 없습니다."}), 404
    return jsonify(retrospective)


@app.get("/api/history")
def history() -> Any:
    try:
        history_data = get_history(limit=60)
        streak_days = history_data.get("streak_days", 0)
        
        # 캐시된 추천이 있는지 확인
        cached = get_latest_streak_recommendation()
        if cached and cached["streak_days"] == streak_days:
            # 같은 연속 달성 일수의 추천이 있으면 사용
            history_data["streak_ai_recommendation"] = cached["recommendation_text"]
        elif streak_days > 0:
            # 없으면 AI에게 새로 요청
            recommendation = generate_streak_recommendation(
                streak_days,
                history_data.get("days", []),
            )
            if recommendation:
                # AI 응답을 저장
                save_streak_recommendation(streak_days, recommendation)
                history_data["streak_ai_recommendation"] = recommendation
        else:
            history_data["streak_ai_recommendation"] = None
        
        return jsonify(history_data)
    except Exception:
        return jsonify({"error": "히스토리 조회 중 오류가 발생했습니다."}), 500


@app.get("/api/history/<string:day_key_value>")
def history_detail(day_key_value: str) -> Any:
    try:
        safe_day_key = _safe_day_key(day_key_value)
        detail = get_history_detail(safe_day_key)
        if detail is None:
            return jsonify({"error": "해당 날짜의 기록을 찾을 수 없습니다."}), 404
        return jsonify(detail)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except Exception:
        return jsonify({"error": "히스토리 상세 조회 중 오류가 발생했습니다."}), 500


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8080"))
    debug = os.getenv("FLASK_DEBUG", "true").strip().lower() in {"1", "true", "yes", "on"}
    app.run(host="0.0.0.0", port=port, debug=debug)
