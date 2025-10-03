import { useMemo, useState, type DragEvent } from 'react'
import clsx from 'clsx'
import { primitiveCatalog } from '../data/primitives'
import { blockCategories } from '../data/blockCategories'

const DRAG_TYPE = 'application/x-workshop-primitive'

export type PrimitiveSidebarProps = {
  onStartDrag?: (blockId: string) => void
  canApplyCategory?: boolean
  categoryState?: Record<string, { all: boolean; any: boolean }>
  onToggleCategory?: (categoryId: string) => void
}

export const PrimitiveSidebar = (props: PrimitiveSidebarProps = {}) => {
  const { onStartDrag, canApplyCategory = false, categoryState = {}, onToggleCategory } = props
  const [query, setQuery] = useState('')

  const sections = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) {
      return primitiveCatalog
    }
    return primitiveCatalog
      .map((category) => ({
        ...category,
        blocks: category.blocks.filter((block) =>
          [block.label, block.description ?? ''].some((text) => text.toLowerCase().includes(trimmed)),
        ),
      }))
      .filter((category) => category.blocks.length > 0)
  }, [query])

  const handleDragStart = (event: DragEvent<HTMLDivElement>, blockId: string) => {
    event.dataTransfer.setData(DRAG_TYPE, blockId)
    event.dataTransfer.effectAllowed = 'copyMove'
    onStartDrag?.(blockId)
  }

  return (
    <aside className="sidebar">
      <section className="sidebar__categories">
        <h2>Categorie</h2>
        <p>Seleziona blocchi e applica un tag per evidenziare lo scenario.</p>
        <div className="sidebar__category-grid">
          {blockCategories.map((category) => {
            const state = categoryState?.[category.id] ?? { all: false, any: false }
            const active = state.all
            const partial = !state.all && state.any
            return (
              <button
                key={category.id}
                type="button"
                className={clsx('sidebar__category', {
                  'sidebar__category--active': active,
                  'sidebar__category--partial': partial,
                })}
                style={{
                  borderColor: active ? category.color : undefined,
                  borderStyle: !active && partial ? 'dashed' : undefined,
                }}
                onClick={() => onToggleCategory?.(category.id)}
                disabled={!canApplyCategory}
              >
                <span className="sidebar__category-badge" style={{ background: category.color }}>
                  {category.icon}
                </span>
                <span>{category.label}</span>
              </button>
            )
          })}
        </div>
      </section>
      <header className="sidebar__header">
        <h2>Primitive</h2>
        <p>Trascina un blocco sul canvas per costruire il tuo workflow.</p>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cerca..."
          className="sidebar__search"
          type="search"
        />
      </header>
      <div className="sidebar__sections">
        {sections.map((category) => (
          <section key={category.id} className="sidebar__section">
            <div className="sidebar__section-head">
              <h3>{category.label}</h3>
              <p>{category.tagline}</p>
            </div>
            <div className="sidebar__blocks">
              {category.blocks.map((block) => (
                <div
                  key={block.id}
                  className={clsx('sidebar__block')}
                  draggable
                  style={{ borderColor: category.color }}
                  onDragStart={(event) => handleDragStart(event, block.id)}
                >
                  <span className="sidebar__block-label">{block.label}</span>
                  {block.description ? <span className="sidebar__block-desc">{block.description}</span> : null}
                </div>
              ))}
            </div>
          </section>
        ))}
        {sections.length === 0 ? <p className="sidebar__empty">Nessun blocco corrisponde alla ricerca.</p> : null}
      </div>
    </aside>
  )
}

export const PrimitiveDragType = DRAG_TYPE
