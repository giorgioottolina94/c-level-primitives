import { primitiveCatalog } from '../data/primitives'

export const categoryMeta = primitiveCatalog.reduce(
  (acc, category) => {
    acc[category.id] = {
      label: category.label,
      color: category.color,
    }
    return acc
  },
  {} as Record<string, { label: string; color: string }>,
)

categoryMeta.custom = categoryMeta.custom ?? {
  label: 'Custom',
  color: '#6b7280',
}

export const blockMeta = primitiveCatalog.flatMap((category) =>
  category.blocks.map((block) => ({
    ...block,
    categoryId: category.id,
    categoryColor: category.color,
    categoryLabel: category.label,
  })),
)

export const findBlockById = (blockId: string) => {
  return blockMeta.find((block) => block.id === blockId) ?? null
}
