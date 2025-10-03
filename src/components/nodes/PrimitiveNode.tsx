import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactElement,
} from 'react'
import { Handle, Position, NodeResizer, type NodeProps } from 'reactflow'
import clsx from 'clsx'
import { useDiagramActions } from '../../context/DiagramActionsContext'
import { categoryMeta } from '../../utils/primitives'
import { blockCategories, blockCategoryMap } from '../../data/blockCategories'
import type { PrimitiveNodeData } from '../../types'

const dataSourceColor = '#7c3aed'

const DatabaseIcon = () => (
  <svg viewBox="0 0 64 64" className="data-source-node__svg" aria-hidden="true">
    <ellipse cx="32" cy="12" rx="20" ry="9" />
    <path d="M12 12v28c0 5.3 9 9.6 20 9.6S52 45.3 52 40V12" />
    <path d="M12 24c0 5.3 9 9.6 20 9.6S52 29.3 52 24" />
    <path d="M12 36c0 5.3 9 9.6 20 9.6S52 41.3 52 36" />
  </svg>
)

const DocsIcon = () => (
  <svg viewBox="0 0 64 64" className="data-source-node__svg" aria-hidden="true">
    <path d="M18 8h20l10 10v34a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4z" />
    <path d="M38 8v10h10" />
    <path d="M24 28h16" />
    <path d="M24 38h16" />
    <path d="M24 48h10" />
  </svg>
)

const dataSourceIcons: Record<'db' | 'docs', ReactElement> = {
  db: <DatabaseIcon />,
  docs: <DocsIcon />,
}

export const PrimitiveNode = memo(({ id, data, selected }: NodeProps<PrimitiveNodeData>) => {
  const { updateNodeData } = useDiagramActions()
  const meta = categoryMeta[data.categoryId] ?? { label: data.categoryId, color: '#444' }
  const [note, setNote] = useState(data.note ?? '')
  const [title, setTitle] = useState(data.label)
  const isCustom = useMemo(() => data.categoryId === 'custom', [data.categoryId])
  const isDataSource = Boolean(data.dataSourceType)
  const activeTagSet = useMemo(() => {
    return new Set((Array.isArray(data.tags) ? data.tags : []).filter((tag) => tag in blockCategoryMap))
  }, [data.tags])

  const handleToggleTag = useCallback(
    (categoryId: string) => {
      const tags = new Set(Array.isArray(data.tags) ? data.tags : [])
      if (tags.has(categoryId)) {
        tags.delete(categoryId)
      } else {
        tags.add(categoryId)
      }
      updateNodeData(id, { tags: Array.from(tags) })
    },
    [data.tags, id, updateNodeData],
  )

  const renderCategoryFlags = useCallback<
    (className?: string, options?: { align?: 'center' | 'start' }) => ReactElement
  >(
    (className, options) => {
      const align = options?.align ?? 'start'
      return (
        <div className={clsx('category-flags', className, { 'category-flags--centered': align === 'center' })}>
          {blockCategories.map((category) => {
            const active = activeTagSet.has(category.id)
            return (
              <button
                key={category.id}
                type="button"
                className={clsx('category-flag', { 'category-flag--active': active })}
                style={{ '--category-color': category.color } as CSSProperties}
                aria-pressed={active}
                aria-label={category.label}
                onMouseDown={(event) => {
                  event.stopPropagation()
                }}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  handleToggleTag(category.id)
                }}
              >
                {category.icon}
              </button>
            )
          })}
        </div>
      )
    },
    [activeTagSet, handleToggleTag],
  )

  useEffect(() => {
    setNote(data.note ?? '')
  }, [data.note])

  useEffect(() => {
    setTitle(data.label)
  }, [data.label])

  const handleBlur = useCallback(() => {
    if (note === (data.note ?? '')) {
      return
    }
    updateNodeData(id, { note })
  }, [id, note, data.note, updateNodeData])

  const handleTitleBlur = useCallback(() => {
    const trimmed = title.trim()
    if (!trimmed) {
      setTitle(data.label)
      return
    }
    if (trimmed === data.label) {
      return
    }
    updateNodeData(id, { label: trimmed })
  }, [data.label, id, title, updateNodeData])

  const handleNoteKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    event.stopPropagation()
  }, [])

  const handleTitleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      event.stopPropagation()
      if (event.key === 'Enter') {
        event.preventDefault()
        ;(event.target as HTMLInputElement).blur()
      }
    },
    [],
  )

  if (isDataSource && data.dataSourceType) {
    const icon = dataSourceIcons[data.dataSourceType]
    const label = data.label

    return (
      <div className="data-source-node" style={{ borderColor: dataSourceColor }}>
        <div className="data-source-node__icon" style={{ background: dataSourceColor }}>
          {icon}
        </div>
        <span className="data-source-node__label">{label}</span>
        <Handle id="handle-top" type="source" position={Position.Top} isConnectable />
        <Handle id="handle-left" type="source" position={Position.Left} isConnectable />
        <Handle id="handle-right" type="source" position={Position.Right} isConnectable />
        <Handle id="handle-bottom" type="source" position={Position.Bottom} isConnectable />
      </div>
    )
  }

  return (
    <div className="primitive-node" style={{ borderColor: meta.color }}>
      <header className="primitive-node__header" style={{ background: meta.color }}>
        <span className="primitive-node__category">{meta.label}</span>
        {isCustom ? (
          <input
            className="primitive-node__title-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={handleTitleKeyDown}
          />
        ) : (
          <span className="primitive-node__title">{data.label}</span>
        )}
      </header>
      {renderCategoryFlags('primitive-node__tags')}
      <textarea
        className="primitive-node__note"
        placeholder="Aggiungi note"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleNoteKeyDown}
      />
      <NodeResizer
        color="rgba(31, 41, 51, 0.65)"
        lineClassName="primitive-node__resizer"
        handleClassName="primitive-node__resizer-handle"
        minWidth={160}
        minHeight={120}
        isVisible={selected}
      />
      <Handle id="handle-top" type="source" position={Position.Top} isConnectable />
      <Handle id="handle-left" type="source" position={Position.Left} isConnectable />  
      <Handle id="handle-right" type="source" position={Position.Right} isConnectable />
      <Handle id="handle-bottom" type="source" position={Position.Bottom} isConnectable />
    </div>
  )
})

PrimitiveNode.displayName = 'PrimitiveNode'
