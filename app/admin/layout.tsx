'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ADMIN_MENU } from '@/lib/data/constants';
import { supabase } from '@/lib/supabase/client';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  useEffect(() => {
    if (pathname === '/admin/login') {
      return;
    }

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/admin/login');
      } else {
        setSessionLoaded(true);
      }
    };

    checkSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push('/admin/login');
      } else {
        setSessionLoaded(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router, pathname]);

  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  if (!sessionLoaded) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center font-sans text-white">
        <div className="w-10 h-10 border-4 border-[#0052ff] border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 font-semibold text-sm text-slate-400 animate-pulse">Menghubungkan Sesi Admin...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#fbf8ff]">
      {/* 1. SIDEBAR (Desktop) */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-outline-variant shrink-0 z-30">
        {/* Branding header */}
        <div className="h-16 flex items-center px-6 border-b border-outline-variant">
          <Link href="/admin/dashboard" className="flex flex-col select-none">
            <span className="font-headline-md text-lg font-bold text-[#0052ff] tracking-tight leading-none">Holiday Sport</span>
            <span className="text-[9px] font-black text-on-surface-variant/70 tracking-widest mt-1 font-label-caps leading-none uppercase">
              FACILITY MGMT
            </span>
          </Link>
        </div>

        {/* Navigation items */}
        <nav className="flex-grow py-6 px-4 space-y-1.5">
          {ADMIN_MENU.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`flex items-center gap-3.5 px-4 py-3 rounded-lg text-sm font-semibold transition-standard select-none ${
                  isActive
                    ? 'bg-[#0052ff] text-white shadow-sm'
                    : 'text-on-surface-variant hover:text-[#0052ff] hover:bg-[#f3f2ff]'
                }`}
              >
                <span className="material-symbols-outlined text-lg" data-icon={item.icon}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Admin profile card footer */}
        <div className="p-4 border-t border-outline-variant bg-slate-50">
          <div className="flex items-center gap-3 p-2 bg-white border border-outline-variant/60 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-[#dde1ff] text-[#003ec7] font-bold flex items-center justify-center select-none text-sm shadow-inner shrink-0">
              SA
            </div>
            <div className="flex flex-col flex-grow min-w-0">
              <span className="text-xs font-headline-md font-bold text-on-surface truncate">Super Admin</span>
              <button 
                onClick={async () => {
                  await supabase.auth.signOut();
                  router.push('/admin/login');
                }}
                className="text-[10px] text-[#ff3b30] hover:text-[#d6241a] font-bold text-left hover:underline mt-0.5 select-none"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* 2. MOBILE MENU OVERLAY */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* 3. MOBILE SIDEBAR (Drawer) */}
      <aside className={`fixed top-0 bottom-0 left-0 w-64 bg-white border-r border-outline-variant z-50 flex flex-col transition-transform duration-300 md:hidden ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-outline-variant">
          <div className="flex flex-col select-none">
            <span className="font-headline-md text-lg font-bold text-[#0052ff] tracking-tight">Holiday Sport</span>
            <span className="text-[8px] font-black text-on-surface-variant/70 tracking-wider mt-0.5 font-label-caps">
              FACILITY MGMT
            </span>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-1 rounded hover:bg-slate-100"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <nav className="flex-grow py-6 px-4 space-y-1">
          {ADMIN_MENU.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3.5 px-4 py-3 rounded-lg text-sm font-semibold transition-standard ${
                  isActive
                    ? 'bg-[#0052ff] text-white shadow-sm'
                    : 'text-on-surface-variant hover:text-[#0052ff] hover:bg-[#f3f2ff]'
                }`}
              >
                <span className="material-symbols-outlined text-lg" data-icon={item.icon}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-outline-variant bg-slate-50">
          <div className="flex items-center gap-3 p-2 bg-white border border-outline-variant/60 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-[#dde1ff] text-[#003ec7] font-bold flex items-center justify-center text-sm shrink-0">
              SA
            </div>
            <div className="flex flex-col flex-grow min-w-0">
              <span className="text-xs font-headline-md font-bold text-on-surface truncate">Super Admin</span>
              <button 
                onClick={async () => {
                  await supabase.auth.signOut();
                  router.push('/admin/login');
                }}
                className="text-[10px] text-[#ff3b30] hover:text-[#d6241a] font-bold text-left hover:underline mt-0.5 select-none"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* 4. MAIN LAYOUT CONTAINER */}
      <div className="flex flex-col flex-grow min-w-0">
        {/* TOPBAR */}
        <header className="h-16 bg-white border-b border-outline-variant flex items-center justify-between px-6 sticky top-0 z-20 shadow-sm">
          {/* Mobile menu trigger */}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="md:hidden p-2 rounded-lg hover:bg-slate-100 mr-2 flex items-center justify-center"
            title="Menu"
          >
            <span className="material-symbols-outlined text-2xl">menu</span>
          </button>

          {/* Search container */}
          <div className="relative max-w-md w-full hidden sm:block">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60 text-xl select-none">
              search
            </span>
            <input
              type="text"
              placeholder="Cari transaksi, lapangan, atau pengaturan..."
              className="w-full pl-10 pr-4 py-2 border border-outline-variant rounded-lg text-sm transition-standard outline-none bg-slate-50 focus:bg-white focus:border-[#0052ff] focus:ring-1 focus:ring-[#0052ff]"
            />
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-4 ml-auto">
            {/* Home portal access */}
            <Link 
              href="/"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline-variant hover:border-[#0052ff]/60 text-xs font-semibold text-on-surface-variant hover:text-[#0052ff] transition-standard select-none"
              title="Portal Publik"
            >
              <span className="material-symbols-outlined text-sm">home</span>
              Portal Publik
            </Link>

            {/* Notification bell */}
            <button className="p-2 rounded-lg hover:bg-slate-100 relative text-on-surface-variant" title="Notifikasi">
              <span className="material-symbols-outlined text-xl">notifications</span>
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-[#FF3B30] rounded-full border-2 border-white"></span>
            </button>

            {/* Help circle */}
            <button className="p-2 rounded-lg hover:bg-slate-100 text-on-surface-variant" title="Bantuan">
              <span className="material-symbols-outlined text-xl">help</span>
            </button>
          </div>
        </header>

        {/* PAGE CONTENT CONTAINER */}
        <main className="flex-grow p-6 md:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
