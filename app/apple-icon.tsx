import { ImageResponse } from 'next/og'

// iOS home-screen icon. Next.js renders this to a 180x180 PNG at build time.
// Apple doesn't reliably pick up SVG apple-icons, so we emit a raster version.
// The design mirrors /icon.svg — Canada red background, white maple leaf.

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#d52b1e',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          viewBox="0 0 512 512"
          width="140"
          height="140"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M256 28l-30 56-30-18 12 90-68-12 24 58-42 18 78 74-14 36 80-14v106h20V316l80 14-14-36 78-74-42-18 24-58-68 12 12-90-30 18z"
            fill="#ffffff"
          />
        </svg>
      </div>
    ),
    { ...size }
  )
}
