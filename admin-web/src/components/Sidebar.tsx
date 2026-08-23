import {
  LayoutDashboard, Package, Boxes, ClipboardList, Tags,
  BadgePercent, Users as UsersIcon, Bell, LogOut, PawPrint, Ticket, Headset, Smartphone, Truck, MapPinned,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type Tab =
  | 'dashboard' | 'products' | 'inventory' | 'orders' | 'livemap'
  | 'categories' | 'offers' | 'coupons' | 'users' | 'delivery' | 'notifications' | 'support' | 'content';

interface NavItem { tab: Tab; label: string; Icon: LucideIcon; }

const NAV_ITEMS: NavItem[] = [
  { tab: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { tab: 'products', label: 'Products', Icon: Package },
  { tab: 'inventory', label: 'Inventory', Icon: Boxes },
  { tab: 'orders', label: 'Orders', Icon: ClipboardList },
  { tab: 'livemap', label: 'Live Map', Icon: MapPinned },
  { tab: 'categories', label: 'Categories', Icon: Tags },
  { tab: 'offers', label: 'Offers', Icon: BadgePercent },
  { tab: 'coupons', label: 'Coupons', Icon: Ticket },
  { tab: 'content', label: 'App Content', Icon: Smartphone },
  { tab: 'users', label: 'Users', Icon: UsersIcon },
  { tab: 'delivery', label: 'Delivery Partners', Icon: Truck },
  { tab: 'notifications', label: 'Notifications', Icon: Bell },
  { tab: 'support', label: 'Support', Icon: Headset },
];

export const TAB_LABELS: Record<Tab, string> = NAV_ITEMS.reduce(
  (acc, item) => ({ ...acc, [item.tab]: item.label }),
  {} as Record<Tab, string>
);

interface SidebarProps {
  active: Tab;
  onSelect: (tab: Tab) => void;
  onLogout: () => void;
}

export default function Sidebar({ active, onSelect, onLogout }: SidebarProps) {
  return (
    <aside className="w-60 shrink-0 bg-gradient-to-b from-brand-950 to-brand-800 text-white flex flex-col p-4">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-2 py-3 mb-1">
        <div className="w-9 h-9 rounded-xl bg-white/15 grid place-items-center">
          <PawPrint size={20} className="text-brand-200" />
        </div>
        <div>
          <div className="font-extrabold text-[17px] leading-none">MedPet</div>
          <div className="text-[11px] text-white/55 mt-1">Admin Console</div>
        </div>
      </div>

      <div className="px-3 mt-3 mb-1 text-[10px] font-bold tracking-[0.12em] text-white/40 uppercase">Menu</div>

      <nav className="flex flex-col gap-1 flex-1">
        {NAV_ITEMS.map(({ tab, label, Icon }) => {
          const isActive = active === tab;
          return (
            <button
              key={tab}
              onClick={() => onSelect(tab)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                isActive ? 'bg-white text-ink shadow-float' : 'text-white/75 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon size={18} className={isActive ? 'text-brand-600' : ''} />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      {/* User + logout */}
      <div className="mt-2 pt-3 border-t border-white/10">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <div className="w-8 h-8 rounded-full bg-brand-500 grid place-items-center text-white font-bold text-sm">A</div>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">Administrator</div>
            <div className="text-[11px] text-white/55 truncate">admin@medpet.com</div>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="mt-1 w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-white/85 hover:bg-white/10 transition"
        >
          <LogOut size={18} />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
}
