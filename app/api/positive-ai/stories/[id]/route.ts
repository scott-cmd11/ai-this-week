import { NextRequest, NextResponse } from 'next/server'
import { isGoodNewsAdminAuthorized, goodNewsAdminSetupMessage } from '@/lib/good-news-admin-auth'
import { updateGoodNewsStory } from '@/lib/good-news-store'
import type { GoodNewsStory } from '@/lib/good-news-types'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

interface PatchBody {
  adminPassword?: string
  patch?: Partial<Omit<GoodNewsStory, 'id'>>
}

export async function PATCH(request: NextRequest, { params }: Props) {
  let body: PatchBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!isGoodNewsAdminAuthorized(request, body)) {
    return NextResponse.json({ error: goodNewsAdminSetupMessage() }, { status: 401 })
  }

  const { id } = await params
  const patch = body.patch ?? {}
  const story = await updateGoodNewsStory(id, patch)
  if (!story) return NextResponse.json({ error: 'Story not found.' }, { status: 404 })
  return NextResponse.json({ story })
}
