# Implementation Notes — Validação de Qualidade

**Feature**: `specs/001-catalog-rate-review`
**Tasks relacionadas**: T055 (gates de cobertura + scripts de validação) e T057 (evidências de validação)
**Data da execução**: 2026-11-20
**Ambiente**: Windows (win32), Node.js v24.19.0, npm 12.0.2, Vitest 5.1.1, V8 coverage

## 1. Quality gates configurados (T055)

### `vitest.config.js`

```js
coverage: {
  provider: "v8",
  reporter: ["text", "html"],
  include: ["src/**/*.{js,jsx}"],
  // Quality gate from Constitution III: 80% lines / 70% branches.
  thresholds: {
    lines: 80,
    branches: 70,
  },
}
```

O `vitest run --coverage` passa a falhar (exit code diferente de zero) quando a cobertura global
ficar abaixo de 80% de linhas ou 70% de branches (Constituição, Princípio III).

### `package.json`

| Script | Comando | Finalidade |
|---|---|---|
| `lint` | `oxlint` | Análise estática |
| `test` | `vitest run` | Suíte completa |
| `test:unit` | `vitest run tests/unit` | Apenas testes unitários |
| `test:coverage` | `vitest run --coverage` | Suíte + gate de cobertura |
| `test:a11y` | `vitest run a11y` | Suíte de acessibilidade (`critical-flows.a11y.test.jsx`) |
| `validate` | `npm run lint && npm run test:coverage && npm run test:a11y` | Validação completa em um comando |

## 2. Evidências de validação (T057)

### 2.1 Lint

```text
$ npm run lint
src/app/routes/router.jsx:14:10 warning react(only-export-components)
src/app/routes/router.jsx:18:10 warning react(only-export-components)
src/app/routes/router.jsx:35:10 warning react(only-export-components)
src/app/routes/router.jsx:47:10 warning react(only-export-components)
Exit code: 0
```

- Resultado: **PASS** (nenhum erro bloqueante).
- Observação: 4 avisos não bloqueantes de Fast Refresh decorrentes de `router.jsx` exportar
  componentes de página auxiliares; não afetam o build nem os gates.

### 2.2 Testes

```text
$ npm test

 Test Files  19 passed (19)
      Tests  240 passed (240)
   Exit code: 0
```

Cobertura de teste por camada:

| Camada | Arquivos cobertos |
|---|---|
| `entities/*/model` | `user.schema`, `media.schema`, `catalog-item.schema`, `rating.schema`, `review.schema`, `media-rating-summary`, `catalog-item-status` |
| `features/*/model` | `save-media`, `update-status`, `remove-catalog-item`, `rate-media`, `rating-eligibility`, `review-media`, `review-permissions` |
| `features/*/ui` | `save-media-controls`, `rating-editor`, `review-form` |
| `widgets` | `catalog-list`, `public-reviews` |
| `pages` | `media-details-page`, `public-media-page` |
| `shared` | `api/omdb/*`, `api/json-server/*`, `lib/accessibility`, `lib/request-state`, `lib/auth-session` |

### 2.3 Cobertura

```text
$ npm run test:coverage

All files       |   86.61 |    80.87 |   88.33 |   86.52 |
-----------------------------------------------------------
Statements   : 86.61% ( 1378/1591 )
Branches     : 80.87% ( 1197/1480 )
Functions    : 88.33% ( 356/403 )
Lines        : 86.52% ( 1349/1559 )
Exit code: 0
```

| Métrica | Limite | Obtido | Status |
|---|---|---|---|
| Linhas | 80% | 86.52% | PASS |
| Branches | 70% | 80.87% | PASS |

Destaques por módulo:

| Módulo | Linhas | Branches |
|---|---|---|
| `entities/user/model/user.schema.js` | 100% | 97.43% |
| `entities/media/model/media.schema.js` | 98.11% | 96.87% |
| `entities/catalog-item/model/catalog-item.schema.js` | 100% | 96.29% |
| `entities/rating/model/rating.schema.js` | 100% | 96.66% |
| `entities/review/model/review.schema.js` | 100% | 97.36% |
| `entities/rating/model/media-rating-summary.js` | 100% | 95.45% |
| `features/save-media/model/save-media.js` | 100% | 86.36% |
| `features/update-status/model/update-status.js` | 100% | 100% |
| `features/update-status/model/remove-catalog-item.js` | 100% | 100% |
| `shared/lib/request-state.js` | 95.08% | 92.77% |
| `shared/lib/accessibility.js` | 96% | 93.65% |
| `widgets/catalog-list/ui/catalog-list.jsx` | 95.31% | 83.33% |

### 2.4 Acessibilidade

```text
$ npm run test:a11y

 Test Files  1 passed (1)
      Tests  9 passed (9)
   Exit code: 0
```

`tests/integration/critical-flows.a11y.test.jsx` cobre os fluxos críticos com `jest-axe`
(`toHaveNoViolations`) e operação exclusiva por teclado:

| Fluxo | Verificações |
|---|---|
| Salvar mídia | Sem violações no estado inicial e visitante; salvamento concluído com `Tab`/`Enter`; restrição de visitante sem controles de mutação |
| Avaliar mídia | Sem violações; navegação por `ArrowRight` e confirmação com `Enter`; estado visitante somente leitura |
| Resenhar | Sem violações; validação de 20–2000 caracteres via `Ctrl+Enter`; publicação via teclado; estado visitante somente leitura |

`tests/integration/catalog-list.integration.test.jsx` complementa a cobertura do fluxo P1
(listagem, atualização de status, remoção, erro e retry).

## 3. Escopo adicional necessário para o gate

Para que o limite de 80%/70% fosse atingido de forma real (sem exclusões artificiais), foram
adicionados testes unitários e de integração:

- `tests/unit/entity-schemas.test.js` — contratos de validação de `User`, `Media`, `CatalogItem`,
  `Rating` e `Review` (campos obrigatórios, limites, unicidade e normalização).
- `tests/unit/request-state.test.js` — máquina de estados de requisição e utilitários de retry.
- `tests/unit/accessibility.test.js` — atalhos de teclado, foco, focus trap e live regions.
- `tests/unit/catalog-usecases.test.js` — casos de uso de salvar/atualizar/remover, status e
  sumarização de avaliações.
- `tests/integration/catalog-list.integration.test.jsx` — listagem e mutações do catálogo pessoal.
- `tests/integration/critical-flows.a11y.test.jsx` — regressão de acessibilidade dos fluxos
  críticos (T053).

## 4. Pendências conhecidas (fora de T055/T057)

| Item | Situação |
|---|---|
| `src/widgets/media-search/ui/media-search.jsx` | 4.34% de linhas — coberto apenas por smoke test; fluxo completo de busca/paginação ainda depende de T027 |
| `src/pages/catalog-page/ui/catalog-page.jsx` | 0% de linhas — composição da página ainda sem teste dedicado (T027) |
| `src/main.jsx` | 0% — bootstrap do app, exercitado apenas em execução real |
| `src/features/rate-media/model/rate-media.js` | 55.17% de linhas — caminho de conflito/concorrência sem teste dedicado (T064) |
| Scripts de dev (`scripts/dev-with-mocks.mjs`) | Não entram no gate de cobertura (`src/**` apenas) |

## 5. Comandos de reprodução

```bash
npm install
npm run validate
```

Saída esperada: lint sem erros, `240` testes aprovados, cobertura `>= 80% linhas` e
`>= 70% branches`, e `9` verificações de acessibilidade aprovadas.
