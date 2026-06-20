from typing import Any


def analyze_retrospective(retrospective_text: str, todos: list[dict[str, Any]]) -> dict[str, str]:
    # Copilot SDK 연동 전, 로컬 개발용으로 동작하는 기본 분석 로직입니다.
    completed_count = sum(1 for todo in todos if todo.get("completed"))
    total_count = len(todos)

    if total_count == 0:
        progress = "오늘은 아직 등록된 투두가 없어요."
    else:
        progress = f"오늘 투두 {total_count}개 중 {completed_count}개를 완료했어요."

    text = retrospective_text.strip()
    low_text = text.lower()

    if any(keyword in low_text for keyword in ["힘들", "피곤", "지침", "어려"]):
        tone = "오늘 꽤 힘든 하루였네요. 그래도 계속 기록한 것 자체가 큰 성과예요."
    elif any(keyword in low_text for keyword in ["좋", "뿌듯", "성공", "완료"]):
        tone = "좋은 흐름을 잘 만들었어요. 이 리듬을 내일도 이어가 봐요."
    else:
        tone = "하루를 돌아본 점이 아주 좋아요. 작은 개선이 큰 변화를 만듭니다."

    analysis = f"{progress} 회고 핵심: {text[:120]}"
    cheer_message = f"{tone} 내일의 첫 투두 하나만 먼저 정해서 가볍게 시작해봐요."

    return {
        "analysis": analysis,
        "cheer_message": cheer_message,
    }


def generate_afternoon_advice(advice_input: str, todos: list[dict[str, Any]]) -> str:
    completed_count = sum(1 for todo in todos if todo.get("completed"))
    total_count = len(todos)
    remained = max(0, total_count - completed_count)

    topic = advice_input.strip()
    if not topic:
        topic = "집중 유지"

    if remained == 0 and total_count > 0:
        progress = "오늘 할 일을 이미 모두 완료했어요."
        tip = "남은 시간에는 내일을 위한 15분 준비를 해보세요."
    elif total_count == 0:
        progress = "아직 오늘 할 일이 등록되지 않았어요."
        tip = "가장 중요한 일 1개만 먼저 등록해 작은 승리를 만드세요."
    else:
        progress = f"현재 할 일 {total_count}개 중 {completed_count}개를 완료했고, {remained}개가 남았어요."
        tip = "남은 항목을 25분 단위로 쪼개고, 가장 어려운 것부터 시작해 보세요."

    return f"주제: {topic}. {progress} 실행 조언: {tip}"
