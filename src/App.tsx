import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { toPng } from 'html-to-image'
import { DiagramCanvas } from './components/DiagramCanvas'
import { PrimitiveSidebar } from './components/PrimitiveSidebar'
import { TopBar } from './components/TopBar'
import { DiagramActionsContext } from './context/DiagramActionsContext'
import { useCollaborativeFlow } from './hooks/useCollaborativeFlow'
import { useRoomId } from './hooks/useRoomId'
import { useBoardStorage } from './hooks/useBoardStorage'
import type { PrimitiveEdge, PrimitiveNode } from './types'
import { blockCategories } from './data/blockCategories'
import './App.css'

function App() {
  const { roomId, boards, selectBoard, createBoard } = useRoomId()
  const { saveSnapshot, loadValidSnapshot, clearAllSnapshots, clearSnapshot, cleanupOldSnapshots } = useBoardStorage()
  const flow = useCollaborativeFlow(roomId)
  const {
    nodes,
    edges,
    loadSnapshot: applySnapshot,
    exportSnapshot,
    removeElements,
    toggleCategory,
    updateEdgeLabel,
    getBoardClearTimestamp,
  } = flow
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const [copyFeedback, setCopyFeedback] = useState('')
  const customOffsetRef = useRef(0)
  const dataSourceOffsetRef = useRef(0)
  const initialisedBoardsRef = useRef<Record<string, boolean>>({})
  const [selectedNodes, setSelectedNodes] = useState<string[]>([])
  const [selectedEdges, setSelectedEdges] = useState<string[]>([])
  const [edgeLabelDraft, setEdgeLabelDraft] = useState('')
  const [boardJustCleared, setBoardJustCleared] = useState(false) // 🛡️ Flag anti-race condition

  // 🧹 Pulizia automatica snapshot obsoleti all'avvio
  useEffect(() => {
    cleanupOldSnapshots()
  }, [cleanupOldSnapshots])

  const selectedNodeObjects = useMemo(
    () => nodes.filter((node) => selectedNodes.includes(node.id)),
    [nodes, selectedNodes],
  )

  const categoryState = useMemo(() => {
    const base: Record<string, { all: boolean; any: boolean }> = {}
    blockCategories.forEach((category) => {
      base[category.id] = { all: false, any: false }
    })
    if (selectedNodeObjects.length === 0) {
      return base
    }
    blockCategories.forEach((category) => {
      let any = false
      let all = true
      selectedNodeObjects.forEach((node) => {
        const tags = node.data?.tags ?? []
        if (tags.includes(category.id)) {
          any = true
        } else {
          all = false
        }
      })
      base[category.id] = { all: any && all, any }
    })
    return base
  }, [selectedNodeObjects])

  const canApplyCategory = selectedNodes.length > 0

  const handleToggleCategory = useCallback(
    (categoryId: string) => {
      if (!selectedNodes.length) {
        return
      }
      toggleCategory(selectedNodes, categoryId)
    },
    [selectedNodes, toggleCategory],
  )

  const handleCopyInvite = useCallback(async () => {
    try {
      const url = window.location.href
      await navigator.clipboard.writeText(url)
      setCopyFeedback('Link copiato!')
      setTimeout(() => setCopyFeedback(''), 1800)
    } catch (error) {
      console.error('Impossibile copiare negli appunti', error)
      setCopyFeedback('Copia manualmente dalla barra degli indirizzi.')
      setTimeout(() => setCopyFeedback(''), 2500)
    }
  }, [])

  const handleExportPng = useCallback(async () => {
    if (!canvasRef.current) {
      return
    }
    const image = await toPng(canvasRef.current, {
      filter: (node) => {
        if (!(node instanceof HTMLElement)) {
          return true
        }
        return !node.classList.contains('react-flow__minimap-mask')
      },
      backgroundColor: '#f2f3f5',
    })
    const link = document.createElement('a')
    link.download = `board-${roomId}.png`
    link.href = image
    link.click()
  }, [roomId])

  const handleExportJson = useCallback(() => {
    const snapshot = flow.exportSnapshot()
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.download = `board-${roomId}.json`
    link.href = URL.createObjectURL(blob)
    link.click()
    setTimeout(() => URL.revokeObjectURL(link.href), 2000)
  }, [flow, roomId])

  const handleClearBoard = useCallback(() => {
    if (window.confirm('Sicuro di voler svuotare la board per tutti?')) {
      // 🛡️ ANTI-RACE: Attiva flag per bloccare auto-save immediato
      setBoardJustCleared(true)
      console.log('🧹 Board pulizia avviata - auto-save temporaneamente bloccato')
      
      // Pulisce Y.js (memoria server)
      flow.clearBoard()
      
      // Pulisce anche il snapshot locale per questa board
      clearSnapshot(roomId)
      
      // Reset selezioni
      setSelectedNodes([])
      setSelectedEdges([])
      
      // Reset flag dopo 2 secondi (per permettere la sincronizzazione)
      setTimeout(() => {
        setBoardJustCleared(false)
        console.log('✅ Anti-race timeout completato - auto-save riattivato')
      }, 2000)
    }
  }, [flow, clearSnapshot, roomId])

  const handleClearAllBoards = useCallback(async () => {
    if (window.confirm(
      '⚠️ PULIZIA TOTALE: Reset completo del sistema!\n\n' +
      '• Riavvierà il server di collaborazione\n' +
      '• Cancellerà TUTTE le board esistenti\n' +
      '• Pulirà tutti i dati salvati\n' +
      '• Ricaricherà l\'applicazione\n\n' +
      'ATTENZIONE: Tutti i dati andranno persi!\n\n' +
      'Procedere con il reset completo?'
    )) {
      try {
        // 🛡️ ANTI-RACE: Blocca auto-save durante reset totale
        setBoardJustCleared(true)
        console.log('🧹 PULIZIA TOTALE avviata - auto-save bloccato globalmente')
        
        // 1. Pulisce immediatamente i dati locali
        clearAllSnapshots()
        if (typeof window !== 'undefined') {
          window.localStorage.clear()
        }

        // 2. Avvisa l'utente
        alert('🔄 RESET IN CORSO:\n\n1. Riavvio server collaborazione...\n2. Pulizia memoria Y.js...\n3. Ricarica app...\n\nAttendere circa 5 secondi.')

        // 3. Trigger restart del server di collaborazione
        console.log('🔄 Triggering collab server restart...')
        
        // Per ora uso un approccio locale - in produzione si può usare un endpoint API
        // L'importante è che l'utente sappia che deve riavviare manualmente
        const useManualRestart = true
        
        if (useManualRestart) {
          if (window.confirm(
            '🔧 PASSO FINALE:\n\n' +
            'Per completare il reset, il server di collaborazione deve essere riavviato.\n\n' +
            '📋 ISTRUZIONI:\n' +
            '1. Apri il Terminale\n' +
            '2. Vai nella cartella del progetto\n' +
            '3. Esegui: node app/scripts/restart-collab.mjs\n' +
            '4. L\'app si ricaricherà automaticamente\n\n' +
            'Clicca OK per copiare il comando negli appunti.'
          )) {
            // Copia il comando negli appunti
            try {
              await navigator.clipboard.writeText('node app/scripts/restart-collab.mjs')
              alert('✅ Comando copiato negli appunti!\n\nEseguilo nel terminale per completare il reset.')
            } catch (error) {
              console.log('Impossibile copiare negli appunti:', error)
              alert('💡 Esegui questo comando nel terminale:\n\nnode app/scripts/restart-collab.mjs')
            }
            return // Esce qui, l'utente deve riavviare manualmente
          }
        }

        // 4. Attesa per il riavvio del server
        await new Promise(resolve => setTimeout(resolve, 3000))

        // 5. Ricarica l'app su board pulita
        if (typeof window !== 'undefined') {
          window.location.href = window.location.origin + '?board=team-0&reset=true'
        }
        
      } catch (error) {
        console.error('Errore durante reset completo:', error)
        
        // Fallback estremo: reset solo locale
        if (window.confirm('Reset server fallito. Procedere con reset solo locale?')) {
          if (typeof window !== 'undefined') {
            window.localStorage.clear()
            window.location.href = window.location.origin + '?board=team-0&reset=local'
          }
        }
      }
    }
  }, [clearAllSnapshots])

  const handleSelectionChange = useCallback(
    (selection: { nodes: PrimitiveNode[]; edges: PrimitiveEdge[] }) => {
      setSelectedNodes(selection.nodes.map((node) => node.id))
      setSelectedEdges(selection.edges.map((edge) => edge.id))
    },
    [],
  )

  const handleRemoveSelection = useCallback(() => {
    if (selectedNodes.length === 0 && selectedEdges.length === 0) {
      return
    }
    removeElements(selectedNodes, selectedEdges)
    setSelectedNodes([])
    setSelectedEdges([])
    setEdgeLabelDraft('')
  }, [removeElements, selectedEdges, selectedNodes])

  const handleEdgeLabelChange = useCallback((value: string) => {
    setEdgeLabelDraft(value)
    if (selectedEdges.length === 1) {
      updateEdgeLabel(selectedEdges[0], value)
    }
  }, [selectedEdges, updateEdgeLabel])

  useEffect(() => {
    if (selectedEdges.length === 1) {
      const edge = edges.find((item) => item.id === selectedEdges[0])
      const label = typeof edge?.label === 'string' ? edge.label : ''
      setEdgeLabelDraft(label)
    } else {
      setEdgeLabelDraft('')
    }
  }, [edges, selectedEdges])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.closest('input') || target.closest('textarea'))) {
        return
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedNodes.length || selectedEdges.length) {
          event.preventDefault()
          handleRemoveSelection()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleRemoveSelection, selectedEdges.length, selectedNodes.length])

  useEffect(() => {
    if (!roomId) {
      return
    }
    // 🔄 FORZA RICONTROLLO: Reset stato inizializzazione per ogni cambio board
    initialisedBoardsRef.current[roomId] = false
    
    // 🛡️ RESET ANTI-RACE: Pulisce flag quando cambi board
    setBoardJustCleared(false)
    
    console.log('🔄 Board cambiata a:', roomId, '- Reset controllo inizializzazione')
  }, [roomId])

  useEffect(() => {
    if (!roomId) {
      return
    }
    if (initialisedBoardsRef.current[roomId]) {
      return
    }
    
    // Inizializzazione board con protezione contro loop
    const timeoutId = setTimeout(() => {
      // 🛡️ ANTI-CACHE: Controlla se è stato fatto un reset del sistema
      const urlParams = new URLSearchParams(window.location.search)
      const isSystemReset = urlParams.get('reset') === 'true' || urlParams.get('reset') === 'local'
      
      // Se è stato fatto un reset, ignora completamente gli snapshots locali
      if (isSystemReset) {
        console.log('🔄 Sistema resettato: snapshots locali ignorati per', roomId)
        
        // 🧹 Pulisci URL dai parametri di reset (una tantum)
        if (window.history.replaceState) {
          const cleanUrl = window.location.pathname + '?board=' + roomId
          window.history.replaceState({}, document.title, cleanUrl)
          console.log('🔗 URL pulito:', cleanUrl)
        }
        
        // 🛡️ IMPORTANTE: Anche in caso di reset, rispetta il flag anti-race!
        if (boardJustCleared) {
          console.log('🚫 Reset ignorato: board appena pulita (anti-race attivo)')
          initialisedBoardsRef.current[roomId] = true
          return
        }

        // 🧹 EXTRA SICUREZZA: Pulisci snapshot locale se è un reset di sistema per board principale
        if (roomId === 'team-0') {
          console.log('🗑️ Reset sistema: pulizia forzata snapshot team-0')
          clearSnapshot(roomId)
        }
        
        initialisedBoardsRef.current[roomId] = true
        return
      }
      
      // 🛡️ USA SMART LOADER: Controllo invalidazione automatico integrato
      const validSnapshot = loadValidSnapshot(roomId, getBoardClearTimestamp)
      if (validSnapshot && nodes.length === 0 && edges.length === 0) {
        applySnapshot(validSnapshot)
      }
      initialisedBoardsRef.current[roomId] = true
    }, 100)
    
    return () => clearTimeout(timeoutId)
  }, [roomId, loadValidSnapshot, applySnapshot, getBoardClearTimestamp, clearSnapshot, boardJustCleared])

  useEffect(() => {
    if (!roomId) {
      return
    }
    if (nodes.length === 0 && edges.length === 0) {
      return
    }
    
    // 🛡️ ANTI-RACE CONDITION: Non salvare se la board è stata appena pulita
    if (boardJustCleared) {
      console.log('🚫 Snapshot auto-save bloccato: board appena pulita')
      return
    }
    
    // Debounce per evitare loop infiniti
    const timeoutId = setTimeout(() => {
      const snapshot = exportSnapshot()
      saveSnapshot(roomId, {
        ...snapshot,
        meta: {
          updatedAt: Date.now(),
        },
      })
    }, 500)
    
    return () => clearTimeout(timeoutId)
  }, [roomId, nodes, edges, exportSnapshot, saveSnapshot, boardJustCleared])

  const handleAddCustomBlock = useCallback(() => {
    const input = window.prompt('Nome del nuovo blocco', 'Blocco custom')
    if (input === null) {
      return
    }
    const label = input.trim() || 'Blocco custom'
    const offset = customOffsetRef.current
    customOffsetRef.current += 80
    const nodeId = `node-${nanoid(8)}`
    flow.addNode({
      id: nodeId,
      type: 'primitive',
      position: { x: offset, y: offset },
      style: { width: 240, minWidth: 160 },
      width: 240,
      height: 140,
      resizable: true,
        data: {
          label,
          blockId: `custom-${nanoid(6)}`,
          categoryId: 'custom',
          note: '',
          tags: ['human'],
        },
    })
  }, [flow])

  const handleAddDataSource = useCallback(
    (source: 'db' | 'docs') => {
      const offset = dataSourceOffsetRef.current
      dataSourceOffsetRef.current += 90
      const nodeId = `source-${source}-${nanoid(6)}`
      const label = source === 'db' ? 'Database' : 'Documenti'
      flow.addNode({
        id: nodeId,
        type: 'primitive',
        position: { x: offset, y: offset },
        style: { width: 170, minWidth: 150 },
        width: 170,
        height: 170,
        resizable: false,
        data: {
          label,
          blockId: nodeId,
          categoryId: 'data-source',
          note: '',
          tags: [],
          dataSourceType: source,
        },
      })
    },
    [flow],
  )

  return (
    <DiagramActionsContext.Provider value={{ updateNodeData: flow.updateNodeData }}>
      <div className="app-shell">
        <TopBar
          roomId={roomId}
          boards={boards}
          onSelectBoard={selectBoard}
          onCreateBoard={createBoard}
          onCopyInvite={handleCopyInvite}
          onClearBoard={handleClearBoard}
          onClearAllBoards={handleClearAllBoards}
          onExportJson={handleExportJson}
          onExportPng={handleExportPng}
          onAddCustomBlock={handleAddCustomBlock}
          onAddDataSource={handleAddDataSource}
          onRemoveSelection={handleRemoveSelection}
          canRemoveSelection={selectedNodes.length > 0 || selectedEdges.length > 0}
          status={flow.status}
        />
        {copyFeedback ? <div className="toast">{copyFeedback}</div> : null}
        <main className="workspace">
          <PrimitiveSidebar
            canApplyCategory={canApplyCategory}
            categoryState={categoryState}
            onToggleCategory={handleToggleCategory}
          />
          <DiagramCanvas
            ref={canvasRef}
            flow={flow}
            onSelectionChange={handleSelectionChange}
            selectedEdgeId={selectedEdges.length === 1 ? selectedEdges[0] : null}
            edgeLabelValue={edgeLabelDraft}
            onEdgeLabelChange={handleEdgeLabelChange}
          />
        </main>
      </div>
    </DiagramActionsContext.Provider>
  )
}

export default App
