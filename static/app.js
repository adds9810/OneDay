const API_BASE = "http://localhost:8080";

const todoForm = document.querySelector("#todoForm");
const todoInput = document.querySelector("#todoInput");
const todoList = document.querySelector("#todoList");
const todoCount = document.querySelector("#todoCount");

const retrospectiveForm = document.querySelector("#retrospectiveForm");
const retrospectiveInput = document.querySelector("#retrospectiveInput");
const retrospectiveResult = document.querySelector("#retrospectiveResult");
const analysisText = document.querySelector("#analysisText");
const cheerText = document.querySelector("#cheerText");
const notice = document.querySelector("#notice");

function showNotice(message, type = "ok") {
  notice.textContent = message;
  notice.className = `notice ${type}`;
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error || data.message || "요청 중 오류가 발생했습니다.",
    );
  }

  return data;
}

function renderTodos(todos) {
  todoList.innerHTML = "";
  todoCount.textContent = `${todos.length} / 3`;

  for (const todo of todos) {
    const li = document.createElement("li");
    li.className = `todo-item ${todo.completed ? "done" : ""}`;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(todo.completed);
    checkbox.addEventListener("change", async () => {
      try {
        await request(`/api/todos/${todo.id}`, {
          method: "PATCH",
          body: JSON.stringify({ completed: checkbox.checked }),
        });
        await loadTodos();
      } catch (error) {
        showNotice(error.message, "error");
        checkbox.checked = !checkbox.checked;
      }
    });

    const text = document.createElement("span");
    text.className = "todo-text";
    // XSS 방지를 위해 innerHTML 대신 textContent를 사용합니다.
    text.textContent = todo.content;

    const state = document.createElement("span");
    state.className = "pill";
    state.textContent = todo.completed ? "완료" : "진행중";

    li.appendChild(checkbox);
    li.appendChild(text);
    li.appendChild(state);
    todoList.appendChild(li);
  }
}

async function loadTodos() {
  const data = await request("/api/todos");
  renderTodos(data.todos || []);
}

async function loadTodayRetrospective() {
  try {
    const data = await request("/api/retrospective/today");
    retrospectiveResult.hidden = false;
    analysisText.textContent = data.analysis;
    cheerText.textContent = data.cheer_message;
  } catch {
    retrospectiveResult.hidden = true;
  }
}

todoForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const content = todoInput.value.trim();
    if (!content) {
      showNotice("투두 내용을 입력해 주세요.", "error");
      return;
    }

    await request("/api/todos", {
      method: "POST",
      body: JSON.stringify({ content }),
    });

    todoInput.value = "";
    await loadTodos();
    showNotice("투두를 등록했습니다.");
  } catch (error) {
    showNotice(error.message, "error");
  }
});

retrospectiveForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const content = retrospectiveInput.value.trim();
    if (!content) {
      showNotice("회고 내용을 입력해 주세요.", "error");
      return;
    }

    const data = await request("/api/retrospective", {
      method: "POST",
      body: JSON.stringify({ content }),
    });

    retrospectiveResult.hidden = false;
    analysisText.textContent = data.analysis;
    cheerText.textContent = data.cheer_message;
    showNotice("회고 분석이 완료되었습니다.");
  } catch (error) {
    showNotice(error.message, "error");
  }
});

(async function bootstrap() {
  try {
    await loadTodos();
    await loadTodayRetrospective();
    showNotice("준비 완료! 오늘의 3가지를 시작해보세요.");
  } catch (error) {
    showNotice(error.message, "error");
  }
})();
