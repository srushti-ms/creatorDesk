import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'
import './detail.css'
import './popovers.css'
import './mobile-popovers.css'
import './highlight.css'

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>)
