'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/browser'

export function AutoAcceptInvites() {
  const router = useRouter()

  useEffect(() => {
    const run = async () => {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) return

      const res = await supabase.rpc('accept_my_pending_invites')
      if (res.error) {
        console.log('accept_my_pending_invites ERROR:', res.error)
      } else {
        console.log('accept_my_pending_invites OK:', res.data)
      }

      router.refresh()
    }

    run()
  }, [router])

  return null
}
