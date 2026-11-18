import { StrictMode } from 'react'
import { ConfigProvider } from 'antd'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const theme = { token: { colorPrimary: '#4cb4b3', borderRadius: 10, fontFamily: 'Arial, sans-serif' } };
ConfigProvider.config({ holderRender: (children) => <ConfigProvider theme={theme}>{children}</ConfigProvider> });

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ConfigProvider theme={theme}><App /></ConfigProvider>
  </StrictMode>,
)
