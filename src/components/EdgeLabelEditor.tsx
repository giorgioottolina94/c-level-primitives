import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EdgeLabelRenderer, useStore, type Edge, type Node } from 'reactflow'

export type EdgeLabelEditorProps = {
  edgeId: string | null
  value: string
  onChange: (value: string) => void
}

const getNodeCenter = (node: Node) => {
  const x = node.positionAbsolute?.x ?? node.position.x
  const y = node.positionAbsolute?.y ?? node.position.y
  const width = node.width ?? 0
  const height = node.height ?? 0
  return {
    x: x + width / 2,
    y: y + height / 2,
  }
}

const EDGE_PATH_SELECTOR = (edgeId: string) =>
  `.react-flow__edge[data-id="${edgeId}"] .react-flow__edge-path`

const toTuple = (x: number, y: number): [number, number] => [x, y]

export const EdgeLabelEditor = ({ edgeId, value, onChange }: EdgeLabelEditorProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null)

  const edge = useStore(
    useCallback((state) => {
      if (!edgeId) {
        return null
      }
      return state.edges.find((item) => item.id === edgeId) ?? null
    }, [edgeId]),
  ) as Edge | null

  const nodeInternals = useStore((state) => state.nodeInternals)
  const edgesState = useStore((state) => state.edges)

  const fallbackCenter = useMemo(() => {
    if (!edge) {
      return toTuple(0, 0)
    }
    const sourceNode = edge.source ? nodeInternals.get(edge.source) : null
    const targetNode = edge.target ? nodeInternals.get(edge.target) : null
    const primary = sourceNode ?? targetNode
    if (!sourceNode && !targetNode) {
      return toTuple(0, 0)
    }
    if (sourceNode && targetNode) {
      const sourceCenter = getNodeCenter(sourceNode)
      const targetCenter = getNodeCenter(targetNode)
      return toTuple(
        (sourceCenter.x + targetCenter.x) / 2,
        (sourceCenter.y + targetCenter.y) / 2,
      )
    }
    const fallback = getNodeCenter(primary as Node)
    return toTuple(fallback.x, fallback.y)
  }, [edge, nodeInternals])

  const [center, setCenter] = useState<[number, number]>(fallbackCenter)

  useEffect(() => {
    setCenter(fallbackCenter)
  }, [fallbackCenter])

  useEffect(() => {
    if (!edgeId) {
      return
    }

    let cancelled = false
    const updateCenter = () => {
      const path = document.querySelector<SVGPathElement>(EDGE_PATH_SELECTOR(edgeId))
      if (!path) {
        return
      }
      const length = path.getTotalLength()
      const point = path.getPointAtLength(length / 2)
      if (!cancelled) {
        setCenter(toTuple(point.x, point.y))
      }
    }

    const frame = requestAnimationFrame(updateCenter)
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [edgeId, edgesState, nodeInternals])

  useEffect(() => {
    if (edgeId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [edgeId])

  if (!edgeId || !edge) {
    return null
  }

  return (
    <EdgeLabelRenderer>
      <div
        className="edge-label-editor"
        style={{ transform: `translate(-50%, -50%) translate(${center[0]}px, ${center[1]}px)` }}
        onPointerDown={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
      >
        <input
          ref={inputRef}
          className="edge-label-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Etichetta collegamento"
        />
      </div>
    </EdgeLabelRenderer>
  )
}
