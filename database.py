import sqlite3
from datetime import date
from pathlib import Path
from typing import Optional

DB_PATH = Path(__file__).parent / "oneday.db"


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def today_key() -> str:
    return date.today().isoformat()


def init_db() -> None:
    with _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS todos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                day_key TEXT NOT NULL,
                content TEXT NOT NULL,
                completed INTEGER NOT NULL DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS retrospectives (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                day_key TEXT NOT NULL UNIQUE,
                content TEXT NOT NULL,
                analysis TEXT NOT NULL,
                cheer_message TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS carryover_decisions (
                day_key TEXT PRIMARY KEY,
                decision TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS streak_recommendations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                streak_days INTEGER NOT NULL,
                recommendation_text TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.commit()


def get_todos() -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT id, content, completed, created_at
            FROM todos
            WHERE day_key = ?
            ORDER BY id ASC
            """,
            (today_key(),),
        ).fetchall()
    return [
        {
            "id": row["id"],
            "content": row["content"],
            "completed": bool(row["completed"]),
            "created_at": row["created_at"],
        }
        for row in rows
    ]


def count_todos() -> int:
    with _connect() as conn:
        row = conn.execute(
            "SELECT COUNT(*) AS count FROM todos WHERE day_key = ?", (today_key(),)
        ).fetchone()
    return int(row["count"])


def add_todo(content: str) -> dict:
    with _connect() as conn:
        cursor = conn.execute(
            "INSERT INTO todos(day_key, content, completed) VALUES (?, ?, 0)",
            (today_key(), content),
        )
        conn.commit()
        todo_id = cursor.lastrowid

        row = conn.execute(
            "SELECT id, content, completed, created_at FROM todos WHERE id = ?",
            (todo_id,),
        ).fetchone()

    return {
        "id": row["id"],
        "content": row["content"],
        "completed": bool(row["completed"]),
        "created_at": row["created_at"],
    }


def get_todo(todo_id: int) -> Optional[dict]:
    with _connect() as conn:
        row = conn.execute(
            """
            SELECT id, content, completed, created_at
            FROM todos
            WHERE id = ? AND day_key = ?
            """,
            (todo_id, today_key()),
        ).fetchone()

    if row is None:
        return None

    return {
        "id": row["id"],
        "content": row["content"],
        "completed": bool(row["completed"]),
        "created_at": row["created_at"],
    }


def update_todo(todo_id: int, completed: bool) -> Optional[dict]:
    with _connect() as conn:
        conn.execute(
            "UPDATE todos SET completed = ? WHERE id = ? AND day_key = ?",
            (1 if completed else 0, todo_id, today_key()),
        )
        conn.commit()

    return get_todo(todo_id)


def update_todo_content(todo_id: int, content: str) -> Optional[dict]:
    with _connect() as conn:
        conn.execute(
            "UPDATE todos SET content = ? WHERE id = ? AND day_key = ?",
            (content, todo_id, today_key()),
        )
        conn.commit()

    return get_todo(todo_id)


def save_streak_recommendation(streak_days: int, recommendation_text: str) -> dict:
    """연속 달성 추천을 저장합니다."""
    with _connect() as conn:
        cursor = conn.execute(
            """
            INSERT INTO streak_recommendations(streak_days, recommendation_text)
            VALUES (?, ?)
            """,
            (streak_days, recommendation_text),
        )
        conn.commit()
        recommendation_id = cursor.lastrowid

        row = conn.execute(
            """
            SELECT id, streak_days, recommendation_text, created_at
            FROM streak_recommendations
            WHERE id = ?
            """,
            (recommendation_id,),
        ).fetchone()

    return {
        "id": row["id"],
        "streak_days": row["streak_days"],
        "recommendation_text": row["recommendation_text"],
        "created_at": row["created_at"],
    }


def get_latest_streak_recommendation() -> Optional[dict]:
    """최신 연속 달성 추천을 조회합니다."""
    with _connect() as conn:
        row = conn.execute(
            """
            SELECT id, streak_days, recommendation_text, created_at
            FROM streak_recommendations
            ORDER BY created_at DESC
            LIMIT 1
            """
        ).fetchone()

    if row is None:
        return None

    return {
        "id": row["id"],
        "streak_days": row["streak_days"],
        "recommendation_text": row["recommendation_text"],
        "created_at": row["created_at"],
    }


def save_retrospective(content: str, analysis: str, cheer_message: str) -> dict:
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO retrospectives(day_key, content, analysis, cheer_message)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(day_key) DO UPDATE SET
                content = excluded.content,
                analysis = excluded.analysis,
                cheer_message = excluded.cheer_message
            """,
            (today_key(), content, analysis, cheer_message),
        )
        conn.commit()

        row = conn.execute(
            """
            SELECT day_key, content, analysis, cheer_message, created_at
            FROM retrospectives
            WHERE day_key = ?
            """,
            (today_key(),),
        ).fetchone()

    return {
        "day_key": row["day_key"],
        "content": row["content"],
        "analysis": row["analysis"],
        "cheer_message": row["cheer_message"],
        "created_at": row["created_at"],
    }


def get_today_retrospective() -> Optional[dict]:
    with _connect() as conn:
        row = conn.execute(
            """
            SELECT day_key, content, analysis, cheer_message, created_at
            FROM retrospectives
            WHERE day_key = ?
            """,
            (today_key(),),
        ).fetchone()

    if row is None:
        return None

    return {
        "day_key": row["day_key"],
        "content": row["content"],
        "analysis": row["analysis"],
        "cheer_message": row["cheer_message"],
        "created_at": row["created_at"],
    }


def _find_latest_previous_day() -> Optional[str]:
    with _connect() as conn:
        row = conn.execute(
            """
            SELECT day_key
            FROM todos
            WHERE day_key < ?
            GROUP BY day_key
            ORDER BY day_key DESC
            LIMIT 1
            """,
            (today_key(),),
        ).fetchone()

    return None if row is None else row["day_key"]


def _get_unfinished_todos(day_key_value: str) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT id, content, completed, created_at
            FROM todos
            WHERE day_key = ? AND completed = 0
            ORDER BY id ASC
            """,
            (day_key_value,),
        ).fetchall()

    return [
        {
            "id": row["id"],
            "content": row["content"],
            "completed": bool(row["completed"]),
            "created_at": row["created_at"],
        }
        for row in rows
    ]


def _get_carryover_decision(day_key_value: str) -> Optional[str]:
    with _connect() as conn:
        row = conn.execute(
            "SELECT decision FROM carryover_decisions WHERE day_key = ?",
            (day_key_value,),
        ).fetchone()

    return None if row is None else row["decision"]


def get_pending_from_yesterday() -> dict:
    previous_day = _find_latest_previous_day()
    if previous_day is None:
        return {
            "has_pending": False,
            "resolved": True,
            "source_day": None,
            "todos": [],
        }

    unfinished = _get_unfinished_todos(previous_day)
    if not unfinished:
        return {
            "has_pending": False,
            "resolved": True,
            "source_day": previous_day,
            "todos": [],
        }

    decision = _get_carryover_decision(today_key())
    return {
        "has_pending": True,
        "resolved": decision is not None,
        "source_day": previous_day,
        "decision": decision,
        "todos": unfinished,
    }


def apply_pending_decision(action: str) -> dict:
    if action not in {"add", "skip"}:
        raise ValueError("잘못된 요청입니다. add 또는 skip만 가능합니다.")

    pending = get_pending_from_yesterday()
    if not pending["has_pending"]:
        return {
            "action": action,
            "added_count": 0,
            "skipped_count": 0,
            "message": "이월할 미완료 항목이 없습니다.",
        }

    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO carryover_decisions(day_key, decision)
            VALUES (?, ?)
            ON CONFLICT(day_key) DO UPDATE SET decision = excluded.decision
            """,
            (today_key(), action),
        )

        added_count = 0
        skipped_count = 0

        if action == "add":
            slots = max(0, 3 - count_todos())
            for todo in pending["todos"]:
                if slots <= 0:
                    skipped_count += 1
                    continue
                conn.execute(
                    "INSERT INTO todos(day_key, content, completed) VALUES (?, ?, 0)",
                    (today_key(), todo["content"]),
                )
                added_count += 1
                slots -= 1
        else:
            skipped_count = len(pending["todos"])

        conn.commit()

    if action == "add":
        message = "미완료 항목을 오늘 할 일에 추가했습니다."
    else:
        message = "미완료 항목을 오늘 할 일에 추가하지 않았습니다."

    return {
        "action": action,
        "added_count": added_count,
        "skipped_count": skipped_count,
        "message": message,
    }


def _list_active_days(limit: int) -> list[str]:
    with _connect() as conn:
        rows = conn.execute(
            """
            WITH all_days AS (
                SELECT day_key FROM todos
                UNION
                SELECT day_key FROM retrospectives
            )
            SELECT day_key
            FROM all_days
            ORDER BY day_key DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

    return [row["day_key"] for row in rows]


def _day_todo_stats(day_key_value: str) -> tuple[int, int]:
    with _connect() as conn:
        row = conn.execute(
            """
            SELECT
                COUNT(*) AS total_count,
                SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS completed_count
            FROM todos
            WHERE day_key = ?
            """,
            (day_key_value,),
        ).fetchone()

    total_count = int(row["total_count"] or 0)
    completed_count = int(row["completed_count"] or 0)
    return total_count, completed_count


def _has_retrospective(day_key_value: str) -> bool:
    with _connect() as conn:
        row = conn.execute(
            "SELECT 1 FROM retrospectives WHERE day_key = ? LIMIT 1",
            (day_key_value,),
        ).fetchone()

    return row is not None


def _compute_streak(days_desc: list[dict]) -> int:
    # 첫 번째 완전 달성인 날부터 시작 (미완료 날은 제외)
    start_idx = -1
    for i, day in enumerate(days_desc):
        if day["achievement"]:
            start_idx = i
            break
    
    if start_idx == -1:
        # 완전 달성한 날이 없으면 0 반환
        return 0
    
    # start_idx부터 연속으로 achievement가 true인 것만 셈
    streak = 0
    for i in range(start_idx, len(days_desc)):
        if days_desc[i]["achievement"]:
            streak += 1
        else:
            break
    
    return streak


def get_history(limit: int = 30) -> dict:
    days = []
    for day_key_value in _list_active_days(limit):
        total_count, completed_count = _day_todo_stats(day_key_value)
        retrospective_written = _has_retrospective(day_key_value)
        todo_achieved = total_count > 0 and completed_count == total_count
        achievement = todo_achieved and retrospective_written

        if achievement:
            icon = "🏆"
            label = "완전 달성"
        elif todo_achieved:
            icon = "✅"
            label = "할 일 완료"
        elif retrospective_written:
            icon = "📝"
            label = "회고만 작성"
        else:
            icon = "⏳"
            label = "진행 중"

        days.append(
            {
                "day_key": day_key_value,
                "todo_total": total_count,
                "todo_completed": completed_count,
                "todo_achieved": todo_achieved,
                "retrospective_written": retrospective_written,
                "achievement": achievement,
                "icon": icon,
                "label": label,
            }
        )

    return {
        "streak_days": _compute_streak(days),
        "days": days,
    }


def get_history_detail(day_key_value: str) -> Optional[dict]:
    with _connect() as conn:
        todo_rows = conn.execute(
            """
            SELECT id, content, completed, created_at
            FROM todos
            WHERE day_key = ?
            ORDER BY id ASC
            """,
            (day_key_value,),
        ).fetchall()

        retrospective_row = conn.execute(
            """
            SELECT day_key, content, analysis, cheer_message, created_at
            FROM retrospectives
            WHERE day_key = ?
            """,
            (day_key_value,),
        ).fetchone()

    todos = [
        {
            "id": row["id"],
            "content": row["content"],
            "completed": bool(row["completed"]),
            "created_at": row["created_at"],
        }
        for row in todo_rows
    ]

    retrospective = None
    if retrospective_row is not None:
        retrospective = {
            "day_key": retrospective_row["day_key"],
            "content": retrospective_row["content"],
            "analysis": retrospective_row["analysis"],
            "cheer_message": retrospective_row["cheer_message"],
            "created_at": retrospective_row["created_at"],
        }

    if not todos and retrospective is None:
        return None

    total_count = len(todos)
    completed_count = sum(1 for todo in todos if todo["completed"])
    todo_achieved = total_count > 0 and completed_count == total_count
    retrospective_written = retrospective is not None
    achievement = todo_achieved and retrospective_written

    return {
        "day_key": day_key_value,
        "todo_total": total_count,
        "todo_completed": completed_count,
        "todo_achieved": todo_achieved,
        "retrospective_written": retrospective_written,
        "achievement": achievement,
        "todos": todos,
        "retrospective": retrospective,
    }
