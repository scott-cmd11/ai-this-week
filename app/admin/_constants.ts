export const STEP_KEYS = ['briefings', 'research', 'events', 'draft', 'publish', 'live'] as const
export type StepKey = typeof STEP_KEYS[number]

export const STEP_LABELS: Record<StepKey, string> = {
  briefings: 'Review Candidates',
  research:  'Add Context',
  events:    'Add Events',
  draft:     'Edit Draft',
  publish:   'Publish',
  live:      'Live Edits',
}

export const STEP_HELP: Record<StepKey, string> = {
  briefings: 'Review the Supabase candidate queue from the automations, reject noise, and import the best items into today\'s draft.',
  research:  'Optionally add papers or reports that should sit alongside the news coverage.',
  events:    'Add learning events only when they belong in today\'s issue.',
  draft:     'Review and edit today\'s assembled issue. Add missing articles manually before publishing.',
  publish:   'Publish today\'s issue from the Supabase draft. Live corrections happen in the next step.',
  live:      'Update an issue that is already public: edit story text, remove items, add a late article, or add a learning event.',
}
