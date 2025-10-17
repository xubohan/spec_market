# Spec Market

Spec Market 是一个用于浏览、搜索与管理产品/技术规格文档的全栈示例项目。前端基于 React + Vite 提供接近 mcp.so 风格的浏览体验，后端使用 Flask 提供查询、下载以及上传接口，方便团队集中维护 Markdown 版 spec 文档。项目统一使用 12 位 base62 的短链接 `shortId` 作为对外展示与路由参数，取代旧的 slug。

## 核心特性

* 📚 **文档浏览**：支持首页瀑布流、分类、标签三种入口查看 spec 列表。
* 🔍 **详情阅读**：React Markdown 渲染、可滚动阅读窗、目录、包含 Author/Category/Tags/Updated/Created/Short ID 的 Meta 信息、复制与下载一应俱全。
* ⬆️ **上传能力**：`/upload` 页面提供 Admin-Token 保护的上传表单，可直接粘贴 Markdown 或选择 `.md` 文件，并需填写上传者 Author 信息。
* 🧭 **现代交互**：Sidebar 导航、响应式布局、客户端缓存和滚动位置恢复。
* 🔗 **短链接体系**：每篇 Spec 由 `shortId`（12 位 base62，例如 `Ab3k9LmNpQr2`）唯一标识，既展示在卡片与详情 Meta 中，也作为前后端接口与路由的统一参数；旧 slug 需迁移至 `shortId` 后再访问。

## 项目结构

```
spec_market/
├── backend/    # Flask API：列表、详情、下载、上传等接口
├── web/        # React 18 + Vite 前端，集成 TanStack Query、Tailwind CSS
└── req/        # 产品/设计文档（含 development_plan.md）
```

## 快速开始

### 后端（Flask）

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # 可选：快速填充本地环境变量
export ADMIN_TOKEN="your-admin-token"
flask --app app run --port 8000
```

API 默认挂在 `/specmarket/v1`，上传接口为 `POST /specmarket/v1/uploadSpec`，需要在 Header 中附带 `X-Admin-Token`。查询、详情、复制与下载等接口全部改用 `shortId` 作为路径参数（例如 `GET /specmarket/v1/specs/{shortId}`、`GET /specmarket/v1/specs/{shortId}/raw`），请同步更新任何依赖旧 slug 的客户端或脚本。

#### 本地 MongoDB 配置

后端会优先连接 `MONGODB_URI` 指定的实例，默认指向 `mongodb://localhost:27017/specdb`。可以使用 Docker 在本地快速启动测试库：

```bash
docker run --name spec-market-mongo \
  -e MONGO_INITDB_DATABASE=specdb \
  -p 27017:27017 \
  -d mongo:6
```

随后在 `backend/.env` 中确认：

```bash
MONGODB_URI=mongodb://localhost:27017/specdb
MONGODB_DB=specdb
```

启动 Flask 后端时会自动探活 Mongo。如果 Mongo 不可达则回退到内存集合（仅测试使用，不会写入磁盘）。

### 前端（Vite）

```bash
cd web
npm install
npm run dev
```

Vite dev server 会通过代理访问本地 API，浏览器访问 `http://localhost:5173`，即可体验浏览、搜索及上传流程。

## 更多文档

* [`req/development_plan.md`](req/development_plan.md)：前端页面结构、交互及接口契约。
* `backend/tests/`：覆盖 API 的基础单元测试示例。
