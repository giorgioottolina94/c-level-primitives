export type PrimitiveBlock = {
  id: string
  label: string
  description?: string
}

export type PrimitiveCategory = {
  id: string
  label: string
  tagline: string
  color: string
  blocks: PrimitiveBlock[]
}

export const primitiveCatalog: PrimitiveCategory[] = [
  {
    id: 'retrieve',
    label: 'Retrieve',
    tagline: 'Scopri e richiama informazioni da fonti interne o esterne.',
    color: '#C4584F',
    blocks: [
      { id: 'web-search', label: 'Web Search', description: 'Usa il web per trovare contenuti di supporto.' },
      { id: 'database-query', label: 'Database query', description: 'Interroga basi dati strutturate.' },
      { id: 'in-document-find', label: 'In-document find', description: 'Cerca riferimenti o snippet dentro a un documento.' },
    ],
  },
  {
    id: 'transform',
    label: 'Transform',
    tagline: 'Modifica il formato o la struttura dell\'informazione.',
    color: '#C96B55',
    blocks: [
      { id: 'clean-normalize', label: 'Clean & Normalize', description: 'Ripulisci dati sporchi e armonizza gli attributi.' },
      { id: 'format-convert', label: 'Format convert', description: 'Cambia formato o layout del contenuto.' },
      { id: 'join-merge', label: 'Join / merge records', description: 'Combina dataset o record correlati.' },
      { id: 'deduplicate', label: 'Deduplicate', description: 'Rimuovi duplicati mantenendo le informazioni chiave.' },
    ],
  },
  {
    id: 'synthesize',
    label: 'Synthesize',
    tagline: 'Comprimi e collega informazioni per decisioni rapide.',
    color: '#CD7B54',
    blocks: [
      { id: 'summarize', label: 'Summarize', description: 'Riassumi parti sostanziali mantenendo il senso.' },
      { id: 'grounded-qa', label: 'Grounded Q&A', description: 'Rispondi a domande citando fonti affidabili.' },
      { id: 'compare-tabulate', label: 'Compare & tabulate', description: 'Confronta alternative e rendile leggibili.' },
    ],
  },
  {
    id: 'evaluate',
    label: 'Evaluate',
    tagline: 'Misura, controlla e analizza per capire qualita e rischi.',
    color: '#D08A52',
    blocks: [
      { id: 'rank-by-criteria', label: 'Rank by criteria', description: 'Ordina secondo metriche definite.' },
      { id: 'policy-check', label: 'Policy / compliance check', description: 'Verifica rispetto di policy e vincoli.' },
      { id: 'fact-check', label: 'Fact / consistency check', description: 'Valida fatti e coerenza narrativa.' },
      { id: 'aggregate-pivot', label: 'Aggregate & pivot', description: 'Raggruppa e calcola indicatori.' },
      { id: 'trend-variance', label: 'Trend & variance', description: 'Evidenzia pattern temporali o varianze.' },
      { id: 'outlier-check', label: 'Outlier check', description: 'Scova anomalie prima di agire.' },
      { id: 'segmentation', label: 'Segmentation', description: 'Dividi in cluster significativi.' },
      { id: 'scenario-what-if', label: 'Scenario / what if', description: 'Simula scenari alternativi.' },
    ],
  },
  {
    id: 'generate',
    label: 'Generate',
    tagline: 'Produci contenuti nuovi coerenti con gli obiettivi.',
    color: '#D39A51',
    blocks: [
      { id: 'outline', label: 'Outline', description: 'Definisci la struttura di un elaborato.' },
      { id: 'draft-section', label: 'Draft section', description: 'Genera bozze di paragrafi o sezioni.' },
      { id: 'template-fill', label: 'Template fill', description: 'Compila template o canvas predefiniti.' },
      { id: 'rewrite-improve', label: 'Rewrite & improve', description: 'Rifinisci un testo esistente.' },
      { id: 'cite-ground', label: 'Cite & ground', description: 'Rendi tracciabili le affermazioni.' },
      { id: 'audience-tone', label: 'Audience & tone shift', description: 'Adatta tono e registro al destinatario.' },
    ],
  },
  {
    id: 'organize',
    label: 'Organize',
    tagline: 'Classifica e collega gli asset per renderli reperibili.',
    color: '#D7A94F',
    blocks: [
      { id: 'classify-tag', label: 'Classify & tag', description: 'Applica tassonomie e tag coerenti.' },
      { id: 'entity-resolve', label: 'Entity resolve & link', description: 'Ricongiungi entita collegate e crea link.' },
    ],
  },
  {
    id: 'collaborate',
    label: 'Collaborate',
    tagline: 'Coinvolgi stakeholder e coordina feedback.',
    color: '#DBB84E',
    blocks: [
      { id: 'comment-annotate', label: 'Comment & annotate', description: 'Raccogli commenti contestuali.' },
      { id: 'request-clarification', label: 'Request clarification', description: 'Chiedi input o conferme rapide.' },
    ],
  },
  {
    id: 'act',
    label: 'Act',
    tagline: 'Automatizza passaggi operativi o trigger successivi.',
    color: '#DFC74C',
    blocks: [
      { id: 'send-notification', label: 'Send notification', description: 'Informa canali o persone chiave.' },
      { id: 'request-approval', label: 'Request approval', description: 'Avvia flussi autorizzativi.' },
      { id: 'create-upload', label: 'Create / upload record', description: 'Aggiorna sistemi operativi.' },
    ],
  },
]

export const primitiveIndex = primitiveCatalog.flatMap((category) =>
  category.blocks.map((block) => ({
    ...block,
    categoryId: category.id,
  })),
)
