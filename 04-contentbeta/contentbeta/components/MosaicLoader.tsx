export default function MosaicLoader({ label }: { label?: string }) {
  return (
    <div className="mosaic-loader">
      <div className="mosaic-grid">
        {Array(9).fill(null).map((_, i) => (
          <div key={i} className="cell" />
        ))}
      </div>
      {label !== undefined && <div className="mosaic-label">{label}</div>}
    </div>
  )
}
