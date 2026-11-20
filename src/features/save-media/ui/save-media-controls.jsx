import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { saveMedia, syncMediaMetadataQuietly } from '../model/save-media'
import { jsonServerResources } from '../../../shared/api/json-server/resources'
import { announceToLiveRegion } from '../../../shared/lib/accessibility'

const CONTROL_STATUS = Object.freeze({
  checking: 'checking',
  ready: 'ready',
  saving: 'saving',
  saved: 'saved',
  error: 'error',
})

export default function SaveMediaControls({
  userId,
  media,
  isAuthenticated = true,
  resources = jsonServerResources,
  onSaved,
}) {
  const [status, setStatus] = useState(CONTROL_STATUS.checking)
  const [errorMessage, setErrorMessage] = useState('')
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    let active = true

    if (!isAuthenticated || !userId || !media?.id) {
      return undefined
    }

    resources.catalogItems
      .findByUserAndMedia({ userId, mediaId: media.id })
      .then(async (item) => {
        if (!active) {
          return
        }

        setStatus(item ? CONTROL_STATUS.saved : CONTROL_STATUS.ready)

        if (item) {
          // Mantém capa/título locais em sincronia com o OMDb ao abrir os
          // detalhes de uma mídia já salva, sem duplicar o item no catálogo.
          await syncMediaMetadataQuietly({ media, resources })
        }
      })
      .catch(() => {
        if (active) {
          setStatus(CONTROL_STATUS.ready)
        }
      })

    return () => {
      active = false
    }
  }, [userId, media, isAuthenticated, resources])

  const isChecking =
    isAuthenticated &&
    Boolean(userId && media?.id) &&
    status === CONTROL_STATUS.checking

  async function handleSave() {
    if (!userId) {
      return
    }

    setStatus(CONTROL_STATUS.saving)
    setErrorMessage('')
    setFeedback('')

    try {
      const result = await saveMedia({ userId, media, resources })
      const message = result.created
        ? 'Mídia salva no catálogo com status Quero ver.'
        : 'Esta mídia já estava no seu catálogo.'

      setStatus(CONTROL_STATUS.saved)
      setFeedback(message)
      announceToLiveRegion(message)
      onSaved?.(result)
    } catch (error) {
      const message = error?.message ?? 'Não foi possível salvar a mídia no catálogo.'
      setStatus(CONTROL_STATUS.error)
      setErrorMessage(message)
      announceToLiveRegion('Não foi possível salvar a mídia no catálogo.', {
        politeness: 'assertive',
      })
    }
  }

  return (
    <section className="save-media" aria-labelledby="save-media-heading">
      <h2 id="save-media-heading" className="section-title">
        Seu catálogo
      </h2>

      {!isAuthenticated && (
        <p className="feedback">
          Entre para salvar esta mídia no seu catálogo pessoal.
        </p>
      )}

      {isAuthenticated && isChecking && (
        <p role="status">Verificando seu catálogo...</p>
      )}

      {isAuthenticated && !isChecking && (
        <>
          {status === CONTROL_STATUS.saved ? (
            <p className="feedback feedback--success">
              {feedback || 'Esta mídia já está no seu catálogo.'}{' '}
              <Link to="/catalog">Ver meu catálogo</Link>
            </p>
          ) : (
            <button
              type="button"
              className="button"
              onClick={handleSave}
              disabled={status === CONTROL_STATUS.saving}
            >
              {status === CONTROL_STATUS.saving
                ? 'Salvando...'
                : status === CONTROL_STATUS.error
                  ? 'Tentar salvar novamente'
                  : 'Salvar no catálogo'}
            </button>
          )}

          {status === CONTROL_STATUS.error && errorMessage && (
            <p className="feedback feedback--error" role="alert">
              {errorMessage}
            </p>
          )}
        </>
      )}
    </section>
  )
}
