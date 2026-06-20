const API_BASE = "http://localhost:8080/api";

const todoForm = document.getElementById("todo-form");
const todoInput = document.getElementById("todo-input");
const todoList = document.getElementById("todo-list");
const todoCount = document.getElementById("todo-count");
const retrospectiveInput = document.getElementById("retrospective-input");
const saveRetrospectiveBtn = document.getElementById("save-retrospective");
const analyzeRetrospectiveBtn = document.getElementById("analyze-retrospective");
const analysisResult = document.getElementById("analysis-result");

let todos = [];

function renderTodos() {
  todoList.innerHTML = "";
  todoCount.textContent = `등록된 투두 ${todos.length}/3`;

  todos.forEach((todo) => {
    const li = document.createElement("li");
    li.className = todo.completed ? "done" : "";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(todo.completed);
    checkbox.addEventListener("change", async () => {
      await fetch(`${API_BASE}/todos/${todo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: checkbox.checked }),
      });
      await loadTodos();
    });

    const text = document.createElement("span");
    text.textContent = todo.content;

    li.append(checkbox, text);
    todoList.appendChild(li);
  });
}

async function loadTodos() {
  const res = await fetch(`${API_BASE}/todos`);
  todos = await res.json();
  renderTodos();
}

async function loadLatestRetrospective() {
  const res = await fetch(`${API_BASE}/retrospectives/latest`);
  const data = await res.json();
  if (!data) return;

  retrospectiveInput.value = data.content || "";
  if (data.analysis || data.cheer_message) {
    analysisResult.textContent = `분석: ${data.analysis || "-"}\n응원: ${data.cheer_message || "-"}`;
  }
}

todoForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const content = todoInput.value.trim();
  if (!content) return;

  const res = await fetch(`${API_BASE}/todos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  const data = await res.json();
  if (!res.ok) {
    alert(data.error || "투두 등록에 실패했습니다.");
    return;
  }

  todoInput.value = "";
  await loadTodos();
});

saveRetrospectiveBtn.addEventListener("click", async () => {
  const content = retrospectiveInput.value.trim();
  if (!content) {
    alert("회고 내용을 입력해 주세요.");
    return;
  }

  const res = await fetch(`${API_BASE}/retrospectives`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    alert("회고 저장에 실패했습니다.");
    return;
  }
  analysisResult.textContent = "회고가 저장되었습니다.";
});

analyzeRetrospectiveBtn.addEventListener("click", async () => {
  const content = retrospectiveInput.value.trim();
  const res = await fetch(`${API_BASE}/retrospectives/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(content ? { content } : {}),
  });
  const data = await res.json();
  if (!res.ok) {
    alert(data.error || "회고 분석에 실패했습니다.");
    return;
  }
  analysisResult.textContent = `분석: ${data.analysis}\n응원: ${data.cheer_message}\n(엔진: ${data.source})`;
});

(async function init() {
  await loadTodos();
  await loadLatestRetrospective();
})();
