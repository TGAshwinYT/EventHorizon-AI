import { usePageContext } from '../hooks/usePageContext';
import { Sparkles } from 'lucide-react';

export default function PageContextBanner() {
  const { pageTitle } = usePageContext();

  return (
    <div className="bg-[#eef7f2] border-b border-[#d2edd7] px-4 py-2.5 flex items-center justify-center gap-2 text-xs font-extrabold text-[#1A4731] w-full">
      <Sparkles className="h-4 w-4 text-[#F5A623] animate-pulse" />
      <span>Horizon is reading this page with you 👀: "{pageTitle || 'Dashboard'}"</span>
    </div>
  );
}
