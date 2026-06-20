import os
from typing import Any, Optional

try:
    # Azure OpenAI SDK 사용 가능 여부를 런타임에 확인합니다.
    from openai import AzureOpenAI
except Exception:
    AzureOpenAI = None


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


def _call_azure_openai(system_prompt: str, user_prompt: str) -> Optional[str]:
    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT", "").strip()
    api_key = os.getenv("AZURE_OPENAI_API_KEY", "").strip()
    deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT", "").strip()

    if not endpoint or not api_key or not deployment or AzureOpenAI is None:
        return None

    try:
        client = AzureOpenAI(
            api_key=api_key,
            api_version="2024-02-15-preview",
            azure_endpoint=endpoint,
        )

        response = client.chat.completions.create(
            model=deployment,
            temperature=0.5,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )

        content = response.choices[0].message.content if response.choices else None
        return (content or "").strip() or None
    except Exception:
        return None


def generate_afternoon_advice(
    advice_input: str,
    todos: list[dict[str, Any]],
    retrospective_written: bool,
) -> str:
    completed_count = sum(1 for todo in todos if todo.get("completed"))
    total_count = len(todos)
    remained = max(0, total_count - completed_count)
    completion_rate = 0 if total_count == 0 else int((completed_count / total_count) * 100)

    topic = advice_input.strip()
    if not topic:
        topic = "집중 유지"

    retrospective_state = "작성됨" if retrospective_written else "미작성"

    ai_message = _call_azure_openai(
        system_prompt=(
            "당신은 개인 생산성 코치입니다. "
            "한국어로 간결하고 실행 가능한 조언을 2~4문장으로 제공합니다."
        ),
        user_prompt=(
            f"주제: {topic}\n"
            f"오늘 투두: 총 {total_count}개, 완료 {completed_count}개, 달성률 {completion_rate}%\n"
            f"회고 작성 상태: {retrospective_state}\n"
            "투두 달성 상태와 회고 작성 여부를 함께 고려해서 "
            "지금 바로 실행할 우선순위 조언을 제시해 주세요."
        ),
    )

    if ai_message:
        return ai_message

    if remained == 0 and total_count > 0:
        if retrospective_written:
            progress = "오늘 할 일과 회고까지 모두 마친 상태예요."
            tip = "내일 목표 1개를 미리 적고, 10분 정리 루틴으로 마무리해 보세요."
        else:
            progress = "할 일은 모두 완료했지만 회고가 아직 비어 있어요."
            tip = "지금 3줄 회고를 먼저 작성하면 내일 집중력이 더 빨라집니다."
    elif total_count == 0:
        progress = "아직 오늘 할 일이 등록되지 않았어요."
        tip = "가장 중요한 일 1개만 먼저 등록해 작은 승리를 만드세요."
    else:
        if retrospective_written:
            progress = (
                f"현재 할 일 {total_count}개 중 {completed_count}개를 완료했고, "
                f"회고는 이미 작성했어요."
            )
            tip = "남은 항목은 난이도 높은 것 1개만 먼저 끝내고 나머지는 내일로 정리해 보세요."
        else:
            progress = (
                f"현재 할 일 {total_count}개 중 {completed_count}개를 완료했고, "
                f"회고는 아직 미작성 상태예요."
            )
            tip = "남은 항목을 25분 단위로 쪼개고, 완료 후 바로 회고 3줄을 적어 마무리하세요."

    return f"주제: {topic}. {progress} 실행 조언: {tip}"


def generate_streak_recommendation(streak_days: int, days: list[dict[str, Any]]) -> str:
    recent_achievement = ["Y" if day.get("achievement") else "N" for day in days[:7]]
    pattern = "-".join(recent_achievement) if recent_achievement else "기록 없음"

    ai_message = _call_azure_openai(
        system_prompt=(
            "당신은 생산성 코치입니다. "
            "연속 달성 일수를 바탕으로 동기부여와 실행 팁을 한국어 2~3문장으로 제시하세요."
        ),
        user_prompt=(
            f"현재 연속 달성 일수: {streak_days}일\n"
            f"최근 7일 달성 패턴(Y=달성,N=미달성): {pattern}\n"
            "사용자가 AI를 어떻게 활용하면 연속 달성을 늘릴 수 있는지 추천해 주세요."
        ),
    )

    if ai_message:
        return ai_message

    if streak_days >= 7:
        return (
            "훌륭해요! 지금은 연속 달성 루틴이 안정적입니다. "
            "AI 조언에서 매일 아침 우선순위 1개만 먼저 뽑아 기록하면 흐름을 더 오래 유지할 수 있어요."
        )
    if streak_days >= 3:
        return (
            "좋은 흐름이 이어지고 있어요. "
            "AI 조언 요청 시 '남은 일 중 가장 중요한 1개'를 물어보면 연속 달성을 더 쉽게 늘릴 수 있습니다."
        )
    if streak_days >= 1:
        return (
            "연속 달성을 시작했어요. "
            "오늘은 투두 1개를 먼저 완료하고, 회고 3줄을 남기도록 AI 조언을 활용해 보세요."
        )
    return (
        "아직 연속 달성이 시작되지 않았습니다. "
        "AI 조언에서 '오늘 반드시 끝낼 1개'를 먼저 정하면 첫 연속 달성을 만들기 쉬워져요."
    )
