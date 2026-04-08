import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { IndianRupee, ShoppingCart, Package, Users, TrendingUp } from 'lucide-react';
import api from '@/lib/api';
import { formatCurrency, formatDate, formatTime } from '@/lib/utils';

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [weeklyRevenue, setWeeklyRevenue] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [recentBills, setRecentBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/bills/stats')
      .then(r => {
        setStats(r.data.stats);
        setWeeklyRevenue(r.data.weekly_revenue || []);
        setTopProducts(r.data.top_products || []);
        setRecentBills(r.data.recent_bills || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-accent border-t-transparent rounded-full" /></div>;

  const cards = [
    { label: "Today's Revenue", value: formatCurrency(stats?.today_revenue || 0), icon: IndianRupee, color: 'bg-emerald-500' },
    { label: "Today's Bills", value: stats?.today_bills || 0, icon: ShoppingCart, color: 'bg-blue-500' },
    { label: "Total Products", value: stats?.total_products || 0, icon: Package, color: 'bg-purple-500' },
    { label: "Total Customers", value: stats?.total_customers || 0, icon: Users, color: 'bg-orange-500' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <div key={c.label} className="bg-white rounded-xl border p-5 flex items-start gap-4">
            <div className={`${c.color} rounded-lg p-2.5 text-white`}><c.icon className="h-5 w-5" /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{c.value}</p>
              <p className="text-sm text-gray-500">{c.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-accent" /> Last 7 Days Revenue</h3>
          {weeklyRevenue.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={weeklyRevenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(v: string) => { const d = new Date(v + 'T00:00:00'); return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }); }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => [formatCurrency(v), 'Revenue']} labelFormatter={(l: string) => { const d = new Date(l + 'T00:00:00'); return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }); }} />
                <Bar dataKey="revenue" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400 py-12 text-center">No revenue data yet. Create some bills to see the chart.</p>
          )}
        </div>

        {/* Top Selling Products */}
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-semibold mb-4">Top Selling Products</h3>
          {topProducts.length > 0 ? (
            <div className="space-y-3">
              {topProducts.slice(0, 8).map((p, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-400 w-5">#{i + 1}</span>
                    <span className="text-sm text-gray-800 truncate max-w-[140px]">{p.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-gray-500">{p.qty} sold</span>
                    <p className="text-xs font-medium text-accent">{formatCurrency(p.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-8 text-center">No sales data yet.</p>
          )}
        </div>
      </div>

      {/* Recent Bills */}
      <div className="bg-white rounded-xl border p-5">
        <h3 className="font-semibold mb-4">Recent Bills</h3>
        {recentBills.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-2 font-medium">Bill #</th>
                  <th className="py-2 font-medium">Date</th>
                  <th className="py-2 font-medium">Items</th>
                  <th className="py-2 font-medium">Payment</th>
                  <th className="py-2 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {recentBills.map(b => (
                  <tr key={b.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2.5 font-mono text-xs">{b.bill_number}</td>
                    <td className="py-2.5 text-gray-600">{formatDate(b.created_at)} {formatTime(b.created_at)}</td>
                    <td className="py-2.5">{b.items?.length || 0} items</td>
                    <td className="py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        b.payment_method === 'cash' ? 'bg-green-100 text-green-700' :
                        b.payment_method === 'upi' ? 'bg-blue-100 text-blue-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>{b.payment_method?.toUpperCase()}</span>
                    </td>
                    <td className="py-2.5 text-right font-semibold">{formatCurrency(b.grand_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400 py-4 text-center">No bills yet.</p>
        )}
      </div>
    </div>
  );
}
