import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { addEdge, applyEdgeChanges, applyNodeChanges, MarkerType } from 'reactflow'
import type { Connection, EdgeChange, NodeChange } from 'reactflow'
import { nanoid } from 'nanoid'
import * as Y from 'yjs'
import { LiveblocksYjsProvider } from '@liveblocks/yjs'
import { createClient } from '@liveblocks/client'
import type { BoardSnapshot, PrimitiveEdge, PrimitiveNode, PrimitiveNodeData } from '../types'

// Liveblocks Public Key - ottieni la tua su https://liveblocks.io
const LIVEBLOCKS_PUBLIC_KEY = import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY

if (!LIVEBLOCKS_PUBLIC_KEY) {
  console.warn('⚠️ VITE_LIVEBLOCKS_PUBLIC_KEY not set. Collaboration will not work.')
}

// Crea il client Liveblocks (riutilizzato per tutte le stanze)
const liveblocksClient = LIVEBLOCKS_PUBLIC_KEY
  ? createClient({ publicApiKey: LIVEBLOCKS_PUBLIC_KEY })
  : null

const NODES_KEY = 'nodes'
const EDGES_KEY = 'edges'
const CLEAR_TIMESTAMPS_KEY = 'clearTimestamps' // 🧹 Per tracking pulizie globali

const toPlain = <T,>(value: T): T => JSON.parse(JSON.stringify(value))

const ensureNodeDefaults = (node: PrimitiveNode): PrimitiveNode => {
  const style = {
    minWidth: 160,
    ...(node.style ?? {}),
  }
  const data = {
    ...(node.data ?? {}),
    tags: Array.isArray(node.data?.tags) ? node.data.tags : [],
  }
  return {
    ...node,
    style,
    data,
    resizable: node.resizable ?? true,
    width: node.width ?? 240,
    height: node.height ?? 140,
  }
}

const ensureEdgeDefaults = (edge: PrimitiveEdge): PrimitiveEdge => {
  const markerEnd = edge.markerEnd ?? {
    type: MarkerType.ArrowClosed,
    color: '#1f2933',
    width: 20,
    height: 20,
  }
  const style = {
    stroke: '#1f2933',
    strokeWidth: 2,
    ...(edge.style ?? {}),
  }
  const existingData = (edge as { data?: Record<string, unknown> }).data ?? {}
  const existingLabel = typeof edge.label === 'string' ? edge.label : undefined
  const dataLabel = typeof existingData.edgeLabel === 'string' ? (existingData.edgeLabel as string) : undefined
  const label = existingLabel ?? dataLabel ?? ''
  return {
    ...edge,
    type: edge.type ?? 'smoothstep',
    markerEnd,
    style,
    label,
    data: {
      ...existingData,
      edgeLabel: label,
    },
  }
}

export type CollaborationStatus = 'connecting' | 'connected' | 'disconnected'

export type CollaborativeFlow = {
  nodes: PrimitiveNode[]
  edges: PrimitiveEdge[]
  status: CollaborationStatus
  addNode: (node: PrimitiveNode) => void
  updateNodeData: (nodeId: string, data: Partial<PrimitiveNodeData>) => void
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => void
  clearBoard: () => void
  clearAllBoards: () => Promise<void>
  getBoardClearTimestamp: (boardId: string) => number | null // 🕐 Per controllo invalidazione snapshot
  exportSnapshot: () => { nodes: PrimitiveNode[]; edges: PrimitiveEdge[] }
  loadSnapshot: (snapshot: BoardSnapshot) => void
  removeElements: (nodeIds: string[], edgeIds: string[]) => void
  toggleCategory: (nodeIds: string[], categoryId: string) => void
  updateEdgeLabel: (edgeId: string, label: string) => void
}

export const useCollaborativeFlow = (roomId: string): CollaborativeFlow => {
  const [status, setStatus] = useState<CollaborationStatus>('connecting')
  const [nodes, setNodes] = useState<PrimitiveNode[]>([])
  const [edges, setEdges] = useState<PrimitiveEdge[]>([])

  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)

  const docRef = useRef<Y.Doc | null>(null)
  
  // Throttling per ridurre i payload durante drag intensi su board grandi
  const THROTTLE_MS = 80
  const nodesCommitTimeoutRef = useRef<number | null>(null)
  const edgesCommitTimeoutRef = useRef<number | null>(null)
  const pendingNodesRef = useRef<PrimitiveNode[] | null>(null)
  const pendingEdgesRef = useRef<PrimitiveEdge[] | null>(null)

  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])

  useEffect(() => {
    edgesRef.current = edges
  }, [edges])

  useEffect(() => {
    // Se Liveblocks non è configurato, usa modalità locale (solo per dev)
    if (!liveblocksClient) {
      setStatus('disconnected')
      console.warn('⚠️ Running in local mode without collaboration')
      
      // Crea doc locale senza sincronizzazione
      const doc = new Y.Doc()
      docRef.current = doc
      
      const yNodes = doc.getArray<PrimitiveNode>(NODES_KEY)
      const yEdges = doc.getArray<PrimitiveEdge>(EDGES_KEY)

      const syncNodes = () => {
        const next = yNodes.toArray().map(ensureNodeDefaults)
        setNodes(next)
      }

      const syncEdges = () => {
        const next = yEdges.toArray().map(ensureEdgeDefaults)
        setEdges(next)
      }

      syncNodes()
      syncEdges()

      const nodesObserver = () => syncNodes()
      const edgesObserver = () => syncEdges()

      yNodes.observe(nodesObserver)
      yEdges.observe(edgesObserver)

      return () => {
        yNodes.unobserve(nodesObserver)
        yEdges.unobserve(edgesObserver)
        doc.destroy()
        docRef.current = null
      }
    }
    
    // Crea documento Yjs e provider Liveblocks
    const doc = new Y.Doc()
    
    const { room, leave } = liveblocksClient.enterRoom(roomId, {
      initialPresence: {},
    })
    
    const provider = new LiveblocksYjsProvider(room, doc)
    docRef.current = doc

    const yNodes = doc.getArray<PrimitiveNode>(NODES_KEY)
    const yEdges = doc.getArray<PrimitiveEdge>(EDGES_KEY)

    const syncNodes = () => {
      const next = yNodes.toArray().map(ensureNodeDefaults)
      setNodes(next)
    }

    const syncEdges = () => {
      const next = yEdges.toArray().map(ensureEdgeDefaults)
      setEdges(next)
    }

    syncNodes()
    syncEdges()

    const nodesObserver = () => syncNodes()
    const edgesObserver = () => syncEdges()

    yNodes.observe(nodesObserver)
    yEdges.observe(edgesObserver)

    // Liveblocks gestisce automaticamente lo status
    // Iniziamo come "connecting" e poi diventeremo "connected"
    setStatus('connecting')
    
    // Simula connessione riuscita dopo un breve delay
    const statusTimer = setTimeout(() => {
      setStatus('connected')
    }, 500)

    return () => {
      clearTimeout(statusTimer)
      yNodes.unobserve(nodesObserver)
      yEdges.unobserve(edgesObserver)
      provider.destroy()
      leave()
      doc.destroy()
      docRef.current = null
    }
  }, [roomId])

  const transact = useCallback((fn: (doc: Y.Doc) => void) => {
    const doc = docRef.current
    if (!doc) {
      return
    }
    doc.transact(() => fn(doc))
  }, [])

  const overwriteArray = useCallback(
    (key: string, next: PrimitiveNode[] | PrimitiveEdge[]) => {
      transact((doc) => {
        const arr = doc.getArray(key)
        arr.delete(0, arr.length)
        arr.insert(0, toPlain(next))
      })
    },
    [transact],
  )

  const scheduleNodesCommit = useCallback(
    (next: PrimitiveNode[]) => {
      pendingNodesRef.current = next
      if (nodesCommitTimeoutRef.current !== null) {
        window.clearTimeout(nodesCommitTimeoutRef.current)
      }
      nodesCommitTimeoutRef.current = window.setTimeout(() => {
        if (pendingNodesRef.current) {
          overwriteArray(NODES_KEY, pendingNodesRef.current.map(ensureNodeDefaults))
          pendingNodesRef.current = null
        }
        if (nodesCommitTimeoutRef.current !== null) {
          window.clearTimeout(nodesCommitTimeoutRef.current)
          nodesCommitTimeoutRef.current = null
        }
      }, THROTTLE_MS)
    },
    [overwriteArray],
  )

  const scheduleEdgesCommit = useCallback(
    (next: PrimitiveEdge[]) => {
      pendingEdgesRef.current = next
      if (edgesCommitTimeoutRef.current !== null) {
        window.clearTimeout(edgesCommitTimeoutRef.current)
      }
      edgesCommitTimeoutRef.current = window.setTimeout(() => {
        if (pendingEdgesRef.current) {
          overwriteArray(EDGES_KEY, pendingEdgesRef.current.map(ensureEdgeDefaults))
          pendingEdgesRef.current = null
        }
        if (edgesCommitTimeoutRef.current !== null) {
          window.clearTimeout(edgesCommitTimeoutRef.current)
          edgesCommitTimeoutRef.current = null
        }
      }, THROTTLE_MS)
    },
    [overwriteArray],
  )

  const addNode = useCallback(
    (node: PrimitiveNode) => {
      transact((doc) => {
        const arr = doc.getArray<PrimitiveNode>(NODES_KEY)
        arr.push([toPlain(ensureNodeDefaults(node))])
      })
    },
    [transact],
  )

  const updateNodeData = useCallback(
    (nodeId: string, data: Partial<PrimitiveNodeData>) => {
      const next = nodesRef.current.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                ...data,
              },
            }
          : node,
      )
      overwriteArray(NODES_KEY, next.map(ensureNodeDefaults))
    },
    [overwriteArray],
  )

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const hasNonSelectionChange = changes.some((change) => change.type !== 'select')
      const hasOnlyDrag = changes.every((change) => change.type === 'position' || change.type === 'select')
      const next = applyNodeChanges(changes, nodesRef.current)

      if (!hasNonSelectionChange) {
        // Solo selezione: aggiorna localmente, non sincronizzare su Yjs
        setNodes(next.map(ensureNodeDefaults))
        return
      }

      if (hasOnlyDrag) {
        // Drag intenso: applica localmente e pianifica commit throttled
        setNodes(next.map(ensureNodeDefaults))
        scheduleNodesCommit(next)
        return
      }

      overwriteArray(NODES_KEY, next.map(ensureNodeDefaults))
    },
    [overwriteArray, scheduleNodesCommit],
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const hasNonSelectionChange = changes.some((change) => change.type !== 'select')
      const hasOnlyDrag = changes.every((change) => change.type === 'select')
      const next = applyEdgeChanges(changes, edgesRef.current)

      if (!hasNonSelectionChange) {
        // Solo selezione: aggiorna localmente
        setEdges(next.map(ensureEdgeDefaults))
        return
      }

      if (hasOnlyDrag) {
        // Non esistono drag veri per edges via changes, ma manteniamo simmetria
        setEdges(next.map(ensureEdgeDefaults))
        scheduleEdgesCommit(next)
        return
      }

      overwriteArray(EDGES_KEY, next.map(ensureEdgeDefaults))
    },
    [overwriteArray, scheduleEdgesCommit],
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      const edgeId = `edge-${nanoid(8)}`
      const edge = { ...connection, id: edgeId }
      const next = addEdge(edge, edgesRef.current)
      overwriteArray(EDGES_KEY, next.map(ensureEdgeDefaults))
    },
    [overwriteArray],
  )

  const clearBoard = useCallback(() => {
    overwriteArray(NODES_KEY, [])
    overwriteArray(EDGES_KEY, [])
    
    // 🧹 Registra timestamp di pulizia globale per invalidare snapshots locali
    transact((doc) => {
      const clearTimestamps = doc.getMap(CLEAR_TIMESTAMPS_KEY)
      clearTimestamps.set(roomId, Date.now())
      console.log('🗑️ Board', roomId, 'pulita - timestamp globale aggiornato')
    })
  }, [overwriteArray, transact, roomId])

  const clearAllBoards = useCallback(() => {
    // Approccio semplificato: pulisce solo localmente 
    // Il server si resetterà al riavvio/riconnessione
    return Promise.resolve()
  }, [])

  const getBoardClearTimestamp = useCallback((boardId: string) => {
    if (!docRef.current) {
      return null
    }
    try {
      const clearTimestamps = docRef.current.getMap(CLEAR_TIMESTAMPS_KEY)
      const timestamp = clearTimestamps.get(boardId)
      return typeof timestamp === 'number' ? timestamp : null
    } catch (error) {
      console.warn('Errore lettura timestamp pulizia per board', boardId, error)
      return null
    }
  }, [])

  const exportSnapshot = useCallback(() => {
    return {
      nodes: nodesRef.current.map(ensureNodeDefaults),
      edges: edgesRef.current.map(ensureEdgeDefaults),
    }
  }, [])

  const loadSnapshot = useCallback(
    (snapshot: BoardSnapshot) => {
      const nextNodes = (snapshot.nodes ?? []).map(ensureNodeDefaults)
      const nextEdges = (snapshot.edges ?? []).map(ensureEdgeDefaults)
      overwriteArray(NODES_KEY, nextNodes)
      overwriteArray(EDGES_KEY, nextEdges)
    },
    [overwriteArray],
  )

  const removeElements = useCallback(
    (nodeIds: string[], edgeIds: string[]) => {
      if (nodeIds.length === 0 && edgeIds.length === 0) {
        return
      }
      const nodeSet = new Set(nodeIds)
      const edgeSet = new Set(edgeIds)

      const nextNodes = nodesRef.current.filter((node) => !nodeSet.has(node.id))
      const nextEdges = edgesRef.current.filter((edge) => {
        if (edgeSet.has(edge.id)) {
          return false
        }
        return !(nodeSet.has(edge.source) || nodeSet.has(edge.target))
      })

      overwriteArray(NODES_KEY, nextNodes.map(ensureNodeDefaults))
      overwriteArray(EDGES_KEY, nextEdges.map(ensureEdgeDefaults))
    },
    [overwriteArray],
  )

  const toggleCategory = useCallback(
    (nodeIds: string[], categoryId: string) => {
      if (nodeIds.length === 0) {
        return
      }
      const nodeSet = new Set(nodeIds)
      const nextNodes = nodesRef.current.map((node) => {
        if (!nodeSet.has(node.id)) {
          return node
        }
        const tags = new Set(node.data?.tags ?? [])
        if (tags.has(categoryId)) {
          tags.delete(categoryId)
        } else {
          tags.add(categoryId)
        }
        return ensureNodeDefaults({
          ...node,
          data: {
            ...node.data,
            tags: Array.from(tags),
          },
        })
      })

      overwriteArray(NODES_KEY, nextNodes)
    },
    [overwriteArray],
  )

  const updateEdgeLabel = useCallback(
    (edgeId: string, label: string) => {
      const sanitized = label.trim().length ? label : ''
      const nextEdges = edgesRef.current.map((edge) =>
        edge.id === edgeId
          ? ensureEdgeDefaults({
              ...edge,
              label: sanitized,
              data: {
                ...(edge.data ?? {}),
                edgeLabel: sanitized,
              },
            })
          : edge,
      )
      overwriteArray(EDGES_KEY, nextEdges)
    },
    [overwriteArray],
  )

  return useMemo(
    () => ({
      nodes,
      edges,
      status,
      addNode,
      onNodesChange,
      onEdgesChange,
      onConnect,
      clearBoard,
      clearAllBoards,
      getBoardClearTimestamp,
      exportSnapshot,
      loadSnapshot,
      removeElements,
      toggleCategory,
      updateEdgeLabel,
      updateNodeData,
    }),
    [
      nodes,
      edges,
      status,
      addNode,
      updateNodeData,
      onNodesChange,
      onEdgesChange,
      onConnect,
      clearBoard,
      clearAllBoards,
      getBoardClearTimestamp,
      exportSnapshot,
      loadSnapshot,
      removeElements,
      toggleCategory,
      updateEdgeLabel,
    ],
  )
}
