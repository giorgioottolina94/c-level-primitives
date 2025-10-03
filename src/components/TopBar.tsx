import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import type { CollaborationStatus } from '../hooks/useCollaborativeFlow'

export type TopBarProps = {
  roomId: string
  boards: string[]
  onSelectBoard: (value: string) => void
  onCreateBoard: () => void
  onCopyInvite: () => void
  onClearBoard: () => void
  onClearAllBoards: () => void
  onExportPng: () => Promise<void>
  onExportJson: () => void
  onAddCustomBlock: () => void
  onAddDataSource: (type: 'db' | 'docs') => void
  onRemoveSelection: () => void
  canRemoveSelection: boolean
  status: CollaborationStatus
}

const statusLabel: Record<CollaborationStatus, string> = {
  connecting: 'Connessione...',
  connected: 'Online',
  disconnected: 'Offline',
}

const formatBoardLabel = (id: string) => {
  if (!id) {
    return 'Board'
  }
  const clean = id.replace(/[-_]+/g, ' ')
  return clean.replace(/\b\w/g, (char) => char.toUpperCase())
}

export const TopBar = ({
  roomId,
  boards,
  onSelectBoard,
  onCreateBoard,
  onCopyInvite,
  onClearBoard,
  onClearAllBoards,
  onExportPng,
  onExportJson,
  onAddCustomBlock,
  onAddDataSource,
  onRemoveSelection,
  canRemoveSelection,
  status,
}: TopBarProps) => {
  const handleSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
  }, [])

  const [isDataMenuOpen, setIsDataMenuOpen] = useState(false)
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false)
  const dataDropdownRef = useRef<HTMLDivElement | null>(null)
  const moreDropdownRef = useRef<HTMLDivElement | null>(null)
  const boardOptions = useMemo(() => {
    const merged = boards.includes(roomId) ? boards : [roomId, ...boards]
    const seen = new Set<string>()
    return merged.filter((board) => {
      if (seen.has(board)) {
        return false
      }
      seen.add(board)
      return true
    })
  }, [boards, roomId])

  const toggleDataMenu = useCallback(() => {
    setIsMoreMenuOpen(false)
    setIsDataMenuOpen((prev) => !prev)
  }, [])

  const toggleMoreMenu = useCallback(() => {
    setIsDataMenuOpen(false)
    setIsMoreMenuOpen((prev) => !prev)
  }, [])

  const closeDataMenu = useCallback(() => setIsDataMenuOpen(false), [])
  const closeMoreMenu = useCallback(() => setIsMoreMenuOpen(false), [])

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node
      if (dataDropdownRef.current && dataDropdownRef.current.contains(target)) {
        return
      }
      if (moreDropdownRef.current && moreDropdownRef.current.contains(target)) {
        return
      }
      setIsDataMenuOpen(false)
      setIsMoreMenuOpen(false)
    }
    window.addEventListener('mousedown', handleClick)
    return () => window.removeEventListener('mousedown', handleClick)
  }, [])

  const handleSelectChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      onSelectBoard(event.target.value)
    },
    [onSelectBoard],
  )

  return (
    <header className="topbar">
      <div className="topbar__left">
        <form onSubmit={handleSubmit} className="topbar__form">
          <label htmlFor="board-select">Board</label>
          <select
            aria-label="Boards salvate"
            className="topbar__select"
            id="board-select"
            value={roomId}
            onChange={handleSelectChange}
          >
            {boardOptions.map((board) => (
              <option key={board} value={board}>
                {formatBoardLabel(board)}
              </option>
            ))}
          </select>
          <button type="button" onClick={onCreateBoard} className="topbar__button">
            Nuova board
          </button>
        </form>
        <div className={`topbar__status topbar__status--${status}`}>
          <span className="topbar__status-dot" />
          {statusLabel[status]}
        </div>
      </div>
      <div className="topbar__actions">
        <button type="button" className="topbar__button" onClick={onAddCustomBlock}>
          Nuovo blocco custom
        </button>
        <div
          className={`topbar__dropdown ${isDataMenuOpen ? 'topbar__dropdown--open' : ''}`}
          ref={dataDropdownRef}
        >
          <button type="button" className="topbar__button" onClick={toggleDataMenu}>
            Sorgente dati
          </button>
          {isDataMenuOpen ? (
            <div className="topbar__dropdown-menu">
              <button
                type="button"
                onClick={() => { onAddDataSource('db'); closeDataMenu() }}
              >
                DB
              </button>
              <button
                type="button"
                onClick={() => { onAddDataSource('docs'); closeDataMenu() }}
              >
                Docs
              </button>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className="topbar__button topbar__button--danger"
          onClick={onRemoveSelection}
          disabled={!canRemoveSelection}
        >
          Elimina selezione
        </button>
        <button type="button" className="topbar__button topbar__button--danger" onClick={onClearBoard}>
          Svuota
        </button>
        <button type="button" className="topbar__button topbar__button--danger" onClick={onClearAllBoards}>
          Pulizia Totale
        </button>
        <div
          className={`topbar__dropdown ${isMoreMenuOpen ? 'topbar__dropdown--open' : ''}`}
          ref={moreDropdownRef}
        >
          <button type="button" className="topbar__button" onClick={toggleMoreMenu}>
            More
          </button>
          {isMoreMenuOpen ? (
            <div className="topbar__dropdown-menu">
              <button
                type="button"
                onClick={() => {
                  onCopyInvite()
                  closeMoreMenu()
                }}
              >
                Condividi link
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onExportPng()
                  closeMoreMenu()
                }}
              >
                Esporta PNG
              </button>
              <button
                type="button"
                onClick={() => {
                  onExportJson()
                  closeMoreMenu()
                }}
              >
                Scarica JSON
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}
