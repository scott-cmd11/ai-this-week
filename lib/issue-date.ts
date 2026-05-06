export const ISSUE_TIME_ZONE = 'America/Winnipeg'

export function issueDateFor(date = new Date(), timeZone = ISSUE_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const year = parts.find(part => part.type === 'year')?.value
  const month = parts.find(part => part.type === 'month')?.value
  const day = parts.find(part => part.type === 'day')?.value

  if (!year || !month || !day) {
    throw new Error('Could not format issue date.')
  }

  return `${year}-${month}-${day}`
}
