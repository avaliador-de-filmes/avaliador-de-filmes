# Tasks: Plataforma Social de Catálogo (Filmes e Séries)

**Input**: Design documents from `/specs/001-catalog-rate-review/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Incluídos, pois a constituição exige testes automatizados e cobertura mínima para mudanças funcionais.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and baseline tooling.

- [ ] T001 Update project dependencies and scripts for React Router, JSON Server, Vitest, RTL, MSW, jest-axe, and coverage in `package.json`
- [ ] T002 Create environment template with `VITE_OMDB_API_KEY` and API base URLs in `.env.example`
- [ ] T003 Create local persistence seed collections (`users`, `media`, `catalogItems`, `ratings`, `reviews`) in `mocks/db.json`
- [ ] T004 Create JSON Server configuration in `json-server.json`
- [ ] T005 Create FSD folder skeleton and placeholder indexes in `src/app/.gitkeep`, `src/pages/.gitkeep`, `src/widgets/.gitkeep`, `src/features/.gitkeep`, `src/entities/.gitkeep`, and `src/shared/.gitkeep`
- [ ] T006 Configure Vitest runtime, jsdom, and coverage reporter in `vitest.config.js`
- [ ] T007 [P] Create test bootstrap (RTL matchers, MSW server, jest-axe setup) in `tests/setupTests.js`
- [ ] T008 Create local dev orchestration for app + mocks in `scripts/dev-with-mocks.mjs`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T009 Create application bootstrap with providers in `src/app/index.jsx`
- [ ] T010 Create route registry and page-level boundaries in `src/app/routes/router.jsx`
- [ ] T011 [P] Implement OMDb HTTP adapter with normalized error contract in `src/shared/api/omdb/client.js`
- [ ] T012 [P] Implement OMDb search/detail mappers to normalized media model in `src/shared/api/omdb/mapper.js`
- [ ] T013 [P] Implement JSON Server HTTP adapter in `src/shared/api/json-server/client.js`
- [ ] T014 [P] Implement JSON Server resource gateways for `catalogItems`, `ratings`, `reviews`, and `media` in `src/shared/api/json-server/resources.js`
- [ ] T015 [P] Create request-state and retry utilities for loading/error/success transitions in `src/shared/lib/request-state.js`
- [ ] T016 [P] Create accessibility helpers for keyboard interaction and live-region announcements in `src/shared/lib/accessibility.js`
- [ ] T017 [P] Create simulated auth session gateway (authenticated user vs visitor) in `src/shared/lib/auth-session.js`
- [ ] T018 [P] Implement User schema validation in `src/entities/user/model/user.schema.js` with citations: `data-model.md (User.id)`, `data-model.md (User.username)`, `data-model.md (User.displayName)`, `data-model.md (User.avatarUrl)`, `data-model.md (User.createdAt)`
- [ ] T019 [P] Implement Media schema validation in `src/entities/media/model/media.schema.js` with citations: `data-model.md (Media.id)`, `data-model.md (Media.type)`, `data-model.md (Media.title)`, `data-model.md (Media.year)`, `data-model.md (Media.posterUrl)`, `data-model.md (Media.plot)`, `data-model.md (Media.genres)`, `data-model.md (Media.imdbRating)`, `data-model.md (Media.updatedAt)`
- [ ] T020 [P] Implement CatalogItem schema validation in `src/entities/catalog-item/model/catalog-item.schema.js` with citations: `data-model.md (CatalogItem.id)`, `data-model.md (CatalogItem.userId)`, `data-model.md (CatalogItem.mediaId)`, `data-model.md (CatalogItem.status)`, `data-model.md (CatalogItem.createdAt)`, `data-model.md (CatalogItem.updatedAt)`, and uniqueness rule `data-model.md (CatalogItem.userId + CatalogItem.mediaId)`
- [ ] T021 [P] Implement Rating schema validation in `src/entities/rating/model/rating.schema.js` with citations: `data-model.md (Rating.id)`, `data-model.md (Rating.userId)`, `data-model.md (Rating.mediaId)`, `data-model.md (Rating.value)`, `data-model.md (Rating.createdAt)`, `data-model.md (Rating.updatedAt)`, and uniqueness rule `data-model.md (Rating.userId + Rating.mediaId)`
- [ ] T022 [P] Implement Review schema validation in `src/entities/review/model/review.schema.js` with citations: `data-model.md (Review.id)`, `data-model.md (Review.userId)`, `data-model.md (Review.mediaId)`, `data-model.md (Review.content)`, `data-model.md (Review.isDeleted)`, `data-model.md (Review.createdAt)`, `data-model.md (Review.updatedAt)`, `data-model.md (Review.publishedAt)`, and uniqueness rule `data-model.md (Review.userId + Review.mediaId)`
- [ ] T023 [P] Implement media rating summary aggregator in `src/entities/rating/model/media-rating-summary.js` with citations: `data-model.md (MediaRatingSummary.mediaId)`, `data-model.md (MediaRatingSummary.averageRating)`, `data-model.md (MediaRatingSummary.ratingsCount)`
- [ ] T024 Create OMDb contract tests (search/detail + normalized errors) in `tests/contract/omdb-adapter.contract.test.js`
- [ ] T025 Create JSON Server contract tests for catalog/ratings/reviews resources in `tests/contract/json-server.contract.test.js`
- [ ] T026 Create integration smoke test for providers + routes + shared API bootstrapping in `tests/integration/app-shell.integration.test.jsx`

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Salvar mídia no catálogo (Priority: P1) 🎯 MVP

**Goal**: Permitir buscar mídia, salvar no catálogo pessoal, alterar status e remover item salvo sem duplicidade.

**Independent Test**: Usuário autenticado busca mídia, salva no catálogo com status inicial, altera status para valor permitido e remove item; resultado persiste no JSON Server.

### Tests for User Story 1

- [ ] T027 [P] [US1] Create integration test for search → save → catalog listing flow in `tests/integration/us1-save-media.integration.test.jsx`
- [ ] T028 [P] [US1] Create accessibility integration test for keyboard completion of save/status actions in `tests/integration/us1-keyboard.a11y.test.jsx`

### Implementation for User Story 1

- [ ] T029 [P] [US1] Implement media search widget with OMDb query, pagination, and retry state in `src/widgets/media-search/ui/media-search.jsx`
- [ ] T030 [P] [US1] Implement media details page loader with OMDb detail fetch + local fallback in `src/pages/media-details-page/ui/media-details-page.jsx`
- [ ] T031 [P] [US1] Implement save-media use case (create + duplicate prevention) in `src/features/save-media/model/save-media.js` using citations `data-model.md (CatalogItem.userId)`, `data-model.md (CatalogItem.mediaId)`, `data-model.md (CatalogItem.status)`, `data-model.md (CatalogItem.userId + CatalogItem.mediaId)`, `data-model.md (Media.id)`
- [ ] T032 [P] [US1] Implement status update use case with allowed values in `src/features/update-status/model/update-status.js` using citations `data-model.md (CatalogItem.status)`, `data-model.md (CatalogItem.updatedAt)`
- [ ] T033 [US1] Implement save/status UI controls in `src/features/save-media/ui/save-media-controls.jsx`
- [ ] T034 [US1] Implement personal catalog list widget in `src/widgets/catalog-list/ui/catalog-list.jsx`
- [ ] T035 [US1] Implement catalog item removal use case in `src/features/update-status/model/remove-catalog-item.js` using citation `data-model.md (CatalogItem.id)`
- [ ] T036 [US1] Compose catalog page with search + list widgets in `src/pages/catalog-page/ui/catalog-page.jsx`
- [ ] T037 [US1] Wire US1 routes into the router table in `src/app/routes/router.jsx`

**Checkpoint**: User Story 1 is independently functional and testable.

---

## Phase 4: User Story 2 - Avaliar mídia salva (Priority: P2)

**Goal**: Permitir atribuir e editar nota (1 a 5) para mídia salva e exibir média + quantidade de avaliações.

**Independent Test**: Com mídia salva no catálogo, usuário autenticado atribui nota válida, edita a nota, e a interface exibe média/quantidade atualizadas.

### Tests for User Story 2

- [ ] T038 [P] [US2] Create integration test for create/edit rating flow on saved media in `tests/integration/us2-rate-media.integration.test.jsx`
- [ ] T039 [P] [US2] Create contract test for ratings resource (`GET/POST/PATCH`) in `tests/contract/us2-ratings.contract.test.js`

### Implementation for User Story 2

- [ ] T040 [P] [US2] Implement rate-media use case with 1..5 validation and single-active rule in `src/features/rate-media/model/rate-media.js` using citations `data-model.md (Rating.value)`, `data-model.md (Rating.userId)`, `data-model.md (Rating.mediaId)`, `data-model.md (Rating.updatedAt)`, `data-model.md (Rating.userId + Rating.mediaId)`
- [ ] T041 [P] [US2] Implement rating editor UI (pointer + keyboard) in `src/features/rate-media/ui/rating-editor.jsx`
- [ ] T042 [P] [US2] Implement rating summary presenter in `src/entities/rating/ui/rating-summary.jsx` using citations `data-model.md (MediaRatingSummary.averageRating)`, `data-model.md (MediaRatingSummary.ratingsCount)`
- [ ] T043 [US2] Implement rating eligibility guard for saved catalog items in `src/features/rate-media/model/rating-eligibility.js` using citations `data-model.md (CatalogItem.userId)`, `data-model.md (CatalogItem.mediaId)`
- [ ] T044 [US2] Integrate rating editor and summary into media details page in `src/pages/media-details-page/ui/media-details-page.jsx`

**Checkpoint**: User Stories 1 and 2 are independently functional and testable.

---

## Phase 5: User Story 3 - Escrever resenha de mídia (Priority: P3)

**Goal**: Permitir publicar, editar e excluir resenha de mídia salva com visibilidade pública para usuários e visitantes.

**Independent Test**: Usuário autenticado publica/edita/exclui uma única resenha ativa por mídia, e visitantes visualizam conteúdo público sem permissão de mutação.

### Tests for User Story 3

- [ ] T045 [P] [US3] Create integration test for publish/edit/delete review lifecycle in `tests/integration/us3-review.integration.test.jsx`
- [ ] T046 [P] [US3] Create contract test for reviews resource (`GET/POST/PATCH/DELETE` + errors) in `tests/contract/us3-reviews.contract.test.js`

### Implementation for User Story 3

- [ ] T047 [P] [US3] Implement review-media use case with single-active-review enforcement in `src/features/review-media/model/review-media.js` using citations `data-model.md (Review.userId)`, `data-model.md (Review.mediaId)`, `data-model.md (Review.updatedAt)`, `data-model.md (Review.publishedAt)`, `data-model.md (Review.userId + Review.mediaId)`
- [ ] T048 [P] [US3] Implement review form UI with 20-2000 length validation and keyboard submit in `src/features/review-media/ui/review-form.jsx` using citation `data-model.md (Review.content)`
- [ ] T049 [P] [US3] Implement public reviews widget for authenticated and visitor read-only modes in `src/widgets/public-reviews/ui/public-reviews.jsx` using citation `data-model.md (Review.isDeleted)`
- [ ] T050 [US3] Implement visitor mutation permission rules in `src/features/review-media/model/review-permissions.js`
- [ ] T051 [US3] Integrate review feature into media details page in `src/pages/media-details-page/ui/media-details-page.jsx`
- [ ] T052 [US3] Implement public media page for anonymous read-only access in `src/pages/public-media-page/ui/public-media-page.jsx`

**Checkpoint**: All user stories are independently functional and testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Hardening and final validation across stories.

- [ ] T053 [P] Add accessibility regression suite for save/rate/review critical flows in `tests/integration/critical-flows.a11y.test.jsx`
- [ ] T054 [P] Add reusable OMDb failure fallback component and retry affordance in `src/shared/ui/omdb-fallback.jsx`
- [ ] T055 Configure coverage thresholds (80% lines, 70% branches) and validation scripts in `package.json` and `vitest.config.js`
- [ ] T056 [P] Update execution and validation steps after implementation in `specs/001-catalog-rate-review/quickstart.md`
- [ ] T057 Run full validation (lint, test, coverage, a11y) and capture evidence in `specs/001-catalog-rate-review/implementation-notes.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: starts immediately.
- **Phase 2 (Foundational)**: depends on Phase 1 and blocks all user stories.
- **Phase 3 (US1)**: depends on Phase 2; delivers MVP.
- **Phase 4 (US2)**: depends on Phase 2 and integrates with US1 data, but remains independently testable.
- **Phase 5 (US3)**: depends on Phase 2 and integrates with shared entities/services, but remains independently testable.
- **Phase 6 (Polish)**: depends on selected user stories being complete.

### User Story Dependency Graph

- **US1 (P1)** → first delivery (MVP baseline).
- **US2 (P2)** → depends on foundational phase and saved-media context from US1.
- **US3 (P3)** → depends on foundational phase and saved-media context from US1.

Graph: `US1 → {US2, US3}`

### Within Each User Story

- Tests first (contract/integration), then model/service logic, then UI integration.
- Keep each story releasable after its phase checkpoint.

---

## Parallel Execution Examples

### US1

Run in parallel after T026:

- `T027` and `T028` (different test files)
- `T029`, `T030`, `T031`, `T032` (different feature/page/model files)

### US2

Run in parallel after US1 baseline:

- `T038` and `T039`
- `T040`, `T041`, `T042`

### US3

Run in parallel after US1 baseline:

- `T045` and `T046`
- `T047`, `T048`, `T049`

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1 and Phase 2.
2. Deliver Phase 3 (US1).
3. Validate US1 independently via T027/T028 and quickstart Scenario A/B.

### Incremental Delivery

1. Add US2 and validate rating flow independently.
2. Add US3 and validate review/public flow independently.
3. Execute Phase 6 cross-cutting hardening and final validation.

### Parallel Team Strategy

1. Team completes Setup + Foundational together.
2. Then split by story:
   - Dev A: US1 stabilization
   - Dev B: US2
   - Dev C: US3

---

## Notes

- `[P]` tasks are scoped to different files with no unmet dependencies.
- Story labels (`[US1]`, `[US2]`, `[US3]`) provide traceability to spec priorities.
- All constrained fields from `data-model.md` are explicitly cited in implementing tasks (`T018`–`T023`, with additional story-level citations).
