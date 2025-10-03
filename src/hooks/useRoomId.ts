import { useCallback, useEffect, useMemo, useState } from 'react'

const LAST_BOARD_KEY = 'workshop.board-id'
const BOARDS_KEY = 'workshop.boards'
const PARAM_KEY = 'board'

// Board disponibili (reintrodotta team-1)
const DEFAULT_BOARD_IDS = [
  'team-0',
  'team-1',
  ...Array.from({ length: 14 }, (_, i) => `team-${i + 2}`) // team-2 a team-15
]

const isTeamBoardId = (value: string) => /^team-\d{1,3}$/.test(value)

const normalizeBoardId = (value: string) => {
  const trimmed = value.trim().toLowerCase()
  // team-1 abilitata
  if (isTeamBoardId(trimmed) && DEFAULT_BOARD_IDS.includes(trimmed)) {
    return trimmed
  }
  return DEFAULT_BOARD_IDS[0]
}

const sanitizeBoardId = (value: unknown) => {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim().toLowerCase()
  // team-1 abilitata
  if (isTeamBoardId(trimmed) && DEFAULT_BOARD_IDS.includes(trimmed)) {
    return trimmed
  }
  return null
}

const mergeBoards = (boards: string[]) => {
  const all = [...DEFAULT_BOARD_IDS, ...boards.filter((id) => isTeamBoardId(id))]
  const unique = Array.from(new Set(all))
  return unique.sort((a, b) => parseInt(a.split('-')[1] ?? '0', 10) - parseInt(b.split('-')[1] ?? '0', 10))
}

const getNextTeamId = (boards: string[]) => {
  const merged = mergeBoards(boards)
  const highest = merged.reduce((acc, id) => Math.max(acc, parseInt(id.split('-')[1] ?? '0', 10)), 0)
  return `team-${highest + 1}`
}

const readBoards = () => {
  if (typeof window === 'undefined') {
    return [...DEFAULT_BOARD_IDS]
  }
  try {
    const raw = window.localStorage.getItem(BOARDS_KEY)
    if (!raw) {
      return [...DEFAULT_BOARD_IDS]
    }
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return [...DEFAULT_BOARD_IDS]
    }
    const sanitized = parsed
      .map((item) => sanitizeBoardId(item))
      .filter((item): item is string => item !== null)
    return mergeBoards(sanitized)
  } catch (error) {
    console.warn('Impossibile leggere la lista board salvate', error)
    return [...DEFAULT_BOARD_IDS]
  }
}

export const useRoomId = () => {
  const { initialRoom, initialBoards } = useMemo(() => {
    if (typeof window === 'undefined') {
      return { initialRoom: 'team-0', initialBoards: ['team-0'] }
    }
    const url = new URL(window.location.href)
    const fromParam = url.searchParams.get(PARAM_KEY)
    const saved = window.localStorage.getItem(LAST_BOARD_KEY)
    const storedBoards = readBoards()

    const candidateBase = normalizeBoardId(fromParam ?? saved ?? 'team-0')
    const preparedBoards = mergeBoards(storedBoards)
    const filtered = preparedBoards.filter((board) => board !== candidateBase)
    const nextBoards = [candidateBase, ...filtered]

    url.searchParams.set(PARAM_KEY, candidateBase)
    window.history.replaceState(null, '', url.toString())
    window.localStorage.setItem(LAST_BOARD_KEY, candidateBase)
    window.localStorage.setItem(BOARDS_KEY, JSON.stringify(nextBoards))

    return { initialRoom: candidateBase, initialBoards: nextBoards }
  }, [])

  const [roomId, setRoomIdState] = useState(initialRoom)
  const [boards, setBoards] = useState<string[]>(initialBoards)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    window.localStorage.setItem(BOARDS_KEY, JSON.stringify(mergeBoards(boards)))
  }, [boards])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const url = new URL(window.location.href)
    url.searchParams.set(PARAM_KEY, roomId)
    window.history.replaceState(null, '', url.toString())
    window.localStorage.setItem(LAST_BOARD_KEY, roomId)
    setBoards((prev) => {
      const merged = mergeBoards(prev)
      if (merged[0] === roomId) {
        return merged
      }
      const filtered = merged.filter((board) => board !== roomId)
      return [roomId, ...filtered]
    })
  }, [roomId])

  const selectBoard = useCallback((rawId: string) => {
    const normalized = normalizeBoardId(rawId)
    setBoards((prev) => {
      const merged = mergeBoards(prev)
      if (merged[0] === normalized) {
        return merged
      }
      const filtered = merged.filter((board) => board !== normalized)
      return [normalized, ...filtered]
    })
    setRoomIdState(normalized)
  }, [])

  const createBoard = useCallback(() => {
    const fresh = getNextTeamId(boards)
    selectBoard(fresh)
    return fresh
  }, [boards, selectBoard])

  const availableBoards = useMemo(() => mergeBoards(boards), [boards])

  return {
    roomId,
    boards: availableBoards,
    selectBoard,
    createBoard,
  }
}
