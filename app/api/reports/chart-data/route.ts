import { NextResponse } from 'next/server'
import { requireAgencyMember } from '@/lib/auth/guards'
import { createServerSupabase } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const agencyId = searchParams.get('agencyId')
    const clientId = searchParams.get('clientId')
    
    if (!agencyId) {
      return NextResponse.json(
        { error: 'agencyId is required' },
        { status: 400 }
      )
    }
    
    // 권한 확인
    await requireAgencyMember(agencyId)
    
    const supabase = await createServerSupabase()
    
    // 웨비나 조회
    let webinarsQuery = supabase
      .from('webinars')
      .select('id, created_at, client_id')
      .eq('agency_id', agencyId)
    
    if (clientId) {
      webinarsQuery = webinarsQuery.eq('client_id', clientId)
    }
    
    const { data: webinars } = await webinarsQuery
    
    // 최근 6개월 데이터 생성
    const months: string[] = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push(date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short' }))
    }
    
    const chartData = months.map((month, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1)
      const nextDate = new Date(now.getFullYear(), now.getMonth() - (5 - index) + 1, 1)
      
      // 해당 월의 웨비나
      const monthWebinars = webinars?.filter(w => {
        const createdAt = new Date(w.created_at)
        return createdAt >= date && createdAt < nextDate
      }) || []
      
      const webinarIds = monthWebinars.map(w => w.id)
      
      return {
        month,
        webinars: monthWebinars.length,
        participants: 0, // 실제로는 registrations에서 계산 필요
        messages: 0, // 실제로는 messages에서 계산 필요
        questions: 0, // 실제로는 questions에서 계산 필요
      }
    })
    
    // 실제 데이터로 채우기 (간단한 버전)
    for (let i = 0; i < chartData.length; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      const nextDate = new Date(now.getFullYear(), now.getMonth() - (5 - i) + 1, 1)
      
      const webinarIds = chartData[i].webinars > 0 
        ? webinars?.filter(w => {
            const createdAt = new Date(w.created_at)
            return createdAt >= date && createdAt < nextDate
          }).map(w => w.id) || []
        : []
      
      if (webinarIds.length > 0) {
        // 참여자 수
        const { data: registrations } = await supabase
          .from('registrations')
          .select('user_id')
          .in('webinar_id', webinarIds)
        
        const uniqueUsers = new Set(registrations?.map(r => r.user_id) || [])
        chartData[i].participants = uniqueUsers.size
        
        // 메시지 수
        const { count: messagesCount } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .in('webinar_id', webinarIds)
        
        chartData[i].messages = messagesCount || 0
        
        // 질문 수
        const { count: questionsCount } = await supabase
          .from('questions')
          .select('id', { count: 'exact', head: true })
          .in('webinar_id', webinarIds)
        
        chartData[i].questions = questionsCount || 0
      }
    }
    
    return NextResponse.json(chartData)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

