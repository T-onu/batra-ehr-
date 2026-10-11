import { createClient } from '@supabase/supabase-js'
const url=import.meta.env.VITE_SUPABASE_URL, key=import.meta.env.VITE_SUPABASE_ANON_KEY
export const configured=Boolean(url&&key)
export const supabase=configured?createClient(url,key):null
export const inr=n=>'₹'+Number(n||0).toLocaleString('en-IN')
export const today=()=>new Date().toISOString().slice(0,10)
