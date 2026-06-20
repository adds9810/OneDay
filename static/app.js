const PAGE_PARAMS = new URLSearchParams(window.location.search);

const queryApiBase = (PAGE_PARAMS.get("api_base") || "").trim();
if (queryApiBase) {
  localStorage.setItem("oneday-api-base", queryApiBase);
}

const savedApiBase = (localStorage.getItem("oneday-api-base") || "").trim();

const API_BASE =
  queryApiBase ||
  savedApiBase ||
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:8080"
    : `${window.location.protocol}//${window.location.host}`);

let activeApiBase = API_BASE;

const queryForcePm = (PAGE_PARAMS.get("force_pm") || "").trim();
if (queryForcePm) {
  localStorage.setItem("oneday-force-pm", queryForcePm);
}

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
const adviceSource = document.querySelector("#adviceSource");
const adviceComparison = document.querySelector("#adviceComparison");
const adviceBeforeText = document.querySelector("#adviceBeforeText");
const adviceAfterText = document.querySelector("#adviceAfterText");
const adviceText = document.querySelector("#adviceText");
const adviceSkeleton = document.querySelector("#adviceSkeleton");
const adviceRetryBtn = document.querySelector("#adviceRetryBtn");

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
const retrospectiveSkeleton = document.querySelector("#retrospectiveSkeleton");
const retrospectiveRetryBtn = document.querySelector("#retrospectiveRetryBtn");
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
let isAdviceLoading = false;
let isRetrospectiveLoading = false;
let lastAdviceContent = "";
let lastRetrospectiveMode = false;

function setButtonLoading(button, loadingText) {
  if (!button) {
    return () => {};
  }

  const prevText = button.textContent;
  const prevDisabled = button.disabled;
  button.disabled = true;
  button.textContent = loadingText;
  button.classList.add("is-loading");

  return () => {
    button.textContent = prevText;
    button.disabled = prevDisabled;
    button.classList.remove("is-loading");
  };
}

function createDelayNoticeTimer() {
  return window.setTimeout(() => {
    showNotice("응답이 지연되고 있어요. 잠시만 기다려 주세요.", "error");
  }, 9000);
}

function getPriorityMapStorageKey() {
  const dayKey = new Date().toISOString().slice(0, 10);
  return `oneday-priority-map-${dayKey}`;
}

function getSavedPriorityMap() {
  const raw = localStorage.getItem(getPriorityMapStorageKey());
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function setSavedPriorityMap(priorityMap) {
  if (!priorityMap || Object.keys(priorityMap).length === 0) {
    localStorage.removeItem(getPriorityMapStorageKey());
  } else {
    localStorage.setItem(getPriorityMapStorageKey(), JSON.stringify(priorityMap));
  }
}

function buildPriorityMap(todos, savedMap) {
  const count = todos.length;
  if (count === 0) {
    return {};
  }

  const priorityMap = {};
  const usedRanks = new Set();

  for (const todo of todos) {
    const rank = Number(savedMap[String(todo.id)]);
    if (Number.isInteger(rank) && rank >= 1 && rank <= count && !usedRanks.has(rank)) {
      priorityMap[todo.id] = rank;
      usedRanks.add(rank);
    }
  }

  const freeRanks = [];
  for (let rank = 1; rank <= count; rank += 1) {
    if (!usedRanks.has(rank)) {
      freeRanks.push(rank);
    }
  }

  for (const todo of todos) {
    if (!priorityMap[todo.id]) {
      priorityMap[todo.id] = freeRanks.shift();
    }
  }

  return priorityMap;
}

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
  const fetchOptions = {
    headers: { "Content-Type": "application/json" },
    ...options,
  };

  let response;
  try {
    response = await fetch(`${activeApiBase}${path}`, fetchOptions);
  } catch (error) {
    const canRecoverLocal =
      (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") &&
      activeApiBase !== "http://localhost:8080";

    if (canRecoverLocal) {
      activeApiBase = "http://localhost:8080";
      localStorage.setItem("oneday-api-base", activeApiBase);
      response = await fetch(`${activeApiBase}${path}`, fetchOptions);
    } else {
      throw error;
    }
  }

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
    if (adviceInput) {
      adviceInput.hidden = false;
    }
    adviceSubmitBtn.hidden = false;
    if (adviceRetryBtn) {
      adviceRetryBtn.hidden = true;
    }
    if (adviceHint)
      adviceHint.textContent =
        "할 일 목록을 분석해서 추천 순서를 알려드릴게요.";
  } else {
    adviceSubmitBtn.disabled = true;
    if (adviceInput) {
      adviceInput.hidden = true;
      adviceInput.value = "";
    }
    adviceSubmitBtn.hidden = true;
    adviceResult.hidden = true;
    if (adviceSkeleton) {
      adviceSkeleton.hidden = true;
    }
    if (adviceRetryBtn) {
      adviceRetryBtn.hidden = true;
    }
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

  const priorityMap = buildPriorityMap(todos, getSavedPriorityMap());
  setSavedPriorityMap(priorityMap);

  const sortedTodos = [...todos].sort(
    (a, b) => priorityMap[a.id] - priorityMap[b.id],
  );

  updateAdviceButton(todos.length);

  for (const todo of sortedTodos) {
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

    const priorityWrap = document.createElement("span");
    priorityWrap.className = "priority-inline";

    if (todos.length === 1) {
      const fixed = document.createElement("span");
      fixed.className = "priority-fixed";
      fixed.textContent = "1순위";
      priorityWrap.appendChild(fixed);
    } else {
      const label = document.createElement("span");
      label.className = "priority-label";
      label.textContent = "우선";

      const select = document.createElement("select");
      select.className = "todo-priority-select";

      for (let rank = 1; rank <= todos.length; rank += 1) {
        const option = document.createElement("option");
        option.value = String(rank);
        option.textContent = String(rank);
        select.appendChild(option);
      }

      select.value = String(priorityMap[todo.id]);
      select.addEventListener("change", () => {
        const nextRank = Number(select.value);
        const prevRank = priorityMap[todo.id];
        if (!Number.isInteger(nextRank) || nextRank === prevRank) {
          return;
        }

        const swappedTodo = todos.find(
          (item) => item.id !== todo.id && priorityMap[item.id] === nextRank,
        );

        priorityMap[todo.id] = nextRank;
        if (swappedTodo) {
          priorityMap[swappedTodo.id] = prevRank;
        }

        setSavedPriorityMap(priorityMap);
        renderTodos(currentTodos);
        showNotice("우선순위를 변경했습니다.");
      });

      priorityWrap.appendChild(label);
      priorityWrap.appendChild(select);
    }

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
    li.appendChild(priorityWrap);
    li.appendChild(text);
    li.appendChild(state);
    li.appendChild(editButton);
    todoList.appendChild(li);
  }
}

function isAfterThreePm() {
  const forcedRaw = queryForcePm || localStorage.getItem("oneday-force-pm") || "";
  const forced = forcedRaw.trim().toLowerCase();

  if (["1", "true", "yes", "on"].includes(forced)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(forced)) {
    return false;
  }

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
  if (isRetrospectiveLoading) {
    return;
  }
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
  lastRetrospectiveMode = regenerateAi;

  isRetrospectiveLoading = true;
  if (retrospectiveRetryBtn) {
    retrospectiveRetryBtn.hidden = true;
  }
  if (retrospectiveSkeleton) {
    retrospectiveSkeleton.hidden = false;
  }
  retrospectiveResult.hidden = true;

  const targetButton = regenerateAi ? reanalyzeBtn : retrospectiveSubmitBtn;
  const restoreButton = setButtonLoading(targetButton, "생성 중...");
  const delayTimer = createDelayNoticeTimer();

  try {
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
  } catch (error) {
    retrospectiveResult.hidden = false;
    if (retrospectiveRetryBtn) {
      retrospectiveRetryBtn.hidden = false;
    }
    showNotice(error.message || "AI 응답에 실패했습니다. 다시 시도해 주세요.", "error");
  } finally {
    clearTimeout(delayTimer);
    restoreButton();
    if (retrospectiveSkeleton) {
      retrospectiveSkeleton.hidden = true;
    }
    isRetrospectiveLoading = false;
  }
}

async function submitAdvice(content) {
  if (isAdviceLoading) {
    return;
  }

  lastAdviceContent = content;
  isAdviceLoading = true;
  const previousAdviceText = adviceText ? adviceText.textContent.trim() : "";

  if (adviceRetryBtn) {
    adviceRetryBtn.hidden = true;
  }
  if (adviceSkeleton) {
    adviceSkeleton.hidden = false;
  }
  adviceResult.hidden = true;

  const restoreButton = setButtonLoading(adviceSubmitBtn, "생성 중...");
  const delayTimer = createDelayNoticeTimer();

  try {
    const data = await request("/api/advice", {
      method: "POST",
      body: JSON.stringify({ content }),
    });

    adviceResult.hidden = false;
    adviceResult.classList.remove("result-enter");
    void adviceResult.offsetWidth;
    adviceResult.classList.add("result-enter");
    if (adviceSource) {
      adviceSource.textContent =
        data.source === "copilot"
          ? "AI가 분석한 추천이에요."
          : "현재는 AI를 사용할 수 없어 기본 추천으로 보여드려요.";
    }
    if (adviceComparison && adviceBeforeText && adviceAfterText) {
      if (previousAdviceText && previousAdviceText !== data.advice) {
        adviceBeforeText.textContent = previousAdviceText;
        adviceAfterText.textContent = data.advice;
        adviceComparison.hidden = false;
        adviceComparison.classList.remove("animate-in");
        void adviceComparison.offsetWidth;
        adviceComparison.classList.add("animate-in");
      } else {
        adviceComparison.hidden = true;
      }
    }
    adviceText.textContent = data.advice;
    showNotice("우선순위 추천을 받았습니다.");
  } catch (error) {
    adviceResult.hidden = false;
    adviceText.textContent = "AI 응답을 가져오지 못했습니다. 다시 시도해 주세요.";
    if (adviceRetryBtn) {
      adviceRetryBtn.hidden = false;
    }
    showNotice(error.message || "AI 응답에 실패했습니다. 다시 시도해 주세요.", "error");
  } finally {
    clearTimeout(delayTimer);
    restoreButton();
    if (adviceSkeleton) {
      adviceSkeleton.hidden = true;
    }
    isAdviceLoading = false;
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

  if (currentTodos.length < 2) {
    showNotice(
      "우선순위 추천은 할 일을 2개 이상 등록해야 받을 수 있어요.",
      "error",
    );
    return;
  }

  // 상황 메모는 선택 사항이므로 비어있어도 전송합니다.
  const content = adviceInput ? adviceInput.value.trim() : "";
  await submitAdvice(content);
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
  await submitRetrospective(true);
});

retrospectiveInput?.addEventListener("input", () => {
  updateRetrospectiveSubmitState();
});

retrospectiveConfirmYes?.addEventListener("click", async () => {
  closeRetrospectiveConfirm();
  await submitRetrospective(pendingRetrospectiveRegenerateAi);
});

adviceRetryBtn?.addEventListener("click", async () => {
  await submitAdvice(lastAdviceContent);
});

retrospectiveRetryBtn?.addEventListener("click", async () => {
  await submitRetrospective(lastRetrospectiveMode);
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
