const API_BASE = "http://localhost:8080";

const detailTitle = document.querySelector("#detailTitle");
const todoSummary = document.querySelector("#todoSummary");
const detailTodoList = document.querySelector("#detailTodoList");
const retroEmpty = document.querySelector("#retroEmpty");
const retroDetail = document.querySelector("#retroDetail");
const retroContent = document.querySelector("#retroContent");
const retroAnalysis = document.querySelector("#retroAnalysis");
const retroCheer = document.querySelector("#retroCheer");
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

function getDayParam() {
  const params = new URLSearchParams(window.location.search);
  return params.get("day") || "";
}

function renderTodos(todos) {
  detailTodoList.innerHTML = "";

  if (!todos.length) {
    const li = document.createElement("li");
    li.className = "history-item";
    li.textContent = "해당 날짜의 할 일 기록이 없습니다.";
    detailTodoList.appendChild(li);
    return;
  }

  for (const todo of todos) {
    const li = document.createElement("li");
    li.className = `todo-item ${todo.completed ? "done" : ""}`;

    const marker = document.createElement("span");
    marker.className = "pill";
    marker.textContent = todo.completed ? "완료" : "미완료";

    const text = document.createElement("span");
    text.className = "todo-text";
    text.textContent = todo.content;

    li.appendChild(marker);
    li.appendChild(text);
    detailTodoList.appendChild(li);
  }
}

function renderRetrospective(retrospective) {
  if (!retrospective) {
    retroEmpty.hidden = false;
    retroDetail.hidden = true;
    return;
  }

  retroEmpty.hidden = true;
  retroDetail.hidden = false;
  retroContent.textContent = retrospective.content;
  retroAnalysis.textContent = retrospective.analysis;
  retroCheer.textContent = retrospective.cheer_message;
}

(async function bootstrap() {
  try {
    const day = getDayParam();
    if (!day) {
      showNotice("잘못된 접근입니다. 날짜 정보가 없습니다.", "error");
      return;
    }

    const data = await request(`/api/history/${encodeURIComponent(day)}`);
    detailTitle.textContent = `${data.day_key} 기록 상세`;
    todoSummary.textContent = `할 일 ${data.todo_completed}/${data.todo_total} 완료`;

    renderTodos(data.todos || []);
    renderRetrospective(data.retrospective);
    showNotice("기록 상세를 불러왔습니다.");
  } catch (error) {
    showNotice(error.message, "error");
  }
})();
