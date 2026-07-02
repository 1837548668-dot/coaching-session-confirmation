# AI星球 · 客户辅导确认系统

一套完整的客户辅导确认与后台管理网站。

## 线上地址

- 客户填写端：<https://ai-planet-coaching.pages.dev/>
- 管理后台：<https://ai-planet-coaching.pages.dev/admin/>

## 功能

### 客户填写端

- 响应式会前确认表
- 触屏 / 鼠标手写签名
- 唯一凭证编号与 SHA-256 校验码
- 图片凭证分享、下载和打印
- 提交后自动进入管理后台

### 管理后台

- 管理密码和安全会话
- 数据概览、搜索和状态筛选
- 客户问题与电子签名详情
- 跟进状态和内部备注
- CSV / Excel 数据导出
- 登录限流和公共提交限流

## 技术架构

- Cloudflare Pages Functions
- Cloudflare D1
- 静态 HTML / CSS / JavaScript
- HttpOnly、Secure、SameSite 管理会话

## 本地检查

```powershell
npm install
npm run check
npx html-validate@9.7.1 docs/index.html docs/admin/index.html
```

## 数据库迁移

```powershell
npx wrangler d1 migrations apply ai-planet-coaching --remote
```

## 部署

```powershell
npx wrangler pages deploy docs --project-name ai-planet-coaching --branch codex/customer-voucher-form
```

管理密码和会话密钥通过 Cloudflare Pages Secrets 配置，不写入仓库。
