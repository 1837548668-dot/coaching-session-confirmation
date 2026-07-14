(() => {
  "use strict";

  const loginView = document.querySelector("#loginView");
  const dashboardView = document.querySelector("#dashboardView");
  const loginForm = document.querySelector("#loginForm");
  const loginButton = document.querySelector("#loginButton");
  const loginError = document.querySelector("#loginError");
  const recordsBody = document.querySelector("#recordsBody");
  const loadingState = document.querySelector("#loadingState");
  const emptyState = document.querySelector("#emptyState");
  const errorState = document.querySelector("#errorState");
  const searchInput = document.querySelector("#searchInput");
  const statusFilter = document.querySelector("#statusFilter");
  const detailOverlay = document.querySelector("#detailOverlay");
  const detailLoading = document.querySelector("#detailLoading");
  const detailContent = document.querySelector("#detailContent");
  const saveDetailButton = document.querySelector("#saveDetail");
  const recordsNav = document.querySelector("#recordsNav");
  const settingsNav = document.querySelector("#settingsNav");
  const recordsSections = document.querySelectorAll("[data-records-section]");
  const settingsPanel = document.querySelector("#settingsPanel");
  const settingsForm = document.querySelector("#settingsForm");
  const saveSettingsButton = document.querySelector("#saveSettings");

  const state = {
    page: 1,
    pages: 1,
    total: 0,
    query: "",
    status: "all",
    selectedId: null,
    toastTimer: null,
  };

  const statusMeta = {
    new: { label: "新提交", className: "status-new" },
    contacted: { label: "已联系", className: "status-contacted" },
    scheduled: { label: "已排期", className: "status-scheduled" },
    completed: { label: "已完成", className: "status-completed" },
    archived: { label: "已归档", className: "status-archived" },
  };

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginError.textContent = "";
    loginButton.disabled = true;
    loginButton.textContent = "正在验证…";

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ password: loginForm.elements.password.value }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "登录失败");
      loginForm.reset();
      showDashboard();
      await loadRecords();
    } catch (error) {
      loginError.textContent = error.message;
    } finally {
      loginButton.disabled = false;
      loginButton.textContent = "安全登录";
    }
  });

  document.querySelector("#logoutButton").addEventListener("click", async () => {
    await fetch("/api/admin/logout", { method: "POST", credentials: "same-origin" });
    showLogin();
  });

  document.querySelector("#refreshButton").addEventListener("click", () => loadRecords());
  document.querySelector("#retryButton").addEventListener("click", () => loadRecords());

  searchInput.addEventListener(
    "input",
    debounce(() => {
      state.query = searchInput.value.trim();
      state.page = 1;
      loadRecords();
    }, 350),
  );

  statusFilter.addEventListener("change", () => {
    state.status = statusFilter.value;
    state.page = 1;
    loadRecords();
  });

  document.querySelector("#prevPage").addEventListener("click", () => {
    if (state.page <= 1) return;
    state.page -= 1;
    loadRecords();
  });

  document.querySelector("#nextPage").addEventListener("click", () => {
    if (state.page >= state.pages) return;
    state.page += 1;
    loadRecords();
  });

  recordsBody.addEventListener("click", (event) => {
    const row = event.target.closest("tr[data-id]");
    if (row) openDetail(Number(row.dataset.id));
  });

  document.querySelector("#closeDetail").addEventListener("click", closeDetail);
  document.querySelector(".detail-backdrop").addEventListener("click", closeDetail);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !detailOverlay.hidden) closeDetail();
  });

  saveDetailButton.addEventListener("click", saveDetail);
  recordsNav.addEventListener("click", showRecordsView);
  settingsNav.addEventListener("click", showSettingsView);
  settingsForm.addEventListener("submit", saveFormSettings);

  async function boot() {
    try {
      const response = await fetch("/api/admin/session", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("not authenticated");
      showDashboard();
      await loadRecords();
    } catch {
      showLogin();
    }
  }

  function showLogin() {
    dashboardView.hidden = true;
    detailOverlay.hidden = true;
    loginView.hidden = false;
    document.querySelector("#password").focus();
  }

  function showDashboard() {
    loginView.hidden = true;
    dashboardView.hidden = false;
    showRecordsView();
  }

  function showRecordsView() {
    recordsSections.forEach((section) => {
      section.hidden = false;
    });
    settingsPanel.hidden = true;
    recordsNav.classList.add("active");
    settingsNav.classList.remove("active");
  }

  async function showSettingsView() {
    recordsSections.forEach((section) => {
      section.hidden = true;
    });
    settingsPanel.hidden = false;
    recordsNav.classList.remove("active");
    settingsNav.classList.add("active");
    await loadFormSettings();
  }

  async function loadFormSettings() {
    const errorElement = document.querySelector("#settingsError");
    errorElement.textContent = "";
    saveSettingsButton.disabled = true;
    saveSettingsButton.textContent = "正在加载…";
    try {
      const response = await api("/api/admin/form-settings");
      const result = await response.json();
      const settings = result.settings;
      document.querySelector("#introText").value = settings.introText;
      document.querySelector("#topicsTitle").value = settings.topicsTitle;
      renderTopicFields(settings.topics);
      document.querySelector("#settingsUpdatedAt").textContent = settings.updatedAt
        ? `上次保存：${formatDateTime(new Date(settings.updatedAt).toISOString())}`
        : "当前为默认内容";
    } catch (error) {
      if (error.status === 401) {
        showLogin();
        return;
      }
      errorElement.textContent = error.message || "内容加载失败";
    } finally {
      saveSettingsButton.disabled = false;
      saveSettingsButton.textContent = "保存并更新客户页";
    }
  }

  function renderTopicFields(topics) {
    const container = document.querySelector("#topicFields");
    container.replaceChildren(
      ...topics.map((topic, index) => {
        const label = document.createElement("label");
        const number = document.createElement("span");
        number.textContent = `第 ${index + 1} 条`;
        const input = document.createElement("textarea");
        input.rows = 2;
        input.maxLength = 240;
        input.required = true;
        input.value = topic;
        input.dataset.topic = String(index);
        label.append(number, input);
        return label;
      }),
    );
  }

  async function saveFormSettings(event) {
    event.preventDefault();
    if (!settingsForm.reportValidity()) return;
    const errorElement = document.querySelector("#settingsError");
    errorElement.textContent = "";
    saveSettingsButton.disabled = true;
    saveSettingsButton.textContent = "正在保存…";
    try {
      const response = await api("/api/admin/form-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          introText: document.querySelector("#introText").value,
          topicsTitle: document.querySelector("#topicsTitle").value,
          topics: Array.from(document.querySelectorAll("[data-topic]"), (input) => input.value),
        }),
      });
      const result = await response.json();
      document.querySelector("#settingsUpdatedAt").textContent = `上次保存：${formatDateTime(
        new Date(result.settings.updatedAt).toISOString(),
      )}`;
      showToast("客户页内容已更新");
    } catch (error) {
      if (error.status === 401) {
        showLogin();
      } else {
        errorElement.textContent = error.message || "保存失败";
      }
    } finally {
      saveSettingsButton.disabled = false;
      saveSettingsButton.textContent = "保存并更新客户页";
    }
  }

  async function loadRecords() {
    setPanelState("loading");
    const params = new URLSearchParams({
      page: String(state.page),
      limit: "20",
      status: state.status,
      q: state.query,
    });

    try {
      const response = await api(`/api/admin/submissions?${params}`);
      const result = await response.json();
      renderRecords(result.items);
      renderStats(result.stats);
      state.page = result.pagination.page;
      state.pages = result.pagination.pages;
      state.total = result.pagination.total;
      renderPagination();
      setPanelState(result.items.length ? "ready" : "empty");
    } catch (error) {
      if (error.status === 401) {
        showLogin();
        return;
      }
      console.error(error);
      setPanelState("error");
    }
  }

  function renderRecords(items) {
    recordsBody.replaceChildren(
      ...items.map((record) => {
        const row = document.createElement("tr");
        row.dataset.id = record.id;

        const clientCell = document.createElement("td");
        clientCell.className = "client-cell";
        const name = document.createElement("strong");
        name.textContent = record.client_name;
        const contact = document.createElement("small");
        contact.textContent = record.contact;
        clientCell.append(name, contact);

        const sessionCell = document.createElement("td");
        sessionCell.textContent = formatDateTime(record.session_at);

        const modeCell = document.createElement("td");
        modeCell.textContent = record.session_mode;

        const submittedCell = document.createElement("td");
        submittedCell.textContent = formatDateTime(record.submitted_at);

        const statusCell = document.createElement("td");
        statusCell.append(createStatusBadge(record.status));

        const actionCell = document.createElement("td");
        const action = document.createElement("button");
        action.className = "record-action";
        action.type = "button";
        action.textContent = "查看详情";
        actionCell.append(action);

        row.append(clientCell, sessionCell, modeCell, submittedCell, statusCell, actionCell);
        return row;
      }),
    );
  }

  function renderStats(stats) {
    document.querySelector("#statTotal").textContent = stats.total;
    document.querySelector("#statNew").textContent = stats.new;
    document.querySelector("#statUpcoming").textContent = stats.upcoming;
    document.querySelector("#statCompleted").textContent = stats.completed;
  }

  function renderPagination() {
    document.querySelector("#resultCount").textContent = `共 ${state.total} 条`;
    document.querySelector("#pageLabel").textContent = `${state.page} / ${state.pages}`;
    document.querySelector("#prevPage").disabled = state.page <= 1;
    document.querySelector("#nextPage").disabled = state.page >= state.pages;
  }

  function setPanelState(value) {
    loadingState.hidden = value !== "loading";
    emptyState.hidden = value !== "empty";
    errorState.hidden = value !== "error";
  }

  async function openDetail(id) {
    state.selectedId = id;
    detailOverlay.hidden = false;
    detailLoading.hidden = false;
    detailContent.hidden = true;
    document.body.style.overflow = "hidden";

    try {
      const response = await api(`/api/admin/submissions/${id}`);
      const result = await response.json();
      populateDetail(result.record);
      detailLoading.hidden = true;
      detailContent.hidden = false;
    } catch (error) {
      closeDetail();
      if (error.status === 401) {
        showLogin();
      } else {
        showToast("详情加载失败，请稍后重试");
      }
    }
  }

  function populateDetail(record) {
    setText("#detailTitle", record.client_name);
    setText("#detailRecordId", record.record_id);
    setText("#detailClientName", record.client_name);
    setText("#detailContact", record.contact);
    setText("#detailSessionAt", formatDateTime(record.session_at));
    setText("#detailSessionMode", record.session_mode);
    setText("#detailSubmittedAt", formatDateTime(record.submitted_at));
    setText("#detailTimezone", record.timezone);
    setText("#detailCoreIssue", record.core_issue);
    setText("#detailHash", record.record_hash);

    const statusBadge = document.querySelector("#detailStatusBadge");
    statusBadge.className = "status-badge";
    const meta = statusMeta[record.status] || statusMeta.new;
    statusBadge.textContent = meta.label;
    statusBadge.classList.add(meta.className);

    document.querySelector("#detailSignature").src = record.signature_data;
    document.querySelector("#detailStatus").value = record.status;
    document.querySelector("#detailNotes").value = record.notes || "";
    document.querySelector("#detailError").textContent = "";
  }

  async function saveDetail() {
    if (!state.selectedId) return;
    saveDetailButton.disabled = true;
    saveDetailButton.textContent = "正在保存…";
    document.querySelector("#detailError").textContent = "";

    try {
      const response = await api(`/api/admin/submissions/${state.selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: document.querySelector("#detailStatus").value,
          notes: document.querySelector("#detailNotes").value,
        }),
      });
      await response.json();
      showToast("跟进信息已保存");
      closeDetail();
      await loadRecords();
    } catch (error) {
      if (error.status === 401) {
        closeDetail();
        showLogin();
      } else {
        document.querySelector("#detailError").textContent = error.message || "保存失败";
      }
    } finally {
      saveDetailButton.disabled = false;
      saveDetailButton.textContent = "保存跟进信息";
    }
  }

  function closeDetail() {
    detailOverlay.hidden = true;
    document.body.style.overflow = "";
    state.selectedId = null;
  }

  async function api(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      cache: "no-store",
      ...options,
    });
    if (!response.ok) {
      let message = "请求失败";
      try {
        message = (await response.json()).message || message;
      } catch {
        // Keep fallback.
      }
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    return response;
  }

  function createStatusBadge(status) {
    const badge = document.createElement("span");
    const meta = statusMeta[status] || statusMeta.new;
    badge.className = `status-badge ${meta.className}`;
    badge.textContent = meta.label;
    return badge;
  }

  function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  }

  function setText(selector, value) {
    document.querySelector(selector).textContent = value || "—";
  }

  function showToast(message) {
    const toast = document.querySelector("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
  }

  function debounce(callback, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => callback(...args), delay);
    };
  }

  boot();
})();
