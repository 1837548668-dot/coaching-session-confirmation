const SESSION_COOKIE = "ai_planet_admin";
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const MAX_BODY_BYTES = 900_000;
const ADMIN_STATUSES = new Set(["new", "contacted", "scheduled", "completed", "archived"]);
const DEFAULT_FORM_SETTINGS = {
  introText:
    "本次课程交付为轩辕（上海）教育科技有限公司（甲方）和________（乙方姓名）合作服务内容：课程仅限168000/268000元私董会成员参加，根据课程协议要求，为了保护双方的合法权益，如约完成课程的交付内容，甲方以书面形式告知本课程的内容明细及注意事项：",
  topicsTitle: "本次辅导内容",
  contentText:
    "如何精准看懂商业周期，把握时代风口与财富机遇？\n如何锤炼强大心理素质，在商业竞争中从容破局？\n如何打造世界级营销体系，实现品牌与业绩双爆发？\n如何搭建顶尖商业组织，筑牢企业发展根基？\n如何做好科学目标管理，让每一步行动都指向成功？\n如何打造疯狂粉丝社群，沉淀高粘性客户资产？\n如何实现企业自动化运营，摆脱事务性缠身？\n如何搭建多元被动收入管道，实现财富自由？\n如何做好全球资产配置，守住并放大财富？",
  agreementTitle: "特别约定（必读）",
  agreementText:
    "退款说明：本课程为线下知识交付服务，一经报名确认，费用不予退款；课程结束时，视为服务已完成，后续可以申请复训，仅需承担相应食宿场地费等。\n\n知识产权：课程所有内容（课件、话术、工具、音视频等）归甲方所有，禁止录音、录像、复制、传播、商用，违者追究法律责任。\n\n乙方签字即确认已充分知悉并同意以上全部条款。",
};

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      if (url.pathname.startsWith("/api/")) {
        return await handleApi(request, env, url);
      }

      if (url.pathname === "/admin") {
        return Response.redirect(`${url.origin}/admin/`, 302);
      }

      const response = await env.ASSETS.fetch(request);
      return withSecurityHeaders(response, url.pathname);
    } catch (error) {
      console.error("Unhandled worker error", error);
      return json({ ok: false, message: "服务暂时不可用，请稍后重试。" }, 500);
    }
  },
};

async function handleApi(request, env, url) {
  const corsHeaders = buildCorsHeaders(request, env, url);

  if (request.method === "OPTIONS") {
    if (!corsHeaders) return new Response(null, { status: 403 });
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (url.pathname === "/api/health" && request.method === "GET") {
    return json({ ok: true, service: "ai-planet-coaching", time: new Date().toISOString() });
  }

  if (url.pathname === "/api/submissions" && request.method === "POST") {
    if (!corsHeaders && request.headers.get("Origin")) {
      return json({ ok: false, message: "不允许的提交来源。" }, 403);
    }
    const response = await createSubmission(request, env);
    return addHeaders(response, corsHeaders || {});
  }

  if (url.pathname === "/api/form-settings" && request.method === "GET") {
    return getFormSettings(env, true);
  }

  if (url.pathname === "/api/admin/login" && request.method === "POST") {
    return adminLogin(request, env);
  }

  if (url.pathname === "/api/admin/logout" && request.method === "POST") {
    return json(
      { ok: true },
      200,
      {
        "Set-Cookie": clearSessionCookie(),
        "Cache-Control": "no-store",
      },
    );
  }

  const sessionValid = await verifyAdminSession(request, env);
  if (!sessionValid) {
    return json({ ok: false, message: "请先登录管理后台。" }, 401, {
      "Cache-Control": "no-store",
    });
  }

  if (url.pathname === "/api/admin/session" && request.method === "GET") {
    return json({ ok: true, authenticated: true }, 200, { "Cache-Control": "no-store" });
  }

  if (url.pathname === "/api/admin/submissions" && request.method === "GET") {
    return listSubmissions(env, url);
  }

  if (url.pathname === "/api/admin/form-settings" && request.method === "GET") {
    return getFormSettings(env, false);
  }
  if (url.pathname === "/api/admin/form-settings" && request.method === "PUT") {
    return updateFormSettings(request, env);
  }

  if (url.pathname === "/api/admin/export.csv" && request.method === "GET") {
    return exportCsv(env);
  }

  const detailMatch = url.pathname.match(/^\/api\/admin\/submissions\/(\d+)$/);
  if (detailMatch && request.method === "GET") {
    return getSubmission(env, Number(detailMatch[1]));
  }
  if (detailMatch && request.method === "PATCH") {
    return updateSubmission(request, env, Number(detailMatch[1]));
  }

  return json({ ok: false, message: "接口不存在。" }, 404);
}

async function getFormSettings(env, isPublic) {
  const row = await env.DB.prepare(
    `SELECT intro_text, topics_title, content_text, agreement_title,
      agreement_text, updated_at FROM form_settings WHERE id = 1`,
  ).first();
  const settings = row
    ? {
        introText: row.intro_text,
        topicsTitle: row.topics_title,
        contentText: row.content_text,
        agreementTitle: row.agreement_title,
        agreementText: row.agreement_text,
        updatedAt: row.updated_at,
      }
    : { ...DEFAULT_FORM_SETTINGS, updatedAt: 0 };
  return json(
    { ok: true, settings },
    200,
    isPublic
      ? { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" }
      : { "Cache-Control": "no-store" },
  );
}

async function updateFormSettings(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, message: "页面内容格式不正确。" }, 400);
  }

  const introText = cleanString(body.introText, 2000);
  const topicsTitle = cleanString(body.topicsTitle, 100);
  const contentText = cleanString(body.contentText, 6000);
  const agreementTitle = cleanString(body.agreementTitle, 100);
  const agreementText = cleanString(body.agreementText, 6000);
  if (!introText) return json({ ok: false, message: "请填写中间的课程交付说明。" }, 400);
  if (!topicsTitle) return json({ ok: false, message: "请填写辅导内容标题。" }, 400);
  if (!contentText) return json({ ok: false, message: "请填写本次辅导内容。" }, 400);
  if (!agreementTitle) return json({ ok: false, message: "请填写特别约定标题。" }, 400);
  if (!agreementText) return json({ ok: false, message: "请填写特别约定内容。" }, 400);

  const updatedAt = Date.now();
  await env.DB.prepare(
    `INSERT INTO form_settings (
       id, intro_text, topics_title, content_text, agreement_title, agreement_text,
       topics_json, updated_at
     ) VALUES (1, ?, ?, ?, ?, ?, '[]', ?)
     ON CONFLICT(id) DO UPDATE SET
       intro_text = excluded.intro_text,
       topics_title = excluded.topics_title,
       content_text = excluded.content_text,
       agreement_title = excluded.agreement_title,
       agreement_text = excluded.agreement_text,
       updated_at = excluded.updated_at`,
  )
    .bind(introText, topicsTitle, contentText, agreementTitle, agreementText, updatedAt)
    .run();
  return json({
    ok: true,
    settings: { introText, topicsTitle, contentText, agreementTitle, agreementText, updatedAt },
  });
}

async function createSubmission(request, env) {
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return json({ ok: false, message: "签名数据过大，请清空后重新签名。" }, 413);
  }

  const ipHash = await hashIdentifier(request.headers.get("CF-Connecting-IP") || "unknown", env);
  const now = Date.now();
  const recentWindow = now - 10 * 60 * 1000;

  const recent = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM submission_events WHERE ip_hash = ? AND created_at > ?",
  )
    .bind(ipHash, recentWindow)
    .first();
  if (Number(recent?.count || 0) >= 6) {
    return json({ ok: false, message: "提交过于频繁，请稍后再试。" }, 429);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, message: "提交内容格式不正确。" }, 400);
  }

  const validation = validateSubmission(payload);
  if (!validation.ok) {
    return json({ ok: false, message: validation.message }, 400);
  }

  const record = validation.value;
  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO submissions (
          record_id, brand_name, client_name, contact, session_at, session_mode,
          core_issue, truth_confirmed, service_confirmed, signature_data,
          submitted_at, timezone, record_hash, status, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', '', ?, ?)`,
      ).bind(
        record.recordId,
        record.brandName,
        record.clientName,
        record.contact,
        record.sessionAt,
        record.sessionMode,
        record.coreIssue,
        record.truthConfirmed ? 1 : 0,
        record.serviceConfirmed ? 1 : 0,
        record.signature,
        record.submittedAt,
        record.timezone,
        record.hash,
        now,
        now,
      ),
      env.DB.prepare("INSERT INTO submission_events (ip_hash, created_at) VALUES (?, ?)").bind(
        ipHash,
        now,
      ),
      env.DB.prepare("DELETE FROM submission_events WHERE created_at < ?").bind(
        now - 24 * 60 * 60 * 1000,
      ),
    ]);
  } catch (error) {
    if (String(error).includes("UNIQUE")) {
      return json({ ok: false, message: "这份凭证已经提交过，请勿重复操作。" }, 409);
    }
    throw error;
  }

  const saved = await env.DB.prepare(
    "SELECT id, record_id FROM submissions WHERE record_id = ?",
  )
    .bind(record.recordId)
    .first();

  return json(
    {
      ok: true,
      synced: true,
      id: saved.id,
      recordId: saved.record_id,
    },
    201,
  );
}

function validateSubmission(input) {
  if (!input || typeof input !== "object") {
    return invalid("缺少提交内容。");
  }
  if (input.website) return invalid("提交未通过安全检查。");

  const pageStartedAt = Number(input.pageStartedAt || 0);
  if (pageStartedAt && Date.now() - pageStartedAt < 1800) {
    return invalid("填写时间过短，请检查内容后重新提交。");
  }

  const recordId = cleanString(input.recordId, 64);
  const brandName = cleanString(input.brandName || "AI星球", 40);
  const clientName = cleanString(input.clientName, 30);
  const contact = cleanString(input.contact, 60);
  const sessionMode = cleanString(input.sessionMode, 20);
  const coreIssue = cleanString(input.coreIssue, 800);
  const timezone = cleanString(input.timezone || "Asia/Shanghai", 80);
  const signature = typeof input.signature === "string" ? input.signature : "";
  const hash = cleanString(input.hash, 128).toLowerCase();
  const sessionAt = parseIsoDate(input.sessionAt);
  const submittedAt = parseIsoDate(input.submittedAt);

  if (!/^CS-\d{8}-\d{6}-[0-9A-F]{4}$/.test(recordId)) return invalid("凭证编号无效。");
  if (!clientName) return invalid("请填写客户姓名。");
  if (!contact) return invalid("请填写联系电话或微信。");
  if (!sessionAt) return invalid("请选择有效的预约时间。");
  if (!["线上视频", "线下面谈", "电话沟通", "其他方式"].includes(sessionMode)) {
    return invalid("请选择有效的辅导方式。");
  }
  if (!coreIssue) return invalid("请填写本次希望解决的核心问题。");
  if (!submittedAt) return invalid("提交时间无效。");
  if (input.truthConfirmed !== true || input.serviceConfirmed !== true) {
    return invalid("请完成提交前确认。");
  }
  if (!signature.startsWith("data:image/png;base64,") || signature.length > 750_000) {
    return invalid("电子签名无效或数据过大。");
  }
  if (!/^[a-f0-9]{64}$/.test(hash)) return invalid("凭证校验码无效。");

  return {
    ok: true,
    value: {
      recordId,
      brandName,
      clientName,
      contact,
      sessionAt,
      sessionMode,
      coreIssue,
      truthConfirmed: true,
      serviceConfirmed: true,
      signature,
      submittedAt,
      timezone,
      hash,
    },
  };
}

async function adminLogin(request, env) {
  const ipHash = await hashIdentifier(request.headers.get("CF-Connecting-IP") || "unknown", env);
  const now = Date.now();
  const lockWindow = now - 15 * 60 * 1000;

  const attempts = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM admin_login_attempts WHERE ip_hash = ? AND created_at > ?",
  )
    .bind(ipHash, lockWindow)
    .first();
  if (Number(attempts?.count || 0) >= 10) {
    return json({ ok: false, message: "登录尝试过多，请 15 分钟后再试。" }, 429, {
      "Cache-Control": "no-store",
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, message: "请输入管理密码。" }, 400);
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (!env.ADMIN_PASSWORD || !(await safeEqual(password, env.ADMIN_PASSWORD))) {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO admin_login_attempts (ip_hash, created_at) VALUES (?, ?)").bind(
        ipHash,
        now,
      ),
      env.DB.prepare("DELETE FROM admin_login_attempts WHERE created_at < ?").bind(
        now - 24 * 60 * 60 * 1000,
      ),
    ]);
    return json({ ok: false, message: "管理密码不正确。" }, 401, {
      "Cache-Control": "no-store",
    });
  }

  await env.DB.prepare("DELETE FROM admin_login_attempts WHERE ip_hash = ?").bind(ipHash).run();
  const cookie = await createSessionCookie(env);
  return json(
    { ok: true },
    200,
    {
      "Set-Cookie": cookie,
      "Cache-Control": "no-store",
    },
  );
}

async function listSubmissions(env, url) {
  const page = clamp(Number(url.searchParams.get("page") || 1), 1, 10_000);
  const limit = clamp(Number(url.searchParams.get("limit") || 20), 10, 100);
  const offset = (page - 1) * limit;
  const status = cleanString(url.searchParams.get("status") || "all", 20);
  const query = cleanString(url.searchParams.get("q") || "", 80);

  const where = [];
  const params = [];
  if (status !== "all" && ADMIN_STATUSES.has(status)) {
    where.push("status = ?");
    params.push(status);
  }
  if (query) {
    where.push(
      "(client_name LIKE ? ESCAPE '\\' OR contact LIKE ? ESCAPE '\\' OR record_id LIKE ? ESCAPE '\\' OR core_issue LIKE ? ESCAPE '\\')",
    );
    const search = `%${query.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
    params.push(search, search, search, search);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const listStatement = env.DB.prepare(
    `SELECT id, record_id, client_name, contact, session_at, session_mode,
      core_issue, submitted_at, status, notes, updated_at
     FROM submissions ${whereSql}
     ORDER BY submitted_at DESC
     LIMIT ? OFFSET ?`,
  ).bind(...params, limit, offset);
  const countStatement = env.DB.prepare(
    `SELECT COUNT(*) AS count FROM submissions ${whereSql}`,
  ).bind(...params);

  const [listResult, countResult, totalStats, newStats, completedStats, upcomingStats] =
    await env.DB.batch([
      listStatement,
      countStatement,
      env.DB.prepare("SELECT COUNT(*) AS count FROM submissions"),
      env.DB.prepare("SELECT COUNT(*) AS count FROM submissions WHERE status = 'new'"),
      env.DB.prepare("SELECT COUNT(*) AS count FROM submissions WHERE status = 'completed'"),
      env.DB.prepare(
        "SELECT COUNT(*) AS count FROM submissions WHERE session_at >= ? AND status NOT IN ('completed', 'archived')",
      ).bind(new Date().toISOString()),
    ]);

  const total = Number(countResult.results?.[0]?.count || 0);
  return json(
    {
      ok: true,
      items: listResult.results || [],
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
      stats: {
        total: Number(totalStats.results?.[0]?.count || 0),
        new: Number(newStats.results?.[0]?.count || 0),
        upcoming: Number(upcomingStats.results?.[0]?.count || 0),
        completed: Number(completedStats.results?.[0]?.count || 0),
      },
    },
    200,
    { "Cache-Control": "no-store" },
  );
}

async function getSubmission(env, id) {
  if (!Number.isInteger(id) || id <= 0) {
    return json({ ok: false, message: "记录编号无效。" }, 400);
  }
  const record = await env.DB.prepare("SELECT * FROM submissions WHERE id = ?").bind(id).first();
  if (!record) return json({ ok: false, message: "记录不存在。" }, 404);
  return json({ ok: true, record }, 200, { "Cache-Control": "no-store" });
}

async function updateSubmission(request, env, id) {
  if (!Number.isInteger(id) || id <= 0) {
    return json({ ok: false, message: "记录编号无效。" }, 400);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, message: "更新内容格式不正确。" }, 400);
  }

  const status = cleanString(body.status, 20);
  const notes = cleanString(body.notes || "", 3000);
  if (!ADMIN_STATUSES.has(status)) {
    return json({ ok: false, message: "记录状态无效。" }, 400);
  }

  const result = await env.DB.prepare(
    "UPDATE submissions SET status = ?, notes = ?, updated_at = ? WHERE id = ?",
  )
    .bind(status, notes, Date.now(), id)
    .run();
  if (!result.meta.changes) return json({ ok: false, message: "记录不存在。" }, 404);
  return json({ ok: true });
}

async function exportCsv(env) {
  const result = await env.DB.prepare(
    `SELECT record_id, client_name, contact, session_at, session_mode, core_issue,
      submitted_at, status, notes, record_hash
     FROM submissions
     ORDER BY submitted_at DESC
     LIMIT 5000`,
  ).all();

  const headers = [
    "凭证编号",
    "客户姓名",
    "联系电话或微信",
    "预约辅导时间",
    "辅导方式",
    "核心问题",
    "提交时间",
    "管理状态",
    "内部备注",
    "校验码",
  ];
  const rows = (result.results || []).map((row) => [
    row.record_id,
    row.client_name,
    row.contact,
    row.session_at,
    row.session_mode,
    row.core_issue,
    row.submitted_at,
    statusLabel(row.status),
    row.notes,
    row.record_hash,
  ]);
  const csv = `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  const date = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ai-planet-coaching-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

async function createSessionCookie(env) {
  const expires = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `v1.${expires}`;
  const signature = await hmac(payload, env.SESSION_SECRET);
  return `${SESSION_COOKIE}=${payload}.${signature}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}`;
}

function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

async function verifyAdminSession(request, env) {
  if (!env.SESSION_SECRET) return false;
  const cookies = parseCookies(request.headers.get("Cookie") || "");
  const value = cookies[SESSION_COOKIE];
  if (!value) return false;

  const parts = value.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;
  const expires = Number(parts[1]);
  if (!Number.isFinite(expires) || expires < Math.floor(Date.now() / 1000)) return false;

  const expected = await hmac(`v1.${parts[1]}`, env.SESSION_SECRET);
  return safeEqual(parts[2], expected);
}

async function hmac(value, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return base64Url(new Uint8Array(signature));
}

async function hashIdentifier(value, env) {
  const input = `${env.SESSION_SECRET || "ai-planet"}:${value}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function safeEqual(left, right) {
  const a = new TextEncoder().encode(String(left));
  const b = new TextEncoder().encode(String(right));
  const max = Math.max(a.length, b.length);
  let mismatch = a.length ^ b.length;
  for (let index = 0; index < max; index += 1) {
    mismatch |= (a[index] || 0) ^ (b[index] || 0);
  }
  return mismatch === 0;
}

function parseCookies(value) {
  return Object.fromEntries(
    value
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return index === -1 ? [part, ""] : [part.slice(0, index), part.slice(index + 1)];
      }),
  );
}

function buildCorsHeaders(request, env, url) {
  const origin = request.headers.get("Origin");
  if (!origin) return {};
  const requestOrigin = new URL(request.url).origin;
  const allowed = new Set(
    [requestOrigin, ...(env.PUBLIC_ORIGINS || "").split(",")]
      .map((item) => item.trim())
      .filter(Boolean),
  );
  if (url.pathname === "/api/submissions") {
    allowed.add("null");
  }
  if (!allowed.has(origin)) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function withSecurityHeaders(response, pathname) {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  );
  if (pathname.startsWith("/admin")) headers.set("Cache-Control", "no-store");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function addHeaders(response, extraHeaders) {
  const headers = new Headers(response.headers);
  Object.entries(extraHeaders).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

function cleanString(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function parseIsoDate(value) {
  if (typeof value !== "string") return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function invalid(message) {
  return { ok: false, message };
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function base64Url(bytes) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function csvCell(value) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function statusLabel(status) {
  return (
    {
      new: "新提交",
      contacted: "已联系",
      scheduled: "已排期",
      completed: "已完成",
      archived: "已归档",
    }[status] || status
  );
}
