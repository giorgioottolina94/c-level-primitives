import { useCallback } from 'react'
import type { BoardSnapshot } from '../types'

const SNAPSHOT_KEY = 'workshop.board-snapshots'

const readStore = (): Record<string, BoardSnapshot> => {
  if (typeof window === 'undefined') {
    return {}
  }
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_KEY)
    if (!raw) {
      return {}
    }
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch (error) {
    console.warn('Impossibile leggere le board salvate in locale', error)
    return {}
  }
}

const writeStore = (payload: Record<string, BoardSnapshot | undefined>) => {
  if (typeof window === 'undefined') {
    return
  }
  const cleaned = Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  ) as Record<string, BoardSnapshot>
  window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(cleaned))
}

export const useBoardStorage = () => {
  const saveSnapshot = useCallback((boardId: string, snapshot: BoardSnapshot) => {
    if (!boardId) {
      return
    }
    const store = readStore()
    store[boardId] = snapshot
    writeStore(store)
  }, [])

  const loadSnapshot = useCallback((boardId: string) => {
    if (!boardId) {
      return null
    }
    const store = readStore()
    const value = store[boardId]
    return value ?? null
  }, [])

  // 🛡️ SMART LOADER: Carica snapshot con controllo invalidazione globale
  const loadValidSnapshot = useCallback((boardId: string, getBoardClearTimestamp?: (boardId: string) => number | null) => {
    if (!boardId) {
      return null
    }
    
    const snapshot = loadSnapshot(boardId)
    if (!snapshot) {
      return null
    }

    // ⚡ Se non abbiamo la funzione di controllo, restituisci lo snapshot comunque
    if (!getBoardClearTimestamp) {
      console.log('💾 Caricando snapshot locale (controllo invalidazione non disponibile) per', boardId)
      return snapshot
    }

    // 🛡️ CONTROLLO INVALIDAZIONE GLOBALE 
    const globalClearTimestamp = getBoardClearTimestamp(boardId)
    const snapshotTimestamp = snapshot.meta?.updatedAt || 0
    
    if (globalClearTimestamp && globalClearTimestamp > snapshotTimestamp) {
      console.log('🧹 Snapshot invalidato da pulizia globale per', boardId, 'clear:', new Date(globalClearTimestamp).toLocaleTimeString())
      return null // Snapshot invalidato
    }
    
    // 🕐 Controllo età dello snapshot (ignora se troppo vecchio)
    const snapshotAge = Date.now() - snapshotTimestamp
    const MAX_SNAPSHOT_AGE = 24 * 60 * 60 * 1000 // 24 ore
    
    if (snapshotAge > MAX_SNAPSHOT_AGE) {
      console.log('🗑️ Snapshot troppo vecchio ignorato per', boardId, 'età:', Math.round(snapshotAge / (60 * 60 * 1000)), 'ore')
      return null
    }
    
    console.log('💾 Caricando snapshot locale valido per', boardId)
    return snapshot
  }, [loadSnapshot])

  const clearAllSnapshots = useCallback(() => {
    if (typeof window === 'undefined') {
      return
    }
    window.localStorage.removeItem(SNAPSHOT_KEY)
  }, [])

  const clearSnapshot = useCallback((boardId: string) => {
    if (!boardId || typeof window === 'undefined') {
      return
    }
    const store = readStore()
    delete store[boardId] // Cancella solo questa board specifica
    writeStore(store)
  }, [])

  const cleanupOldSnapshots = useCallback(() => {
    if (typeof window === 'undefined') {
      return
    }
    const store = readStore()
    const now = Date.now()
    const MAX_AGE = 24 * 60 * 60 * 1000 // 24 ore
    let cleaned = false
    
    Object.entries(store).forEach(([boardId, snapshot]) => {
      const age = now - (snapshot.meta?.updatedAt || 0)
      if (age > MAX_AGE) {
        delete store[boardId]
        cleaned = true
        console.log('🧹 Snapshot obsoleto rimosso:', boardId)
      }
    })
    
    if (cleaned) {
      writeStore(store)
    }
  }, [])

  return {
    saveSnapshot,
    loadSnapshot,
    loadValidSnapshot, // 🛡️ Loader con controllo invalidazione integrato
    clearAllSnapshots,
    clearSnapshot,
    cleanupOldSnapshots,
  }
}
