# Quickstart de Validação — Plataforma Social de Catálogo

## Objetivo

Validar ponta a ponta os fluxos de salvar, avaliar e resenhar mídias, além da visualização pública.

## Pré-requisitos

- Node.js 20+ e npm
- Chave da OMDb configurada em variável de ambiente (`VITE_OMDB_API_KEY`)
- Dependências instaladas com `npm install`

## Subir ambiente local

1. Iniciar API local (JSON Server):
   ```bash
   npx json-server --watch mocks/db.json --port 3001
   ```
2. Em outro terminal, iniciar app:
   ```bash
   npm run dev
   ```
3. Acessar URL exibida pelo Vite (ex.: `http://localhost:5173`)

## Referências de contrato e modelo

- Modelo de dados: `specs/001-catalog-rate-review/data-model.md`
- Contrato JSON Server: `specs/001-catalog-rate-review/contracts/json-server-contract.md`
- Contrato OMDb: `specs/001-catalog-rate-review/contracts/omdb-contract.md`

## Cenários de validação funcional

### Cenário A — Salvar mídia no catálogo (P1)

1. Buscar por uma mídia existente.
2. Abrir detalhe da mídia.
3. Acionar “Salvar no catálogo”.
4. Confirmar que a mídia aparece no catálogo pessoal com status inicial `Quero ver`.

**Resultado esperado**: item persistido no JSON Server sem duplicidade para o mesmo usuário+mídia.

### Cenário B — Atualizar status e avaliação (P1 + P2)

1. Selecionar item já salvo.
2. Alterar status para `Assistindo` e depois `Concluído`.
3. Atribuir nota entre 1 e 5, depois editar a nota.

**Resultado esperado**: status e nota atualizados; apenas uma nota ativa por usuário+mídia.

### Cenário C — Publicar, editar e excluir resenha (P3)

1. Em mídia salva, publicar resenha com 20+ caracteres.
2. Editar resenha existente.
3. Excluir resenha.

**Resultado esperado**: validação de tamanho aplicada; no máximo uma resenha ativa por usuário+mídia; alterações visíveis corretamente.

### Cenário D — Visualização pública para visitantes

1. Acessar página pública da mídia sem autenticação.
2. Verificar avaliações e resenhas públicas.
3. Confirmar ausência de ações de criar/editar/excluir.

**Resultado esperado**: leitura pública habilitada; mutações bloqueadas para visitante.

### Cenário E — Falha da OMDb

1. Simular erro de rede/chave inválida na OMDb.
2. Repetir busca/detalhe de mídia.

**Resultado esperado**: mensagem clara de erro + opção de nova tentativa; fallback local quando disponível.

## Validação técnica (qualidade)

Executar:

```bash
npm run lint
npm run test
npm run test:coverage
npm run test:a11y
```

**Resultado esperado**:
- lint sem erros bloqueantes
- testes unitários/integração passando
- cobertura mínima de 80% (linhas) e 70% (branches)
- fluxos críticos sem violações de acessibilidade bloqueantes
