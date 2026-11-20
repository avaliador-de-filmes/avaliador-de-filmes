import { calculateMediaRatingSummary } from '../model/media-rating-summary'

function formatAverage(average) {
  const numeric = Number(average)

  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(numeric) ? numeric : 0)
}

function formatCount(count) {
  const numeric = Number(count)
  const total = Number.isFinite(numeric) && numeric > 0 ? numeric : 0

  return `${total} ${total === 1 ? 'avaliação' : 'avaliações'}`
}

/**
 * data-model.md (MediaRatingSummary.averageRating): média das notas da mídia.
 * data-model.md (MediaRatingSummary.ratingsCount): quantidade de notas da mídia.
 */
export default function RatingSummary({
  mediaId,
  ratings = [],
  summary,
  className = '',
}) {
  const normalized = summary ?? calculateMediaRatingSummary(mediaId, ratings)
  const hasRatings = Number(normalized?.ratingsCount) > 0
  const classes = ['rating-summary', className].filter(Boolean).join(' ')

  return (
    <p className={classes} role="status">
      {hasRatings
        ? `Média ${formatAverage(normalized.averageRating)} · ${formatCount(
            normalized.ratingsCount,
          )}`
        : 'Sem avaliações ainda.'}
    </p>
  )
}
