export const STEP_KEYS = ['briefings', 'research', 'events', 'draft', 'publish'] as const
export type StepKey = typeof STEP_KEYS[number]

export const STEP_LABELS: Record<StepKey, string> = {
  briefings: 'Import Articles',
  research:  'Add Research',
  events:    'Add Events',
  draft:     'Review Issue',
  publish:   'Publish & Refresh',
}

export const STEP_HELP: Record<StepKey, string> = {
  briefings: 'Bring in the daily briefing links first. Review any title warnings before moving on.',
  research:  'Add papers or reports that should sit alongside the news coverage.',
  events:    'Add learning events only when they belong in today\'s issue.',
  draft:     'Review today\'s assembled issue and add anything missing. Publishing happens in the next step.',
  publish:   'Publish today\'s issue first. Use live-issue updates only after an issue is already public.',
}
