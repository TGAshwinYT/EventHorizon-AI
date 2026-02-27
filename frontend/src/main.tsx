import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import Gatekeeper from './components/Gatekeeper.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <Gatekeeper>
            <App />
        </Gatekeeper>
    </React.StrictMode>,
)
