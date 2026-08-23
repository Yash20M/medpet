import { Product } from '../types';

const rupee = (n: number) => `₹${n.toLocaleString('en-IN')}`;

interface Props {
  product: Product;
  onBack: () => void;
  onEdit: (p: Product) => void;
  onDelete: (id: number) => void;
}

export default function ProductDetail({ product: p, onBack, onEdit, onDelete }: Props) {
  const low = p.stock_quantity <= p.low_stock_threshold;

  return (
    <div>
      <div className="section-head">
        <button className="btn ghost" onClick={onBack}>← Back to products</button>
        <div className="actions">
          <button className="btn" onClick={() => onEdit(p)}>Edit</button>
          <button className="btn gray" onClick={() => onDelete(p.id)}>Delete</button>
        </div>
      </div>

      <div className="od-grid">
        <div className="card">
          {p.image_url
            ? <img className="pd-image" src={p.image_url} alt={p.name} />
            : <div className="pd-image pd-emoji">{p.emoji}</div>}
        </div>

        <div className="od-side">
          <div className="card">
            <div className="od-id">{p.name}</div>
            <div className="muted" style={{ marginBottom: 12 }}>{p.brand || '—'} · {p.category_name ?? 'Uncategorised'}</div>

            <div className="pd-price">
              <strong>{rupee(p.discount_price)}</strong>
              {p.discount_percent > 0 && <>
                <span className="strike">{rupee(p.original_price)}</span>
                <span className="tag red">{p.discount_percent}% OFF</span>
              </>}
            </div>

            <div className="pd-flags">
              {p.is_featured && <span className="tag green">Featured</span>}
              {p.in_stock ? <span className="tag gray">In stock</span> : <span className="tag red">Out of stock</span>}
              {low && <span className="tag red">Low stock</span>}
            </div>
          </div>

          <div className="card">
            <h2>Inventory &amp; Ratings</h2>
            <div className="detail-line"><span className="muted">Stock quantity</span><strong>{p.stock_quantity}</strong></div>
            <div className="detail-line"><span className="muted">Low-stock alert below</span><span>{p.low_stock_threshold}</span></div>
            <div className="detail-line"><span className="muted">Rating</span><span>⭐ {p.rating} ({p.reviews_count} reviews)</span></div>
            <div className="detail-line"><span className="muted">Product ID</span><span>#{p.id}</span></div>
            <div className="detail-line"><span className="muted">Added</span><span>{new Date(p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h2>Description</h2>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--ink)' }}>{p.description || <span className="muted">No description.</span>}</p>
      </div>
    </div>
  );
}
