const wbaLetterPaths = [
  'M0 0H7L9.5 12.5L2.2 8.5Z M3.1 13.5L10.5 17.5L12.3 26L17 12H21L26 26L30 0H37L31 36H24L19 25L14 36H7Z',
  'M43 0H64L73 8V15L68 18L74 23V29L67 36H43Z M51 7V14H61L65 11V10L62 7Z M51 22V29H63L66 26V25L63 22Z',
  'M92 0H99L114 36H105L95.5 12L85 36H76Z M89 24H101L104 31H86Z',
]

function WbaLettering() {
  return <><title>WBA</title>{wbaLetterPaths.map((d, index) => <path key={index} d={d} fillRule={index === 2 ? 'nonzero' : 'evenodd'} />)}</>
}

export function WbaWordmark() {
  return <svg className="wba-wordmark" viewBox="0 0 114 36" width="114" height="36" fill="currentColor" fillRule="evenodd" aria-hidden="true" focusable="false">
    <WbaLettering />
  </svg>
}

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
    <g className="wba-sun-lettering" transform="translate(28 52.632) scale(.631579)" fill="#f3f2ee" fillRule="evenodd"><WbaLettering /></g>
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
