export const STEP_KEYS = ['briefings', 'research', 'events', 'draft', 'publish'] as const
export type StepKey = typeof STEP_KEYS[number]

export const STEP_LABELS: Record<StepKey, string> = {
  briefings: 'Briefings',
  research:  'Research Papers',
  events:    'Add Events',
  draft:     'Review Draft',
  publish:   'Publish',
}
