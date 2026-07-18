'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Check if already logged in on mount
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push('/admin/dashboard');
      }
    };
    checkUser();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email.trim() || !password.trim()) {
      setError('Email dan Password wajib diisi.');
      return;
    }

    setLoading(true);
    try {
      const { data, error: loginErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (loginErr) {
        setError(loginErr.message || 'Login gagal. Periksa kembali email dan password Anda.');
        setLoading(false);
        return;
      }

      router.push('/admin/dashboard');
    } catch (err) {
      console.error(err);
      setError('Terjadi kesalahan koneksi saat login.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f2f4fc] flex flex-col justify-between font-sans text-slate-800">
      
      {/* 1. TOP HEADER BAR */}
      <header className="w-full bg-[#f2f4fc] px-6 sm:px-12 h-16 flex items-center justify-between border-b border-transparent select-none shrink-0">
        <Link href="/" className="flex items-center gap-1">
          <span className="font-headline-md text-[#0047e1] font-black text-sm uppercase tracking-tight select-none">
            Holiday Sport
          </span>
        </Link>
        <button 
          type="button" 
          onClick={() => alert('Butuh bantuan? Silakan hubungi tim IT Holiday Sport untuk panduan operasional.')}
          className="p-2 rounded-full hover:bg-slate-200 text-slate-500 transition-colors flex items-center justify-center"
          title="Bantuan"
        >
          <span className="material-symbols-outlined text-xl">help_outline</span>
        </button>
      </header>

      {/* 2. MAIN LOGIN CONTAINER */}
      <main className="flex-grow flex flex-col justify-center items-center px-4 py-8 shrink-0">
        <div className="w-full max-w-[420px] bg-white border border-[#e4e6f2] rounded-2xl p-8 shadow-sm space-y-6 text-[#1c1e28] transition-transform duration-300 hover:shadow-md">
          
          {/* Dashboard/Grid Blue Icon Container */}
          <div className="text-center space-y-4 select-none">
            <div className="w-12 h-12 bg-[#0047e1] text-white rounded-lg flex items-center justify-center mx-auto shadow-sm">
              <span className="material-symbols-outlined text-2xl font-bold">grid_view</span>
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                Admin Login
              </h2>
              <p className="text-[11px] text-slate-500 leading-relaxed px-4">
                Welcome back. Please enter your credentials to access the Holiday Sport command center.
              </p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email field */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-[10px] font-black tracking-wider text-slate-600 block uppercase select-none">
                Email Address
              </label>
              <div className="flex items-center border border-[#e0e2ee] rounded-lg px-3 bg-white focus-within:border-[#0047e1] focus-within:ring-1 focus-within:ring-[#0047e1] transition-all">
                <span className="material-symbols-outlined text-slate-400 text-lg mr-2 select-none">mail</span>
                <input
                  type="email"
                  id="email"
                  placeholder="admin@holidaysport.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full py-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none bg-transparent"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password field */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-[10px] font-black tracking-wider text-slate-600 block uppercase select-none">
                Password
              </label>
              <div className="flex items-center border border-[#e0e2ee] rounded-lg px-3 bg-white focus-within:border-[#0047e1] focus-within:ring-1 focus-within:ring-[#0047e1] transition-all">
                <span className="material-symbols-outlined text-slate-400 text-lg mr-2 select-none">lock</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full py-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none bg-transparent"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-slate-400 hover:text-slate-600 ml-2 focus:outline-none flex items-center justify-center"
                  title={showPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                >
                  <span className="material-symbols-outlined text-lg select-none">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between text-xs font-semibold select-none pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer text-slate-600">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-[#d0d2dd] text-[#0047e1] focus:ring-[#0047e1] w-4 h-4 cursor-pointer"
                />
                Remember Me
              </label>
              <button
                type="button"
                onClick={() => alert('Fitur pemulihan kata sandi dinonaktifkan. Silakan hubungi tim IT Administrator.')}
                className="text-[#0047e1] hover:underline"
              >
                Forgot Password?
              </button>
            </div>

            {error && (
              <div className="text-xs text-[#ff3b30] bg-[#fff5f5] p-2.5 rounded-lg border border-[#ffcdcd] flex items-center gap-1.5 select-none">
                <span className="material-symbols-outlined text-sm shrink-0">error</span>
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#0047e1] hover:bg-[#0038b3] disabled:bg-slate-200 text-white font-bold text-xs rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2 uppercase tracking-wider cursor-pointer"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Card Footer Divider */}
          <div className="border-t border-[#efeff6] pt-4 text-center select-none">
            <p className="text-[11px] text-slate-500">
              Trouble accessing your account?{' '}
              <a 
                href="https://wa.me/6281234567890" 
                target="_blank" 
                rel="noreferrer" 
                className="text-[#0047e1] font-bold hover:underline"
              >
                Contact System Admin
              </a>
            </p>
          </div>
        </div>

        {/* Small icons below card */}
        <div className="flex justify-center gap-4 text-slate-400/80 pt-6 select-none shrink-0">
          <span className="material-symbols-outlined text-base">settings</span>
          <span className="material-symbols-outlined text-base">sports_tennis</span>
          <span className="material-symbols-outlined text-base">stadium</span>
        </div>
      </main>

      {/* 3. BOTTOM FOOTER BAR */}
      <footer className="w-full bg-[#f2f4fc] border-t border-[#e2e4ee] px-6 sm:px-12 py-4 flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-500 gap-2 shrink-0 select-none font-medium">
        <div>
          <span className="font-extrabold text-[#0047e1]">Holiday Sport</span>
          <span className="ml-1">&copy; 2024 Holiday Sport. All rights reserved.</span>
        </div>
        <div className="flex gap-4 sm:gap-6 font-semibold">
          <button type="button" onClick={() => alert('Kebijakan Privasi Holiday Sport.')} className="hover:underline">Privacy Policy</button>
          <button type="button" onClick={() => alert('Syarat & Ketentuan Layanan.')} className="hover:underline">Terms of Service</button>
          <button type="button" onClick={() => alert('Sistem Keamanan Portal.')} className="hover:underline">Security</button>
        </div>
      </footer>
    </div>
  );
}
