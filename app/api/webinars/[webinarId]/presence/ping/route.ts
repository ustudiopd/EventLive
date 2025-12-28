import { createServerSupabase } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Presence Ping API
 * 라이브 웨비나 참가자가 주기적으로 호출하여 접속 상태를 업데이트
 * 
 * POST /api/webinars/[webinarId]/presence/ping
 * - 인증 필수
 * - Body 없음
 * - 응답: 204 No Content
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ webinarId: string }> }
) {
  try {
    const { webinarId } = await params
    const supabase = await createServerSupabase()

    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    // 웨비나 등록 확인 (RLS 정책에서도 체크하지만, 명시적으로 확인)
    const { data: registration, error: regError } = await supabase
      .from('registrations')
      .select('id')
      .eq('webinar_id', webinarId)
      .eq('user_id', user.id)
      .single()

    if (regError || !registration) {
      return NextResponse.json(
        { success: false, error: '웨비나에 등록되지 않았습니다.' },
        { status: 403 }
      )
    }

    // RPC 함수 호출 (60초 이내 중복 업데이트 억제 포함)
    const { error: rpcError } = await supabase.rpc('webinar_presence_ping', {
      _webinar_id: webinarId,
    })

    if (rpcError) {
      console.error('[Presence Ping] RPC 오류:', rpcError)
      return NextResponse.json(
        { success: false, error: 'Presence 업데이트 실패' },
        { status: 500 }
      )
    }

    // 성공: 204 No Content
    return new NextResponse(null, { status: 204 })
  } catch (error: any) {
    console.error('[Presence Ping] 오류:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}




