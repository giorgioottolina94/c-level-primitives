import type { Node, Edge } from 'reactflow'

export type PrimitiveNodeData = {
  blockId: string
  label: string
  categoryId: string
  note?: string
  tags?: string[]
  dataSourceType?: 'db' | 'docs'
}

export type PrimitiveNode = Node<PrimitiveNodeData> & {
  resizable?: boolean
}
export type PrimitiveEdge = Edge

export type BoardSnapshot = {
  nodes: PrimitiveNode[]
  edges: PrimitiveEdge[]
  meta?: {
    title?: string
    updatedAt: number
  }
}
