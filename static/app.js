const API_BASE = "http://localhost:8080";

const todoForm = document.querySelector("#todoForm");
const todoInput = document.querySelector("#todoInput");
const todoList = document.querySelector("#todoList");
const todoCount = document.querySelector("#todoCount");

const carryoverCard = document.querySelector("#carryoverCard");
const carryoverText = document.querySelector("#carryoverText");
const carryoverList = document.querySelector("#carryoverList");
const carryoverAddBtn = document.querySelector("#carryoverAddBtn");
const carryoverSkipBtn = document.querySelector("#carryoverSkipBtn");

const timeGateNotice = document.querySelector("#timeGateNotice");
const afternoonPanel = document.querySelector("#afternoonPanel");

const adviceForm = document.querySelector("#adviceForm");
const adviceInput = document.querySelector("#adviceInput");
const adviceSubmitBtn = document.querySelector("#adviceSubmitBtn");
const adviceHint = document.querySelector("#adviceHint");
const adviceResult = document.querySelector("#adviceResult");
const adviceText = document.querySelector("#adviceText");

const retrospectiveForm = document.querySelector("#retrospectiveForm");
const retrospectiveInput = document.querySelector("#retrospectiveInput");
const retrospectiveResult = document.querySelector("#retrospectiveResult");
const analysisText = document.querySelector("#analysisText");
const cheerText = document.querySelector("#cheerText");
const notice = document.querySelector("#notice");
const todayDate = document.querySelector("#todayDate");

// 모달 요소
const editModal = document.querySelector("#editModal");
const editInput = document.querySelector("#editInput");
const editConfirmBtn = document.querySelector("#editConfirmBtn");
const editCancelBtn = document.querySelector("#editCancelBtn");

let currentTodos = [];
let editingTodoId = null;

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

function updateAdviceButton(count) {
  if (!adviceSubmitBtn) return;
  if (count >= 2) {
    adviceSubmitBtn.disabled = false;
    if (adviceHint)
      adviceHint.textContent =
        "할 일 목록을 분석해서 추천 순서를 알려드릴게요.";
  } else {
    adviceSubmitBtn.disabled = true;
    if (adviceHint)
      adviceHint.textContent =
        "할 일을 2개 이상 등록하면 AI 우선순위 추천을 받을 수 있어요.";
  }
}

function renderTodos(todos) {
  currentTodos = todos;
  todoList.innerHTML = "";
  todoCount.textContent = `${todos.length} / 3`;
  updateAdviceButton(todos.length);

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

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "todo-edit-btn";
    editButton.textContent = "수정";
    editButton.addEventListener("click", () => {
      editingTodoId = todo.id;
      editInput.value = todo.content;
      editModal.hidden = false;
      editInput.focus();
    });

    li.appendChild(checkbox);
    li.appendChild(text);
    li.appendChild(state);
    li.appendChild(editButton);
    todoList.appendChild(li);
  }
}

function isAfterThreePm() {
  return new Date().getHours() >= 13; // 임시: 확인용 (원래 15)
}

function renderTodayDate() {
  if (!todayDate) {
    return;
  }

  const formatted = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date());

  todayDate.textContent = `오늘 날짜: ${formatted}`;
}

function renderTimeGate() {
  if (isAfterThreePm()) {
    afternoonPanel.hidden = false;
    timeGateNotice.textContent =
      "지금은 오후 3시 이후입니다. 조언과 회고를 입력할 수 있어요.";
    return;
  }

  afternoonPanel.hidden = true;
  timeGateNotice.textContent = "조언/회고 입력은 오후 3시 이후에 열립니다.";
}

function renderCarryoverPrompt(payload) {
  if (!payload.has_pending || payload.resolved) {
    carryoverCard.hidden = true;
    return;
  }

  carryoverCard.hidden = false;
  carryoverText.textContent = `${payload.source_day}의 미완료 항목이 있습니다. 오늘 할 일에 추가할까요?`;
  carryoverList.innerHTML = "";

  for (const todo of payload.todos) {
    const li = document.createElement("li");
    li.className = "todo-item";

    const marker = document.createElement("span");
    marker.className = "pill";
    marker.textContent = "미완료";

    const text = document.createElement("span");
    text.className = "todo-text";
    text.textContent = todo.content;

    li.appendChild(marker);
    li.appendChild(text);
    carryoverList.appendChild(li);
  }
}

async function loadCarryoverPrompt() {
  try {
    const data = await request("/api/todos/pending-from-yesterday");
    renderCarryoverPrompt(data);
  } catch {
    carryoverCard.hidden = true;
  }
}

async function decideCarryover(action) {
  const data = await request("/api/todos/pending-decision", {
    method: "POST",
    body: JSON.stringify({ action }),
  });
  showNotice(data.message, "ok");
  carryoverCard.hidden = true;
  await loadTodos();
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
    if (currentTodos.length >= 3) {
      showNotice("투두는 최대 3개까지 등록할 수 있어요.", "error");
      return;
    }

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

adviceForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    if (currentTodos.length < 2) {
      showNotice(
        "우선순위 추천은 할 일을 2개 이상 등록해야 받을 수 있어요.",
        "error",
      );
      return;
    }

    // 상황 메모는 선택 사항이므로 비어있어도 전송합니다.
    const content = adviceInput ? adviceInput.value.trim() : "";

    const data = await request("/api/advice", {
      method: "POST",
      body: JSON.stringify({ content }),
    });

    adviceResult.hidden = false;
    adviceText.textContent = data.advice;
    showNotice("우선순위 추천을 받았습니다.");
  } catch (error) {
    showNotice(error.message, "error");
  }
});

retrospectiveForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    if (!isAfterThreePm()) {
      showNotice("회고는 오후 3시 이후에 작성할 수 있어요.", "error");
      return;
    }
    if (currentTodos.length < 1) {
      showNotice("회고 전 투두를 최소 1개 등록해 주세요.", "error");
      return;
    }

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
    showNotice("회고 조언이 완료되었습니다.");
  } catch (error) {
    showNotice(error.message, "error");
  }
});

carryoverAddBtn?.addEventListener("click", async () => {
  try {
    await decideCarryover("add");
  } catch (error) {
    showNotice(error.message, "error");
  }
});

carryoverSkipBtn?.addEventListener("click", async () => {
  try {
    await decideCarryover("skip");
  } catch (error) {
    showNotice(error.message, "error");
  }
});

// 모달 버튼 이벤트 리스너
editConfirmBtn?.addEventListener("click", async () => {
  try {
    const content = editInput.value.trim();
    if (!content) {
      showNotice("수정할 내용을 입력해 주세요.", "error");
      return;
    }

    if (editingTodoId === null) {
      showNotice("오류가 발생했습니다.", "error");
      return;
    }

    await request(`/api/todos/${editingTodoId}`, {
      method: "PATCH",
      body: JSON.stringify({ content }),
    });

    editModal.hidden = true;
    editingTodoId = null;
    editInput.value = "";
    await loadTodos();
    showNotice("할 일을 수정했습니다.");
  } catch (error) {
    showNotice(error.message, "error");
  }
});

editCancelBtn?.addEventListener("click", () => {
  editModal.hidden = true;
  editingTodoId = null;
  editInput.value = "";
});

// 모달 바깥 클릭 시 닫기
editModal?.addEventListener("click", (event) => {
  if (event.target === editModal) {
    editModal.hidden = true;
    editingTodoId = null;
    editInput.value = "";
  }
});

// Enter 키로 수정
editInput?.addEventListener("keypress", async (event) => {
  if (event.key === "Enter") {
    editConfirmBtn?.click();
  }
});

(async function bootstrap() {
  try {
    renderTodayDate();
    renderTimeGate();
    await loadTodos();
    await loadCarryoverPrompt();
    await loadTodayRetrospective();
    showNotice("준비 완료! 오늘의 3가지를 시작해보세요.");
  } catch (error) {
    showNotice(error.message, "error");
  }
})();
