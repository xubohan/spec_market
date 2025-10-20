# Fix Log

## Markdown-only spec detail delivery

- **Date**: 2025-10-25
- **Motivation**: 详情页未按要求渲染 Markdown，前端优先消费后端返回的 `contentHtml`，而接口还支持 `format=both` 等多种响应模式，导致接入
  上出现 `something went wrong`。需统一以 `contentMd` 作为契约，前端直接用 React Markdown 渲染。
- **Implementation**: 移除后端 `contentHtml` 字段及 `format` 参数分支，仅返回 Markdown；上传和更新流程停止生成 HTML。前端删掉 `html`
  fallback，`MarkdownView` 组件专注渲染 Markdown，API hooks 也不再拼接 `format` 参数。
- **Verification**: 运行 `pytest backend/tests` 与 `npm run build`，并通过实际页面访问确认 Markdown 可正常渲染且接口响应稳定。

## slug→shortId migration for specs

- **Date**: 2025-10-21
- **Motivation**: 旧的 slug 命名无法满足跨团队分享与后续短链需求，且存在命名冲突风险，需要统一成规则明确、长度固定的短链接。
- **Plan**: 在前后端契约中以 16 位 base62 `shortId` 取代 slug，更新数据模型、接口路径、组件 props 及上传表单校验提示，同时在详情 Meta、列表卡片展示 `shortId`，并要求 Admin 上传时填写合法短链。
- **Verification**: 查阅 `req/development_plan.md` 与 `README.md` 的最新规范，确认所有对外路径改为 `shortId`，并在设计文档中标注 16 位 base62 规则与展示位置，确保上传流程提示与后端存储说明同步。

## Admin editing flow for specs

- **Date**: 2025-10-22
- **Motivation**: 上传完成后才发现 Markdown 错误的场景较多，需要提供安全的在线编辑入口让作者在发现问题后立即修订，同时为后续按作者隔离权限做准备。
- **Implementation**: 后端新增 `PUT /specmarket/v1/updateSpec`，基于 Admin-Token 认证并复用 Markdown 渲染与 TOC 生成流程；前端在详情页加入 “Edit Spec” 跳转，新增 `/specs/:shortId/edit` 页面加载原始 Markdown 并支持在线修改。
- **Verification**: 手动与自动化覆盖 `pytest backend/tests` 新增的更新接口用例，前端通过本地开发确认编辑后详情页即时刷新、缓存失效，文档同步描述 Admin Edit 流程。

## updatedAt timestamp drift after edits

- **Date**: 2025-10-26
- **Issue**: 编辑 spec 并保存后，详情页 Meta 的 `updatedAt` 没有同步刷新，列表卡片也显示旧的日期；原因是后端 JSON 序列化直接 `str(datetime)`，浏览器无法解析该格式，TanStack Query 的缓存也没有强制失效，导致界面沿用旧数据。
- **Fix**: 统一后端响应的时间字段为 RFC 3339（`2025-10-26T09:30:45Z`）格式，并在 `useUpdateSpec` 成功回调中同步更新缓存、再触发 `invalidateQueries` 强制重新获取详情与列表。
- **Verification**: 运行 `pytest` 与 `npm run build`，并在本地修改文档后确认详情页 Meta 立即显示新的 `updatedAt`，Markdown 内容实时更新。

## can't compare offset-naive and offset-aware datetimes

- **Date**: 2025-10-17
- **Root cause**: Spec documents pulled from MongoDB store `updatedAt` as naive `datetime` objects (no timezone info). When the `/specmarket/v1/listSpecs` endpoint builds the "today" filter it uses a UTC-aware timestamp, so comparing the two raised `TypeError: can't compare offset-naive and offset-aware datetimes` and the homepage failed to load.
- **Resolution**: Normalized every spec's `updatedAt` inside `SpecRepository._spec_from_raw` to coerce strings or datetimes into timezone-aware UTC values before constructing the `Spec` model. Added regression coverage that loads a naive `updatedAt` document and exercises the filter.
- **Tests**: `pytest backend/tests`
