# Feature Specification: Plataforma Social de Catálogo

**Feature Branch**: `001-catalog-rate-review`

**Created**: 2026-11-18

**Status**: Draft

**Input**: User description: "Eu estou desenvolvendo uma plataforma de catalogação social, sistemas de tracking como MyAnimeList e letterboxd focado em filmes e series onde o usuario poder salvar, avaliar e escrever uma resenha sobre a midia"

## Clarifications

### Session 2026-11-18

- Q: As resenhas e avaliações de cada usuário devem ser visíveis para quem? → A: Públicas para todos os usuários.
- Q: Qual conjunto de status de acompanhamento você quer adotar no v1? → A: Quero ver / Assistindo / Concluído / Em pausa / Abandonado.
- Q: Pessoas sem conta (não autenticadas) também podem visualizar avaliações e resenhas públicas? → A: Sim, visitantes podem visualizar.
- Q: No v1, o tracking de séries deve considerar apenas a série como um todo ou também progresso por episódio/temporada? → A: Apenas status da série inteira.
- Q: Cada usuário pode ter quantas resenhas por mídia no v1? → A: Apenas 1 resenha ativa por mídia, com edição permitida.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Salvar mídia no catálogo (Priority: P1)

Como usuário autenticado, quero salvar filmes e séries no meu catálogo pessoal para organizar
o que já vi e o que pretendo assistir.

**Why this priority**: Sem catálogo pessoal, a plataforma não entrega o valor central de tracking.

**Independent Test**: Pode ser testada de forma independente quando um usuário consegue buscar
uma mídia, salvá-la no catálogo e visualizar o item na sua lista pessoal.

**Acceptance Scenarios**:

1. **Given** um usuário autenticado visualizando uma mídia, **When** ele salva a mídia no catálogo,
   **Then** o item aparece na lista pessoal com status inicial definido.
2. **Given** um item salvo no catálogo, **When** o usuário altera o status de acompanhamento,
   **Then** o novo status é persistido e exibido na lista.
3. **Given** um item salvo no catálogo, **When** o usuário seleciona um status permitido,
   **Then** o sistema aceita apenas um entre: Quero ver, Assistindo, Concluído, Em pausa ou Abandonado.

---

### User Story 2 - Avaliar mídia salva (Priority: P2)

Como usuário autenticado, quero atribuir uma nota para mídias salvas para registrar minha opinião
de forma rápida.

**Why this priority**: A avaliação numérica gera sinal imediato de preferência e melhora a utilidade
social da plataforma.

**Independent Test**: Pode ser testada de forma independente quando um usuário consegue atribuir,
editar e visualizar uma nota para um item salvo.

**Acceptance Scenarios**:

1. **Given** um item salvo no catálogo, **When** o usuário atribui uma nota válida,
   **Then** a nota é registrada e exibida no item.
2. **Given** um item já avaliado, **When** o usuário altera a nota,
   **Then** o valor anterior é substituído e o novo valor é exibido.

---

### User Story 3 - Escrever resenha de mídia (Priority: P3)

Como usuário autenticado, quero escrever uma resenha sobre uma mídia salva para compartilhar minha
análise com outros usuários.

**Why this priority**: Resenhas aprofundam a interação social e aumentam o valor da descoberta
de conteúdo.

**Independent Test**: Pode ser testada de forma independente quando um usuário consegue publicar,
editar e excluir uma resenha associada a uma mídia salva.

**Acceptance Scenarios**:

1. **Given** um item salvo no catálogo, **When** o usuário publica uma resenha válida,
   **Then** a resenha é exibida na página da mídia com autoria e data.
2. **Given** uma resenha existente do usuário, **When** ele edita ou exclui a resenha,
   **Then** a alteração é refletida corretamente para os leitores.
3. **Given** uma mídia com avaliações e resenhas publicadas, **When** outro usuário acessa a página
   da mídia, **Then** ele visualiza o conteúdo público de autoria de terceiros.
4. **Given** um visitante não autenticado, **When** ele acessa a página de uma mídia,
   **Then** ele visualiza avaliações e resenhas públicas sem poder criar ou editar conteúdo.

---

### Edge Cases

- O que acontece quando o usuário tenta salvar a mesma mídia mais de uma vez?
- Como o sistema reage quando a mídia fica temporariamente indisponível no provedor externo?
- Como o sistema trata tentativas de enviar resenha vazia ou acima do limite permitido?
- Como o sistema lida com tentativa de avaliar uma mídia que ainda não está salva no catálogo?
- O que acontece quando o usuário tenta criar nova resenha para uma mídia já resenhada por ele?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST permitir que usuários autenticados salvem filmes e séries no catálogo
  pessoal.
- **FR-002**: O sistema MUST registrar para cada item salvo um status de acompanhamento entre:
  Quero ver, Assistindo, Concluído, Em pausa ou Abandonado.
- **FR-003**: O sistema MUST permitir atualizar e remover itens do catálogo pessoal.
- **FR-004**: Usuários MUST poder atribuir uma nota em escala de 1 a 5 para cada mídia salva.
- **FR-005**: O sistema MUST permitir editar a nota de uma mídia salva, mantendo apenas a nota mais
  recente como ativa.
- **FR-006**: Usuários MUST poder escrever uma resenha textual para cada mídia salva.
- **FR-007**: O sistema MUST validar tamanho de resenha entre 20 e 2.000 caracteres.
- **FR-008**: O sistema MUST permitir editar e excluir resenhas de autoria do próprio usuário.
- **FR-009**: O sistema MUST impedir mais de um registro ativo da mesma mídia por usuário no catálogo.
- **FR-010**: O sistema MUST exibir nota média e quantidade de avaliações por mídia.
- **FR-011**: O sistema MUST exibir mensagens claras de erro e permitir nova tentativa quando houver
  falha na obtenção de dados de catálogo externo.
- **FR-012**: O sistema MUST permitir conclusão por teclado dos fluxos principais de salvar, avaliar
  e publicar resenha.
- **FR-013**: O sistema MUST tornar avaliações e resenhas visíveis publicamente para todos os usuários.
- **FR-014**: O sistema MUST permitir visualização pública de avaliações e resenhas por visitantes
  não autenticados, mantendo criação/edição/exclusão restritas a usuários autenticados.
- **FR-015**: O sistema MUST tratar séries no v1 apenas no nível da obra completa, sem controle de
  progresso por temporada ou episódio.
- **FR-016**: O sistema MUST permitir apenas uma resenha ativa por usuário para cada mídia, com
  suporte a edição dessa resenha.

### Key Entities *(include if feature involves data)*

- **Usuário**: Pessoa autenticada que mantém catálogo pessoal, avaliações e resenhas.
- **Mídia**: Filme ou série com metadados descritivos usados para identificação e navegação.
- **Item de Catálogo**: Associação entre usuário e mídia, contendo status de acompanhamento e
  histórico de atualização.
- **Avaliação**: Nota numérica atribuída por um usuário a uma mídia salva.
- **Resenha**: Texto opinativo de autoria do usuário, vinculado a uma mídia salva.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Pelo menos 90% dos usuários de teste conseguem salvar a primeira mídia em até 2 minutos.
- **SC-002**: Pelo menos 90% dos usuários de teste conseguem completar o fluxo salvar + avaliar +
  resenhar em até 5 minutos, sem ajuda externa.
- **SC-003**: Pelo menos 95% das tentativas de salvar, avaliar e publicar resenha resultam em
  confirmação de sucesso sem erro bloqueante.
- **SC-004**: Menos de 2% dos itens de catálogo criados apresentam duplicidade por usuário e mídia.
- **SC-005**: Pelo menos 80% dos usuários ativos na primeira semana registram ao menos uma avaliação
  e uma resenha.

## Assumptions

- Apenas usuários autenticados podem salvar, avaliar e resenhar mídias.
- Visitantes não autenticados podem apenas visualizar avaliações e resenhas públicas.
- O escopo inicial cobre somente filmes e séries.
- Para séries, o acompanhamento no v1 ocorre apenas no nível da obra inteira.
- Cada usuário possui no máximo uma resenha ativa por mídia; atualizações ocorrem por edição.
- Cada usuário mantém no máximo um item ativo por mídia no catálogo pessoal.
- O status de acompanhamento permitido no v1 é restrito a: Quero ver, Assistindo, Concluído,
  Em pausa e Abandonado.
- Resenhas e avaliações são públicas para todos os usuários.
- Funcionalidades de seguir usuários, curtidas e comentários em resenhas estão fora do escopo desta
  especificação inicial.
- Dados de mídia podem depender de disponibilidade de serviços externos de catálogo.
