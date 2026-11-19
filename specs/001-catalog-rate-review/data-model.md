# Data Model — Plataforma Social de Catálogo

## Visão Geral

O modelo cobre catálogo pessoal, avaliação e resenha pública para filmes/séries, com restrição de unicidade por usuário+mídia.

## Entidades

### 1) User

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| id | string | Sim | Identificador único |
| username | string | Sim | 3-30 caracteres, único |
| displayName | string | Sim | 1-60 caracteres |
| avatarUrl | string \| null | Não | URL válida quando informado |
| createdAt | string (ISO-8601) | Sim | Data de criação |

### 2) Media

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| id | string | Sim | `imdbID` da OMDb (ex.: `tt0133093`) |
| type | enum(`movie`,`series`) | Sim | v1 não suporta episódio/temporada |
| title | string | Sim | 1-200 caracteres |
| year | string | Sim | Formato OMDb (`1999`, `2018–2020`) |
| posterUrl | string \| null | Não | URL válida |
| plot | string \| null | Não | Texto normalizado da OMDb |
| genres | string[] | Não | Lista de gêneros |
| imdbRating | number \| null | Não | 0-10, opcional |
| updatedAt | string (ISO-8601) | Sim | Última sincronização local |

### 3) CatalogItem

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| id | string | Sim | Identificador único |
| userId | string | Sim | FK → User.id |
| mediaId | string | Sim | FK → Media.id |
| status | enum(`want_to_watch`,`watching`,`completed`,`on_hold`,`dropped`) | Sim | Apenas valores permitidos |
| createdAt | string (ISO-8601) | Sim | Data de criação |
| updatedAt | string (ISO-8601) | Sim | Data da última atualização |

**Regra de negócio**: único ativo por `(userId, mediaId)` (FR-009).

### 4) Rating

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| id | string | Sim | Identificador único |
| userId | string | Sim | FK → User.id |
| mediaId | string | Sim | FK → Media.id |
| value | integer | Sim | Escala de 1 a 5 |
| createdAt | string (ISO-8601) | Sim | Data de criação |
| updatedAt | string (ISO-8601) | Sim | Data da última edição |

**Regra de negócio**: uma nota ativa por `(userId, mediaId)`; edição substitui valor anterior (FR-005).

### 5) Review

| Campo | Tipo | Obrigatório | Regras |
|---|---|---|---|
| id | string | Sim | Identificador único |
| userId | string | Sim | FK → User.id |
| mediaId | string | Sim | FK → Media.id |
| content | string | Sim | 20-2000 caracteres (FR-007) |
| isDeleted | boolean | Sim | Soft delete opcional para auditoria local |
| createdAt | string (ISO-8601) | Sim | Data de criação |
| updatedAt | string (ISO-8601) | Sim | Data da última edição |
| publishedAt | string (ISO-8601) | Sim | Data da publicação ativa |

**Regra de negócio**: uma resenha ativa por `(userId, mediaId)` (FR-016).

### 6) MediaRatingSummary (derivada)

| Campo | Tipo | Origem |
|---|---|---|
| mediaId | string | Agrupamento de `Rating` |
| averageRating | number | Média de `value` |
| ratingsCount | integer | Quantidade de notas da mídia |

## Relacionamentos

- User 1:N CatalogItem
- User 1:N Rating
- User 1:N Review
- Media 1:N CatalogItem
- Media 1:N Rating
- Media 1:N Review
- Media 1:1 MediaRatingSummary (derivado em tempo de consulta)

## Regras de validação principais

- Não permitir `CatalogItem`, `Rating` ou `Review` duplicados para o mesmo `(userId, mediaId)`.
- Não permitir rating fora de `1..5`.
- Não permitir review fora de `20..2000` caracteres.
- Operações de criar/editar/excluir exigem usuário autenticado.
- Visitantes não autenticados possuem acesso somente leitura de avaliações/resenhas públicas.

## Transições de estado

### CatalogItem.status

- Estado inicial: `want_to_watch`
- Transições permitidas: qualquer estado para qualquer estado do conjunto permitido
- Estado terminal opcional: remoção do item (delete), retirando do catálogo ativo

### Review lifecycle

- `draft` (estado de formulário, não persistido)
- `published` (persistido e público)
- `edited` (continua público, `updatedAt` alterado)
- `deleted` (não público quando removido; pode ser hard delete ou `isDeleted=true` conforme implementação)
