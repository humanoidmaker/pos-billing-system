import { useState, useEffect, useRef } from 'react';
import { ShoppingCart, Search, Plus, Minus, Trash2, X, Printer, CreditCard, Smartphone, Banknote, User } from 'lucide-react';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import toast from 'react-hot-toast';

interface CartItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  discount: number;
  tax_rate: number;
  stock: number;
}

export default function Billing() {
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerPhone, setCustomerPhone] = useState('');
  const [customer, setCustomer] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptHtml, setReceiptHtml] = useState('');
  const [lastBill, setLastBill] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProducts();
    api.get('/categories').then(r => setCategories(r.data.categories || [])).catch(() => {});
  }, []);

  useEffect(() => {
    loadProducts();
  }, [search, selectedCategory]);

  const loadProducts = () => {
    const params: any = {};
    if (search) params.q = search;
    if (selectedCategory) params.category = selectedCategory;
    api.get('/products', { params }).then(r => setProducts(r.data.products || [])).catch(() => {});
  };

  const addToCart = (product: any) => {
    if (product.stock <= 0) {
      toast.error('Out of stock!');
      return;
    }
    setCart(prev => {
      const existing = prev.find(c => c.product_id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          toast.error('Not enough stock!');
          return prev;
        }
        return prev.map(c => c.product_id === product.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, {
        product_id: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        discount: 0,
        tax_rate: product.tax_rate || 18,
        stock: product.stock,
      }];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart(prev => prev.map(c => {
      if (c.product_id !== productId) return c;
      const newQty = c.quantity + delta;
      if (newQty <= 0) return c;
      if (newQty > c.stock) { toast.error('Not enough stock!'); return c; }
      return { ...c, quantity: newQty };
    }));
  };

  const updateDiscount = (productId: string, discount: number) => {
    setCart(prev => prev.map(c => c.product_id === productId ? { ...c, discount: Math.max(0, discount) } : c));
  };

  const removeItem = (productId: string) => {
    setCart(prev => prev.filter(c => c.product_id !== productId));
  };

  const searchCustomer = async () => {
    if (!customerPhone.trim()) return;
    try {
      const { data } = await api.get('/customers/search', { params: { q: customerPhone } });
      if (data.customers?.length) {
        setCustomer(data.customers[0]);
        toast.success(`Customer found: ${data.customers[0].name}`);
      } else {
        setCustomer(null);
        toast.error('Customer not found');
      }
    } catch {
      toast.error('Search failed');
    }
  };

  const subtotal = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);
  const totalDiscount = cart.reduce((sum, c) => sum + c.discount, 0);
  const totalTax = cart.reduce((sum, c) => {
    const line = (c.price * c.quantity) - c.discount;
    return sum + round2(line * c.tax_rate / 100);
  }, 0);
  const grandTotal = round2(subtotal - totalDiscount + totalTax);

  function round2(n: number) { return Math.round(n * 100) / 100; }

  const generateBill = async () => {
    if (cart.length === 0) { toast.error('Cart is empty!'); return; }
    setSubmitting(true);
    try {
      const items = cart.map(c => ({
        product_id: c.product_id,
        name: c.name,
        quantity: c.quantity,
        price: c.price,
        discount: c.discount,
        tax_rate: c.tax_rate,
      }));
      const payload: any = { items, payment_method: paymentMethod };
      if (customer) payload.customer_id = customer.id;
      const { data } = await api.post('/bills', payload);
      setLastBill(data.bill);
      toast.success(`Bill ${data.bill.bill_number} generated!`);
      // Fetch receipt HTML
      const receiptRes = await api.get(`/bills/receipt/${data.bill.id}`);
      setReceiptHtml(receiptRes.data.html);
      setShowReceipt(true);
      setCart([]);
      setCustomer(null);
      setCustomerPhone('');
      loadProducts();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to generate bill');
    } finally {
      setSubmitting(false);
    }
  };

  const printReceipt = () => {
    const w = window.open('', '_blank', 'width=350,height=600');
    if (w) {
      w.document.write(receiptHtml);
      w.document.close();
      w.focus();
      w.print();
    }
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)]">
      {/* Left: Product Grid */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input ref={searchRef} type="text" placeholder="Search products by name, SKU, or barcode..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none" autoFocus />
          </div>
          <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} className="border rounded-lg px-3 py-2 text-sm min-w-[140px] outline-none focus:ring-2 focus:ring-accent/30">
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {products.map(p => (
              <button key={p.id} onClick={() => addToCart(p)} className={`bg-white border rounded-xl p-3 text-left hover:border-accent hover:shadow-sm transition-all ${p.stock <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={p.stock <= 0}>
                <p className="font-medium text-sm text-gray-900 truncate">{p.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{p.sku}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-bold text-accent">{formatCurrency(p.price)}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${p.stock <= 0 ? 'bg-red-100 text-red-600' : p.stock <= (p.min_stock || 10) ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
                    {p.stock <= 0 ? 'Out' : `${p.stock} in stock`}
                  </span>
                </div>
              </button>
            ))}
            {products.length === 0 && <p className="col-span-full text-center text-sm text-gray-400 py-8">No products found.</p>}
          </div>
        </div>
      </div>

      {/* Right: Cart / Bill */}
      <div className="w-[420px] bg-white border rounded-xl flex flex-col shrink-0">
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-accent" />
          <span className="font-semibold text-sm">Current Bill</span>
          <span className="ml-auto text-xs text-gray-400">{cart.length} items</span>
        </div>

        {/* Customer */}
        <div className="px-4 py-2 border-b">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input type="text" placeholder="Customer phone (optional)" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchCustomer()} className="w-full pl-8 pr-3 py-1.5 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/30" />
            </div>
            <button onClick={searchCustomer} className="px-2.5 py-1.5 bg-gray-100 rounded-lg text-xs hover:bg-gray-200">Find</button>
          </div>
          {customer && <p className="text-xs text-green-600 mt-1">Customer: {customer.name} ({customer.loyalty_points} pts)</p>}
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {cart.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-12">Click products to add to bill</p>
          ) : (
            <div className="space-y-3">
              {cart.map(item => {
                const lineSubtotal = item.price * item.quantity;
                const lineTax = round2((lineSubtotal - item.discount) * item.tax_rate / 100);
                const lineTotal = round2(lineSubtotal - item.discount + lineTax);
                return (
                  <div key={item.product_id} className="border rounded-lg p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-gray-900 flex-1">{item.name}</p>
                      <button onClick={() => removeItem(item.product_id)} className="text-red-400 hover:text-red-600 p-0.5"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center border rounded-lg">
                        <button onClick={() => updateQty(item.product_id, -1)} className="px-2 py-1 hover:bg-gray-100 rounded-l-lg"><Minus className="h-3 w-3" /></button>
                        <span className="px-2 text-sm font-medium min-w-[24px] text-center">{item.quantity}</span>
                        <button onClick={() => updateQty(item.product_id, 1)} className="px-2 py-1 hover:bg-gray-100 rounded-r-lg"><Plus className="h-3 w-3" /></button>
                      </div>
                      <span className="text-xs text-gray-500">x {formatCurrency(item.price)}</span>
                      <div className="flex items-center gap-1 ml-auto">
                        <span className="text-[10px] text-gray-400">Disc:</span>
                        <input type="number" min={0} value={item.discount} onChange={e => updateDiscount(item.product_id, parseFloat(e.target.value) || 0)} className="w-14 px-1.5 py-0.5 border rounded text-xs text-right outline-none focus:ring-1 focus:ring-accent/30" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-1.5 text-xs text-gray-500">
                      <span>Tax ({item.tax_rate}%): {formatCurrency(lineTax)}</span>
                      <span className="font-semibold text-gray-900">{formatCurrency(lineTotal)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="border-t px-4 py-3 space-y-1.5 text-sm">
          <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
          {totalDiscount > 0 && <div className="flex justify-between text-red-500"><span>Discount</span><span>-{formatCurrency(totalDiscount)}</span></div>}
          <div className="flex justify-between text-gray-600"><span>GST</span><span>{formatCurrency(totalTax)}</span></div>
          <div className="flex justify-between font-bold text-lg pt-1 border-t"><span>Grand Total</span><span className="text-accent">{formatCurrency(grandTotal)}</span></div>
        </div>

        {/* Payment */}
        <div className="border-t px-4 py-3">
          <p className="text-xs text-gray-500 mb-2">Payment Method</p>
          <div className="flex gap-2 mb-3">
            {[
              { id: 'cash', label: 'Cash', icon: Banknote },
              { id: 'upi', label: 'UPI', icon: Smartphone },
              { id: 'card', label: 'Card', icon: CreditCard },
            ].map(pm => (
              <button key={pm.id} onClick={() => setPaymentMethod(pm.id)} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border transition-all ${paymentMethod === pm.id ? 'border-accent bg-accent/10 text-accent' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                <pm.icon className="h-3.5 w-3.5" />{pm.label}
              </button>
            ))}
          </div>
          <button onClick={generateBill} disabled={cart.length === 0 || submitting} className="w-full py-2.5 bg-accent text-white rounded-lg font-semibold text-sm hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            {submitting ? 'Processing...' : `Generate Bill - ${formatCurrency(grandTotal)}`}
          </button>
        </div>
      </div>

      {/* Receipt Modal */}
      {showReceipt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="font-semibold">Receipt - {lastBill?.bill_number}</h3>
              <button onClick={() => setShowReceipt(false)}><X className="h-5 w-5 text-gray-400 hover:text-gray-600" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div dangerouslySetInnerHTML={{ __html: receiptHtml }} />
            </div>
            <div className="flex gap-2 px-4 py-3 border-t">
              <button onClick={printReceipt} className="flex-1 flex items-center justify-center gap-2 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90">
                <Printer className="h-4 w-4" /> Print Receipt
              </button>
              <button onClick={() => setShowReceipt(false)} className="flex-1 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
