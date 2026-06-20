import os
import asyncio
from typing import Any, Optional

try:
    # Copilot SDK: Semantic Kernel + Azure OpenAI 커넥터를 사용합니다.
    from semantic_kernel import Kernel
    from semantic_kernel.connectors.ai.open_ai import (
        AzureChatCompletion,
        AzureChatPromptExecutionSettings,
    )
    from semantic_kernel.contents import ChatHistory
    SEMANTIC_KERNEL_AVAILABLE = True
except Exception:
    SEMANTIC_KERNEL_AVAILABLE = False


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


async def _call_copilot_api_async(system_prompt: str, user_prompt: str) -> Optional[str]:
    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT", "").strip()
    api_key = os.getenv("AZURE_OPENAI_API_KEY", "").strip()
    deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT", "").strip()
    api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-10-21").strip()

    if not endpoint or not api_key or not deployment or not SEMANTIC_KERNEL_AVAILABLE:
        return None

    try:
        # Semantic Kernel을 사용한 Copilot SDK 연동
        kernel = Kernel()
        service_id = "oneday-copilot"

        # Azure OpenAI 서비스를 커널에 추가합니다.
        chat_completion = AzureChatCompletion(
            service_id=service_id,
            deployment_name=deployment,
            endpoint=endpoint,
            api_key=api_key,
            api_version=api_version,
        )
        kernel.add_service(chat_completion)

        chat_history = ChatHistory()
        chat_history.add_system_message(system_prompt)
        chat_history.add_user_message(user_prompt)

        request_settings = AzureChatPromptExecutionSettings(service_id=service_id)
        request_settings.max_tokens = 500
        request_settings.temperature = 0.5

        response = await chat_completion.get_chat_message_content(
            chat_history=chat_history,
            settings=request_settings,
            kernel=kernel,
        )

        content = str(response).strip() if response else None
        return content if content else None
    except Exception:
        return None


def _call_copilot_api(system_prompt: str, user_prompt: str) -> Optional[str]:
    """동기 래퍼: Copilot SDK를 Flask 동기 환경에서 호출합니다."""
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(_call_copilot_api_async(system_prompt, user_prompt))
        return result
    except Exception:
        return None
    finally:
        loop.close()


def generate_afternoon_advice(
    advice_input: str,
    todos: list[dict[str, Any]],
    retrospective_written: bool,
) -> dict[str, str]:
    # 완료/미완료 목록을 분리합니다.
    pending = [t for t in todos if not t.get("completed")]
    completed = [t for t in todos if t.get("completed")]
    total_count = len(todos)
    context = advice_input.strip()

    # 투두 목록을 AI 프롬프트용으로 포맷합니다.
    todo_lines = "\n".join(
        f"- [{'완료' if t.get('completed') else '미완료'}] {t['content']}"
        for t in todos
    )
    retro_state = "작성 완료" if retrospective_written else "미작성"

    def _priority_score(todo_text: str) -> int:
        lower_context = context.lower()
        lower_todo = todo_text.lower()

        score = 0
        if any(keyword in lower_context for keyword in ["마케팅", "marketing"]):
            if any(keyword in lower_todo for keyword in ["마케팅", "strategy", "전략"]):
                score -= 20
        if any(keyword in lower_context for keyword in ["보고서", "report"]):
            if any(keyword in lower_todo for keyword in ["보고서", "report"]):
                score -= 20
        if any(keyword in lower_context for keyword in ["팀미팅", "미팅", "회의", "meeting"]):
            if any(keyword in lower_todo for keyword in ["팀 미팅", "미팅", "회의", "meeting"]):
                score -= 20

        if any(keyword in lower_todo for keyword in ["마케팅", "strategy", "전략"]):
            score += 1
        elif any(keyword in lower_todo for keyword in ["보고서", "report"]):
            score += 2
        elif any(keyword in lower_todo for keyword in ["팀 미팅", "미팅", "회의", "meeting"]):
            score += 3
        else:
            score += 10

        return score

    if total_count >= 2 and pending:
        # 2개 이상 투두가 있을 때 우선순위 추천 모드입니다.
        ai_message = _call_copilot_api(
            system_prompt=(
                "당신은 개인 생산성 코치입니다. "
                "미완료 할 일들의 우선순위를 추천하고 각 항목에 간단한 이유를 붙여 "
                "한국어로 번호 목록 형식으로 답해 주세요. 3~5문장 이내로 간결하게."
            ),
            user_prompt=(
                f"오늘의 할 일 목록:\n{todo_lines}\n\n"
                f"회고 작성 상태: {retro_state}\n"
                + (f"추가 상황: {context}\n" if context else "")
                + "미완료 항목들을 어떤 순서로 처리하면 좋을지 우선순위를 추천해 주세요."
            ),
        )
        if ai_message:
            return {
                "advice": ai_message,
                "source": "copilot",
            }

        # Azure OpenAI 미설정 시 규칙 기반 폴백입니다.
        ordered_pending = sorted(
            pending,
            key=lambda todo: (_priority_score(todo.get("content", "")), todo.get("id", 0)),
        )
        lines = [f"{i + 1}. {t['content']}" for i, t in enumerate(ordered_pending)]
        reason = f"총 {total_count}개 중 {len(pending)}개가 남아 있어요."
        if context:
            reason += f" ({context})"
        return {
            "advice": f"{reason} 추천 순서:\n" + "\n".join(lines) + "\n가장 어려운 것부터 끝내면 나머지가 수월해집니다.",
            "source": "fallback",
        }

    elif total_count == 1:
        # 투두가 1개일 때는 단순 응원 메시지입니다.
        ai_message = _call_copilot_api(
            system_prompt="당신은 생산성 코치입니다. 간결한 응원 한 마디를 한국어로 해주세요.",
            user_prompt=f"할 일: {todos[0]['content']}\n회고 상태: {retro_state}\n짧은 응원 메시지를 주세요.",
        )
        if ai_message:
            return {
                "advice": ai_message,
                "source": "copilot",
            }
        return {
            "advice": f"'{todos[0]['content']}' 하나만 집중해서 끝내 보세요. 작은 완료가 오늘의 승리입니다.",
            "source": "fallback",
        }

    else:
        return {
            "advice": "오늘 할 일을 등록하면 우선순위 추천을 받을 수 있어요.",
            "source": "fallback",
        }


def generate_streak_recommendation(streak_days: int, days: list[dict[str, Any]]) -> str:
    # 연속 달성이 0일 때는 추천 생성하지 않음
    if streak_days == 0:
        return ""
    
    recent_achievement = ["Y" if day.get("achievement") else "N" for day in days[:7]]
    pattern = "-".join(recent_achievement) if recent_achievement else "기록 없음"

    ai_message = _call_copilot_api(
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

    # Azure OpenAI가 없을 때 규칙 기반 메시지 (백업)
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
    return ""
