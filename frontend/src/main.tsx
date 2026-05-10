import React from 'react'
import ReactDOM from 'react-dom/client'
import ResponsiveRouter from './ResponsiveRouter.tsx'
import Gatekeeper from './components/Gatekeeper.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <Gatekeeper>
            <ResponsiveRouter />
        </Gatekeeper>
    </React.StrictMode>,
)
