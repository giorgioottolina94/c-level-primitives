import { forwardRef, useCallback, useRef, type DragEvent } from 'react'
import ReactFlow, {
  Background,
  ConnectionMode,
  Controls,
  MarkerType,
  MiniMap,
  PanOnScrollMode,
  ReactFlowProvider,
  useReactFlow,
  type NodeTypes,
  type OnSelectionChangeParams,
  type IsValidConnection,
} from 'reactflow'
import { nanoid } from 'nanoid'
import type { CollaborativeFlow } from '../hooks/useCollaborativeFlow'
import type { PrimitiveEdge, PrimitiveNode } from '../types'
import { findBlockById } from '../utils/primitives'
import { PrimitiveDragType } from './PrimitiveSidebar'
import { PrimitiveNode as PrimitiveNodeComponent } from './nodes/PrimitiveNode'
import { EdgeLabelEditor } from './EdgeLabelEditor'

const nodeTypes = {
  primitive: PrimitiveNodeComponent,
} satisfies NodeTypes

const defaultEdgeOptions = {
  type: 'smoothstep' as const,
  animated: false,
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: '#1f2933',
    width: 20,
    height: 20,
  },
  style: {
    strokeWidth: 2,
    stroke: '#1f2933',
  },
}

type CanvasProps = {
  flow: CollaborativeFlow
  onSelectionChange?: (selection: { nodes: PrimitiveNode[]; edges: PrimitiveEdge[] }) => void
  selectedEdgeId: string | null
  edgeLabelValue: string
  onEdgeLabelChange: (value: string) => void
}

const InnerCanvas = forwardRef<HTMLDivElement, CanvasProps>(({
  flow,
  onSelectionChange,
  selectedEdgeId,
  edgeLabelValue,
  onEdgeLabelChange,
}, ref) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const { project } = useReactFlow()

  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      wrapperRef.current = node
      if (typeof ref === 'function') {
        ref(node)
      } else if (ref) {
        ref.current = node
      }
    },
    [ref],
  )

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }, [])


  const handleSelectionChangeInternal = useCallback(
    (params: OnSelectionChangeParams) => {
      if (!onSelectionChange) {
        return
      }
      onSelectionChange({
        nodes: params.nodes as PrimitiveNode[],
        edges: params.edges as PrimitiveEdge[],
      })
    },
    [onSelectionChange],
  )

  const isValidConnection: IsValidConnection = useCallback((connection) => {
    // Permetti tutte le connessioni, anche tra handle dello stesso tipo
    return connection.source !== connection.target
  }, [])

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      const blockId = event.dataTransfer.getData(PrimitiveDragType)
      if (!blockId) {
        return
      }
      const block = findBlockById(blockId)
      if (!block || !wrapperRef.current) {
        return
      }
      const bounds = wrapperRef.current.getBoundingClientRect()
      const position = project({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      })
      const node: PrimitiveNode = {
        id: `node-${nanoid(8)}`,
        type: 'primitive',
        position,
        style: {
          width: 240,
          minWidth: 160,
        },
        width: 240,
        height: 140,
        resizable: true,
        data: {
          label: block.label,
          blockId: block.id,
          categoryId: block.categoryId,
          note: '',
          tags: ['human'],
        },
      }
      flow.addNode(node)
    },
    [flow, project],
  )

  return (
    <div className="canvas" ref={setRefs}>
      <ReactFlow
        nodes={flow.nodes}
        edges={flow.edges}
        onNodesChange={flow.onNodesChange}
        onEdgesChange={flow.onEdgesChange}
        onConnect={flow.onConnect}
        onSelectionChange={handleSelectionChangeInternal}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        isValidConnection={isValidConnection}
        translateExtent={[[-100000, -100000], [100000, 100000]]}
        minZoom={0.2}
        maxZoom={2.5}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        panOnScroll
        panOnScrollMode={PanOnScrollMode.Free}
        panOnDrag={[2]}
        zoomOnScroll={false}
        nodeDragThreshold={1}
        connectionMode={ConnectionMode.Loose}
        connectionRadius={32}
        snapToGrid
        snapGrid={[16, 16]}
        proOptions={{ hideAttribution: true }}
      >
        <MiniMap pannable zoomable />
        <Controls />
        <Background gap={16} size={1} />
        <EdgeLabelEditor edgeId={selectedEdgeId} value={edgeLabelValue} onChange={onEdgeLabelChange} />
      </ReactFlow>
    </div>
  )
})

InnerCanvas.displayName = 'InnerCanvas'

export const DiagramCanvas = forwardRef<HTMLDivElement, CanvasProps>((props, ref) => {
  return (
    <ReactFlowProvider>
      <InnerCanvas {...props} ref={ref} />
    </ReactFlowProvider>
  )
})

DiagramCanvas.displayName = 'DiagramCanvas'
