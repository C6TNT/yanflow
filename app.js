const STORAGE_KEY = "yanflow-v1";

const defaultState = {
  settings: {
    examDate: "",
    reviewPattern: [1, 2, 4, 7, 15, 30],
  },
  subjects: [],
  items: [],
};

const el = {
  subjectForm: document.querySelector("#subject-form"),
  subjectName: document.querySelector("#subject-name"),
  subjectColor: document.querySelector("#subject-color"),
  itemForm: document.querySelector("#item-form"),
  itemSubject: document.querySelector("#item-subject"),
  itemStartDate: document.querySelector("#item-start-date"),
  itemTitle: document.querySelector("#item-title"),
  itemNotes: document.querySelector("#item-notes"),
  settingsForm: document.querySelector("#settings-form"),
  examDate: document.querySelector("#exam-date"),
  reviewPattern: document.querySelector("#review-pattern"),
  todayTaskList: document.querySelector("#today-task-list"),
  itemList: document.querySelector("#item-list"),
  subjectProgress: document.querySelector("#subject-progress"),
  timelineBars: document.querySelector("#timeline-bars"),
  timelineTotal: document.querySelector("#timeline-total"),
  todayLabel: document.querySelector("#today-label"),
  examCountdown: document.querySelector("#exam-countdown"),
  heroDueCount: document.querySelector("#hero-due-count"),
  heroDoneRate: document.querySelector("#hero-done-rate"),
  heroTotalItems: document.querySelector("#hero-total-items"),
  heroUpcomingCount: document.querySelector("#hero-upcoming-count"),
  summaryDue: document.querySelector("#summary-due"),
  summaryDone: document.querySelector("#summary-done"),
  summaryOverdue: document.querySelector("#summary-overdue"),
  taskTemplate: document.querySelector("#task-card-template"),
  itemTemplate: document.querySelector("#item-card-template"),
};

let state = loadState();

bootstrap();

function bootstrap() {
  bindEvents();
  seedDemoData();
  render();
}

function bindEvents() {
  el.subjectForm.addEventListener("submit", handleSubjectSubmit);
  el.itemForm.addEventListener("submit", handleItemSubmit);
  el.settingsForm.addEventListener("submit", handleSettingsSubmit);

  document.querySelectorAll("[data-scroll-target]").forEach((button) => {
    button.addEventListener("click", () => {
      const targetId = button.getAttribute("data-scroll-target");
      const target = document.getElementById(targetId);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  el.todayTaskList.addEventListener("click", handleTaskAction);
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return structuredClone(defaultState);
    }
    const parsed = JSON.parse(saved);
    return {
      ...structuredClone(defaultState),
      ...parsed,
      settings: {
        ...defaultState.settings,
        ...(parsed.settings || {}),
      },
    };
  } catch (error) {
    console.warn("Failed to read local state:", error);
    return structuredClone(defaultState);
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function seedDemoData() {
  if (state.subjects.length || state.items.length) {
    return;
  }

  const physiologyId = createId();
  const pathologyId = createId();
  state.subjects = [
    { id: physiologyId, name: "生理学", color: "#d96c54" },
    { id: pathologyId, name: "病理学", color: "#315f71" },
  ];

  [
    {
      subjectId: physiologyId,
      title: "生理学 第1章 细胞的基本功能",
      notes: "重点看静息电位、动作电位、跨膜转运方式",
      startDate: offsetDate(-3),
    },
    {
      subjectId: pathologyId,
      title: "病理学 第2章 细胞损伤与适应",
      notes: "坏死与凋亡的区别容易混",
      startDate: offsetDate(-1),
    },
  ].forEach((item) => {
    state.items.push(buildItem(item));
  });
  persist();
}

function handleSubjectSubmit(event) {
  event.preventDefault();
  const name = el.subjectName.value.trim();
  const color = el.subjectColor.value;
  if (!name) {
    return;
  }

  state.subjects.push({ id: createId(), name, color });
  persist();
  el.subjectForm.reset();
  el.subjectColor.value = "#d96c54";
  render();
}

function handleItemSubmit(event) {
  event.preventDefault();
  if (!state.subjects.length) {
    window.alert("请先新增一个科目。");
    return;
  }

  const subjectId = el.itemSubject.value;
  const title = el.itemTitle.value.trim();
  const notes = el.itemNotes.value.trim();
  const startDate = el.itemStartDate.value;

  if (!subjectId || !title || !startDate) {
    return;
  }

  state.items.unshift(buildItem({ subjectId, title, notes, startDate }));
  persist();
  el.itemForm.reset();
  el.itemStartDate.value = isoToday();
  render();
}

function handleSettingsSubmit(event) {
  event.preventDefault();

  const pattern = el.reviewPattern.value
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!pattern.length) {
    window.alert("请输入有效的复习节点，例如 1,2,4,7,15,30");
    return;
  }

  state.settings.examDate = el.examDate.value;
  state.settings.reviewPattern = pattern;
  persist();
  render();
}

function handleTaskAction(event) {
  const button = event.target.closest("button");
  if (!button) {
    return;
  }

  const card = button.closest(".task-card");
  const itemId = card ? card.dataset.itemId : "";
  const roundIndex = Number(card ? card.dataset.roundIndex : NaN);
  if (!itemId || Number.isNaN(roundIndex)) {
    return;
  }

  if (button.dataset.action === "postpone") {
    postponeRound(itemId, roundIndex);
    return;
  }

  if (button.dataset.feedback) {
    completeRound(itemId, roundIndex, button.dataset.feedback);
  }
}

function buildItem({ subjectId, title, notes, startDate }) {
  return {
    id: createId(),
    subjectId,
    title,
    notes,
    startDate,
    createdAt: new Date().toISOString(),
    rounds: state.settings.reviewPattern.map((offset, index) => ({
      index,
      offset,
      scheduledDate: addDays(startDate, offset),
      completedAt: "",
      feedback: "",
    })),
  };
}

function completeRound(itemId, roundIndex, feedback) {
  const item = state.items.find((entry) => entry.id === itemId);
  const round = item ? item.rounds[roundIndex] : null;
  if (!round || round.completedAt) {
    return;
  }

  round.completedAt = isoToday();
  round.feedback = feedback;

  const nextRound = item.rounds[roundIndex + 1];
  if (nextRound && feedback === "forgot") {
    nextRound.scheduledDate = addDays(isoToday(), Math.max(1, Math.floor(nextRound.offset / 2)));
  }
  if (nextRound && feedback === "good") {
    nextRound.scheduledDate = addDays(nextRound.scheduledDate, 1);
  }

  persist();
  render();
}

function postponeRound(itemId, roundIndex) {
  const item = state.items.find((entry) => entry.id === itemId);
  const round = item ? item.rounds[roundIndex] : null;
  if (!round || round.completedAt) {
    return;
  }

  round.scheduledDate = addDays(round.scheduledDate, 1);
  persist();
  render();
}

function render() {
  ensureSubjectSelect();
  syncSettingsForm();
  renderHeaderStats();
  renderTodayTasks();
  renderSubjectProgress();
  renderTimeline();
  renderItems();
}

function ensureSubjectSelect() {
  if (!state.subjects.length) {
    el.itemSubject.innerHTML = '<option value="">请先添加科目</option>';
    return;
  }

  const currentValue = el.itemSubject.value;
  el.itemSubject.innerHTML = state.subjects
    .map((subject) => `<option value="${subject.id}">${subject.name}</option>`)
    .join("");
  el.itemSubject.value = state.subjects.some((subject) => subject.id === currentValue)
    ? currentValue
    : state.subjects[0].id;

  if (!el.itemStartDate.value) {
    el.itemStartDate.value = isoToday();
  }
}

function syncSettingsForm() {
  el.examDate.value = state.settings.examDate || "";
  el.reviewPattern.value = state.settings.reviewPattern.join(",");
}

function renderHeaderStats() {
  const today = isoToday();
  const tasks = getTaskEntries();
  const due = tasks.filter((task) => task.scheduledDate <= today && !task.completedAt);
  const doneToday = tasks.filter((task) => task.completedAt && task.completedAt.startsWith(today));
  const upcomingCount = countUpcomingDays(7);
  const doneRate = tasks.length
    ? Math.round((tasks.filter((task) => task.completedAt).length / tasks.length) * 100)
    : 0;

  el.todayLabel.textContent = formatFriendlyDate(today);
  el.heroDueCount.textContent = String(due.length);
  el.heroDoneRate.textContent = `${doneRate}%`;
  el.heroTotalItems.textContent = String(state.items.length);
  el.heroUpcomingCount.textContent = String(upcomingCount);
  el.summaryDue.textContent = String(due.length);
  el.summaryDone.textContent = String(doneToday.length);
  el.summaryOverdue.textContent = String(due.filter((task) => task.scheduledDate < today).length);

  if (!state.settings.examDate) {
    el.examCountdown.textContent = "未设置";
    return;
  }

  const days = diffInDays(today, state.settings.examDate);
  el.examCountdown.textContent = days >= 0 ? `还剩 ${days} 天` : `已过 ${Math.abs(days)} 天`;
}

function renderTodayTasks() {
  const today = isoToday();
  const tasks = getTaskEntries()
    .filter((task) => task.scheduledDate <= today && !task.completedAt)
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));

  if (!tasks.length) {
    el.todayTaskList.innerHTML =
      '<div class="empty-state">今天没有待处理的复习任务，可以继续录入新的章节内容。</div>';
    return;
  }

  const fragment = document.createDocumentFragment();
  tasks.forEach((task) => {
    const node = el.taskTemplate.content.firstElementChild.cloneNode(true);
    const badge = task.scheduledDate < today ? "已逾期" : "今天复习";

    node.dataset.itemId = task.itemId;
    node.dataset.roundIndex = String(task.roundIndex);
    node.querySelector(".task-card__subject").textContent = task.subjectName;
    node.querySelector(".task-card__subject").style.color = task.subjectColor;
    node.querySelector(".task-card__title").textContent = task.title;
    node.querySelector(".task-card__badge").textContent = badge;
    node.querySelector(".task-card__meta").textContent =
      `第 ${task.roundIndex + 1} 轮复习 · 计划日期 ${formatFriendlyDate(task.scheduledDate)}`;
    node.querySelector(".task-card__notes").textContent =
      task.notes || "这条内容暂时还没有补充备注。";
    fragment.appendChild(node);
  });

  el.todayTaskList.innerHTML = "";
  el.todayTaskList.appendChild(fragment);
}

function renderSubjectProgress() {
  if (!state.subjects.length) {
    el.subjectProgress.innerHTML = '<div class="empty-state">先添加科目，才能看到进度面板。</div>';
    return;
  }

  const today = isoToday();
  el.subjectProgress.innerHTML = "";
  state.subjects.forEach((subject) => {
    const subjectItems = state.items.filter((item) => item.subjectId === subject.id);
    const totalRounds = subjectItems.reduce((sum, item) => sum + item.rounds.length, 0);
    const completedRounds = subjectItems.reduce(
      (sum, item) => sum + item.rounds.filter((round) => round.completedAt).length,
      0,
    );
    const dueCount = getTaskEntries().filter(
      (task) => task.subjectId === subject.id && !task.completedAt && task.scheduledDate <= today,
    ).length;

    const card = document.createElement("article");
    card.className = "subject-stat";
    card.style.setProperty("--subject-color", subject.color);
    card.innerHTML = `
      <p>${subject.name}</p>
      <strong>${subjectItems.length}</strong>
      <small>条学习内容</small>
      <small>已完成 ${completedRounds}/${totalRounds} 轮 · 当前待复习 ${dueCount} 项</small>
    `;
    el.subjectProgress.appendChild(card);
  });
}

function renderTimeline() {
  const tasks = getTaskEntries();
  const upcoming = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(isoToday(), index);
    const count = tasks.filter((task) => !task.completedAt && task.scheduledDate === date).length;
    return { date, count };
  });

  const maxCount = Math.max(...upcoming.map((entry) => entry.count), 1);
  el.timelineTotal.textContent = `${upcoming.reduce((sum, entry) => sum + entry.count, 0)} 项`;
  el.timelineBars.innerHTML = upcoming
    .map((entry) => {
      const height = Math.max(18, Math.round((entry.count / maxCount) * 120));
      return `
        <div class="timeline-bar">
          <div class="timeline-bar__fill" style="height:${height}px"></div>
          <span>${formatShortDate(entry.date)}</span>
          <span>${entry.count}</span>
        </div>
      `;
    })
    .join("");
}

function renderItems() {
  if (!state.items.length) {
    el.itemList.innerHTML = '<div class="empty-state">还没有学习条目，先从第一章开始录入吧。</div>';
    return;
  }

  el.itemList.innerHTML = "";
  state.items.forEach((item) => {
    const subject = getSubject(item.subjectId);
    const node = el.itemTemplate.content.firstElementChild.cloneNode(true);
    const completedCount = item.rounds.filter((round) => round.completedAt).length;
    const nextRound = item.rounds.find((round) => !round.completedAt);

    node.querySelector(".item-card__subject").textContent = subject ? subject.name : "未分类";
    node.querySelector(".item-card__subject").style.color = subject ? subject.color : "#d96c54";
    node.querySelector(".item-card__title").textContent = item.title;
    node.querySelector(".item-card__status").textContent = nextRound
      ? `进行到第 ${completedCount + 1} 轮`
      : "已完成";
    node.querySelector(".item-card__schedule").textContent =
      `首次学习 ${formatFriendlyDate(item.startDate)} · 共 ${item.rounds.length} 个复习节点`;

    const roundsContainer = node.querySelector(".round-list");
    item.rounds.forEach((round) => {
      const pill = document.createElement("div");
      const isDone = Boolean(round.completedAt);
      const isActive = !isDone && round === nextRound;
      pill.className = `round-pill${isDone ? " round-pill--done" : ""}${isActive ? " round-pill--active" : ""}`;
      pill.innerHTML = `
        <span>第 ${round.index + 1} 轮 · ${formatFriendlyDate(round.scheduledDate)}</span>
        <span>${renderRoundStatus(round)}</span>
      `;
      roundsContainer.appendChild(pill);
    });

    el.itemList.appendChild(node);
  });
}

function getTaskEntries() {
  return state.items.flatMap((item) =>
    item.rounds.map((round, roundIndex) => {
      const subject = getSubject(item.subjectId);
      return {
        itemId: item.id,
        subjectId: item.subjectId,
        subjectName: subject ? subject.name : "未分类",
        subjectColor: subject ? subject.color : "#d96c54",
        title: item.title,
        notes: item.notes,
        roundIndex,
        scheduledDate: round.scheduledDate,
        completedAt: round.completedAt,
        feedback: round.feedback,
      };
    }),
  );
}

function getSubject(subjectId) {
  return state.subjects.find((subject) => subject.id === subjectId);
}

function renderRoundStatus(round) {
  if (!round.completedAt) {
    return "待完成";
  }

  return (
    {
      forgot: "已完成 · 基本忘了",
      okay: "已完成 · 有点模糊",
      good: "已完成 · 记得很牢",
    }[round.feedback] || "已完成"
  );
}

function countUpcomingDays(days) {
  const tasks = getTaskEntries();
  return Array.from({ length: days }, (_, index) => addDays(isoToday(), index + 1)).reduce(
    (sum, date) => sum + tasks.filter((task) => !task.completedAt && task.scheduledDate === date).length,
    0,
  );
}

function createId() {
  return Math.random().toString(36).slice(2, 10);
}

function isoToday() {
  return formatLocalISO(new Date());
}

function addDays(dateString, days) {
  const date = parseLocalDate(dateString);
  date.setDate(date.getDate() + days);
  return formatLocalISO(date);
}

function offsetDate(offset) {
  return addDays(isoToday(), offset);
}

function formatFriendlyDate(dateString) {
  const date = parseLocalDate(dateString);
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

function formatShortDate(dateString) {
  const date = parseLocalDate(dateString);
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
  }).format(date);
}

function diffInDays(fromDate, toDate) {
  const start = parseLocalDate(fromDate);
  const end = parseLocalDate(toDate);
  return Math.round((end - start) / (24 * 60 * 60 * 1000));
}

function parseLocalDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatLocalISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
