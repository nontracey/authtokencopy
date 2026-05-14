# Swagger Auth Helper

浏览器插件 - 自动捕获网页 Authorization 并注入到 Swagger UI

## 功能特性

- ✅ 自动捕获所有网页请求中的 Authorization 头
- ✅ 智能识别 Swagger UI 页面
- ✅ 一键注入 Authorization 到 Swagger UI
- ✅ 自动去除 Bearer 前缀
- ✅ 支持多个站点的 Authorization 管理
- ✅ 支持 Chrome 和 Edge 浏览器

## 安装方法

### Chrome 浏览器

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启右上角的「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `swagger-auth-helper` 文件夹
5. 安装成功后会显示插件图标

### Edge 浏览器

1. 打开 Edge，访问 `edge://extensions/`
2. 开启左下角的「开发人员模式」
3. 点击「加载解压缩的扩展」
4. 选择 `swagger-auth-helper` 文件夹
5. 安装成功后会显示插件图标

## 使用说明

### 1. 捕获 Authorization

- 在任意网页登录后，插件会自动捕获请求中的 Authorization 头
- 支持所有形式的 Authorization（Bearer token、API key 等）
- 以 `host + referer` 作为唯一标识存储

### 2. 注入到 Swagger UI

#### 方式一：页面按钮（推荐）

1. 打开 Swagger UI 页面
2. 页面右上角会出现「注入 Auth」按钮
3. 点击按钮，选择要注入的 Authorization
4. 自动填充到 Swagger UI 的认证输入框

#### 方式二：插件弹窗

1. 点击浏览器工具栏的插件图标
2. 在弹出的窗口中选择要注入的 Authorization
3. 如果当前是 Swagger 页面，会自动注入
4. 否则会将 Token 复制到剪贴板

### 3. 管理 Authorization

- 点击插件图标查看所有已捕获的 Authorization
- 当前站点的 Authorization 会高亮显示
- 可以清空所有存储的 Authorization

## 项目结构

```
swagger-auth-helper/
├── manifest.json          # 插件配置文件 (Manifest V3)
├── background.js          # 后台脚本 - 拦截请求
├── content.js            # 内容脚本 - 操作 Swagger 页面
├── content.css           # 内容脚本样式
├── popup.html            # 弹出页面
├── popup.js              # 弹出页面逻辑
├── popup.css             # 弹出页面样式
├── icons/                # 图标资源
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## 技术实现

### 请求拦截

使用 Chrome Extension API `webRequest.onBeforeSendHeaders` 拦截所有请求：

```javascript
chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    // 提取 Authorization 头
    // 以 host + referer 作为唯一键存储
  },
  { urls: ["<all_urls>"] },
  ["requestHeaders", "extraHeaders"]
);
```

### Swagger UI 检测

通过多种 DOM 选择器智能识别 Swagger UI：

```javascript
const indicators = [
  '.swagger-ui',
  '#swagger-ui',
  '[data-swagger-ui]',
  '.api-explorer',
  '.redoc-wrap'
];
```

### Authorization 注入

支持多种 Swagger UI 版本的认证输入框：

```javascript
const selectors = [
  'input[placeholder*="api_key"]',
  '.authorization__input',
  '#api_key'
];
```

### Bearer 前缀处理

自动识别并去除 Bearer 前缀（大小写不敏感）：

```javascript
const bearerRegex = /^bearer\s+/i;
return authValue.replace(bearerRegex, '');
```

## 兼容性

- **Chrome**: 88+ (支持 Manifest V3)
- **Edge**: 88+ (支持 Manifest V3)
- **Firefox**: 需调整为 Manifest V2 或 V3（未测试）

## 安全说明

- Authorization 仅存储在本地浏览器中
- 不会发送任何数据到外部服务器
- 可以随时清空所有存储的数据

## 常见问题

### Q: 为什么没有捕获到 Authorization？

A: 请确保：
1. 插件已正确安装并启用
2. 网站的 Authorization 头确实在请求中
3. 检查是否有其他插件干扰

### Q: 为什么注入失败？

A: 可能原因：
1. 当前页面不是标准的 Swagger UI
2. Swagger UI 版本较旧，DOM 结构不同
3. Token 会被复制到剪贴板，可以手动粘贴

### Q: 支持哪些 Swagger 版本？

A: 理论上支持所有版本，包括：
- Swagger UI 2.x
- Swagger UI 3.x
- OpenAPI 3.x
- ReDoc

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！
