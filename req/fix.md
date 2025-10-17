# Fix Log

## can't compare offset-naive and offset-aware datetimes

- **Date**: 2025-10-17
- **Root cause**: Spec documents pulled from MongoDB store `updatedAt` as naive `datetime` objects (no timezone info). When the `/specmarket/v1/listSpecs` endpoint builds the "today" filter it uses a UTC-aware timestamp, so comparing the two raised `TypeError: can't compare offset-naive and offset-aware datetimes` and the homepage failed to load.
- **Resolution**: Normalized every spec's `updatedAt` inside `SpecRepository._spec_from_raw` to coerce strings or datetimes into timezone-aware UTC values before constructing the `Spec` model. Added regression coverage that loads a naive `updatedAt` document and exercises the filter.
- **Tests**: `pytest backend/tests`
