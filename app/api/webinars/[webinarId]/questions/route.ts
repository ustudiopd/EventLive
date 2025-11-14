import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/guards'
import { createAdminSupabase } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * 웨비나 질문 목록 조회 (프로필 정보 포함)
 * 같은 웨비나에 등록된 사용자는 모두 조회 가능
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ webinarId: string }> }
) {
  try {
    const { webinarId } = await params
    const { searchParams } = new URL(req.url)
    const showOnlyMine = searchParams.get('onlyMine') === 'true'
    const filter = searchParams.get('filter') || 'all'
    
    const { user } = await requireAuth()
    const admin = createAdminSupabase()
    
    // 웨비나 존재 확인
    const { data: webinar, error: webinarError } = await admin
      .from('webinars')
      .select('id')
      .eq('id', webinarId)
      .single()
    
    if (webinarError || !webinar) {
      return NextResponse.json(
        { error: 'Webinar not found' },
        { status: 404 }
      )
    }
    
    // 질문 조회 쿼리 구성
    let query = admin
      .from('questions')
      .select(`
        id,
        user_id,
        content,
        status,
        created_at,
        answered_by,
        answered_at,
        answer
      `)
      .eq('webinar_id', webinarId)
    
    if (showOnlyMine) {
      query = query.eq('user_id', user.id)
    }
    
    if (filter === 'published') {
      query = query.eq('status', 'published')
    } else if (filter === 'answered') {
      query = query.eq('status', 'answered')
    } else if (filter === 'pinned') {
      query = query.eq('status', 'pinned')
    } else {
      query = query.neq('status', 'hidden')
    }
    
    const { data: questions, error: questionsError } = await query
      .order('created_at', { ascending: false })
    
    if (questionsError) {
      return NextResponse.json(
        { error: questionsError.message },
        { status: 500 }
      )
    }
    
    // 프로필 정보를 별도로 조회 (RLS 우회)
    const userIds = [...new Set((questions || []).map((q: any) => q.user_id))]
    const profilesMap = new Map()
    
    if (userIds.length > 0) {
      const { data: profiles } = await admin
        .from('profiles')
        .select('id, display_name, email')
        .in('id', userIds)
      
      if (profiles) {
        profiles.forEach((p: any) => {
          profilesMap.set(p.id, p)
        })
      }
    }
    
    // 질문과 프로필 정보 결합
    const formattedQuestions = (questions || []).map((q: any) => ({
      id: q.id,
      user_id: q.user_id,
      content: q.content,
      status: q.status,
      created_at: q.created_at,
      answered_by: q.answered_by,
      answered_at: q.answered_at,
      answer: q.answer,
      user: profilesMap.get(q.user_id) || null,
    }))
    
    // 고정된 질문을 맨 위로
    const sorted = formattedQuestions.sort((a, b) => {
      if (a.status === 'pinned' && b.status !== 'pinned') return -1
      if (a.status !== 'pinned' && b.status === 'pinned') return 1
      return 0
    })
    
    return NextResponse.json({ questions: sorted })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

