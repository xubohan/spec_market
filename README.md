# Spec Market

Spec Market 是一个用于浏览、搜索与管理产品/技术规格文档的全栈示例项目。前端基于 React + Vite 提供接近 mcp.so 风格的浏览体验，后端使用 Flask 提供查询、下载以及上传接口，方便团队集中维护 Markdown 版 spec 文档。

## 核心特性

* 📚 **文档浏览**：支持首页瀑布流、分类、标签三种入口查看 spec 列表。
* 🔍 **详情阅读**：Markdown 渲染、目录、Meta 信息、复制与下载一应俱全。
* ⬆️ **上传能力**：`/upload` 页面提供 Admin-Token 保护的上传表单，可直接粘贴 Markdown 或选择 `.md` 文件。
* 🧭 **现代交互**：Sidebar 导航、响应式布局、客户端缓存和滚动位置恢复。

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
export ADMIN_TOKEN="your-admin-token"
flask --app app run --port 5000
```

API 默认挂在 `/specmarket/v1`，上传接口为 `POST /specmarket/v1/uploadSpec`，需要在 Header 中附带 `X-Admin-Token`。

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
