import React from 'react'
import ReactDOM from 'react-dom/client'
import ResponsiveRouter from './ResponsiveRouter.tsx'
import Gatekeeper from './components/Gatekeeper.tsx'
import './index.css'

// Globally intercept fetch to point all /api/ requests to the external VITE_API_URL
const API_URL = import.meta.env.VITE_API_URL;
if (API_URL) {
    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
        if (typeof input === 'string' && input.startsWith('/api/')) {
            // Strip trailing slash from API_URL if exists to avoid double slashes
            const baseUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
            input = baseUrl + input;
        } else if (input instanceof URL && input.pathname.startsWith('/api/')) {
            const baseUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
            input = new URL(baseUrl + input.pathname + input.search);
        }
        return originalFetch(input, init);
    };
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <Gatekeeper>
            <ResponsiveRouter />
        </Gatekeeper>
    </React.StrictMode>,
)
