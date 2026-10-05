/** A travel scene in the brand colours (burgundy, gold, paper): an arched
 *  window onto hills, sea and a setting sun, with a plane's gold trail. */
export function TravelArt() {
  return (
    <svg className="travel-art" viewBox="0 0 320 200" role="img" aria-label="Rolling hills by the sea at sunset, with a plane overhead">
      <defs>
        <clipPath id="arch">
          <path d="M40 200V100a120 100 0 0 1 240 0v100z" />
        </clipPath>
      </defs>
      <g clipPath="url(#arch)">
        <rect width="320" height="200" fill="var(--paper-tint)" />
        <circle cx="200" cy="136" r="34" fill="var(--gold)" />
        <path d="M30 140h260v60H30z" style={{ fill: 'color-mix(in srgb, var(--brand-disc) 22%, var(--paper-tint))' }} />
        <path d="M150 152h70M170 160h40" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
        <path d="M30 150q40-30 90-8t90 2 100-10v70H30z" fill="var(--brand-disc)" opacity="0.55" />
        <path d="M30 172q60-26 120-6t170-8v50H30z" fill="var(--brand-disc)" />
        <path d="M70 70q60 10 110-12t90-8" fill="none" stroke="var(--gold)" strokeWidth="2" strokeDasharray="2 7" strokeLinecap="round" />
        <path d="M272 47l14-4-4 6 6 3-8 1-3 5-1-7z" fill="var(--brand-disc)" />
      </g>
      <path d="M40 200V100a120 100 0 0 1 240 0v100" fill="none" stroke="var(--gold)" strokeWidth="2" />
    </svg>
  )
}
