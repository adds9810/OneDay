import os
import sqlite3
from typing import Any

from flask import Flask, jsonify, request
from flask_cors import CORS
from openai import AzureOpenAI

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "oneday.db")

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000"}})


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS todos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content TEXT NOT NULL,
                completed INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS retrospectives (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content TEXT NOT NULL,
                analysis TEXT,
                cheer_message TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )


def row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    return {k: row[k] for k in row.keys()}


def today_todos(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT id, content, completed, created_at
        FROM todos
        WHERE date(created_at, 'localtime') = date('now', 'localtime')
        ORDER BY id ASC
        """
    ).fetchall()
    return [row_to_dict(r) for r in rows]


def generate_copilot_feedback(retrospective: str, todos: list[dict[str, Any]]) -> dict[str, str]:
    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    api_key = os.getenv("AZURE_OPENAI_API_KEY")
    deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT")

    todo_summary = "\n".join(
        [
            f"- [{'완료' if t['completed'] else '미완료'}] {t['content']}"
            for t in todos
        ]
    ) or "- 오늘 등록된 투두 없음"

    if endpoint and api_key and deployment:
        client = AzureOpenAI(
            azure_endpoint=endpoint,
            api_key=api_key,
            api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-01"),
        )

        response = client.chat.completions.create(
            model=deployment,
            temperature=0.7,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a GitHub Copilot SDK productivity coach. "
                        "Return concise Korean feedback in exactly two sections: "
                        "분석: ... and 응원: ..."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"오늘 투두 현황:\n{todo_summary}\n\n"
                        f"저녁 회고:\n{retrospective}"
                    ),
                },
            ],
        )
        text = (response.choices[0].message.content or "").strip()
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        analysis = next((line.replace("분석:", "").strip() for line in lines if line.startswith("분석:")), "오늘의 실행 패턴을 바탕으로 내일 우선순위를 더 선명히 잡아보세요.")
        cheer = next((line.replace("응원:", "").strip() for line in lines if line.startswith("응원:")), "오늘도 충분히 잘해냈어요. 내일도 한 걸음씩 가봅시다!")
        return {"analysis": analysis, "cheer_message": cheer, "source": "azure-openai"}

    completed = sum(1 for t in todos if t["completed"])
    total = len(todos)
    analysis = f"오늘 완료한 투두는 {completed}/{total}개입니다. 회고에서 언급한 핵심 한 가지를 내일 첫 투두로 설정해 보세요."
    cheer = "지금처럼 하루를 정리하는 습관이 생산성을 꾸준히 끌어올립니다. 정말 잘하고 있어요!"
    return {"analysis": analysis, "cheer_message": cheer, "source": "local-fallback"}


@app.get("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.get("/api/todos")
def get_todos():
    with get_conn() as conn:
        return jsonify(today_todos(conn))


@app.post("/api/todos")
def create_todo():
    payload = request.get_json(silent=True) or {}
    content = (payload.get("content") or "").strip()
    if not content:
        return jsonify({"error": "투두 내용을 입력해 주세요."}), 400

    with get_conn() as conn:
        count = conn.execute(
            """
            SELECT COUNT(*) AS cnt
            FROM todos
            WHERE date(created_at, 'localtime') = date('now', 'localtime')
            """
        ).fetchone()["cnt"]
        if count >= 3:
            return jsonify({"error": "투두는 하루 최대 3개까지 등록할 수 있습니다."}), 400

        cur = conn.execute("INSERT INTO todos (content, completed) VALUES (?, 0)", (content,))
        conn.commit()
        row = conn.execute("SELECT id, content, completed, created_at FROM todos WHERE id = ?", (cur.lastrowid,)).fetchone()
        return jsonify(row_to_dict(row)), 201


@app.patch("/api/todos/<int:todo_id>")
def update_todo(todo_id: int):
    payload = request.get_json(silent=True) or {}
    completed = 1 if bool(payload.get("completed")) else 0

    with get_conn() as conn:
        exists = conn.execute("SELECT id FROM todos WHERE id = ?", (todo_id,)).fetchone()
        if not exists:
            return jsonify({"error": "투두를 찾을 수 없습니다."}), 404

        conn.execute("UPDATE todos SET completed = ? WHERE id = ?", (completed, todo_id))
        conn.commit()
        row = conn.execute("SELECT id, content, completed, created_at FROM todos WHERE id = ?", (todo_id,)).fetchone()
        return jsonify(row_to_dict(row))


@app.get("/api/retrospectives/latest")
def get_latest_retrospective():
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT id, content, analysis, cheer_message, created_at
            FROM retrospectives
            ORDER BY id DESC LIMIT 1
            """
        ).fetchone()
        return jsonify(row_to_dict(row) if row else None)


@app.post("/api/retrospectives")
def save_retrospective():
    payload = request.get_json(silent=True) or {}
    content = (payload.get("content") or "").strip()
    if not content:
        return jsonify({"error": "회고 내용을 입력해 주세요."}), 400

    with get_conn() as conn:
        cur = conn.execute("INSERT INTO retrospectives (content) VALUES (?)", (content,))
        conn.commit()
        row = conn.execute(
            "SELECT id, content, analysis, cheer_message, created_at FROM retrospectives WHERE id = ?",
            (cur.lastrowid,),
        ).fetchone()
        return jsonify(row_to_dict(row)), 201


@app.post("/api/retrospectives/analyze")
def analyze_retrospective():
    payload = request.get_json(silent=True) or {}
    provided = (payload.get("content") or "").strip()

    with get_conn() as conn:
        retrospective_row = None
        if provided:
            cur = conn.execute("INSERT INTO retrospectives (content) VALUES (?)", (provided,))
            retrospective_id = cur.lastrowid
            conn.commit()
            retrospective_row = conn.execute(
                "SELECT id, content FROM retrospectives WHERE id = ?",
                (retrospective_id,),
            ).fetchone()
        else:
            retrospective_row = conn.execute(
                "SELECT id, content FROM retrospectives ORDER BY id DESC LIMIT 1"
            ).fetchone()

        if not retrospective_row:
            return jsonify({"error": "분석할 회고가 없습니다."}), 400

        todos = today_todos(conn)
        feedback = generate_copilot_feedback(retrospective_row["content"], todos)
        conn.execute(
            "UPDATE retrospectives SET analysis = ?, cheer_message = ? WHERE id = ?",
            (feedback["analysis"], feedback["cheer_message"], retrospective_row["id"]),
        )
        conn.commit()

        return jsonify(
            {
                "retrospective_id": retrospective_row["id"],
                "analysis": feedback["analysis"],
                "cheer_message": feedback["cheer_message"],
                "source": feedback["source"],
            }
        )


if __name__ == "__main__":
    init_db()
    debug_mode = os.getenv("FLASK_DEBUG", "").lower() in {"1", "true", "yes"}
    app.run(host="0.0.0.0", port=8080, debug=debug_mode)
else:
    init_db()
