(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [
    ...root.querySelectorAll(selector),
  ];
  const STORAGE_KEY = "taskflowPro.tasks.v1";
  const THEME_KEY = "taskflowPro.theme";
  let tasks = loadTasks();
  let currentView = "overview";
  let statusFilter = "all";
  let searchTerm = "";
  let layout = "list";
  let editingId = null;
  let activeMenuId = null;
  let toastTimer;

  function loadTasks() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed)
        ? parsed.filter((t) => t && typeof t.title === "string" && t.id)
        : [];
    } catch {
      return [];
    }
  }
  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch {
      showToast("Could not save changes in this browser.");
    }
  }
  function localISODate(date = new Date()) {
    const y = date.getFullYear(),
      m = String(date.getMonth() + 1).padStart(2, "0"),
      d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  function formatDate(value) {
    if (!value) return "No deadline";
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }
  function isOverdue(task) {
    return !!task.due && task.due < localISODate() && task.status !== "done";
  }
  function statusLabel(status) {
    return (
      { todo: "To do", progress: "In progress", done: "Completed" }[status] ||
      "To do"
    );
  }
  function priorityLabel(priority) {
    return (
      (priority || "medium")[0].toUpperCase() + (priority || "medium").slice(1)
    );
  }
  function escapeHTML(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );
  }
  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
  }
  function setDateAndGreeting() {
    const now = new Date();
    $("#currentDate").textContent = now.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const hour = now.getHours();
    const greeting =
      hour < 12
        ? "Good morning."
        : hour < 18
          ? "Good afternoon."
          : "Good evening.";
    $("#pageTitle").textContent = `${greeting} Let's get things done.`;
  }
  function getVisibleTasks() {
    let result = [...tasks];
    const today = localISODate();
    if (currentView === "today")
      result = result.filter((t) => t.due === today && t.status !== "done");
    if (currentView === "upcoming")
      result = result.filter(
        (t) => t.due && t.due > today && t.status !== "done",
      );
    if (statusFilter !== "all")
      result = result.filter((t) => t.status === statusFilter);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter((t) =>
        [t.title, t.description, t.category, t.priority, t.status].some((v) =>
          String(v || "")
            .toLowerCase()
            .includes(term),
        ),
      );
    }
    const sort = $("#sortSelect").value;
    result.sort((a, b) => {
      if (sort === "due")
        return (a.due || "9999-99-99").localeCompare(b.due || "9999-99-99");
      if (sort === "priority")
        return (
          ({ high: 0, medium: 1, low: 2 }[a.priority] ?? 1) -
          ({ high: 0, medium: 1, low: 2 }[b.priority] ?? 1)
        );
      if (sort === "title") return a.title.localeCompare(b.title);
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
    return result;
  }
  function renderStats() {
    const done = tasks.filter((t) => t.status === "done").length;
    const progress = tasks.filter((t) => t.status === "progress").length;
    const overdue = tasks.filter(isOverdue).length;
    const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
    $("#totalStat").textContent = tasks.length;
    $("#progressStat").textContent = progress;
    $("#doneStat").textContent = done;
    $("#overdueStat").textContent = overdue;
    $("#navTaskCount").textContent = tasks.filter(
      (t) => t.status !== "done",
    ).length;
    $("#progressFill").style.width = `${pct}%`;
    $("#progressLabel").textContent = `${pct}% completed`;
    $("#progressFraction").textContent = `${done} of ${tasks.length} tasks`;
    $("#progressCaption").textContent = tasks.length
      ? pct === 100
        ? "Amazing work — everything is complete!"
        : `${tasks.length - done} task${tasks.length - done === 1 ? "" : "s"} left to reach your goal.`
      : "Create your first task and start building momentum.";
  }
  function renderRows(visible) {
    const rows = $("#taskRows");
    rows.innerHTML = visible
      .map((task) => {
        const desc = task.description
          ? `<div class="task-description">${escapeHTML(task.description)}</div>`
          : "";
        const dueClass = isOverdue(task) ? "due-date overdue" : "due-date";
        return `<div class="task-row ${task.status === "done" ? "is-done" : ""}" data-task-id="${escapeHTML(task.id)}">
        <div class="task-main"><input class="task-check" type="checkbox" data-action="complete" aria-label="Mark ${escapeHTML(task.title)} completed" ${task.status === "done" ? "checked" : ""}><div style="min-width:0"><div class="task-name">${escapeHTML(task.title)}</div>${desc}<span class="category-tag">${escapeHTML(task.category || "Other")}</span></div></div>
        <span class="priority priority-${escapeHTML(task.priority || "medium")}">${priorityLabel(task.priority)}</span>
        <span class="${dueClass}">${isOverdue(task) ? "Overdue · " : ""}${formatDate(task.due)}</span>
        <span class="status-tag status-${escapeHTML(task.status || "todo")}">${statusLabel(task.status)}</span>
        <div class="row-actions"><button class="more-btn" data-action="menu" aria-label="Task actions">···</button>${activeMenuId === task.id ? `<div class="action-menu"><button data-action="edit">Edit task</button><button data-action="cycle">Change status</button><button class="danger" data-action="delete">Delete task</button></div>` : ""}</div>
      </div>`;
      })
      .join("");
    $("#emptyState").classList.toggle("hidden", visible.length > 0);
    $("#taskRows").classList.toggle("hidden", visible.length === 0);
  }
  function renderKanban(visible) {
    const groups = {
      todo: $("#todoCards"),
      progress: $("#doingCards"),
      done: $("#doneCards"),
    };
    Object.entries(groups).forEach(([status, container]) => {
      const group = visible.filter((t) => t.status === status);
      container.innerHTML = group
        .map(
          (
            task,
          ) => `<article class="kanban-card" draggable="true" data-task-id="${escapeHTML(task.id)}">
        <div class="kanban-card-title">${escapeHTML(task.title)}</div>${task.description ? `<div class="kanban-card-desc">${escapeHTML(task.description)}</div>` : ""}
        <div class="kanban-card-meta"><span class="priority priority-${escapeHTML(task.priority || "medium")}">${priorityLabel(task.priority)}</span><span class="kanban-due">${task.due ? (isOverdue(task) ? "Overdue · " : "") + formatDate(task.due) : escapeHTML(task.category || "Other")}</span></div>
        <div class="kanban-card-actions"><button class="more-btn" data-action="edit" aria-label="Edit task">✎</button><button class="more-btn" data-action="delete" aria-label="Delete task">×</button></div>
      </article>`,
        )
        .join("");
      $(`[data-drop-status="${status}"]`).classList.remove("drag-over");
    });
    $("#todoCount").textContent = visible.filter(
      (t) => t.status === "todo",
    ).length;
    $("#doingCount").textContent = visible.filter(
      (t) => t.status === "progress",
    ).length;
    $("#doneCount").textContent = visible.filter(
      (t) => t.status === "done",
    ).length;
  }
  function updateViewLabels() {
    const labels = {
      overview: [
        "Overview",
        "Task board",
        "Organize your priorities and keep moving forward.",
      ],
      board: [
        "My Tasks",
        "All tasks",
        "Everything you need to get done, in one place.",
      ],
      today: [
        "Due Today",
        "Today's tasks",
        "Focus on tasks that need your attention today.",
      ],
      upcoming: [
        "Upcoming",
        "Coming up next",
        "Keep an eye on the tasks on your horizon.",
      ],
    };
    const current = labels[currentView] || labels.overview;
    $("#breadcrumbTitle").textContent = current[0];
    if (currentView !== "overview") $("#pageTitle").textContent = current[0];
    else setDateAndGreeting();
    $("#listHeading").textContent = current[1];
    $("#listDescription").textContent = current[2];
    $$(".nav-item[data-view]").forEach((btn) =>
      btn.classList.toggle("active", btn.dataset.view === currentView),
    );
  }
  function render() {
    renderStats();
    updateViewLabels();
    const visible = getVisibleTasks();
    renderRows(visible);
    renderKanban(visible);
    $("#taskListView").classList.toggle("hidden", layout !== "list");
    $("#kanbanView").classList.toggle("hidden", layout !== "board");
    $("#listViewBtn").classList.toggle("active", layout === "list");
    $("#boardViewBtn").classList.toggle("active", layout === "board");
    $("#emptyAdd").classList.toggle(
      "hidden",
      currentView === "today" ||
        currentView === "upcoming" ||
        statusFilter !== "all" ||
        !!searchTerm,
    );
  }
  function openModal(task = null, defaultStatus = "todo") {
    editingId = task ? task.id : null;
    $("#taskForm").reset();
    $("#modalTitle").textContent = task ? "Edit task" : "Create a new task";
    $("#saveTaskBtn").innerHTML = task
      ? "Save changes <span>→</span>"
      : "Create task <span>→</span>";
    $("#taskTitle").value = task?.title || "";
    $("#taskDescription").value = task?.description || "";
    $("#taskPriority").value = task?.priority || "medium";
    $("#taskStatus").value = task?.status || defaultStatus;
    $("#taskDue").value = task?.due || "";
    $("#taskCategory").value = task?.category || "Work";
    $("#taskModal").classList.remove("hidden");
    document.body.style.overflow = "hidden";
    setTimeout(() => $("#taskTitle").focus(), 40);
  }
  function closeModal() {
    $("#taskModal").classList.add("hidden");
    document.body.style.overflow = "";
    editingId = null;
  }
  function changeStatus(task, status) {
    task.status = status;
    task.updatedAt = Date.now();
    saveTasks();
    render();
  }
  function handleTaskAction(action, id) {
    const task = tasks.find((t) => String(t.id) === String(id));
    if (!task) return;
    if (action === "menu") {
      activeMenuId = activeMenuId === task.id ? null : task.id;
      render();
      return;
    }
    activeMenuId = null;
    if (action === "edit") {
      openModal(task);
      return;
    }
    if (action === "delete") {
      if (!confirm(`Delete "${task.title}"? This cannot be undone.`)) return;
      tasks = tasks.filter((t) => t.id !== task.id);
      saveTasks();
      render();
      showToast("Task deleted.");
      return;
    }
    if (action === "complete") {
      changeStatus(task, task.status === "done" ? "todo" : "done");
      showToast(
        task.status === "done"
          ? "Task completed — nice work!"
          : "Task moved to To do.",
      );
      return;
    }
    if (action === "cycle") {
      const next =
        { todo: "progress", progress: "done", done: "todo" }[task.status] ||
        "todo";
      changeStatus(task, next);
      showToast(`Status changed to ${statusLabel(next)}.`);
    }
  }
  $("#taskForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const title = $("#taskTitle").value.trim();
    if (!title) {
      $("#taskTitle").focus();
      return;
    }
    const data = {
      title,
      description: $("#taskDescription").value.trim(),
      priority: $("#taskPriority").value,
      status: $("#taskStatus").value,
      due: $("#taskDue").value,
      category: $("#taskCategory").value,
    };
    if (editingId) {
      const task = tasks.find((t) => t.id === editingId);
      if (task) Object.assign(task, data, { updatedAt: Date.now() });
      showToast("Changes saved.");
    } else {
      tasks.push({
        id: crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`,
        ...data,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      showToast("Task created successfully.");
    }
    saveTasks();
    closeModal();
    render();
  });
  $("#closeModal").addEventListener("click", closeModal);
  $("#cancelModal").addEventListener("click", closeModal);
  $("#taskModal").addEventListener("click", (event) => {
    if (event.target === $("#taskModal")) closeModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal();
      activeMenuId = null;
      render();
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      $("#searchInput").focus();
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
      event.preventDefault();
      openModal();
    }
  });
  $("#addTaskTop").addEventListener("click", () => openModal());
  $("#emptyAdd").addEventListener("click", () => openModal());
  $("#taskRows").addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const row = button.closest("[data-task-id]");
    if (row) handleTaskAction(button.dataset.action, row.dataset.taskId);
  });
  $("#taskRows").addEventListener("change", (event) => {
    if (event.target.matches('[data-action="complete"]')) {
      const row = event.target.closest("[data-task-id]");
      if (row) handleTaskAction("complete", row.dataset.taskId);
    }
  });
  $$(".nav-item[data-view]").forEach((button) =>
    button.addEventListener("click", () => {
      currentView = button.dataset.view;
      statusFilter = "all";
      activeMenuId = null;
      render();
      $("#sidebar").classList.remove("open");
    }),
  );
  $$(".side-filter").forEach((button) =>
    button.addEventListener("click", () => {
      statusFilter = button.dataset.status;
      currentView = "board";
      activeMenuId = null;
      $$(".side-filter").forEach(
        (b) => (b.style.color = b === button ? "var(--purple)" : ""),
      );
      render();
      $("#sidebar").classList.remove("open");
    }),
  );
  $("#searchInput").addEventListener("input", (event) => {
    searchTerm = event.target.value.trim();
    render();
  });
  $("#sortSelect").addEventListener("change", render);
  $("#listViewBtn").addEventListener("click", () => {
    layout = "list";
    render();
  });
  $("#boardViewBtn").addEventListener("click", () => {
    layout = "board";
    render();
  });
  $$(".kanban-add").forEach((button) =>
    button.addEventListener("click", () =>
      openModal(null, button.dataset.addStatus),
    ),
  );
  $("#kanbanView").addEventListener("click", (event) => {
    const card = event.target.closest(".kanban-card");
    if (!card) return;
    const actionButton = event.target.closest("[data-action]");
    if (actionButton)
      handleTaskAction(actionButton.dataset.action, card.dataset.taskId);
  });
  let draggedId = null;
  $("#kanbanView").addEventListener("dragstart", (event) => {
    const card = event.target.closest(".kanban-card");
    if (!card) return;
    draggedId = card.dataset.taskId;
    card.classList.add("dragging");
    if (event.dataTransfer) {
      event.dataTransfer.setData("text/plain", draggedId);
      event.dataTransfer.effectAllowed = "move";
    }
  });
  $("#kanbanView").addEventListener("dragend", (event) => {
    const card = event.target.closest(".kanban-card");
    if (card) card.classList.remove("dragging");
    $$(".kanban-cards").forEach((el) => el.classList.remove("drag-over"));
  });
  $$(".kanban-cards").forEach((column) => {
    column.addEventListener("dragover", (event) => {
      event.preventDefault();
      column.classList.add("drag-over");
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    });
    column.addEventListener("dragleave", (event) => {
      if (!column.contains(event.relatedTarget))
        column.classList.remove("drag-over");
    });
    column.addEventListener("drop", (event) => {
      event.preventDefault();
      column.classList.remove("drag-over");
      const id = event.dataTransfer?.getData("text/plain") || draggedId;
      const task = tasks.find((t) => String(t.id) === String(id));
      if (task && task.status !== column.dataset.dropStatus) {
        task.status = column.dataset.dropStatus;
        task.updatedAt = Date.now();
        saveTasks();
        render();
        showToast(`Moved to ${statusLabel(task.status)}.`);
      }
    });
  });
  function applyTheme(theme) {
    document.body.classList.toggle("dark", theme === "dark");
    $("#themeIcon").textContent = theme === "dark" ? "☀" : "☾";
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {}
  }
  function toggleTheme() {
    applyTheme(document.body.classList.contains("dark") ? "light" : "dark");
  }
  $("#themeToggle").addEventListener("click", toggleTheme);
  $("#topThemeToggle").addEventListener("click", toggleTheme);
  $("#mobileMenu").addEventListener("click", () =>
    $("#sidebar").classList.toggle("open"),
  );
  document.addEventListener("click", (event) => {
    if (activeMenuId && !event.target.closest(".row-actions")) {
      activeMenuId = null;
      render();
    }
  });
  try {
    applyTheme(localStorage.getItem(THEME_KEY) || "light");
  } catch {
    applyTheme("light");
  }
  setDateAndGreeting();
  render();
})();
