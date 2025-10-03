import { createContext, useContext } from 'react'
import type { PrimitiveNodeData } from '../types'

export type DiagramActions = {
  updateNodeData: (nodeId: string, data: Partial<PrimitiveNodeData>) => void
}

export const DiagramActionsContext = createContext<DiagramActions | null>(null)

export const useDiagramActions = () => {
  const context = useContext(DiagramActionsContext)
  if (!context) {
    throw new Error('useDiagramActions deve essere usato dentro DiagramActionsContext.Provider')
  }
  return context
}
