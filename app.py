from typing import Any

from flask import Flask, jsonify, request
from flask_cors import CORS

from ai_service import analyze_retrospective
from database import (
    add_todo,
    count_todos,
    get_today_retrospective,
    get_todo,
    get_todos,
    init_db,
    save_retrospective,
    update_todo,
)

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": ["http://localhost:3000"]}})


# 앱 시작 시 DB를 초기화합니다.
init_db()


def _safe_text(value: Any, max_len: int) -> str:
    text = str(value or "").strip()
    if not text:
        raise ValueError("내용을 입력해 주세요.")
    if len(text) > max_len:
        raise ValueError(f"입력 길이는 최대 {max_len}자까지 가능합니다.")
    return text


@app.get("/api/health")
def health() -> Any:
    return jsonify({"message": "서버가 정상 동작 중입니다."})


@app.get("/api/todos")
def list_todos() -> Any:
    return jsonify({"todos": get_todos()})


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
        completed = payload.get("completed")

        if completed is None:
            completed = not existing["completed"]
        else:
            completed = bool(completed)

        updated = update_todo(todo_id, completed)
        return jsonify(updated)
    except Exception:
        return jsonify({"error": "투두 수정 중 오류가 발생했습니다."}), 500


@app.post("/api/retrospective")
def create_retrospective() -> Any:
    try:
        payload = request.get_json(silent=True) or {}
        content = _safe_text(payload.get("content"), 2000)

        todos = get_todos()
        ai_result = analyze_retrospective(content, todos)

        saved = save_retrospective(
            content=content,
            analysis=ai_result["analysis"],
            cheer_message=ai_result["cheer_message"],
        )
        return jsonify(saved), 201
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except Exception:
        return jsonify({"error": "회고 분석 중 오류가 발생했습니다."}), 500


@app.get("/api/retrospective/today")
def get_retrospective_today() -> Any:
    retrospective = get_today_retrospective()
    if retrospective is None:
        return jsonify({"message": "아직 오늘 회고가 없습니다."}), 404
    return jsonify(retrospective)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080, debug=True)
