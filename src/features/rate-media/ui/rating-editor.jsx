import { useEffect, useRef, useState } from 'react'
import { RATING_CONSTRAINTS } from '../../../entities/rating/model/rating.schema'
import { jsonServerResources } from '../../../shared/api/json-server/resources'
import { announceToLiveRegion } from '../../../shared/lib/accessibility'
import { rateMedia } from '../model/rate-media'

const EDITOR_STATUS = Object.freeze({
  idle: 'idle',
  saving: 'saving',
  error: 'error',
})

const RATING_VALUES = Object.freeze(
  Array.from(
    { length: RATING_CONSTRAINTS.max - RATING_CONSTRAINTS.min + 1 },
    (_, index) => RATING_CONSTRAINTS.min + index,
  ),
)

function getNextValueByArrow(key, currentValue) {
  const currentIndex = RATING_VALUES.indexOf(currentValue)

  switch (key) {
    case 'ArrowRight':
    case 'ArrowUp':
      return RATING_VALUES[Math.min(currentIndex + 1, RATING_VALUES.length - 1)]
    case 'ArrowLeft':
    case 'ArrowDown':
      return RATING_VALUES[Math.max(currentIndex - 1, 0)]
    case 'Home':
      return RATING_VALUES[0]
    case 'End':
      return RATING_VALUES[RATING_VALUES.length - 1]
    default:
      return null
  }
}

export default function RatingEditor({
  userId,
  mediaId,
  initialValue = null,
  isAuthenticated = true,
  resources = jsonServerResources,
  onRated,
}) {
  const [currentValue, setCurrentValue] = useState(initialValue)
  const [status, setStatus] = useState(EDITOR_STATUS.idle)
  const [errorMessage, setErrorMessage] = useState('')
  const [feedback, setFeedback] = useState('')
  const optionRefs = useRef({})

  // Ajusta o valor controlado durante a renderização quando a mídia/usuário ou
  // a nota inicial mudam, sem disparar um efeito adicional.
  const initialIdentity = `${userId ?? ''}::${mediaId ?? ''}::${initialValue ?? ''}`
  const [previousIdentity, setPreviousIdentity] = useState(initialIdentity)

  if (initialIdentity !== previousIdentity) {
    setPreviousIdentity(initialIdentity)
    setCurrentValue(initialValue)
  }

  useEffect(() => {
    let active = true

    if (!isAuthenticated || !userId || !mediaId || initialValue !== null) {
      return undefined
    }

    resources.ratings
      .findByUserAndMedia({ userId, mediaId })
      .then((rating) => {
        if (active && rating) {
          setCurrentValue(rating.value)
        }
      })
      .catch(() => {
        // A nota atual é informação complementar; a edição continua disponível.
      })

    return () => {
      active = false
    }
  }, [userId, mediaId, initialValue, isAuthenticated, resources])

  async function handleSelect(value) {
    if (status === EDITOR_STATUS.saving || !userId || !mediaId) {
      return
    }

    setStatus(EDITOR_STATUS.saving)
    setErrorMessage('')
    setFeedback('')

    try {
      const result = await rateMedia({ userId, mediaId, value, resources })
      const message = `Nota ${value} ${result.updated ? 'atualizada' : 'registrada'}.`

      setCurrentValue(value)
      setStatus(EDITOR_STATUS.idle)
      setFeedback(message)
      announceToLiveRegion(message)
      onRated?.(result)
    } catch (error) {
      const message = error?.message ?? 'Não foi possível salvar a nota.'
      setStatus(EDITOR_STATUS.error)
      setErrorMessage(message)
      announceToLiveRegion('Não foi possível salvar a nota.', {
        politeness: 'assertive',
      })
    }
  }

  function handleKeyDown(event) {
    // A navegação parte da opção focada, não da nota selecionada.
    const focusedValue = Number(event.target?.dataset?.ratingValue)
    const origin = RATING_VALUES.includes(focusedValue) ? focusedValue : currentValue
    const nextValue = getNextValueByArrow(event.key, origin)

    if (nextValue === null) {
      return
    }

    event.preventDefault()
    optionRefs.current[nextValue]?.focus()
  }

  if (!isAuthenticated) {
    return (
      <section className="rating-editor" aria-labelledby="rating-editor-heading">
        <h2 id="rating-editor-heading" className="section-title">
          Sua avaliação
        </h2>
        <p className="feedback">Entre para avaliar esta mídia.</p>
      </section>
    )
  }

  return (
    <section className="rating-editor" aria-labelledby="rating-editor-heading">
      <h2 id="rating-editor-heading" className="section-title">
        Avalie esta mídia
      </h2>

      <div
        className="rating-editor__options"
        role="group"
        aria-labelledby="rating-editor-heading"
        onKeyDown={handleKeyDown}
      >
        {RATING_VALUES.map((value) => (
          <button
            key={value}
            ref={(element) => {
              optionRefs.current[value] = element
            }}
            type="button"
            className="rating-editor__option"
            data-rating-value={value}
            aria-label={`Nota ${value}`}
            aria-pressed={currentValue === value}
            disabled={status === EDITOR_STATUS.saving}
            onClick={() => handleSelect(value)}
          >
            <span aria-hidden="true">★</span>
          </button>
        ))}
      </div>

      <p className="rating-editor__hint">
        Use as setas para navegar entre as notas e Enter para confirmar.
      </p>

      {status === EDITOR_STATUS.saving && (
        <p role="status">Salvando nota...</p>
      )}

      {status === EDITOR_STATUS.error && errorMessage && (
        <p className="feedback feedback--error" role="alert">
          {errorMessage}
        </p>
      )}

      {feedback && (
        <p className="feedback feedback--success" role="status">
          {feedback}
        </p>
      )}
    </section>
  )
}
