# Quickstart de Validação — Plataforma Social de Catálogo

**Feature**: `specs/001-catalog-rate-review`
**Atualizado em**: 2026-11-20 (pós-implementação — T056)

## Objetivo

Validar ponta a ponta os fluxos de buscar/salvar, avaliar, resenhar e a leitura pública de mídias,
além dos quality gates técnicos (lint, testes, cobertura e acessibilidade).

## Pré-requisitos

- Node.js `>= 20.19` (ver `engines` em `package.json`) e npm
- Dependências instaladas:
  ```bash
  npm install
  ```
- Chave da OMDb (gratuita em <https://www.omdbapi.com/apikey.aspx>)

## Configuração de ambiente

Copie `.env.example` para `.env.local` (não versionado) e preencha:

| Variável | Obrigatória | Padrão | Descrição |
|---|---|---|---|
| `VITE_OMDB_API_KEY` | Sim | — | Chave da OMDb; ausente/inválida gera erro de autorização nas buscas |
| `VITE_OMDB_BASE_URL` | Não | `https://www.omdbapi.com/` | Endpoint da OMDb |
| `VITE_API_BASE_URL` | Não | `http://localhost:3001` | Base do JSON Server local |
| `VITE_TEST_USER_ID` | Não | `u_1` | Usuário carregado pela sessão simulada |

> A chave MUST vir apenas de variável de ambiente. `.env.local` está no `.gitignore` e nunca deve
> ser versionado.

## Subir o ambiente local (fluxo canônico)

1. Execute o orquestrador (app + mocks):
   ```bash
   npm run dev:full
   ```
   O script `scripts/dev-with-mocks.mjs`:
   - restaura `mocks/db.runtime.json` a partir de `mocks/db.json` (reset determinístico);
   - sobe o JSON Server em `http://localhost:3001` em modo watch;
   - sobe o Vite (URL exibida no terminal; padrão `http://localhost:5173`).
2. Acesse a URL informada pelo Vite.
3. `Ctrl+C` encerra os dois processos.

> A porta `3001` precisa estar livre; se estiver em uso, o script aborta com mensagem clara.

### Comandos alternativos

| Comando | Efeito |
|---|---|
| `npm run dev` | Somente Vite (exige a API já em execução) |
| `npm run mocks` | Somente JSON Server sobre `mocks/db.runtime.json` |
| `npm run mocks:reset` | Restaura `mocks/db.runtime.json` a partir de `mocks/db.json`, sem subir processos |

### Persistência local

- `mocks/db.json` é a **fonte canônica** versionada (seed de `users`, `media`, `catalogItems`,
  `ratings`, `reviews`).
- `mocks/db.runtime.json` é o banco de execução, recriado a cada `dev:full`/`mocks:reset` e não
  versionado.
- Todas as mutações da aplicação (salvar, status, nota, resenha) gravam em `mocks/db.runtime.json`.

## Rotas da aplicação

| Rota | Página |
|---|---|
| `/` | Home |
| `/catalog` | Catálogo pessoal (busca na OMDb + lista salva) |
| `/media/:mediaId` | Detalhes da mídia com ações de sessão autenticada |
| `/public/media/:mediaId` | Página pública somente leitura (visitantes) |

## Sessão simulada (autenticado vs visitante)

O padrão é **autenticado** como `u_1` (Usuário Teste). Para validar o Cenário D, alterne para
visitante no console do navegador:

```js
// entrar como visitante
localStorage.setItem('avaliador.auth-session.mode', 'visitor')
location.reload()

// voltar ao modo autenticado
localStorage.removeItem('avaliador.auth-session.mode')
location.reload()
```

## Dados de seed (`mocks/db.json`)

| Coleção | Registro | Observação |
|---|---|---|
| `users` | `u_1` | Usuário Teste (sessão padrão) |
| `media` | `tt0133093` / `tt0903747` | The Matrix (1999) / Breaking Bad (2008–2013) |
| `catalogItems` | `ci_1` | `u_1` + `tt0133093` com status `want_to_watch` |
| `ratings` | `ra_1` | `u_1` + `tt0133093`, nota `5` |
| `reviews` | `rv_1` | `u_1` + `tt0133093`, resenha ativa |

## Cenários de validação funcional

### Cenário A — Buscar, salvar e remover do catálogo (P1)

1. Abra `/` e clique em **“Ir para o catálogo”**.
2. Busque por “Matrix”; confirme resultados, contagem e paginação.
3. Clique em **“Ver detalhes”** → rota `/media/<imdbID>`.
4. Acione **“Salvar no catálogo”**.
5. Repita o salvamento para a mesma mídia.

**Resultado esperado**: item persistido com status inicial `Quero ver`; repetição informa que a
mídia já estava salva, sem criar duplicata (`GET /catalogItems?userId=u_1&mediaId=<imdbID>` retorna
um único registro). Em `/catalog`, altere o status e remova o item; a lista e o JSON Server devem
refletir a mudança.

### Cenário B — Status e avaliação (P1 + P2)

1. Em `/catalog`, altere o status para `Assistindo` e depois `Concluído`.
2. Abra `/media/tt0133093`.
3. Use as setas (`←`/`→`) para navegar entre as notas e `Enter` para confirmar; ajuste a nota em
   seguida.

**Resultado esperado**: status e nota persistidos; apenas uma nota ativa por usuário+mídia (a edição
atualiza o registro existente) e o resumo de média/quantidade reflete o valor atual.

### Cenário C — Publicar, editar e excluir resenha (P3)

1. Em `/media/tt0133093`, publique uma resenha com 20+ caracteres.
2. Edite a resenha existente e salve (o envio também pode ser feito com `Ctrl+Enter`/`Cmd+Enter`).
3. Exclua a resenha e confirme a remoção da listagem pública.
4. Valide os limites: 19 caracteres e texto só com espaços devem ser rejeitados com mensagem.

**Resultado esperado**: validação de 20–2000 caracteres; no máximo uma resenha ativa por
usuário+mídia; alterações e exclusão visíveis para leitores.

### Cenário D — Visualização pública para visitantes (P3)

1. Ative o modo visitante (ver “Sessão simulada”).
2. Abra `/public/media/tt0133093`.
3. Verifique a média/quantidade e a lista de avaliações públicas, além das resenhas (autoria e data de publicação).
4. Confirme a ausência de ações de criar/editar/excluir e as mensagens “Entre para…”.

**Resultado esperado**: leitura pública habilitada; mutações bloqueadas para visitante; `/catalog`
não lista o catálogo pessoal para visitantes.

### Cenário E — Falha da OMDb

1. Deixe `VITE_OMDB_API_KEY` vazia/inválida (ou simule indisponibilidade de rede).
2. Em `/catalog`, faça uma busca.
3. Abra `/media/tt0133093` (mídia já salva localmente) e depois uma mídia sem registro local.

**Resultado esperado**:
- busca: alerta acessível com mensagem clara (`A chave da OMDb está ausente ou inválida.` ou
  `Não foi possível consultar a OMDb no momento.`) e ação **“Tentar novamente”**;
- detalhes de mídia salva: exibe os dados locais com o aviso
  `Não foi possível consultar a OMDb. Exibindo os dados salvos no catálogo local.`;
- detalhes sem fallback local: alerta com mensagem e ação **“Tentar novamente”**.

## Validação técnica (quality gates)

```bash
npm run lint
npm test
npm run test:unit
npm run test:coverage
npm run test:a11y

# lint + cobertura + acessibilidade em um único comando
npm run validate
```

| Comando | Escopo | Critério de aprovação |
|---|---|---|
| `npm run lint` | oxlint em `src/` e `tests/` | Sem erros bloqueantes |
| `npm test` | Suíte completa (unit, integration, contract) | 100% dos testes verdes |
| `npm run test:unit` | Apenas `tests/unit` | 100% verdes |
| `npm run test:coverage` | Suíte completa + V8 coverage | **Linhas ≥ 80%** e **branches ≥ 70%**; o comando falha abaixo disso |
| `npm run test:a11y` | `tests/integration/critical-flows.a11y.test.jsx` | `jest-axe` sem violações + fluxos concluídos por teclado |
| `npm run validate` | lint + cobertura + acessibilidade | Exit code `0` |

Os thresholds ficam em `vitest.config.js` (`coverage.thresholds`). O script `test:a11y` filtra
arquivos com `a11y` no nome; novos testes de acessibilidade devem seguir essa convenção
(`*.a11y.test.jsx`).

## Evidências e registro

- Evidências da última execução completa (lint, testes, cobertura, a11y):
  `specs/001-catalog-rate-review/implementation-notes.md`.
- Ao abrir um PR, anexe:
  - saída de `npm run validate`;
  - resumo de cobertura (linhas/branches);
  - resultado da suíte de acessibilidade;
  - limitações/falhas conhecidas encontradas durante a validação manual.
