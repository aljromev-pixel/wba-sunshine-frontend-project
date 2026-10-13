import { WbaEmblem } from './BrandIcons'

export function BrandLogo({ compact = false, href = '#/' }) {
  const className = `wba-brand${compact ? ' wba-brand-compact' : ''}`
  const content = <>
    <WbaEmblem className="wba-mark" />
    <span className="wba-brand-copy">
      <strong>WBA</strong>
      {!compact && <span>WalangBrownout Appliances</span>}
      <small>{compact ? 'Powered by Sunshine' : 'Powered by Sunshine team'}</small>
    </span>
  </>
  return href ? <a className={className} href={href} aria-label="WBA home">{content}</a> : <div className={className} aria-label="WBA, powered by Sunshine team">{content}</div>
}
