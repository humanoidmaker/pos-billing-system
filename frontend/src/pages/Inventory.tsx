import { useState, useEffect } from 'react';
import { Warehouse, AlertTriangle, ArrowUpDown, X, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function Inventory() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adjustTarget, setAdjustTarget] = useState<any>(null);
  const [adjustment, setAdjustment] = useState(0);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.get('/products').then(r => {
      const sorted = (r.data.products || []).sort((a: any, b: any) => a.stock - b.stock);
      setProducts(sorted);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const submitAdjustment = async () => {
    if (adjustment === 0) { toast.error('Enter a non-zero adjustment'); return; }
    setSaving(true);
    try {
      await api.put(`/products/${adjustTarget.id}/stock`, { adjustment, reason });
      toast.success(`Stock adjusted by ${adjustment > 0 ? '+' : ''}${adjustment}`);
      setAdjustTarget(null);
      setAdjustment(0);
      setReason('');
      load();
    } catch {
      toast.error('Failed to adjust stock');
    } finally { setSaving(false); }
  };

  const stockColor = (p: any) => {
    if (p.stock <= 0) return 'border-l-red-500 bg-red-50/50';
    if (p.stock <= (p.min_stock || 10)) return 'border-l-amber-500 bg-amber-50/50';
    return 'border-l-green-500';
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;

  const lowStockCount = products.filter(p => p.stock <= (p.min_stock || 10)).length;
  const outOfStock = products.filter(p => p.stock <= 0).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Warehouse className="h-6 w-6 text-accent" /> Inventory</h2>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">Total Products</p>
          <p className="text-xl font-bold text-gray-900">{products.length}</p>
        </div>
        <div className="bg-white rounded-xl border p-4 border-l-4 border-l-amber-500">
          <p className="text-sm text-gray-500">Low Stock</p>
          <p className="text-xl font-bold text-amber-600">{lowStockCount}</p>
        </div>
        <div className="bg-white rounded-xl border p-4 border-l-4 border-l-red-500">
          <p className="text-sm text-gray-500">Out of Stock</p>
          <p className="text-xl font-bold text-red-600">{outOfStock}</p>
        </div>
      </div>

      {/* Alerts */}
      {lowStockCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">Stock Alert</p>
            <p className="text-sm text-amber-600">{lowStockCount} products are at or below minimum stock level. {outOfStock > 0 && `${outOfStock} are completely out of stock.`}</p>
          </div>
        </div>
      )}

      {/* Products List */}
      <div className="space-y-2">
        {products.map(p => (
          <div key={p.id} className={`bg-white border rounded-xl p-4 flex items-center gap-4 border-l-4 ${stockColor(p)}`}>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900">{p.name}</p>
              <p className="text-xs text-gray-500">{p.sku} | {p.category} | {formatCurrency(p.price)}</p>
            </div>
            <div className="text-center px-4">
              <p className={`text-lg font-bold ${p.stock <= 0 ? 'text-red-600' : p.stock <= (p.min_stock || 10) ? 'text-amber-600' : 'text-green-600'}`}>
                {p.stock}
              </p>
              <p className="text-[10px] text-gray-400">in stock</p>
            </div>
            <div className="text-center px-4">
              <p className="text-sm text-gray-500">{p.min_stock || 10}</p>
              <p className="text-[10px] text-gray-400">min level</p>
            </div>
            {/* Stock bar */}
            <div className="w-24">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${p.stock <= 0 ? 'bg-red-500' : p.stock <= (p.min_stock || 10) ? 'bg-amber-500' : 'bg-green-500'}`}
                  style={{ width: `${Math.min(100, (p.stock / Math.max(p.min_stock || 10, 1)) * 50)}%` }}
                />
              </div>
            </div>
            <button onClick={() => { setAdjustTarget(p); setAdjustment(0); setReason(''); }} className="flex items-center gap-1 px-3 py-1.5 border rounded-lg text-xs hover:bg-gray-50">
              <ArrowUpDown className="h-3 w-3" /> Adjust
            </button>
          </div>
        ))}
      </div>

      {/* Adjustment Modal */}
      {adjustTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h3 className="font-semibold">Adjust Stock</h3>
              <button onClick={() => setAdjustTarget(null)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="font-medium text-gray-900">{adjustTarget.name}</p>
                <p className="text-sm text-gray-500">Current stock: {adjustTarget.stock}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Adjustment (+/-)</label>
                <div className="flex gap-2">
                  <button onClick={() => setAdjustment(a => a - 1)} className="px-3 py-2 border rounded-lg hover:bg-gray-50 font-bold">-</button>
                  <input type="number" value={adjustment} onChange={e => setAdjustment(parseInt(e.target.value) || 0)} className="flex-1 px-3 py-2 border rounded-lg text-center text-sm outline-none focus:ring-2 focus:ring-accent/30" />
                  <button onClick={() => setAdjustment(a => a + 1)} className="px-3 py-2 border rounded-lg hover:bg-gray-50 font-bold">+</button>
                </div>
                <p className="text-xs text-gray-400 mt-1">New stock: {adjustTarget.stock + adjustment}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g., New shipment received" className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent/30" />
              </div>
            </div>
            <div className="flex gap-2 px-5 py-3 border-t">
              <button onClick={submitAdjustment} disabled={saving || adjustment === 0} className="flex-1 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {saving ? 'Saving...' : 'Apply Adjustment'}
              </button>
              <button onClick={() => setAdjustTarget(null)} className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
