<!--
Sync Impact Report
- Version change: template (unversioned) → 1.0.0
- Modified principles:
  - Template principle 1 → I. Arquitetura Feature-Sliced Design (FSD)
  - Template principle 2 → II. Stack Tecnológica Obrigatória
  - Template principle 3 → III. Qualidade de Código e Cobertura de Testes (NÃO NEGOCIÁVEL)
  - Template principle 4 → IV. Acessibilidade como Critério de Pronto
  - Template principle 5 → V. Integração de APIs Externas com Resiliência
- Added sections:
  - Padrões Técnicos e Restrições
  - Fluxo de Desenvolvimento e Quality Gates
- Removed sections:
  - Nenhuma
- Follow-up TODOs:
  - Nenhum
-->

# Avaliador de Filmes Constitution

## Core Principles

### I. Arquitetura Feature-Sliced Design (FSD)
Toda evolução da aplicação MUST seguir Feature-Sliced Design, com responsabilidades separadas
por camadas e slices de negócio. Dependências MUST respeitar direção estável (camadas mais altas
dependem de camadas mais baixas), e lógica de domínio MUST permanecer em `entities` e `features`,
evitando acoplamento em `pages` e `widgets`.
Rationale: FSD reduz acoplamento, facilita manutenção e melhora escalabilidade do front-end.

### II. Stack Tecnológica Obrigatória
O front-end MUST ser implementado com React e JavaScript, e o build/runtime de desenvolvimento
MUST usar Vite. Mocks de API MUST ser disponibilizados por JSON Server para desenvolvimento local
e testes de integração de interface. Mudanças de stack só podem ocorrer por emenda formal desta
constituição.
Rationale: padronização de stack reduz custo de manutenção e inconsistências técnicas.

### III. Qualidade de Código e Cobertura de Testes (NÃO NEGOCIÁVEL)
Todo código novo ou alterado MUST incluir testes automatizados proporcionais ao risco funcional.
A cobertura global MUST ser mantida ou aumentada a cada entrega, com meta mínima de 80% para
linhas e 70% para branches. Nenhum PR MUST ser aprovado com testes falhando, lint falhando ou
regressões funcionais conhecidas sem plano de correção aprovado.
Rationale: qualidade contínua depende de prevenção ativa de regressões e de feedback rápido.

### IV. Acessibilidade como Critério de Pronto
Fluxos principais MUST atender, no mínimo, aos critérios WCAG 2.1 nível AA aplicáveis. Componentes
interativos MUST ser operáveis por teclado, possuir semântica HTML adequada e nomes acessíveis.
Toda entrega de UI MUST incluir validação por testes automatizados de acessibilidade e checklist
manual dos fluxos críticos.
Rationale: acessibilidade é requisito de produto, não melhoria opcional.

### V. Integração de APIs Externas com Resiliência
A aplicação MUST consumir a OMDB API e serviços complementares por meio de uma camada dedicada de
acesso a dados (adapters/services), sem chamadas diretas dispersas em componentes de UI. Falhas de
rede e respostas inválidas MUST ter tratamento explícito de erro, estados de carregamento e
fallback de mock quando aplicável em ambiente de desenvolvimento.
Rationale: encapsular integrações externas reduz impacto de mudanças de contrato e melhora
confiabilidade da experiência.

## Padrões Técnicos e Restrições

- Chaves e segredos de APIs externas MUST ser gerenciados por variáveis de ambiente e nunca
  versionados no repositório.
- O contrato de cada integração externa MUST ser documentado e validado por testes de integração.
- Estrutura de pastas e nomenclatura MUST refletir FSD, evitando utilitários globais sem dono
  claro em `shared`.
- Dependências novas MUST ser justificadas por necessidade técnica e impacto de manutenção.

## Fluxo de Desenvolvimento e Quality Gates

- Cada PR MUST incluir evidências de:
  - conformidade com FSD;
  - testes automatizados atualizados e aprovados;
  - verificação de acessibilidade dos fluxos alterados;
  - comportamento de erro/sucesso para integrações com OMDB e serviços complementares.
- Revisão de código MUST validar regras desta constituição antes de aprovação.
- Toda exceção temporária MUST registrar prazo e responsável, com issue de acompanhamento.

## Governance

Esta constituição prevalece sobre convenções locais conflitantes do projeto.

Emendas MUST ser propostas via PR com: justificativa, impacto esperado, plano de migração (quando
aplicável) e atualização deste documento.

Política de versionamento da constituição:
- MAJOR: remoção ou redefinição incompatível de princípio/governança.
- MINOR: adição de novo princípio/seção ou expansão material de regras.
- PATCH: clarificações textuais sem mudança de obrigação normativa.

Conformidade MUST ser revisada em toda PR e em revisão periódica de arquitetura e qualidade.
Não conformidades MUST gerar plano corretivo rastreável.

**Version**: 1.0.0 | **Ratified**: 2026-11-18 | **Last Amended**: 2026-11-18
