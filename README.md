# 客户辅导服务 · 会前确认单

一个支持手机、平板和电脑的公开网页确认单，包含：

- 客户基本信息和会前问题采集
- 触屏 / 鼠标手写签名
- 唯一凭证编号与 SHA-256 校验码
- 图片凭证保存与系统分享
- 打印或另存为 PDF
- 本设备最近 20 条记录留存
- 可选的团队后台 JSON 同步接口
- PWA 离线缓存

## 修改品牌

编辑 `config.js`：

```js
window.APP_CONFIG = {
  brandName: "你的品牌名称",
  submissionEndpoint: "",
};
```

## 接入团队后台

将 `submissionEndpoint` 配置为可接收 JSON POST 的 HTTPS 地址。未配置后台时，填写者仍可生成并保存正式图片凭证，但需要通过微信等方式把凭证发送给顾问，才算完成团队端留档。

## 本地预览

```powershell
python -m http.server 4173
```

打开 <http://localhost:4173>。
