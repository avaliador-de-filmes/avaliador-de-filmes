import { MEDIA_TYPES } from './media.schema'

const MEDIA_TYPE_LABELS = Object.freeze({
  [MEDIA_TYPES.movie]: 'Filme',
  [MEDIA_TYPES.series]: 'Série',
})

export function getMediaTypeLabel(type) {
  return MEDIA_TYPE_LABELS[type] ?? 'Mídia'
}
