# Phase 0 Research — Plataforma Social de Catálogo

## 1) Organização por Feature-Sliced Design (FSD)

- **Decision**: Adotar layers `app`, `pages`, `widgets`, `features`, `entities`, `shared` com slices por domínio (`media`, `catalog-item`, `rating`, `review`).
- **Rationale**: Alinha com a constituição do projeto e reduz acoplamento entre UI e regra de negócio.
- **Alternatives considered**:
  - Arquitetura por tipo técnico (`components/services/hooks`): mais simples no início, porém escala pior para domínio rico.
  - Arquitetura por páginas apenas: acelera MVP, mas dificulta reutilização e governança de dependências.

## 2) Roteamento e composição de telas

- **Decision**: Usar React Router DOM para rotas de catálogo, detalhe de mídia e visualização pública.
- **Rationale**: É padrão de mercado no ecossistema React e separa navegação da lógica de domínio.
- **Alternatives considered**:
  - Navegação manual via estado global: menor dependência, porém baixa clareza e pior manutenção.
  - Framework full-stack (ex.: Next.js): fora do escopo e da stack mandatória.

## 3) Persistência local com JSON Server

- **Decision**: Persistir `users`, `catalogItems`, `ratings` e `reviews` em `mocks/db.json` via JSON Server.
- **Rationale**: Atende requisito de simulação/persistência local e permite testes de integração realistas da interface.
- **Alternatives considered**:
  - LocalStorage puro: simples, mas sem contrato HTTP para testes de integração.
  - Backend custom em Node/Express: maior custo para o escopo atual.

## 4) Integração com OMDb (resiliência)

- **Decision**: Implementar adapter dedicado em `shared/api/omdb` com normalização de payload e erros tipados.
- **Rationale**: Evita chamadas dispersas em UI, facilita tratamento de falhas e segue a constituição.
- **Alternatives considered**:
  - Chamada direta com `fetch` em componentes: viola FSD e piora testabilidade.
  - Proxy backend obrigatório no MVP: mais seguro para chave, mas adiciona complexidade fora do escopo atual.

## 5) Estratégia de testes e qualidade (NÃO NEGOCIÁVEL)

- **Decision**: Vitest + React Testing Library + MSW + jest-axe, com metas de cobertura mínimas de 80% linhas e 70% branches.
- **Rationale**: Cobertura proporcional ao risco funcional e validação de UI, integrações e acessibilidade.
- **Alternatives considered**:
  - Apenas testes unitários: insuficiente para fluxos ponta a ponta da interface.
  - Cypress-only: bom para e2e, porém mais lento para feedback diário de domínio.

## 6) Acessibilidade dos fluxos críticos

- **Decision**: Garantir operabilidade por teclado nos fluxos salvar/avaliar/resenhar e validar com jest-axe + checklist manual.
- **Rationale**: Acessibilidade é critério de pronto segundo a constituição.
- **Alternatives considered**:
  - Validação somente manual: não escala e falha em regressões.
  - Validação somente automática: não cobre completamente usabilidade real por teclado.

## 7) Clarificações resolvidas (Technical Context)

- **Decision**: Definir alvo de performance para MVP em 2s p95 (busca com resposta OMDb) e 300ms p95 (ações locais).
- **Rationale**: Metas práticas para front-end com backend local em desenvolvimento.
- **Alternatives considered**:
  - Sem metas explícitas: dificulta validação objetiva.
  - Metas muito agressivas (<1s para tudo): pouco realistas para integrações externas variáveis.

- **Decision**: Assumir escopo beta de até ~5.000 usuários ativos/mês e séries no nível da obra inteira.
- **Rationale**: Compatível com a spec e suficiente para orientar decisões de modelagem e testes.
- **Alternatives considered**:
  - Escala enterprise já no MVP: aumenta complexidade prematuramente.
  - Escopo sem qualquer suposição de escala: prejudica priorização técnica.
