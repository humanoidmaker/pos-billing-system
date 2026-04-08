import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Billing from '@/pages/Billing';
import Products from '@/pages/Products';
import Inventory from '@/pages/Inventory';
import Customers from '@/pages/Customers';
import Reports from '@/pages/Reports';
import Settings from '@/pages/Settings';

import Register from '@/pages/Register';
import VerifyEmail from '@/pages/VerifyEmail';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

export default function App() {
  const { isAuthenticated, fetchUser } = useAuthStore();
  useEffect(() => { if (isAuthenticated) fetchUser(); }, []);

  if (!isAuthenticated) return <Routes><Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Login />} /></Routes>;

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="billing" element={<Billing />} />
        <Route path="products" element={<Products />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="customers" element={<Customers />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
