(() => {
  "use strict";

  const config = {
    brandName: "AI星球",
    logoPath: "./assets/ai-planet-logo.jpg",
    submissionEndpoint: "",
    ...(window.APP_CONFIG || {}),
  };

  const form = document.querySelector("#briefForm");
  const canvas = document.querySelector("#signaturePad");
  const hint = document.querySelector("#signatureHint");
  const error = document.querySelector("#signatureError");
  const submitButton = document.querySelector("#submitButton");
  const modal = document.querySelector("#successModal");
  const storageNote = document.querySelector("#storageNote");
  const context = canvas.getContext("2d");
  const strokes = [];
  const pageStartedAt = Date.now();
  let activeStroke = null;
  let currentRecord = null;
  let toastTimer = null;

  document.querySelectorAll("[data-brand]").forEach((element) => {
    element.textContent = config.brandName;
  });
  const currentYear = document.querySelector("#currentYear");
  if (currentYear) currentYear.textContent = new Date().getFullYear();
  document.title = `${config.brandName} · 客户辅导确认函`;

  const sessionInput = form.elements.sessionAt;
  const now = new Date();
  now.setHours(now.getHours() + 1);
  now.setSeconds(0, 0);
  sessionInput.min = toLocalDateTime(new Date());
  sessionInput.value = toLocalDateTime(now);
  loadFormSettings();

  form.querySelectorAll("textarea[maxlength]").forEach((textarea) => {
    const counter = document.querySelector(`[data-for="${textarea.name}"]`);
    const update = () => {
      counter.textContent = `${textarea.value.length} / ${textarea.maxLength}`;
    };
    textarea.addEventListener("input", update);
    update();
  });

  function toLocalDateTime(date) {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  async function loadFormSettings() {
    const endpoint = config.submissionEndpoint
      ? config.submissionEndpoint.replace(/\/api\/submissions(?:\?.*)?$/, "/api/form-settings")
      : "/api/form-settings";
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      if (!response.ok) return;
      const result = await response.json();
      const settings = result.settings;
      if (!settings) return;
      document.querySelector("#formIntroText").textContent = settings.introText;
      document.querySelector("#formTopicsTitle").textContent = settings.topicsTitle;
      document.querySelector("#formContentText").textContent = settings.contentText;
      document.querySelector("#formAgreementTitle").textContent = settings.agreementTitle;
      document.querySelector("#formAgreementText").textContent = settings.agreementText;
    } catch {
      // 网络异常时继续显示页面内置的默认内容。
    }
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    redraw();
  }

  function redraw() {
    const rect = canvas.getBoundingClientRect();
    context.clearRect(0, 0, rect.width, rect.height);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#102c3b";
    context.lineWidth = 2.4;

    strokes.forEach((stroke) => {
      if (!stroke.length) return;
      context.beginPath();
      context.moveTo(stroke[0].x * rect.width, stroke[0].y * rect.height);
      if (stroke.length === 1) {
        context.lineTo(
          stroke[0].x * rect.width + 0.01,
          stroke[0].y * rect.height + 0.01,
        );
      } else {
        for (let index = 1; index < stroke.length; index += 1) {
          const point = stroke[index];
          context.lineTo(point.x * rect.width, point.y * rect.height);
        }
      }
      context.stroke();
    });

    hint.hidden = strokes.length > 0;
  }

  function pointFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  }

  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    activeStroke = [pointFromEvent(event)];
    strokes.push(activeStroke);
    error.textContent = "";
    redraw();
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!activeStroke) return;
    event.preventDefault();
    activeStroke.push(pointFromEvent(event));
    redraw();
  });

  const stopDrawing = () => {
    activeStroke = null;
  };
  canvas.addEventListener("pointerup", stopDrawing);
  canvas.addEventListener("pointercancel", stopDrawing);

  document.querySelector("#undoSignature").addEventListener("click", () => {
    strokes.pop();
    redraw();
  });

  document.querySelector("#clearSignature").addEventListener("click", () => {
    strokes.length = 0;
    redraw();
  });

  window.addEventListener("resize", debounce(resizeCanvas, 120));
  resizeCanvas();

  function signatureDataUrl() {
    const output = document.createElement("canvas");
    output.width = 900;
    output.height = 300;
    const outputContext = output.getContext("2d");
    outputContext.clearRect(0, 0, output.width, output.height);
    outputContext.lineCap = "round";
    outputContext.lineJoin = "round";
    outputContext.strokeStyle = "#102c3b";
    outputContext.lineWidth = 5;

    strokes.forEach((stroke) => {
      if (!stroke.length) return;
      outputContext.beginPath();
      outputContext.moveTo(stroke[0].x * output.width, stroke[0].y * output.height);
      stroke.slice(1).forEach((point) => {
        outputContext.lineTo(point.x * output.width, point.y * output.height);
      });
      outputContext.stroke();
    });
    return output.toDataURL("image/png");
  }

  function createRecordId() {
    const date = new Date();
    const datePart = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("");
    const timePart = [
      String(date.getHours()).padStart(2, "0"),
      String(date.getMinutes()).padStart(2, "0"),
      String(date.getSeconds()).padStart(2, "0"),
    ].join("");
    const random = crypto.getRandomValues(new Uint16Array(1))[0]
      .toString(16)
      .toUpperCase()
      .padStart(4, "0");
    return `CS-${datePart}-${timePart}-${random}`;
  }

  async function digestRecord(record) {
    const hashable = { ...record, signature: undefined, hash: undefined };
    const bytes = new TextEncoder().encode(JSON.stringify(hashable));
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  function formatDateTime(value) {
    const date = new Date(value);
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  }

  async function syncRecord(record) {
    if (!config.submissionEndpoint) return { synced: false, reason: "not-configured" };
    const response = await fetch(config.submissionEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    });
    if (!response.ok) throw new Error(`同步失败：${response.status}`);
    return { synced: true };
  }

  function storeLocally(record) {
    const key = "coaching-confirmation-records-v1";
    try {
      const existing = JSON.parse(localStorage.getItem(key) || "[]");
      existing.unshift(record);
      localStorage.setItem(key, JSON.stringify(existing.slice(0, 20)));
      return true;
    } catch (storageError) {
      console.warn("Local storage unavailable", storageError);
      return false;
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!form.reportValidity()) return;
    if (strokes.length === 0) {
      error.textContent = "请先完成本人手写签名。";
      canvas.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setSubmitting(true);
    form.elements.coreIssue.value = document
      .querySelector("#formContentText")
      .textContent.trim()
      .slice(0, 800);
    const formData = new FormData(form);
    const submittedAt = new Date().toISOString();
    const record = {
      version: 2,
      recordId: createRecordId(),
      brandName: config.brandName,
      clientName: formData.get("clientName").trim(),
      contact: formData.get("contact").trim(),
      sessionAt: new Date(formData.get("sessionAt")).toISOString(),
      sessionMode: formData.get("sessionMode"),
      coreIssue: formData.get("coreIssue").trim(),
      website: formData.get("website") || "",
      pageStartedAt,
      truthConfirmed: formData.get("truthConfirmed") === "on",
      serviceConfirmed: formData.get("serviceConfirmed") === "on",
      signature: signatureDataUrl(),
      submittedAt,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      hash: "",
    };
    record.hash = await digestRecord(record);

    const savedLocally = storeLocally(record);
    let syncResult = { synced: false };
    try {
      syncResult = await syncRecord(record);
    } catch (syncError) {
      console.error(syncError);
      syncResult = { synced: false, reason: "failed" };
    }

    currentRecord = record;
    populateReceipt(record);

    if (syncResult.synced) {
      storageNote.textContent = "本次记录已同步至 AI星球管理后台，同时已保存在当前设备。";
    } else if (syncResult.reason === "failed") {
      storageNote.textContent =
        "后台同步暂时失败，请务必保存或分享图片凭证；记录已保存在当前设备。";
    } else if (savedLocally) {
      storageNote.textContent =
        "当前版本已将记录保存在本设备；请保存或分享图片给顾问，完成团队端留档。";
    } else {
      storageNote.textContent = "浏览器未允许本地保存，请立即保存或分享图片凭证。";
    }

    modal.hidden = false;
    document.body.style.overflow = "hidden";
    setSubmitting(false);
  });

  function setSubmitting(isSubmitting) {
    submitButton.disabled = isSubmitting;
    submitButton.querySelector("span").textContent = isSubmitting
      ? "正在生成凭证…"
      : "确认无误，签名并提交";
  }

  function populateReceipt(record) {
    const displayValues = {
      clientName: record.clientName,
      sessionAt: formatDateTime(record.sessionAt),
      sessionMode: record.sessionMode,
      submittedAt: formatDateTime(record.submittedAt),
      recordId: record.recordId,
      hash: record.hash,
    };
    Object.entries(displayValues).forEach(([key, value]) => {
      document.querySelectorAll(`[data-receipt="${key}"]`).forEach((element) => {
        element.textContent = value;
      });
    });
    document.querySelector("#receiptSignature").src = record.signature;
  }

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = "";
  }

  document.querySelector("#closeModal").addEventListener("click", closeModal);
  document.querySelector(".modal-backdrop").addEventListener("click", closeModal);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) closeModal();
  });

  document.querySelector("#copyRecordId").addEventListener("click", async () => {
    if (!currentRecord) return;
    await navigator.clipboard.writeText(currentRecord.recordId);
    showToast("凭证编号已复制");
  });

  document.querySelector("#printReceipt").addEventListener("click", () => {
    window.print();
  });

  document.querySelector("#shareReceipt").addEventListener("click", async () => {
    if (!currentRecord) return;
    const blob = await createReceiptImage(currentRecord);
    const filename = `辅导确认凭证-${currentRecord.clientName}-${currentRecord.recordId}.png`;
    const file = new File([blob], filename, { type: "image/png" });

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: "客户辅导会前确认凭证",
          text: `凭证编号：${currentRecord.recordId}`,
        });
        return;
      } catch (shareError) {
        if (shareError.name === "AbortError") return;
      }
    }

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showToast("图片凭证已保存，请发送给您的服务顾问");
  });

  async function createReceiptImage(record) {
    const output = document.createElement("canvas");
    output.width = 1240;
    output.height = 1754;
    const ctx = output.getContext("2d");

    ctx.fillStyle = "#f8f5ef";
    ctx.fillRect(0, 0, output.width, output.height);
    ctx.fillStyle = "#102c3b";
    ctx.fillRect(0, 0, output.width, 28);

    ctx.textAlign = "left";
    ctx.fillStyle = "#b9965b";
    ctx.font = '600 25px "Microsoft YaHei", sans-serif';
    ctx.fillText("CLIENT SUCCESS · PRE-SESSION BRIEF", 94, 108);

    ctx.fillStyle = "#102c3b";
    ctx.font = '700 62px "Microsoft YaHei", sans-serif';
    ctx.fillText("客户辅导服务", 94, 195);
    ctx.font = '700 78px "Microsoft YaHei", sans-serif';
    ctx.fillText("会前确认凭证", 94, 290);

    roundedRect(ctx, 940, 115, 204, 70, 35, "#e5f0eb");
    ctx.fillStyle = "#397b68";
    ctx.font = '600 28px "Microsoft YaHei", sans-serif';
    ctx.textAlign = "center";
    ctx.fillText("已签署", 1042, 160);
    ctx.textAlign = "left";

    ctx.strokeStyle = "#d8d4ca";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(94, 350);
    ctx.lineTo(1146, 350);
    ctx.stroke();

    const rows = [
      ["客户姓名", record.clientName, "联系电话 / 微信", record.contact],
      ["预约时间", formatDateTime(record.sessionAt), "辅导方式", record.sessionMode],
      ["提交时间", formatDateTime(record.submittedAt), "记录状态", "本人已签署"],
    ];

    rows.forEach((row, index) => {
      const y = 425 + index * 120;
      drawLabelValue(ctx, 94, y, row[0], row[1]);
      drawLabelValue(ctx, 650, y, row[2], row[3]);
    });

    ctx.strokeStyle = "#d8d4ca";
    ctx.beginPath();
    ctx.moveTo(94, 740);
    ctx.lineTo(1146, 740);
    ctx.stroke();

    ctx.fillStyle = "#7d8788";
    ctx.font = '400 23px "Microsoft YaHei", sans-serif';
    ctx.fillText("本次希望解决的核心问题", 94, 810);
    ctx.fillStyle = "#263941";
    ctx.font = '500 30px "Microsoft YaHei", sans-serif';
    wrapText(ctx, record.coreIssue, 94, 858, 1052, 48, 5);

    ctx.fillStyle = "#7d8788";
    ctx.font = '400 23px "Microsoft YaHei", sans-serif';
    ctx.fillText("客户本人电子手写签名", 94, 1165);

    const signatureImage = await loadImage(record.signature);
    ctx.drawImage(signatureImage, 94, 1190, 520, 180);
    ctx.strokeStyle = "#bfc7c5";
    ctx.beginPath();
    ctx.moveTo(94, 1383);
    ctx.lineTo(620, 1383);
    ctx.stroke();

    const brandImage = await loadImage(config.logoPath);
    ctx.drawImage(brandImage, 966, 1168, 150, 150);

    ctx.textAlign = "right";
    ctx.fillStyle = "#102c3b";
    ctx.font = '700 32px "Microsoft YaHei", sans-serif';
    ctx.fillText(record.brandName, 1146, 1354);
    ctx.fillStyle = "#899294";
    ctx.font = '400 20px "Microsoft YaHei", sans-serif';
    ctx.fillText("服务记录专用", 1146, 1386);
    ctx.textAlign = "left";

    roundedRect(ctx, 94, 1450, 1052, 140, 16, "#102c3b");
    ctx.fillStyle = "#b9c7cb";
    ctx.font = '400 20px "Microsoft YaHei", sans-serif';
    ctx.fillText("凭证编号", 132, 1498);
    ctx.fillStyle = "#ffffff";
    ctx.font = '600 29px Consolas, monospace';
    ctx.fillText(record.recordId, 132, 1544);

    ctx.fillStyle = "#8d989a";
    ctx.font = '400 17px Consolas, monospace';
    ctx.fillText(`SHA-256 校验码：${record.hash}`, 94, 1645);
    ctx.font = '400 19px "Microsoft YaHei", sans-serif';
    ctx.fillText(
      "本凭证用于记录本次辅导准备信息，不替代双方另行签署的正式服务合同。",
      94,
      1692,
    );

    return new Promise((resolve) => output.toBlob(resolve, "image/png", 0.96));
  }

  function drawLabelValue(ctx, x, y, label, value) {
    ctx.fillStyle = "#899294";
    ctx.font = '400 20px "Microsoft YaHei", sans-serif';
    ctx.fillText(label, x, y);
    ctx.fillStyle = "#25373e";
    ctx.font = '600 28px "Microsoft YaHei", sans-serif';
    ctx.fillText(truncateText(ctx, value, 460), x, y + 43);
  }

  function truncateText(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let result = text;
    while (result.length && ctx.measureText(`${result}…`).width > maxWidth) {
      result = result.slice(0, -1);
    }
    return `${result}…`;
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    const characters = Array.from(text);
    const lines = [];
    let line = "";
    characters.forEach((character) => {
      const testLine = line + character;
      if (ctx.measureText(testLine).width > maxWidth && line) {
        lines.push(line);
        line = character;
      } else {
        line = testLine;
      }
    });
    if (line) lines.push(line);

    lines.slice(0, maxLines).forEach((currentLine, index) => {
      let displayLine = currentLine;
      if (index === maxLines - 1 && lines.length > maxLines) {
        displayLine = `${displayLine.slice(0, -1)}…`;
      }
      ctx.fillText(displayLine, x, y + index * lineHeight);
    });
  }

  function roundedRect(ctx, x, y, width, height, radius, fill) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function loadImage(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = source;
    });
  }

  function showToast(message) {
    const toast = document.querySelector("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
  }

  function debounce(callback, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => callback(...args), delay);
    };
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }
})();
