# Implementation Plan: Plataforma Social de Catálogo (Filmes e Séries)

**Branch**: `001-catalog-rate-review` | **Date**: 2026-11-18 | **Spec**: `specs/001-catalog-rate-review/spec.md`

**Input**: Feature specification from `/specs/001-catalog-rate-review/spec.md`

## Summary

Implementar a plataforma social de catálogo com arquitetura Feature-Sliced Design (FSD), usando React + JavaScript com Vite no front-end, JSON Server para persistência local e OMDb API para busca de filmes/séries. O escopo cobre salvar mídia no catálogo, atualizar status de acompanhamento, atribuir nota e publicar resenha pública (com visualização também para visitantes não autenticados).

## Technical Context

**Language/Version**: JavaScript (ES2023) com React 19

**Primary Dependencies**: React, React DOM, React Router DOM, Vite, JSON Server, camada de fetch dedicada para OMDb/JSON Server, Vitest, React Testing Library, MSW, jest-axe

**Storage**: `mocks/db.json` servido por JSON Server (catálogo, avaliações, resenhas e usuários de teste)

**Testing**: Vitest (unit/integration), React Testing Library + user-event (UI), MSW (mocks de rede), jest-axe (acessibilidade), cobertura via c8

**Target Platform**: Navegadores modernos (Chrome/Edge/Firefox/Safari nas 2 versões mais recentes) e Node.js 20 LTS no ambiente de desenvolvimento

**Project Type**: Aplicação web SPA (front-end desacoplado de APIs externas)

**Performance Goals**: resposta visual da busca em até 2s p95 (após retorno da OMDb), feedback de salvar/avaliar/resenhar em até 300ms p95 com JSON Server local

**Constraints**: seguir FSD estritamente; chave OMDb somente por variável de ambiente; sem chamadas diretas à OMDb em componentes de UI; fluxos principais operáveis por teclado; uma entrada ativa por usuário+mídia para catálogo, nota e resenha

**Scale/Scope**: MVP para filmes e séries (nível da obra inteira), até ~5.000 usuários ativos/mês no beta, com foco em confiabilidade dos fluxos P1-P3 definidos na spec

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Phase 0 Gate Evaluation

| Gate (Constitution) | Status | Evidence |
|---|---|---|
| I. Arquitetura FSD | PASS | Estrutura planejada em `app/pages/widgets/features/entities/shared` com dependências unidirecionais |
| II. Stack Tecnológica Obrigatória | PASS | React + JavaScript + Vite definidos; JSON Server obrigatório no dev local |
| III. Qualidade e Cobertura | PASS | Estratégia de testes automatizados + meta de cobertura mínima 80% linhas / 70% branches |
| IV. Acessibilidade | PASS | Critérios WCAG 2.1 AA para fluxos principais + testes automatizados (jest-axe) e checklist manual |
| V. Resiliência em APIs Externas | PASS | Camada dedicada de adapters para OMDb e JSON Server com tratamento explícito de erro |

### Post-Phase 1 Re-check

| Gate (Constitution) | Status | Evidence after design |
|---|---|---|
| I. Arquitetura FSD | PASS | `research.md` e `quickstart.md` definem estrutura por layers e limites de dependência |
| II. Stack Tecnológica Obrigatória | PASS | Stack confirmada nos artefatos de design; contratos contemplam JSON Server + OMDb |
| III. Qualidade e Cobertura | PASS | `quickstart.md` define validação com testes unitários, integração e cobertura alvo |
| IV. Acessibilidade | PASS | `quickstart.md` inclui validação de teclado e a11y; `data-model.md` mantém regras para conteúdo acessível |
| V. Resiliência em APIs Externas | PASS | Contratos em `contracts/` documentam erro, fallback e comportamento esperado |

## Project Structure

### Documentation (this feature)

```text
specs/001-catalog-rate-review/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── json-server-contract.md
│   └── omdb-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── providers/
│   ├── routes/
│   └── styles/
├── pages/
│   ├── catalog-page/
│   ├── media-details-page/
│   └── public-media-page/
├── widgets/
│   ├── media-search/
│   ├── catalog-list/
│   └── public-reviews/
├── features/
│   ├── save-media/
│   ├── update-status/
│   ├── rate-media/
│   └── review-media/
├── entities/
│   ├── media/
│   ├── catalog-item/
│   ├── rating/
│   └── review/
└── shared/
    ├── api/
    │   ├── omdb/
    │   └── json-server/
    ├── config/
    ├── lib/
    └── ui/

mocks/
└── db.json

tests/
├── unit/
├── integration/
└── contract/
```

**Structure Decision**: Projeto web único com front-end React em FSD. Integrações externas centralizadas em `shared/api`, regras de negócio em `entities` e `features`, e composição de telas em `widgets/pages`.

## Complexity Tracking

Nenhuma violação constitucional identificada no planejamento.
