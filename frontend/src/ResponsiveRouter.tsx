import { useState, useEffect } from 'react';
import App from './App';
import MobileApp from './mobile/MobileApp';

export default function ResponsiveRouter() {
    const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Optionally check User Agent for more robust mobile detection
    // but window width is usually sufficient for responsive web apps.

    return isMobile ? <MobileApp /> : <App />;
}
