const API_BASE = "http://localhost:8080";

const todoForm = document.querySelector("#todoForm");
const todoInput = document.querySelector("#todoInput");
const todoList = document.querySelector("#todoList");
const todoCount = document.querySelector("#todoCount");
const todoEmptyHint = document.querySelector("#todoEmptyHint");

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
const retrospectiveModeHint = document.querySelector("#retrospectiveModeHint");
const retrospectiveSubmitBtn = retrospectiveForm?.querySelector(
  "button[type='submit']",
);
const retrospectiveResult = document.querySelector("#retrospectiveResult");
const analysisText = document.querySelector("#analysisText");
const cheerText = document.querySelector("#cheerText");
const reanalyzeBtn = document.querySelector("#reanalyzeBtn");
const retrospectiveConfirmModal = document.querySelector(
  "#retrospectiveConfirmModal",
);
const retrospectiveConfirmText = document.querySelector(
  "#retrospectiveConfirmText",
);
const retrospectiveConfirmYes = document.querySelector("#retrospectiveConfirmYes");
const retrospectiveConfirmNo = document.querySelector("#retrospectiveConfirmNo");
const notice = document.querySelector("#notice");
const todayDate = document.querySelector("#todayDate");

// 모달 요소
const editModal = document.querySelector("#editModal");
const editInput = document.querySelector("#editInput");
const editConfirmBtn = document.querySelector("#editConfirmBtn");
const editCancelBtn = document.querySelector("#editCancelBtn");

let currentTodos = [];
let editingTodoId = null;
let hasExistingRetrospective = false;
let pendingRetrospectiveRegenerateAi = false;

function updateRetrospectiveMode(hasExisting) {
  hasExistingRetrospective = hasExisting;

  if (retrospectiveSubmitBtn) {
    retrospectiveSubmitBtn.textContent = hasExisting
      ? "정리 내용 저장"
      : "하루 정리하기";
  }

  if (retrospectiveModeHint) {
    retrospectiveModeHint.textContent = hasExisting
      ? "수정 저장 시 기존 AI 조언은 유지됩니다. 필요하면 아래에서 AI 다시 분석하기를 눌러 주세요."
      : "처음 작성하면 AI 조언과 응원 메시지가 생성됩니다.";
  }
}

function updateRetrospectiveSubmitState() {
  if (!retrospectiveSubmitBtn || !retrospectiveInput) {
    return;
  }

  retrospectiveSubmitBtn.disabled = retrospectiveInput.value.trim().length === 0;
}

function openRetrospectiveConfirm(regenerateAi) {
  pendingRetrospectiveRegenerateAi = regenerateAi;
  if (retrospectiveConfirmText) {
    retrospectiveConfirmText.textContent = hasExistingRetrospective
      ? "입력한 수정 내용으로 정리를 저장할까요?"
      : "입력한 내용으로 하루 정리를 마무리할까요?";
  }
  if (retrospectiveConfirmModal) {
    retrospectiveConfirmModal.hidden = false;
  }
}

function closeRetrospectiveConfirm() {
  if (retrospectiveConfirmModal) {
    retrospectiveConfirmModal.hidden = true;
  }
}

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
  if (todoEmptyHint) {
    todoEmptyHint.hidden = todos.length > 0;
  }
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
  return new Date().getHours() >= 15;
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
    retrospectiveInput.value = data.content || "";
    updateRetrospectiveSubmitState();
    retrospectiveResult.hidden = false;
    analysisText.textContent = data.analysis;
    cheerText.textContent = data.cheer_message;
    updateRetrospectiveMode(true);
    if (reanalyzeBtn) {
      reanalyzeBtn.hidden = false;
    }
  } catch {
    retrospectiveInput.value = "";
    updateRetrospectiveSubmitState();
    retrospectiveResult.hidden = true;
    updateRetrospectiveMode(false);
    if (reanalyzeBtn) {
      reanalyzeBtn.hidden = true;
    }
  }
}

async function submitRetrospective(regenerateAi) {
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

  const hadExistingBeforeSave = hasExistingRetrospective;

  const data = await request("/api/retrospective", {
    method: "POST",
    body: JSON.stringify({
      content,
      regenerate_ai: regenerateAi,
    }),
  });

  retrospectiveResult.hidden = false;
  analysisText.textContent = data.analysis;
  cheerText.textContent = data.cheer_message;
  if (reanalyzeBtn) {
    reanalyzeBtn.hidden = false;
  }
  updateRetrospectiveMode(true);

  if (data.ai_refreshed && !hadExistingBeforeSave) {
    showNotice("하루 정리가 저장되었고 AI 조언이 생성되었습니다.");
  } else if (data.ai_refreshed) {
    showNotice("AI 조언을 새로 분석했습니다.");
  } else {
    showNotice("회고 내용을 수정했습니다. 기존 AI 조언은 유지됩니다.");
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
  if (retrospectiveInput.value.trim().length === 0) {
    showNotice("회고 내용을 입력해 주세요.", "error");
    return;
  }

  openRetrospectiveConfirm(false);
});

reanalyzeBtn?.addEventListener("click", async () => {
  try {
    await submitRetrospective(true);
  } catch (error) {
    showNotice(error.message, "error");
  }
});

retrospectiveInput?.addEventListener("input", () => {
  updateRetrospectiveSubmitState();
});

retrospectiveConfirmYes?.addEventListener("click", async () => {
  try {
    closeRetrospectiveConfirm();
    await submitRetrospective(pendingRetrospectiveRegenerateAi);
  } catch (error) {
    showNotice(error.message, "error");
  }
});

retrospectiveConfirmNo?.addEventListener("click", () => {
  closeRetrospectiveConfirm();
});

retrospectiveConfirmModal?.addEventListener("click", (event) => {
  if (event.target === retrospectiveConfirmModal) {
    closeRetrospectiveConfirm();
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
    updateRetrospectiveSubmitState();
    await loadTodos();
    await loadCarryoverPrompt();
    await loadTodayRetrospective();
    showNotice("준비 완료! 오늘의 3가지를 시작해보세요.");
  } catch (error) {
    showNotice(error.message, "error");
  }
})();
