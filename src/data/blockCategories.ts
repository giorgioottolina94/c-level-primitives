export type BlockCategory = {
  id: string
  label: string
  short: string
  color: string
  icon: string
}

export const blockCategories: BlockCategory[] = [
  { id: 'augmentation', label: 'Augmentation', short: 'AU', color: '#f59e0b', icon: '💡' },
  { id: 'automation', label: 'Automation', short: 'AT', color: '#059669', icon: '⚙️' },
  { id: 'full-product', label: 'Full Product', short: 'FP', color: '#f97316', icon: '🚀' },
  { id: 'human', label: 'Human', short: 'HM', color: '#2563eb', icon: '👤' },
  { id: 'chatbot', label: 'Chatbot', short: 'CB', color: '#ef4444', icon: '🤖' },
]

export const blockCategoryMap = blockCategories.reduce<Record<string, BlockCategory>>((acc, category) => {
  acc[category.id] = category
  return acc
}, {})
