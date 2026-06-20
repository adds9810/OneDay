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
