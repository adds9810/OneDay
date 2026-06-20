const API_BASE = "http://localhost:8080";

const streakBox = document.querySelector("#streakBox");
const streakAdvice = document.querySelector("#streakAdvice");
const streakAdviceText = document.querySelector("#streakAdviceText");
const historyList = document.querySelector("#historyList");
const notice = document.querySelector("#notice");

function showNotice(message, type = "ok") {
  notice.textContent = message;
  notice.className = `notice ${type}`;
}

async function request(path) {
  const response = await fetch(`${API_BASE}${path}`);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error || data.message || "요청 중 오류가 발생했습니다.",
    );
  }

  return data;
}

function renderHistory(days) {
  historyList.innerHTML = "";

  if (!days.length) {
    const li = document.createElement("li");
    li.className = "history-item";
    li.textContent = "아직 기록이 없습니다.";
    historyList.appendChild(li);
    return;
  }

  for (const day of days) {
    const li = document.createElement("li");
    li.className = "history-item";

    const head = document.createElement("div");
    head.className = "history-head";

    const dayText = document.createElement("strong");
    dayText.textContent = `${day.icon} ${day.day_key}`;

    const label = document.createElement("span");
    label.className = "pill";
    label.textContent = day.label;

    head.appendChild(dayText);
    head.appendChild(label);

    const meta = document.createElement("div");
    meta.className = "history-meta";

    const todoStat = document.createElement("span");
    todoStat.className = `meta-pill ${day.todo_achieved ? "status-done" : "status-pending"}`;
    todoStat.textContent = day.todo_achieved
      ? `✅ 할 일 완료 (${day.todo_completed}/${day.todo_total})`
      : `🕒 할 일 진행 중 (${day.todo_completed}/${day.todo_total})`;

    const retroStat = document.createElement("span");
    retroStat.className = `meta-pill ${day.retrospective_written ? "status-done" : "status-pending"}`;
    retroStat.textContent = day.retrospective_written
      ? "📝 회고 작성 완료"
      : "📭 회고 미작성";

    const detailLink = document.createElement("a");
    detailLink.className = "detail-link";
    detailLink.href = `./history-detail.html?day=${encodeURIComponent(day.day_key)}`;
    detailLink.textContent = "상세 보기";

    meta.appendChild(todoStat);
    meta.appendChild(retroStat);
    meta.appendChild(detailLink);

    li.appendChild(head);
    li.appendChild(meta);
    historyList.appendChild(li);
  }
}

(async function bootstrap() {
  try {
    const data = await request("/api/history");
    const streakIcon = data.streak_days > 0 ? "🔥" : "🌱";
    streakBox.textContent = `${streakIcon} 연속 달성 ${data.streak_days}일`;

    if (data.streak_ai_recommendation) {
      streakAdvice.hidden = false;
      streakAdviceText.textContent = data.streak_ai_recommendation;
    } else {
      streakAdvice.hidden = true;
    }

    renderHistory(data.days || []);
    showNotice("히스토리를 불러왔습니다.");
  } catch (error) {
    showNotice(error.message, "error");
  }
})();
