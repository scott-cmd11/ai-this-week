// Known URL/title index for recent AI Today issues.
// The arguments are kept for older callers that used to pass Notion clients.

import {
  buildKnownTitleList as buildIssueStoreKnownTitleList,
  buildKnownUrlMap as buildIssueStoreKnownUrlMap,
  type KnownTitleEntry,
  type KnownUrlEntry,
} from './issue-store'

export type { KnownTitleEntry, KnownUrlEntry }
export type KnownUrlMap = Map<string, KnownUrlEntry>

function resolveDays(
  _clientOrDays?: unknown,
  _databaseId?: unknown,
  days?: number,
) {
  if (typeof _clientOrDays === 'number') return _clientOrDays
  if (typeof _databaseId === 'number') return _databaseId
  return days ?? 30
}

export async function buildKnownUrlMap(
  clientOrDays?: unknown,
  databaseId?: unknown,
  days?: number,
): Promise<KnownUrlMap> {
  return buildIssueStoreKnownUrlMap(resolveDays(clientOrDays, databaseId, days))
}

export async function buildKnownTitleList(
  clientOrDays?: unknown,
  databaseId?: unknown,
  days?: number,
): Promise<KnownTitleEntry[]> {
  return buildIssueStoreKnownTitleList(resolveDays(clientOrDays, databaseId, days))
}
