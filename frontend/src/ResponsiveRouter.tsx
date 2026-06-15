import { useState, useEffect, lazy, Suspense } from 'react';
import App from './App';
import { Loader2 } from 'lucide-react';

const MobileApp = lazy(() => import('./mobile/MobileApp'));

export default function ResponsiveRouter() {
    const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768);

    useEffect(() => {
        let timeoutId: any;
        const handleResize = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                setIsMobile(window.innerWidth < 768);
            }, 150);
        };

        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            clearTimeout(timeoutId);
        };
    }, []);

    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
            </div>
        }>
            {isMobile ? <MobileApp /> : <App />}
        </Suspense>
    );
}
