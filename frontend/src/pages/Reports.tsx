import { useState, useEffect } from 'react';
import { BarChart3, Calendar } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import api from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

const COLORS = ['#8b5cf6', '#0ea5e9', '#f59e0b', '#10b981', '#ef4444', '#ec4899'];

export default function Reports() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBills = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/bills');
      setBills(data.bills || []);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadBills(); }, []);

  // Filter bills by date range
  const filtered = bills.filter(b => {
    const d = b.created_at?.slice(0, 10);
    return d >= startDate && d <= endDate;
  });

  // Daily sales
  const dailyMap: Record<string, { revenue: number; count: number }> = {};
  filtered.forEach(b => {
    const d = b.created_at?.slice(0, 10);
    if (!dailyMap[d]) dailyMap[d] = { revenue: 0, count: 0 };
    dailyMap[d].revenue += b.grand_total || 0;
    dailyMap[d].count += 1;
  });
  const dailyData = Object.entries(dailyMap).sort().map(([date, v]) => ({ date, ...v }));

  // Product-wise
  const productMap: Record<string, { qty: number; revenue: number }> = {};
  filtered.forEach(b => {
    (b.items || []).forEach((item: any) => {
      const name = item.name || 'Unknown';
      if (!productMap[name]) productMap[name] = { qty: 0, revenue: 0 };
      productMap[name].qty += item.quantity || 0;
      productMap[name].revenue += item.total || 0;
    });
  });
  const productData = Object.entries(productMap).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 10).map(([name, v]) => ({ name: name.length > 15 ? name.slice(0, 15) + '...' : name, ...v }));

  // Payment method
  const paymentMap: Record<string, number> = {};
  filtered.forEach(b => {
    const pm = b.payment_method || 'cash';
    paymentMap[pm] = (paymentMap[pm] || 0) + (b.grand_total || 0);
  });
  const paymentData = Object.entries(paymentMap).map(([name, value]) => ({ name: name.toUpperCase(), value: Math.round(value) }));

  // Category revenue
  const catMap: Record<string, { revenue: number; qty: number }> = {};
  filtered.forEach(b => {
    (b.items || []).forEach((item: any) => {
      const cat = item.category || 'Other';
      if (!catMap[cat]) catMap[cat] = { revenue: 0, qty: 0 };
      catMap[cat].revenue += item.total || 0;
      catMap[cat].qty += item.quantity || 0;
    });
  });
  const catData = Object.entries(catMap).sort((a, b) => b[1].revenue - a[1].revenue).map(([name, v]) => ({ name, ...v }));

  const totalRevenue = filtered.reduce((s, b) => s + (b.grand_total || 0), 0);
  const totalBills = filtered.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><BarChart3 className="h-6 w-6 text-accent" /> Reports</h2>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-400" />
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-accent/30" />
          <span className="text-gray-400">to</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-accent/30" />
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border p-5">
          <p className="text-sm text-gray-500">Total Revenue (period)</p>
          <p className="text-2xl font-bold text-accent mt-1">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <p className="text-sm text-gray-500">Total Bills (period)</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalBills}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-accent border-t-transparent rounded-full" /></div>
      ) : (
        <>
          {/* Daily Sales Line Chart */}
          <div className="bg-white rounded-xl border p-5">
            <h3 className="font-semibold mb-4">Daily Sales</h3>
            {dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v: string) => { const d = new Date(v + 'T00:00:00'); return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }); }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => [formatCurrency(v), 'Revenue']} />
                  <Line type="monotone" dataKey="revenue" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-gray-400 text-center py-12">No data for selected range.</p>}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Product-wise Bar Chart */}
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-semibold mb-4">Top Products by Revenue</h3>
              {productData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={productData} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatCurrency(v)} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => [formatCurrency(v), 'Revenue']} />
                    <Bar dataKey="revenue" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-gray-400 text-center py-12">No product data.</p>}
            </div>

            {/* Payment Method Pie Chart */}
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-semibold mb-4">Payment Methods</h3>
              {paymentData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={paymentData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {paymentData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => [formatCurrency(v), 'Amount']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-gray-400 text-center py-12">No payment data.</p>}
            </div>
          </div>

          {/* Category Revenue Table */}
          {catData.length > 0 && (
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-semibold mb-4">Category Revenue</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="py-2 font-medium">Category</th>
                    <th className="py-2 font-medium text-right">Items Sold</th>
                    <th className="py-2 font-medium text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {catData.map(c => (
                    <tr key={c.name} className="border-b last:border-0">
                      <td className="py-2.5 font-medium">{c.name}</td>
                      <td className="py-2.5 text-right text-gray-600">{c.qty}</td>
                      <td className="py-2.5 text-right font-semibold text-accent">{formatCurrency(c.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
