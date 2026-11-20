import { useState } from 'react'

/**
 * Pôster de mídia com fallback para imagens ausentes ou quebradas.
 *
 * O OMDb retorna URLs externas que podem expirar ou vir nulas; quando o
 * carregamento falha o navegador exibiria uma imagem quebrada, então trocamos
 * por um placeholder acessível.
 */
export default function MediaPoster({
  src,
  alt,
  className = 'media-poster',
  emptyLabel = 'Sem capa',
  loading = 'lazy',
}) {
  const [failedSrc, setFailedSrc] = useState(null)
  const hasImage = Boolean(src) && failedSrc !== src

  if (!hasImage) {
    return (
      <div className={`${className} ${className}--empty`} aria-hidden="true">
        {emptyLabel}
      </div>
    )
  }

  return (
    <img
      className={className}
      src={src}
      alt={alt}
      loading={loading}
      onError={() => setFailedSrc(src)}
    />
  )
}
