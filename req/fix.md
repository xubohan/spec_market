# Sidebar visual refresh & author search support

- **Date**: 2025-10-21
- **Motivation**: 为了让首页导航与品牌区域更贴近 SaaS 市场气质，需要统一暖橙主色、优化 Logo 字体，同时补充按作者检索的需求，便于运营按发布者筛选文档。
- **Implementation**: 左侧栏采用 Space Grotesk 品牌字型、主色点缀 `.so`，背景与高亮阴影调整为更柔和的暖白配色，并将「Management / Upload」改为「Workspace / New Spec」；搜索框根据 `@username` 自动切换作者模式并新增 `author` 查询参数以覆盖标题、标签与作者三类检索。
- **Verification**: `npm run build` 验证前端通过构建，运行 `pytest backend/tests/test_api.py::test_list_specs_filters_by_author_username` 确认按作者过滤结果准确，手动在浏览器中执行标题、标签以及 `@username` 检索，确认高亮与查询结果展示正常，并更新截图存档。

# Fix Log

## Version history tracking for specs

- **Date**: 2025-10-22
- **Motivation**: 现有平台仅保留最新文档，无法追溯历史修改，作者也难以验证前后差异，需要引入版本管理和可视化历史入口。
- **Implementation**: 后端将 `specs` 主表精简为仅存储结构化元数据（标题、分类、标签、作者、ownerId 等），Markdown 正文与版本号全部写入 `spec_versions`，详情与版本接口按 `shortId` 合并最新内容并返回完整历史列表与 `total` 计数。前端保留标题区的版本徽章，Meta 卡片移除版本行，历史卡片默认展示最多 3 个旧版本并提供“View full history”切换，支持在同一 UI 中浏览包含最新在内的所有版本，Short ID 仍可一键复制。
- **Verification**: 运行 `pytest` 与 `npm run build`，手动在详情页切换多轮历史版本与“View full history”折叠，确认 Markdown、版本号与历史计数同步更新，并补充截图存档。

## Author search normalization for spec listing

- **Date**: 2025-10-21
- **Motivation**: 首页搜索栏虽可输入 `@username`，但后端缺少按作者过滤逻辑，导致查询命中后仍返回全量数据，用户无法定位某位作者的文档。
- **Implementation**: 为 `/listSpecs` 增加 `author` 查询参数并在 `SpecRepository.list_specs` 中统一去除前缀 `@`、忽略大小写进行精确匹配；首页 `useSpecs` 请求携带作者参数，并新增 API 测试覆盖多账号上传后的检索场景。
- **Verification**: `pytest backend/tests/test_api.py::test_list_specs_filters_by_author_username`、`npm run build`

## Spec detail header simplification

- **Date**: 2025-10-23
- **Motivation**: 详情页标题区信息密度过高，历史提示分散，Meta 栏的复制按钮样式突兀，导致视觉层级混乱、最新版本提示不够直观。
- **Implementation**: 标题区仅保留标题与版本徽章，将“Viewing version”提示与“Latest”徽章并排展示且通过点击 Latest 跳转最新版本；历史卡片改为固定高度的滚动列表，仅以弱化字体呈现最近版本；Meta 中的 Short ID 改为点击文字即可复制。
- **Verification**: `npm run build`，手动在规格详情页切换版本并验证 Latest 提示、历史滚动与 Short ID 点击复制均正常展示。

## Unified login flow and author binding

- **Date**: 2025-10-21
- **Motivation**: 登录入口分散在 Upload/Edit/详情页内的卡片中，体验割裂，且作者信息依赖表单输入，无法保证与账号绑定，也无法限制非作者的写权限。
- **Implementation**: 在右上角新增全局 Top Bar 管理登录态，新增独立登录页并在 Upload/Edit 访问前自动跳转；后端将上传/更新/删除操作与 `ownerId` 绑定，只允许作者执行，同时自动生成 `@username` 作者字段并写入文档。前端移除 Author 输入框，写操作页改为基于登录状态重定向和禁用逻辑。
- **Verification**: 运行 `pytest` 覆盖新的权限判定与自动归属逻辑，并执行 `npm run build` 验证前端编译及登录跳转；手动登录后上传/编辑/删除文档，确认作者字段自动补全且仅作者可操作，同时更新页面截图。

## Session-based auth rollout

- **Date**: 2025-10-21
- **Motivation**: 现网依赖固定的 admin token 操作上传/编辑/删除接口，不具备账号体系，容易被误用，也无法追踪操作者。
- **Implementation**: 引入会话 Cookie 驱动的注册/登录/登出接口，后端基于 bcrypt 哈希保存密码并新增 `require_login` 装饰器保护写操作；前端提供 `AuthProvider` 和 `AuthCard` 组件以在 Upload/Edit/详情页中切换登录态，所有写请求自动携带凭据。
- **Verification**: 运行 `pytest` 覆盖注册、登录、登出和认证写操作的端到端流程，并在前端登录后上传/编辑/删除确保成功；更新截图存档。

## Spec detail layout iteration

- **Date**: 2025-10-21
- **Motivation**: 详情页仍然存在三层卡片的压迫感，操作按钮主次不清、Meta 卡片内的 shortId 溢出，影响浏览体验。
- **Implementation**: 调整全局布局移除额外的内容外壳，让详情页仅保留标题区与 Markdown 内容两层视觉层级；将复制、下载、编辑、删除整合成统一的图标按钮组，弱化删除按钮并保留提示；Meta 信息卡片改为双列排布、支持 `break-all`，避免短链溢出。
- **Verification**: 运行 `npm run build`，本地打开 Spec 详情页确认层级与操作按钮展示正常，并更新截图。

## Spec detail layout visual refresh

- **Date**: 2025-10-21
- **Motivation**: 现有界面在导航高亮、正文与背景层次、右侧操作区按钮以及 Meta 信息排版上层级不清晰，重要信息难以快速聚焦。
- **Implementation**: 重构左侧导航为分组结构并强化 active/hover 高亮，主内容区增加半透明卡片与投影，同时优化 Markdown 排版间距；在规格详情页中调整 Actions 为图标按钮+底部操作组，弱化删除按钮警示强度并新增 Meta 卡片图标化两列布局。
- **Verification**: 运行 `npm run build` 并在本地浏览器确认详情页样式与交互正常，更新截图存档。

## Authenticated delete flow for specs

- **Date**: 2025-10-20
- **Motivation**: 运营需要在发现错误或过期内容时，能够立即移除指定 spec；目前缺少 UI 与接口支持，只能手动删库删文件，既费时又风险高。
- **Implementation**: 后端新增 `DELETE /specmarket/v1/deleteSpec`，基于登录会话校验后同步删除内存仓库与 MongoDB 文档；Repository 支持持久化删除逻辑。前端详情页 Actions 卡片加入 “Delete Spec” 按钮，复用登录状态触发请求，点击后弹出二次确认并在成功后跳转首页，同时刷新 React Query 缓存。
- **Verification**: 通过 `pytest backend/tests` 与 `npm run build`，并在本地环境登录后删除文档，确认详情页提示、列表刷新及数据库同步更新，保留界面截图。

## Disable API and UI caching for real-time updates

- **Date**: 2025-10-20
- **Motivation**: 线上页面在完成规格文档编辑后仍长时间显示旧数据，原因是后端开启了 Flask-Caching，前端又沿用 React Query 默认缓存，并允许浏览器对接口做条件缓存。必须在当前阶段彻底关闭缓存机制，确保任何改动都能即时展示。
- **Implementation**: 后端移除 Flask-Caching 初始化、缓存装饰器与相关响应头，上传/更新后不再手动清缓存；配置项与依赖同步清理。前端将 React Query 默认 `staleTime`/`gcTime` 设为 0、强制每次挂载重新获取数据，并在所有 fetch 请求上添加 `cache: 'no-store'` 以禁用浏览器缓存。
- **Verification**: 运行 `pytest backend/tests` 与 `npm run build` 确认后端接口和前端构建均通过，再手动更新规格并在页面刷新后立即看到最新内容，同时保留截图记录。

## Markdown-only spec detail delivery

- **Date**: 2025-10-20
- **Motivation**: 详情页未按要求渲染 Markdown，前端优先消费后端返回的 `contentHtml`，而接口还支持 `format=both` 等多种响应模式，导致接入
  上出现 `something went wrong`。需统一以 `contentMd` 作为契约，前端直接用 React Markdown 渲染。
- **Implementation**: 移除后端 `contentHtml` 字段及 `format` 参数分支，仅返回 Markdown；上传和更新流程停止生成 HTML。前端删掉 `html`
  fallback，`MarkdownView` 组件专注渲染 Markdown，API hooks 也不再拼接 `format` 参数。
- **Verification**: 运行 `pytest backend/tests` 与 `npm run build`，并通过实际页面访问确认 Markdown 可正常渲染且接口响应稳定。

## slug→shortId migration for specs

- **Date**: 2025-10-20
- **Motivation**: 旧的 slug 命名无法满足跨团队分享与后续短链需求，且存在命名冲突风险，需要统一成规则明确、长度固定的短链接。
- **Plan**: 在前后端契约中以 16 位 base62 `shortId` 取代 slug，更新数据模型、接口路径、组件 props 及上传表单校验提示，同时在详情 Meta、列表卡片展示 `shortId`，并要求登录用户上传时填写合法短链。
- **Verification**: 查阅 `req/development_plan.md` 与 `README.md` 的最新规范，确认所有对外路径改为 `shortId`，并在设计文档中标注 16 位 base62 规则与展示位置，确保上传流程提示与后端存储说明同步。

## Authenticated editing flow for specs

- **Date**: 2025-10-20
- **Motivation**: 上传完成后才发现 Markdown 错误的场景较多，需要提供安全的在线编辑入口让作者在发现问题后立即修订，同时为后续按作者隔离权限做准备。
- **Implementation**: 后端新增 `PUT /specmarket/v1/updateSpec`，基于登录会话认证并复用 Markdown 渲染与 TOC 生成流程；前端在详情页加入 “Edit Spec” 跳转，新增 `/specs/:shortId/edit` 页面加载原始 Markdown 并支持在线修改。
- **Verification**: 手动与自动化覆盖 `pytest backend/tests` 新增的更新接口用例，前端通过本地开发确认登录后编辑可即时刷新、缓存失效，并同步更新文档描述。

## updatedAt timestamp drift after edits

- **Date**: 2025-10-20
- **Issue**: 编辑 spec 并保存后，详情页 Meta 的 `updatedAt` 没有同步刷新，列表卡片也显示旧的日期；原因是后端 JSON 序列化直接 `str(datetime)`，浏览器无法解析该格式，TanStack Query 的缓存也没有强制失效，导致界面沿用旧数据。
- **Fix**: 统一后端响应的时间字段为 RFC 3339（`2025-10-26T09:30:45Z`）格式，并在 `useUpdateSpec` 成功回调中同步更新缓存、再触发 `invalidateQueries` 强制重新获取详情与列表。
- **Verification**: 运行 `pytest` 与 `npm run build`，并在本地修改文档后确认详情页 Meta 立即显示新的 `updatedAt`，Markdown 内容实时更新。

## can't compare offset-naive and offset-aware datetimes

- **Date**: 2025-10-17
- **Root cause**: Spec documents pulled from MongoDB store `updatedAt` as naive `datetime` objects (no timezone info). When the `/specmarket/v1/listSpecs` endpoint builds the "today" filter it uses a UTC-aware timestamp, so comparing the two raised `TypeError: can't compare offset-naive and offset-aware datetimes` and the homepage failed to load.
- **Resolution**: Normalized every spec's `updatedAt` inside `SpecRepository._spec_from_raw` to coerce strings or datetimes into timezone-aware UTC values before constructing the `Spec` model. Added regression coverage that loads a naive `updatedAt` document and exercises the filter.
- **Tests**: `pytest backend/tests`
