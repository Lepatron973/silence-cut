'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the video processing hub after a short delay
    const timer = setTimeout(() => {
      router.push('/dashboard');
    }, 2000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center text-white font-sans bg-[linear-gradient(135deg,#667eea_0%,#764ba2_100%)]">
      <div className="text-center p-8 bg-white/10 rounded-[15px] backdrop-blur-[10px] shadow-[0_8px_32px_rgba(0,0,0,0.3)] max-w-[500px] w-[90%]">
        <div className="text-5xl font-bold mb-4 bg-gradient-to-r from-[#ff6b6b] to-[#4ecdc4] bg-clip-text text-transparent">
          SilenceCut
        </div>
        <div className="text-xl mb-8 opacity-90">
          Intelligent Video Processing Platform
        </div>

        {/* Loading Spinner */}
        <div className="w-[50px] h-[50px] border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4"></div>

        <div className="text-base opacity-80 mb-6">
          Redirecting to Video Processing Hub...
        </div>

        <Link
          href="/dashboard"
          className="inline-block px-6 py-3 bg-white/20 text-white no-underline rounded-full transition-all duration-300 border border-white/30 hover:bg-white/30 hover:-translate-y-0.5 hover:shadow-lg"
        >
          Continue Manually
        </Link>
      </div>
    </div>
  );
}
