import { useState, useEffect } from 'react';
import { api, setToken, getToken } from './api';
import { AdminUser } from './types';
import Login from './components/Login';
import Sidebar, { Tab, TAB_LABELS } from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Products from './components/Products';
import Inventory from './components/Inventory';
import Orders from './components/Orders';
import LiveMap from './components/LiveMap';
import Categories from './components/Categories';
import Offers from './components/Offers';
import Coupons from './components/Coupons';
import Users from './components/Users';
import DeliveryPartners from './components/DeliveryPartners';
import Notifications from './components/Notifications';
import Support from './components/Support';
import AppContent from './components/AppContent';

const SUBTITLES: Record<Tab, string> = {
  dashboard: 'Overview of your store performance',
  products: 'Manage your medicines & products',
  inventory: 'Track stock levels & restock alerts',
  orders: 'View, track and fulfil customer orders',
  livemap: 'Real-time delivery tracking across Amravati',
  categories: 'Organise categories & sub-categories',
  offers: 'Promotions & home banners',
  coupons: 'Discount codes and promotional conditions',
  users: 'Customers and administrators',
  delivery: 'Add & manage delivery partners',
  notifications: 'Send announcements & reminders',
  support: 'Customer support tickets',
  content: 'Health tips, brands, reviews, stores & app settings',
};

export default function App() {
  // Restore a session if a token is already stored.
  const [user, setUser] = useState<AdminUser | null>(
    getToken() ? ({ id: 0, name: 'Admin', email: '', role: 'admin' } as AdminUser) : null
  );
  const [tab, setTab] = useState<Tab>(
    () => (localStorage.getItem('medpet_admin_tab') as Tab) || 'dashboard'
  );

  // Keep the admin on the same section across refreshes.
  useEffect(() => { localStorage.setItem('medpet_admin_tab', tab); }, [tab]);

  if (!user) {
    return (
      <Login
        onLogin={async (email, password) => {
          const { token, user: u } = await api.login(email, password);
          if (u.role !== 'admin') throw new Error('This account is not an admin.');
          setToken(token);
          setUser(u);
        }}
      />
    );
  }

  const logout = () => { setToken(null); setUser(null); };

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar active={tab} onSelect={setTab} onLogout={logout} />

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between px-7 py-4 bg-white/90 backdrop-blur border-b"
          style={{ borderColor: 'var(--border)' }}>
          <div>
            <h1 className="text-xl font-extrabold text-ink">{TAB_LABELS[tab]}</h1>
            <p className="text-[13px] mt-0.5" style={{ color: 'var(--gray)' }}>{SUBTITLES[tab]}</p>
          </div>
          <div className="flex items-center gap-2 rounded-full pl-1 pr-3 py-1"
            style={{ background: 'var(--primary-soft)' }}>
            <div className="w-7 h-7 rounded-full bg-brand-500 text-white grid place-items-center text-xs font-bold">A</div>
            <span className="text-sm font-semibold" style={{ color: 'var(--primary-dark)' }}>Admin</span>
          </div>
        </header>

        <div className="container">
          {tab === 'dashboard' && <Dashboard />}
          {tab === 'products' && <Products />}
          {tab === 'inventory' && <Inventory />}
          {tab === 'orders' && <Orders />}
          {tab === 'livemap' && <LiveMap />}
          {tab === 'categories' && <Categories />}
          {tab === 'offers' && <Offers />}
          {tab === 'coupons' && <Coupons />}
          {tab === 'users' && <Users />}
          {tab === 'delivery' && <DeliveryPartners />}
          {tab === 'notifications' && <Notifications />}
          {tab === 'support' && <Support />}
          {tab === 'content' && <AppContent />}
        </div>
      </div>
    </div>
  );
}
