import { NeoPopButton } from '@/components/NeoPop/NeoPopButton'

export default function NotFound() {
  return (
    <div className="max-w-2xl">
      <p className="text-[13px] font-black uppercase tracking-[0.15em] inline-block bg-neopop-red text-neopop-white px-3 py-1 mb-4">
        Error 404
      </p>
      <h1 className="text-[56px] sm:text-[72px] font-black uppercase leading-[0.95] tracking-tight mb-4">
        Page not found
      </h1>
      <div className="w-20 h-[6px] bg-neopop-red mb-6" aria-hidden="true" />
      <p className="text-[19px] leading-[1.5] mb-8">
        The page you&apos;re looking for doesn&apos;t exist. The link might be broken, or
        the issue might have been moved.
      </p>

      <div className="flex flex-wrap gap-4">
        <NeoPopButton href="/" variant="primary">
          Back to latest issue
        </NeoPopButton>
        <NeoPopButton href="/issues" variant="secondary">
          Browse all issues
        </NeoPopButton>
      </div>
    </div>
  )
}
