import type { NextRequest } from 'next/server'

export function isGoodNewsAdminAuthorized(request: NextRequest, body?: { adminPassword?: string }): boolean {
  const password = process.env.AI_GOOD_NEWS_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD
  if (!password) return false
  return request.headers.get('x-admin-password') === password || body?.adminPassword === password
}

export function goodNewsAdminSetupMessage(): string {
  return 'Set AI_GOOD_NEWS_ADMIN_PASSWORD or ADMIN_PASSWORD to enable the AI Good News admin desk.'
}
