import { useEffect, useId, useRef, useState } from 'react'
import { REVIEW_CONSTRAINTS } from '../../../entities/review/model/review.schema'
import { jsonServerResources } from '../../../shared/api/json-server/resources'
import { announceToLiveRegion } from '../../../shared/lib/accessibility'
import {
  editReview,
  publishReview,
  validateReviewContent,
} from '../model/review-media'

/**
 * Formulário de resenha com validação de 20-2000 caracteres
 * (data-model.md — Review.content) e envio por teclado.
 *
 * Publica a primeira resenha de uma mídia ou edita a resenha ativa recebida em
 * `review`. O envio também pode ser disparado com Ctrl+Enter (Cmd+Enter no
 * macOS), além do botão de submit nativo.
 */
export default function ReviewForm({
  userId,
  mediaId,
  review = null,
  isAuthenticated = true,
  resources = jsonServerResources,
  onPublished,
  heading = 'Sua resenha',
  focusToken = 0,
}) {
  const fieldId = useId()
  const textareaRef = useRef(null)

  const [content, setContent] = useState(review?.content ?? '')
  const [fieldError, setFieldError] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [feedback, setFeedback] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isEditing = Boolean(review?.id)
  const trimmedLength = content.trim().length
  const canWrite = Boolean(isAuthenticated && userId && mediaId)

  const headingId = `${fieldId}-heading`
  const contentId = `${fieldId}-content`
  const hintId = `${fieldId}-hint`
  const counterId = `${fieldId}-counter`
  const errorId = `${fieldId}-error`

  // Reinicializa o formulário quando a mídia ou a resenha alvo muda, sem
  // sobrescrever o texto enquanto o usuário digita.
  const reviewIdentity = `${review?.id ?? 'new'}::${mediaId ?? ''}`
  const [loadedReviewIdentity, setLoadedReviewIdentity] = useState(reviewIdentity)

  if (loadedReviewIdentity !== reviewIdentity) {
    setLoadedReviewIdentity(reviewIdentity)
    setContent(review?.content ?? '')
    setFieldError('')
    setErrorMessage('')
  }

  // Solicitações externas (ex.: botão "Editar resenha" na listagem pública)
  // levam o foco ao campo de texto sem interferir na digitação normal.
  useEffect(() => {
    if (focusToken > 0) {
      textareaRef.current?.focus()
    }
  }, [focusToken])

  function handleChange(event) {
    setContent(event.target.value)
    setFieldError('')
    setErrorMessage('')
    setFeedback('')
  }

  function handleBlur() {
    if (!content.trim()) {
      return
    }

    const result = validateReviewContent(content)
    setFieldError(result.valid ? '' : (result.errors[0]?.message ?? ''))
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (isSubmitting) {
      return
    }

    if (!canWrite) {
      setErrorMessage('Entre para publicar sua resenha.')
      return
    }

    const validation = validateReviewContent(content)

    if (!validation.valid) {
      const message = validation.errors[0]?.message ?? 'Resenha inválida.'
      setFieldError(message)
      setErrorMessage('')
      setFeedback('')
      announceToLiveRegion(message, { politeness: 'assertive' })
      textareaRef.current?.focus()
      return
    }

    setIsSubmitting(true)
    setFieldError('')
    setErrorMessage('')
    setFeedback('')

    try {
      const result = isEditing
        ? await editReview({
            reviewId: review.id,
            userId,
            content: validation.value,
            resources,
          })
        : await publishReview({
            userId,
            mediaId,
            content: validation.value,
            resources,
          })

      const message = result.created
        ? 'Resenha publicada com sucesso.'
        : result.restored
          ? 'Resenha republicada com sucesso.'
          : 'Resenha atualizada com sucesso.'

      setContent(validation.value)
      setFeedback(message)
      announceToLiveRegion(message)
      onPublished?.(result)
    } catch (error) {
      if (
        error?.code === 'VALIDATION_ERROR' &&
        error?.details?.field === 'content'
      ) {
        setFieldError(error.message)
        textareaRef.current?.focus()
      } else {
        const message =
          error?.message ?? 'Não foi possível salvar sua resenha.'
        setErrorMessage(message)
        announceToLiveRegion(message, { politeness: 'assertive' })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="review-form" aria-labelledby={headingId}>
      <h2 id={headingId} className="section-title">
        {heading}
      </h2>

      {!canWrite ? (
        <p className="feedback">Entre para publicar uma resenha.</p>
      ) : (
        <form className="review-form__form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor={contentId}>
              {isEditing ? 'Editar sua resenha' : 'Sua resenha'}
            </label>

            <textarea
              ref={textareaRef}
              id={contentId}
              rows={6}
              value={content}
              disabled={isSubmitting}
              aria-required="true"
              aria-invalid={fieldError ? 'true' : 'false'}
              aria-describedby={`${hintId} ${counterId}${
                fieldError ? ` ${errorId}` : ''
              }`}
              placeholder="Compartilhe sua opinião sobre a mídia."
              onChange={handleChange}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
            />

            <p id={hintId} className="review-form__hint">
              Entre {REVIEW_CONSTRAINTS.minLength} e{' '}
              {REVIEW_CONSTRAINTS.maxLength} caracteres. Use Ctrl+Enter (ou
              Cmd+Enter) para publicar.
            </p>

            <p id={counterId} className="review-form__counter">
              {trimmedLength}/{REVIEW_CONSTRAINTS.maxLength} caracteres
            </p>

            {fieldError && (
              <p id={errorId} className="feedback feedback--error" role="alert">
                {fieldError}
              </p>
            )}
          </div>

          <button type="submit" className="button" disabled={isSubmitting}>
            {isSubmitting
              ? 'Salvando...'
              : isEditing
                ? 'Salvar alterações'
                : 'Publicar resenha'}
          </button>
        </form>
      )}

      {errorMessage && (
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
