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
