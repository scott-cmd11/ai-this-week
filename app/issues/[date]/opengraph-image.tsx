import { ImageResponse } from 'next/og'
import { getIssueByDate, getPublishedIssues } from '@/lib/notion'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const revalidate = 300

interface Props {
  params: Promise<{ date: string }>
}

export async function generateStaticParams() {
  const issues = await getPublishedIssues()
  return issues.map(issue => ({ date: issue.slug }))
}

function formatDate(isoDate: string): string {
  return new Date(isoDate + 'T12:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default async function OgImage({ params }: Props) {
  const { date } = await params
  const issue = await getIssueByDate(date)

  const title = issue?.title ?? 'AI Today'
  const meta = issue
    ? `Issue ${issue.issueNumber} · ${formatDate(issue.issueDate)}`
    : 'Weekly AI news for non-technical professionals'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#ffffff',
          padding: '64px',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Top bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#0b0c0c',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '20px',
              padding: '8px 16px',
            }}
          >
            AI Today
          </div>
        </div>

        {/* Title */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              fontSize: title.length > 60 ? '44px' : '56px',
              fontWeight: 700,
              color: '#0b0c0c',
              lineHeight: 1.15,
              maxWidth: '900px',
            }}
          >
            {title}
          </div>
          <div style={{ fontSize: '24px', color: '#505a5f' }}>{meta}</div>
        </div>

        {/* Bottom accent */}
        <div
          style={{
            height: '6px',
            backgroundColor: '#1d70b8',
            width: '100%',
          }}
        />
      </div>
    ),
    { ...size }
  )
}
