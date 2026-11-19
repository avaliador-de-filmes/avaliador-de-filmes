# Contract — OMDb Integration

## Endpoint externo

- Base: `https://www.omdbapi.com/`
- Autenticação: `apikey` via variável de ambiente (`VITE_OMDB_API_KEY`)

## Operações consumidas

### 1) Busca por termo

`GET /?apikey={key}&s={query}&type={movie|series}&page={n}`

#### Resposta de sucesso (exemplo OMDb)

```json
{
  "Search": [
    {
      "Title": "The Matrix",
      "Year": "1999",
      "imdbID": "tt0133093",
      "Type": "movie",
      "Poster": "https://..."
    }
  ],
  "totalResults": "1",
  "Response": "True"
}
```

### 2) Detalhe por imdbID

`GET /?apikey={key}&i={imdbID}&plot={short|full}`

#### Resposta de sucesso (exemplo OMDb)

```json
{
  "Title": "The Matrix",
  "Year": "1999",
  "Rated": "R",
  "Runtime": "136 min",
  "Genre": "Action, Sci-Fi",
  "Plot": "A computer hacker learns ...",
  "Poster": "https://...",
  "imdbRating": "8.7",
  "imdbID": "tt0133093",
  "Type": "movie",
  "Response": "True"
}
```

## Contrato normalizado interno (adapter)

```json
{
  "id": "tt0133093",
  "type": "movie",
  "title": "The Matrix",
  "year": "1999",
  "posterUrl": "https://...",
  "plot": "A computer hacker learns ...",
  "genres": ["Action", "Sci-Fi"],
  "imdbRating": 8.7,
  "updatedAt": "2026-11-18T14:00:00.000Z"
}
```

## Contrato de erro padronizado

```json
{
  "kind": "network_error",
  "message": "Não foi possível consultar a OMDb no momento.",
  "retryable": true
}
```

`kind` permitido:
- `network_error`
- `unauthorized` (chave ausente/inválida)
- `not_found`
- `invalid_response`
- `rate_limited`

## Regras de resiliência

- Nenhum componente de UI chama OMDb diretamente.
- Toda falha da OMDb gera estado de erro legível + opção de tentar novamente.
- Quando aplicável no ambiente local, a aplicação pode exibir dados já persistidos em `media` no JSON Server como fallback de leitura.
