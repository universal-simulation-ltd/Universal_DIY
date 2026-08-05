// ---------------------------------------------------------------------------
// Worked examples, offered from the navbar menu.
//
// Every one is a box somebody actually builds, and between them they cover the
// three things a first-time visitor most needs to see working: an omitted panel
// (the open-top tote), a full-overlay back (the bookcase), and a non-default
// wrap order (the plinth). A demo that only shows the default preset teaches
// nothing about the one control that matters.
// ---------------------------------------------------------------------------

import { PRESETS, type Design, type PanelId } from './panels'

export interface Example {
  id: string
  label: string
  design: Design
}

function order(presetId: string): PanelId[] {
  const preset = PRESETS.find((p) => p.id === presetId)
  if (!preset) throw new Error(`unknown preset ${presetId}`)
  return [...preset.order]
}

const ALL = { left: true, right: true, top: true, bottom: true, back: true, front: true }

export const EXAMPLES: Example[] = [
  {
    id: 'tote',
    label: 'Tool tote — open top',
    design: {
      name: 'Tool tote',
      width: 400, depth: 250, height: 200, thickness: 18,
      present: { ...ALL, top: false },
      order: order('sides'),
      material: '18 mm birch ply',
      grained: true,
    },
  },
  {
    id: 'bookcase',
    label: 'Bookcase carcass — overlay back',
    design: {
      name: 'Bookcase carcass',
      width: 800, depth: 300, height: 1800, thickness: 18,
      present: { ...ALL, front: false },
      order: order('overlayback'),
      material: '18 mm birch ply',
      grained: true,
    },
  },
  {
    id: 'plinth',
    label: 'Plinth box — top & bottom capture the sides',
    design: {
      name: 'Plinth box',
      width: 600, depth: 400, height: 150, thickness: 18,
      present: { ...ALL },
      order: order('topbottom'),
      material: '18 mm birch ply',
      grained: true,
    },
  },
  {
    id: 'speaker',
    label: 'Speaker cabinet — 18 mm MDF',
    design: {
      name: 'Speaker cabinet',
      width: 300, depth: 250, height: 450, thickness: 18,
      present: { ...ALL },
      order: order('sides'),
      material: '18 mm MDF',
      grained: false,
    },
  },
  {
    id: 'drawer',
    label: 'Drawer box — 12 mm, no top',
    design: {
      name: 'Drawer box',
      width: 400, depth: 300, height: 120, thickness: 12,
      present: { ...ALL, top: false },
      order: order('sides'),
      material: '12 mm birch ply',
      grained: true,
    },
  },
]
