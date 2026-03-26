'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { supabase } from '@/lib/supabase';
import { SidebarContext } from '@/lib/sidebar-context';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [checking, setChecking] = useState(true);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      // Allow access in demo mode (no Supabase configured) or when logged in
      if (!session && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== 'your-anon-key-here') {
        // Only redirect if Supabase is actually configured
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        if (url && !url.includes('placeholder')) {
          router.push('/auth');
          return;
        }
      }
      setChecking(false);
    });
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center text-white">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-slate-400">Đang tải...</p>
        </div>
      </div>
    );
  }

  return (
    <SidebarContext.Provider value={{ toggle: () => setSidebarOpen(v => !v) }}>
      <div className="app-layout">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="main-content">
          {children}
        </main>
        <ConfirmDialog />
      </div>
    </SidebarContext.Provider>
  );
}
