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
