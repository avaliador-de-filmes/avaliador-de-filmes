# Contract — JSON Server Local API

## Base URL

- `http://localhost:3001`

## Recursos

- `users`
- `media`
- `catalogItems`
- `ratings`
- `reviews`

## Regras gerais

- Conteúdo em JSON (`Content-Type: application/json`)
- `id` é string única por coleção
- Regras de unicidade por `(userId, mediaId)` são garantidas na camada de aplicação (pré-validação no front-end)

## Endpoints principais

### 1) Catálogo

#### GET `/catalogItems?userId={userId}`

- **200 OK**
```json
[
  {
    "id": "ci_1",
    "userId": "u_1",
    "mediaId": "tt0133093",
    "status": "watching",
    "createdAt": "2026-11-18T12:00:00.000Z",
    "updatedAt": "2026-11-18T12:10:00.000Z"
  }
]
```

#### POST `/catalogItems`

```json
{
  "userId": "u_1",
  "mediaId": "tt0133093",
  "status": "want_to_watch"
}
```

- **201 Created** (com timestamps e id)
- **422 Unprocessable Entity** quando status inválido
- **409 Conflict** quando item duplicado (tratado pela camada de aplicação)

#### PATCH `/catalogItems/{id}`

```json
{
  "status": "completed",
  "updatedAt": "2026-11-18T13:00:00.000Z"
}
```

- **200 OK**

#### DELETE `/catalogItems/{id}`

- **200 OK** ou **204 No Content**

### 2) Avaliações

#### GET `/ratings?mediaId={mediaId}`

- **200 OK**

```json
[
  {
    "id": "ra_1",
    "userId": "u_1",
    "mediaId": "tt0133093",
    "value": 5,
    "createdAt": "2026-11-18T12:20:00.000Z",
    "updatedAt": "2026-11-18T12:20:00.000Z"
  }
]
```

#### POST `/ratings`

```json
{
  "userId": "u_1",
  "mediaId": "tt0133093",
  "value": 4
}
```

- **201 Created**
- **422 Unprocessable Entity** se `value` fora de `1..5`
- **409 Conflict** para duplicidade por usuário+mídia

#### PATCH `/ratings/{id}`

```json
{
  "value": 5,
  "updatedAt": "2026-11-18T13:10:00.000Z"
}
```

- **200 OK**

### 3) Resenhas

#### GET `/reviews?mediaId={mediaId}`

- **200 OK**

```json
[
  {
    "id": "rv_1",
    "userId": "u_1",
    "mediaId": "tt0133093",
    "content": "Texto com no mínimo 20 caracteres...",
    "isDeleted": false,
    "createdAt": "2026-11-18T12:30:00.000Z",
    "updatedAt": "2026-11-18T12:30:00.000Z",
    "publishedAt": "2026-11-18T12:30:00.000Z"
  }
]
```

#### POST `/reviews`

```json
{
  "userId": "u_1",
  "mediaId": "tt0133093",
  "content": "Resenha com tamanho entre 20 e 2000 caracteres."
}
```

- **201 Created**
- **422 Unprocessable Entity** para conteúdo inválido
- **409 Conflict** para segunda resenha ativa na mesma mídia

#### PATCH `/reviews/{id}`

```json
{
  "content": "Resenha editada com novo texto válido.",
  "updatedAt": "2026-11-18T13:20:00.000Z"
}
```

- **200 OK**

#### DELETE `/reviews/{id}`

- **200 OK** ou **204 No Content**

## Contrato de erro (camada de aplicação)

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Descrição legível do problema",
  "details": {
    "field": "status"
  }
}
```
