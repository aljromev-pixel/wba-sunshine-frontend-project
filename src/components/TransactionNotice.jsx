export function TransactionNotice({ notice, onDismiss }) {
  return <div className="transaction-feedback" aria-live="polite" aria-atomic="true">
    {notice && <div key={notice.id} className={`toast transaction-notice ${notice.tone}`}>
      {notice.tone === 'success' && <svg className="success-handshake" viewBox="0 0 48 48" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="m4 20 7-9 10 4M44 20l-7-9-9 3-9 9c-2 3 1 6 4 4l5-4 11 9M10 26l13 12c2 2 4 0 3-2m0 0c3 3 6 0 4-2m0 0c3 2 6-1 4-3m0 0c4 3 7-1 4-4M4 20l6 6m34-6-6 7" />
        <path className="handshake-check" d="m29 5 3 3 6-6" />
      </svg>}
      <div><strong>{notice.tone === 'success' ? 'Action completed' : 'Workspace notice'}</strong><p>{notice.message}</p></div>
      <button type="button" className="notice-dismiss" aria-label="Dismiss notification" onClick={onDismiss}>×</button>
    </div>}
  </div>
}
