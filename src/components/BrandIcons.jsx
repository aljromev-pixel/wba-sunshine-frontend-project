export function WbaEmblem({ className = '' }) {
  return <svg className={`wba-emblem ${className}`.trim()} viewBox="0 0 128 128" aria-hidden="true" focusable="false">
    <g className="wba-sun-rays">
      {Array.from({ length: 12 }, (_, index) => <g key={index} transform={`rotate(${index * 30} 64 64)`}>
        <path d="M64 4 70 16H58Z" fill="#e4b735" />
        <path d="M64 4v12h-6Z" fill="#b88713" />
      </g>)}
    </g>
    <circle cx="64" cy="64" r="43" fill="#242521" stroke="#e4b735" strokeWidth="2.5" />
    <circle cx="64" cy="64" r="38.5" fill="none" stroke="#f3f2ee" strokeOpacity=".25" />
    <text className="wba-sun-lettering" x="64" y="74" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontSize="29" fontWeight="700" letterSpacing="-1" fill="#f3f2ee">WBA</text>
  </svg>
}

export function SunIcon({ className = 'sun-icon' }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.93 4.93l2.12 2.12m9.9 9.9 2.12 2.12M4.93 19.07l2.12-2.12m9.9-9.9 2.12-2.12" />
  </svg>
}

export function FlashlightIcon() {
  return <svg className="flashlight-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path className="flashlight-rays" d="M12 1v2M4 2l2 1m14-1-2 1" />
    <path d="M6 5h12l-3 5H9L6 5Zm3 5h6v10a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V10Z" />
    <path d="M11 13h2" />
  </svg>
}
