import { WbaEmblem } from './BrandIcons'

export function BrandLogo({ compact = false, href = '#/' }) {
  const className = `wba-brand${compact ? ' wba-brand-compact' : ''}`
  const content = <>
    <WbaEmblem className="wba-mark" />
    <span className="wba-brand-copy">
      {!compact && <span>WalangBrownout Appliances</span>}
      <small>{compact ? 'Powered by Sunshine' : 'Powered by Sunshine team'}</small>
    </span>
  </>
  return href ? <a className={className} href={href}>{content}</a> : <div className={className}>{content}</div>
}
