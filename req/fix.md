# Fix Log

## slug→shortId migration for specs

- **Date**: 2025-10-21
- **Motivation**: 旧的 slug 命名无法满足跨团队分享与后续短链需求，且存在命名冲突风险，需要统一成规则明确、长度固定的短链接。
- **Plan**: 在前后端契约中以 12 位 base62 `shortId` 取代 slug，更新数据模型、接口路径、组件 props 及上传表单校验提示，同时在详情 Meta、列表卡片展示 `shortId`，并要求 Admin 上传时填写合法短链。
- **Verification**: 查阅 `req/development_plan.md` 与 `README.md` 的最新规范，确认所有对外路径改为 `shortId`，并在设计文档中标注 12 位 base62 规则与展示位置，确保上传流程提示与后端存储说明同步。

## can't compare offset-naive and offset-aware datetimes

- **Date**: 2025-10-17
- **Root cause**: Spec documents pulled from MongoDB store `updatedAt` as naive `datetime` objects (no timezone info). When the `/specmarket/v1/listSpecs` endpoint builds the "today" filter it uses a UTC-aware timestamp, so comparing the two raised `TypeError: can't compare offset-naive and offset-aware datetimes` and the homepage failed to load.
- **Resolution**: Normalized every spec's `updatedAt` inside `SpecRepository._spec_from_raw` to coerce strings or datetimes into timezone-aware UTC values before constructing the `Spec` model. Added regression coverage that loads a naive `updatedAt` document and exercises the filter.
- **Tests**: `pytest backend/tests`
