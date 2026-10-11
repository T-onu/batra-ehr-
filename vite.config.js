import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
export default defineConfig({ plugins:[react(), VitePWA({
  registerType:'autoUpdate', includeAssets:['logo.png','apple-touch-icon.png'],
  manifest:{ name:'Batra Eye Hospital EHR', short_name:'Batra EHR', description:'Batra Eye Hospital, Mukerian - Digital EHR',
    theme_color:'#0b1a4a', background_color:'#f4f6fb', display:'standalone', start_url:'/',
    icons:[{src:'pwa-192.png',sizes:'192x192',type:'image/png'},{src:'pwa-512.png',sizes:'512x512',type:'image/png',purpose:'any maskable'}] },
  workbox:{ navigateFallback:'/index.html' } })] })
