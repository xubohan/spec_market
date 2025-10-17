# 前端设计文档（Spec 文档市场 · Web）

## 目标与范围（MVP）

> 在以下规划确认无误后，再启动具体代码实现工作。

* 左侧主导航仅 **Home / Categories / Tags**，风格贴近 mcp.so。
* **Upload** 作为临时管理入口，允许内网成员通过 Admin-Token 上传 `spec.md`（支持文本或文件）。
  * Upload 表单限定仅接受 `.md` 文件：文件选择器设置 `accept=".md,text/markdown"`，提交前追加校验防止非 Markdown 文件被上传。
* 详情页仅 **Overview**（React Markdown 渲染，滚动容器防止页面被拉长），右侧提供 **复制 Markdown**、**下载 .md**、**Meta/TOC**。
* 不展示 Playground、不展示 MCP 配置。
* 页面需对十几名并发访问者保持流畅；移动端可读。
* 前端从所有 API 统一接收 `{ status_code, status_msg, data }` 包装结构；仅当 `status_code === 0` 视为成功。

---

## 技术栈与项目结构

* **框架**：React 18 + Vite + TypeScript
* **路由**：React Router v6
* **数据请求**：TanStack Query（SWR 风格缓存/重试/错误边界）
* **样式**：Tailwind CSS（原子化，快速贴近 mcp.so）
* **组件基座**：Headless UI（弹层/菜单可及性） + Radix Primitives（可选）
* **图标**：lucide-react
* **字体**：Inter（英数）+ Noto Sans SC（中文），系统字体回退
* **Markdown 渲染**：remark/rehype + `remark-gfm`、`remark-slug`、`rehype-autolink-headings`、`rehype-sanitize`
* **代码高亮**：Prism.js（主题：One Light / GitHub Light）
* **表单与校验**：React Hook Form + zod（仅后台页会用到，MVP可极简）
* **环境变量**：`VITE_API_BASE`（如 `https://spec.example.com/api`）；本地开发通过 Vite 代理把 `5173` 端口请求转发至后端 `5000`（与后端 `PORT` 环境变量保持一致）。

**目录建议**

```
web/
  src/
    app/
      routes.tsx
    pages/
      Home.tsx
      Categories.tsx
      CategoryList.tsx
      Tags.tsx
      TagList.tsx
      SpecDetail.tsx
    components/
      SidebarNav.tsx
      SearchBar.tsx
      SpecCard.tsx
      TagChip.tsx
      CategoryBadge.tsx
      MarkdownView.tsx
      Toc.tsx
      CopyMarkdownButton.tsx
      DownloadButton.tsx
      Pagination.tsx
      Skeletons.tsx
      EmptyState.tsx
    lib/
      api.ts           // fetch 封装 + TanStack Query hooks
      markdown.ts      // 客户端预览用（后端已预渲）
      utils.ts
    styles/
      globals.css
    types/
      spec.ts
```

---

## UI 设计（贴近 mcp.so）

### 基础主题（Tailwind 配色 Token）

* 背景：`#F8F6F2`（近似 mcp.so 的暖白）
* 卡片：`#FFFFFF`，阴影 `shadow-sm` / hover `shadow-md`
* 主色：`#E36549`（按钮/强调，接近 mcp.so 的砖橙）
* 文本：`#1F2937`（深灰）
* 辅助灰：`#6B7280`
* 圆角：`rounded-2xl`（大卡片）、`rounded-lg`（按钮/输入）
* 间距：布局 `px-6 py-6`，卡片内部 `p-5`
* 代码块：Prism “One Light”，行号可选

### 布局

* **左侧固定侧栏（260px）**：

  * Logo（文字版可用 “Spec.so” 临时）
  * Nav：Home / Categories / Tags（当前项高亮）
  * 底部：简单设置图标（预留，不实现）
* **右侧内容区**：最大宽 1100px，居中。
* **响应式**：<= 1024px 时侧栏可折叠，汉堡按钮展开。

### 页面与交互

#### 1) Home

* 顶部居中大搜索框（placeholder “Search with keywords”）
* 快捷筛选 Pill：`Today | Latest`（点击切换查询参数）
* 列表区：`SpecCard` 瀑布式网格（2 列/桌面，1 列/移动）

  * 卡片内容：标题、摘要、标签 chips、更新时间
  * 交互：hover 提升阴影、title 下划线
* 分页：底部 `Pagination`（上一页/下一页 + 页码）

#### 2) Categories / Tags

* **总览页**：以卡片或列表展示所有类目/标签（显示文档计数）
* **详情页**（如 `/categories/backend`）：顶部显示类目名 + 计数，下面是该类目的文档列表（同 `SpecCard`）

#### 3) Spec 详情（/specs/:slug）

* 标题区：标题、类别/标签 chips、更新时间
* 主栏（左）：`MarkdownView`（优先使用 React Markdown 渲染 `contentMd`，保留 `contentHtml` 兜底，内置可滚动容器）
* 侧栏（右）：

  * **Actions 卡片**：

    * 📋 Copy Markdown（调用 `/api/specs/:slug/raw` → clipboard）
    * ⬇️ Download .md（直链 `/api/specs/:slug/download.md`）
  * **Meta 卡片**：Category、Tags、Updated、Version
  * **TOC 卡片**：当前文档标题层级目录，点击锚点定位、滚动高亮

**可及性**

* 全站语义化（`nav/main/aside`），按钮有 `aria-label`
* 键盘导航：`/` 聚焦搜索；`g h` 返回 Home；复制按钮可按回车触发
* 明暗对比度 > 4.5：1

#### Upload（Admin 工具页，仅内网）

* 文件上传控件 `accept=".md,text/markdown"`，并在提交前读取所选 `File` 的 `name`，若未以 `.md` 结尾（忽略大小写）立即中断提交流程并提示“Only .md files are allowed.”。
* 若未选择文件但手动填写 Markdown 文本，则允许提交；成功上传后清空表单字段、重置文件输入和提示文案。

#### Upload（Admin 工具页，仅内网）

* 文件上传控件 `accept=".md,text/markdown"`，并在提交前读取所选 `File` 的 `name`，若未以 `.md` 结尾（忽略大小写）立即中断提交流程并提示“Only .md files are allowed.”。
* 若未选择文件但手动填写 Markdown 文本，则允许提交；成功上传后清空表单字段、重置文件输入和提示文案。

---

## 组件清单（关键 Props）

* `SidebarNav({active: 'home'|'categories'|'tags'})`
* `SearchBar({defaultQuery, onSearch})`
* `SpecCard({title, slug, summary, tags, updatedAt})`
* `MarkdownView({markdown?: string, html?: string})`
* `Toc({items: TocItem[], onJump})`
* `CopyMarkdownButton({slug})`
* `DownloadButton({slug})`
* `Pagination({page, total, onChange})`

---

## 数据流与状态

* 通过 TanStack Query 定义 hooks：

  * `useSpecsList(params)`、`useSpec(slug)`、`useCategories()`、`useTags()`
* URL 与查询参数同步（支持刷新/分享链接还原当前筛选）
* 错误边界：统一 `Toast` + 空态组件（可重试）

---

## 前端安全

* 渲染 HTML 前二次 `DOMPurify.sanitize`
* 外链 `rel="noopener noreferrer"` + `target="_blank"`
* 复制/下载仅读接口，无敏感信息

---

## 构建与部署

* `vite build` 产物由 Nginx/静态托管
* `VITE_API_BASE` 注入运行时（可通过 Nginx `/api` 反代后省略）

---

## 验收标准（前端）

1. 首页搜索与分页可用，空态/加载态完整
2. 详情页 Markdown 正确渲染（标题锚点、表格、代码高亮、TOC 同步）
3. 复制/下载操作成功（Toast 提示）
4. Categories/Tags 能筛出正确文档
5. Lighthouse Performance/Best Practices/SEO/Accessibility ≥ 90（桌面）

---

# 后端设计文档（Spec 文档市场 · Flask API）

## 目标与范围（MVP）

* 提供 **公开只读 REST**：列表/搜索、单文档详情（md/html）、原文/下载、类目/标签统计。
* 对写接口（新建/更新）先保留但不上线（或仅内网）。
* 连接 MongoDB，保存 Markdown 原文与预渲 HTML/TOC。
* QPS 低，优先简洁与可维护性。

---

## 技术栈与项目结构

* **运行环境**：Python 3.11
* **框架**：Flask 3.x
* **Mongo**：PyMongo（或 Flask-PyMongo）
* **数据校验**：pydantic v2（请求/响应 DTO）
* **Markdown**：markdown-it-py + mdit-py-plugins（gfm/attrs/toc），自定义提取 TOC
* **HTML 安全**：bleach（服务端 sanitize 一次）
* **缓存**：Flask-Caching（Simple 或 Redis，可选）
* **限流**：Flask-Limiter（后期开启写接口再用）
* **日志**：structlog 或标准 logging（JSON 格式）
* **CORS**：Flask-CORS（仅允许前端域名）

**目录建议**

```
api/
  app.py
  config.py
  extensions/           # mongo, cache, cors, limiter, logger
  blueprints/
    specs/
      routes.py
      service.py
      repository.py
      schema.py         # pydantic models
      markdown.py       # md->html/toc/summary
    meta/
      routes.py         # categories/tags
  models/
    indexes.py
  utils/
    slugify.py
    responses.py
    errors.py
  tests/
```

---

## 数据模型（Mongo）与索引

```json
Spec {
  _id: ObjectId,
  title: string,
  slug: string,             // 唯一
  category: string,
  tags: [string],
  summary: string,          // 从首段/Front-matter 提取
  contentMd: string,        // 原文
  contentHtml: string,      // 预渲 + 已 bleach 清洗
  toc: [ { text, id, level } ],
  version: number,          // 未来乐观锁
  createdAt: Date,
  updatedAt: Date
}
```

**索引**

* `slug` 唯一
* 文本索引：`{ title: "text", summary: "text", contentMd: "text" }`
* 普通索引：`category`, `tags`, `updatedAt`

**大文档策略**

* 一般 spec < 1–2MB 直接存字段；极大文档后续改用 GridFS（MVP 不必）。

---

## 预渲管道（保存/更新时）

1. `contentMd` → markdown-it-py 渲染 HTML
2. 生成 headings 锚点（slugify H2/H3…） → `toc[]`
3. `bleach.clean`（白名单：`p, h1-6, a, code, pre, table, thead, tbody, tr, td, th, ul, ol, li, blockquote, img, strong, em` 等；属性白名单包括 `href, target, rel, src, alt, class, id`）
4. 提取 `summary`（首段文本 160 字内）
5. 存库：`contentHtml`, `toc`, `summary`，`updatedAt` 更新时间

---

## REST API 设计（公开读）

* 全部 JSON 响应（含错误）使用统一包装：`{ status_code: number, status_msg: string, data: object }`。`status_code === 0` 表示成功，`status_msg` 描述状态，`data` 携带实际载荷（最少为空对象 `{}`）。

### 1) 列表/搜索

`GET /api/specs`

* **查询参数**：

  * `q`（全文），`category`，`tag`（可多值），`page=1`，`pageSize=20(<=50)`，`sort`（`-updatedAt|updatedAt|-title|title`）
* **响应**

```json
{
  "status_code": 0,
  "status_msg": "OK",
  "data": {
    "items": [
      { "title":"...", "slug":"...", "summary":"...", "tags":["..."], "category":"...", "updatedAt":"2025-10-12T08:00:00Z" }
    ],
    "page": 1,
    "pageSize": 20,
    "total": 123,
    "hasMore": true
  }
}
```

### 2) 单文档详情

`GET /api/specs/:slug?format=md|html|both`（默认 `md`）

```json
{
  "status_code": 0,
  "status_msg": "OK",
  "data": {
    "title":"Amap Maps",
    "slug":"amap-maps",
    "category":"maps",
    "tags":["maps","location-services"],
    "toc":[{"text":"Overview","id":"overview","level":2}],
    "contentMd":"...",            // 当 format=md/both
    "contentHtml":"...",          // 当 format=html/both
    "updatedAt":"2025-10-12T08:00:00Z",
    "version": 3
  }
}
```

#### 4) Upload（/upload）

* 顶部先输入并保存 **Admin-Token**（LocalStorage 持久化，模拟简单鉴权）。
* 上传表单包含：标题、Slug、类别、标签（逗号分隔）、摘要、Markdown 文本/文件（二选一）以及版本号。
* 成功上传后清空表单并提示 `Upload successful for <slug>`。
* 后端接收 `multipart/form-data`，读取 `content` 字段或 `file` 文件内容，落盘至 `data/uploads/<slug>.md` 并存储 HTML、TOC。
* 当前上传端点保持宽松：后端仍接受任意文件类型，依赖前端的 `.md` 限制；若后续需要可在 Flask 层再加 MIME/扩展名校验。

### 3) 获取原文（复制）

`GET /api/specs/:slug/raw`

* `Content-Type: text/plain; charset=utf-8`
* 直接返回 `contentMd`（若不存在返回 404，错误响应仍遵循 `{ status_code, status_msg, data }` 结构，`data` 可为空对象）

### 4) 下载 Markdown

`GET /api/specs/:slug/download.md`

* `Content-Disposition: attachment; filename="<slug>.md"`

### 5) 类目/标签

### 6) 上传接口

`POST /api/specs/upload`（实际部署可通过 Nginx rewrite → `/specmarket/v1/uploadSpec`）

* Header：`X-Admin-Token`
* Body：`multipart/form-data`
  * `title`、`slug`、`category`、`summary`、`tags`、`version`
  * `content`（纯文本 Markdown，可选）
  * `file`（Markdown 文件，可选；当 `content` 为空时必填）
* 成功返回 `201` + `{ "status_code": 0, "status_msg": "Created", "data": { "id": "...", "slug": "..." } }`
* 失败返回标准错误模型（401/400 等），错误响应同样包装在 `{ status_code, status_msg, data }` 中，`data` 至少为空对象或包含字段错误详情。

`GET /api/categories` →

```json
{
  "status_code": 0,
  "status_msg": "OK",
  "data": {
    "items": [{ "name": "backend", "slug": "backend", "count": 23 }]
  }
}
```

`GET /api/tags` →

```json
{
  "status_code": 0,
  "status_msg": "OK",
  "data": {
    "items": [{ "name": "coupon", "slug": "coupon", "count": 12 }]
  }
}
```

> **写接口（保留不上线）**
> `POST /api/specs`、`PUT /api/specs/:id`（需要 `X-Admin-Token` + `version` 乐观锁）

#### Upload 接口（POST `/specmarket/v1/uploadSpec`）

* 依赖 MongoDB（`specs` 集合）存储上传文档：字段包括 `slug`（唯一索引）、`title`、`summary`、`category`、`tags`、`contentMd`、`contentHtml`、`toc`、`updatedAt`、`version`。
* 上传流程：读取表单（文本或文件内容）→ 渲染 Markdown 与 TOC → 使用 `update_one(..., upsert=True)` 保存，若命中重复 `slug` 则覆盖旧记录并刷新 `updatedAt`。
* 成功写入 Mongo 后刷新内存缓存（`SpecRepository`），不再写入 `backend/uploads/` 或更新 JSON 文件，所有持久化交给 Mongo；异常时写入标准错误响应并附带 traceId。
* 本地开发：通过 `.env`/环境变量暴露 `MONGODB_URI=mongodb://localhost:27017/specdb`、`MONGODB_DB=specdb`，确保上传接口默认即可连上本地实例。

---

## 缓存与性能

* **页面列表/详情**：使用 Flask-Caching 短缓存（60s）
* **HTTP 缓存**：对详情与原文返回 `ETag` 与 `Last-Modified`，支持条件请求（304）
* **分页**：最大 `pageSize=50`
* **目标**：P95 响应时间

  * 列表 ≤ 100ms（命中缓存）
  * 详情 ≤ 150ms（含读取）

---

## 安全

* **CORS**：仅允许前端域名（如 `https://spec.example.com`）
* **HTML sanitize**：后端渲染阶段用 `bleach.clean`，前端再次 DOMPurify
* **速率限制**：公开读接口先不限制；下载接口可设 `100/min/IP`（可选）
* **写接口保护**：`X-Admin-Token`（从环境变量读取）
* **输入校验**：pydantic DTO（参数/分页/排序白名单）

---

## 错误模型

```json
{
  "status_code": 400,
  "status_msg": "INVALID_ARG",
  "data": {
    "error": { "code": "NOT_FOUND|INVALID_ARG|INTERNAL", "message": "说明", "traceId": "req-..." }
  }
}
```

* 记录 `traceId`（响应头也返回，便于排障）
* 对 5xx 统一掩码为 `INTERNAL`（`status_code` 置为 500），日志保留详细堆栈

---

## 监控与健康检查

* `GET /healthz`：返回 `{"ok":true,"mongo":true,"uptime":...}`
* 结构化日志：访问日志（方法 / 路由 / 用时 / 状态码 / traceId）

---

## 配置与部署

**环境变量**

```
MONGODB_URI=mongodb://user:pass@host:27017/specdb
MONGODB_DB=specdb
ADMIN_TOKEN=***             # 仅写接口
CACHE_BACKEND=simple|redis
CORS_ORIGINS=https://spec.example.com
PORT=5000
```

**Docker Compose（示意）**

* `mongo`（持久卷）
* `api`（Flask，暴露 5000，依赖 mongo）
* `web`（静态站：Nginx 反代 `/api` 到 `api:5000`）

**初始化与索引**

* 启动时确保：

  * `slug` 唯一索引
  * 文本索引：`title/summary/contentMd`
  * `updatedAt` 排序索引

---

## 验收标准（后端）

1. 列表/详情/原文/下载/类目/标签接口按契约返回
2. Markdown → HTML 渲染正确（表格、代码、锚点、TOC）且已 sanitize
3. 详情接口携带 `ETag` 与 `Last-Modified`，条件请求返回 304
4. 错误模型一致、日志包含 traceId
5. 在 10～20 并发下 P95 符合目标

---

## 未来扩展预留（非 MVP）

* 版本管理（`SpecVersion`）与变更日志
* 草稿/发布状态与审核流
* GridFS 大文档
* 语义检索（向量索引）
* 写接口管理后台（简单登录）
* Webhook：文档更新后触发构建静态副本或搜索索引
