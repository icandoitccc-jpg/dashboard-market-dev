import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // 提前报错，避免出现"看起来能用但其实数据存不进去"的静默失败
  // eslint-disable-next-line no-console
  console.error('缺少 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 环境变量')
}

export const supabase = createClient(url, anonKey)
