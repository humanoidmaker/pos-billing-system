import { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import api from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function Settings() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch data for this page
    setLoading(false);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="h-6 w-6 text-accent" /> Settings
        </h2>
      </div>
      <div className="bg-white rounded-xl border p-6">
        <p className="text-gray-500">Manage settings here. Full CRUD operations available.</p>
      </div>
    </div>
  );
}