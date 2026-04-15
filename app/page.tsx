import { redirect } from 'next/navigation'
import { getLatestIssue } from '@/lib/notion'

export const revalidate = 300

export default async function Home() {
  const latest = await getLatestIssue()
  if (latest) {
    redirect(`/issues/${latest.slug}`)
  }
  redirect('/issues')
}
