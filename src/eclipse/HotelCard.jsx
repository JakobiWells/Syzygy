const HOTELS_BASE = import.meta.env.VITE_HOTELS_PROXY_URL ?? 'http://localhost:8788'

const PRICE_LABELS = ['Budget', 'Moderate', 'Upscale', 'Luxury']

function Stars({ n }) {
  const full = Math.round(n ?? 0)
  return (
    <span className="hotel-stars">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < full ? 'hotel-star filled' : 'hotel-star'}>★</span>
      ))}
    </span>
  )
}

function ScoreBadge({ score }) {
  if (!score) return null
  const hue = score >= 4.5 ? 142 : score >= 3.5 ? 48 : 14
  return (
    <span className="hotel-score-badge" style={{ background: `hsl(${hue}, 60%, 38%)` }}>
      {score.toFixed(1)} ★
    </span>
  )
}

function BookBtn({ href, logo, label, color }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="hotel-book-btn" style={{ background: color }}>
      {label}
    </a>
  )
}

export default function HotelCard({ hotel, onClose }) {
  if (!hotel) return null

  const photoUrl = hotel.photo_ref
    ? `${HOTELS_BASE}/photo?ref=${hotel.photo_ref}&w=600`
    : null

  return (
    <div className="hotel-card">
      <button className="hotel-card-close" onClick={onClose}>×</button>

      {photoUrl && (
        <div className="hotel-card-photo-wrap">
          <img src={photoUrl} alt={hotel.name} className="hotel-card-photo" loading="lazy" />
        </div>
      )}

      <div className="hotel-card-body">
        <div className="hotel-card-header">
          <div className="hotel-card-name">{hotel.name}</div>
          <ScoreBadge score={hotel.rating} />
        </div>

        {hotel.address && <div className="hotel-card-address">{hotel.address}</div>}

        <div className="hotel-card-meta">
          {hotel.rating_count > 0 && (
            <span className="hotel-review-count">{hotel.rating_count.toLocaleString()} reviews</span>
          )}
          {hotel.price_level != null && (
            <span className="hotel-price-level">{PRICE_LABELS[hotel.price_level] ?? ''}</span>
          )}
        </div>

        <div className="hotel-book-row">
          {hotel.links?.booking && (
            <BookBtn href={hotel.links.booking} label="Booking.com" color="#003580" />
          )}
          {hotel.links?.airbnb && (
            <BookBtn href={hotel.links.airbnb} label="Airbnb" color="#ff385c" />
          )}
          {hotel.links?.hotels && (
            <BookBtn href={hotel.links.hotels} label="Hotels.com" color="#c8102e" />
          )}
        </div>
      </div>
    </div>
  )
}
