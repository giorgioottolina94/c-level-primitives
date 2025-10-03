import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { addEdge, applyEdgeChanges, applyNodeChanges, MarkerType } from 'reactflow'
import type { Connection, EdgeChange, NodeChange } from 'reactflow'
import { nanoid } from 'nanoid'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import type { BoardSnapshot, PrimitiveEdge, PrimitiveNode, PrimitiveNodeData } from '../types'

const defaultEndpoint = (() => {
  if (typeof window === 'undefined') {
    return 'ws://localhost:1234'
  }
  const { host } = window.location
  
  // Solo localhost: usa WebSocket con collaborazione
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return 'ws://localhost:1234'
  }
  
  // IP di rete locale (es. 192.168.x.x, 10.x.x.x, 172.16-31.x.x): punta al server sulla stessa macchina
  const hostName = host.split(':')[0]
  const isPrivateA = hostName.startsWith('10.')
  const isPrivateB = hostName.startsWith('192.168.')
  const isPrivateC = /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostName)
  const isIPv4 = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostName)
  if (isIPv4 && (isPrivateA || isPrivateB || isPrivateC)) {
    return `ws://${hostName}:1234`
  }
  
  // ngrok HTTPS: usa tunnel WebSocket dedicato
  if (host.includes('c-level-primitives.eu.ngrok.io')) {
    return 'wss://c-level-primitives-ws.eu.ngrok.io'
  }
  
  // Altri casi: disabilita WebSocket
  return null
})()

const WS_ENDPOINT = import.meta.env.VITE_COLLAB_ENDPOINT ?? defaultEndpoint

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
    // Non creare connessione WebSocket se endpoint è null (ngrok HTTPS)
    if (!WS_ENDPOINT) {
      setStatus('disconnected')
      // Crea doc locale senza WebSocket per mantenere funzionalità
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
    
    const doc = new Y.Doc()
    
    const provider = new WebsocketProvider(WS_ENDPOINT, roomId, doc, { connect: true })
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

    const handleStatus = (event: { status: CollaborationStatus }) => {
      setStatus(event.status)
    }

    provider.on('status', handleStatus)

    setStatus(provider.wsconnected ? 'connected' : 'connecting')

    return () => {
      yNodes.unobserve(nodesObserver)
      yEdges.unobserve(edgesObserver)
      provider.off('status', handleStatus)
      provider.destroy()
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
