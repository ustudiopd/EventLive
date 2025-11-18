import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * 웨비나 메시지 목록 조회 (프로필 정보 포함)
 * 같은 웨비나에 등록된 사용자는 모두 조회 가능
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ webinarId: string }> }
) {
  try {
    const { webinarId } = await params
    const { searchParams } = new URL(req.url)
    
    // 커서 기반 페이지네이션 파라미터
    const beforeTs = searchParams.get('beforeTs') // ISO 8601 타임스탬프
    const beforeId = searchParams.get('beforeId') // 메시지 ID
    const limitParam = searchParams.get('limit')
    const includeHidden = searchParams.get('includeHidden') === 'true' // 운영 콘솔용: 숨김 메시지 포함
    
    // 증분 폴링 파라미터 (하위 호환성)
    const afterId = searchParams.get('after')
    
    // limit 검증 및 클램프 (10~100)
    // limitParam이 없으면 기본값 50, 있으면 파싱 후 10~100 사이로 제한
    let limit = 50
    if (limitParam) {
      const parsed = parseInt(limitParam, 10)
      if (!isNaN(parsed)) {
        limit = Math.min(Math.max(parsed, 10), 100)
      }
    }
    
    // 인증 확인 (Route Handler에서는 redirect 대신 에러 반환)
    const { createServerSupabase } = await import('@/lib/supabase/server')
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.error('메시지 조회 API 인증 실패:', authError)
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const admin = createAdminSupabase()
    
    // 웨비나 존재 확인 (agency_id, client_id도 함께 조회)
    const { data: webinar, error: webinarError } = await admin
      .from('webinars')
      .select('id, agency_id, client_id')
      .eq('id', webinarId)
      .single()
    
    if (webinarError || !webinar) {
      return NextResponse.json(
        { success: false, error: 'Webinar not found' },
        { status: 404 }
      )
    }
    
    // 사용자가 웨비나에 등록되어 있는지 확인
    const { data: registration } = await admin
      .from('registrations')
      .select('webinar_id, user_id')
      .eq('webinar_id', webinarId)
      .eq('user_id', user.id)
      .maybeSingle()
    
    // 등록되어 있지 않으면 자동 등록
    if (!registration) {
      const { error: regError } = await admin
        .from('registrations')
        .insert({
          webinar_id: webinarId,
          user_id: user.id,
          role: 'attendee',
        })
      
      // 중복 키 에러(23505)는 무시 (동시 요청 시 발생 가능)
      if (regError && regError.code !== '23505') {
        console.error('웨비나 자동 등록 실패:', regError)
        // 등록 실패해도 메시지는 조회 가능하도록 계속 진행
      }
    }
    
    // 프로필 정보는 별도 조회 (RLS 우회)
    let query = admin
      .from('messages')
      .select(`
        id,
        user_id,
        content,
        created_at,
        hidden,
        client_msg_id
      `)
      .eq('webinar_id', webinarId)
    
    // 운영 콘솔이 아닌 경우 숨김 메시지 제외
    if (!includeHidden) {
      query = query.eq('hidden', false)
    }
    
    // 커서 기반 페이지네이션: 과거 메시지 더 불러오기
    if (beforeTs && beforeId) {
      const beforeTsDate = new Date(beforeTs)
      const beforeIdNum = parseInt(beforeId, 10)
      
      if (!isNaN(beforeTsDate.getTime()) && !isNaN(beforeIdNum)) {
        // (created_at, id) < (beforeTs, beforeId) 조건
        // Supabase는 복합 조건을 직접 지원하지 않으므로,
        // created_at < beforeTs OR (created_at = beforeTs AND id < beforeId) 조건을
        // created_at <= beforeTs로 필터링 후 클라이언트에서 id로 추가 필터링
        // 또는 더 정확하게는 created_at < beforeTs로 필터링 (대부분의 경우 충분)
        // 같은 시간대의 메시지가 많을 경우를 대비해 약간의 여유를 둠
        query = query.lt('created_at', beforeTs)
      }
    } else if (afterId) {
      // 증분 폴링 (하위 호환성): afterId 이후 메시지만 조회
      const afterIdNum = parseInt(afterId, 10)
      if (!isNaN(afterIdNum)) {
        query = query.gt('id', afterIdNum)
      }
    }
    
    // 정렬: created_at DESC, id DESC (인덱스와 일치)
    query = query
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit)
    
    const { data: messages, error: messagesError } = await query
    
    if (messagesError) {
      return NextResponse.json(
        { success: false, error: messagesError.message },
        { status: 500 }
      )
    }
    
    const loadedMessages = messages || []
    
    // 사용자 ID 목록 수집
    const userIds = [...new Set(loadedMessages.map((m: any) => m.user_id))]
    
    // 프로필 정보 조회 (RLS 우회, is_super_admin 포함)
    const profilesMap = new Map()
    if (userIds.length > 0) {
      const { data: profiles } = await admin
        .from('profiles')
        .select('id, display_name, email, nickname, is_super_admin')
        .in('id', userIds)
      
      if (profiles) {
        profiles.forEach((p: any) => {
          profilesMap.set(p.id, p)
        })
      }
    }
    
    // 각 사용자의 관리자 여부 확인 (슈퍼 관리자, 에이전시 멤버, 클라이언트 멤버)
    const adminUsersSet = new Set<string>()
    
    // 1. 슈퍼 관리자 확인
    profilesMap.forEach((profile, userId) => {
      if (profile.is_super_admin) {
        adminUsersSet.add(userId)
      }
    })
    
    // 2. 에이전시 멤버십 확인
    if (userIds.length > 0 && webinar.agency_id) {
      const { data: agencyMembers } = await admin
        .from('agency_members')
        .select('user_id')
        .eq('agency_id', webinar.agency_id)
        .in('user_id', userIds)
      
      if (agencyMembers) {
        agencyMembers.forEach((m: any) => {
          adminUsersSet.add(m.user_id)
        })
      }
    }
    
    // 3. 클라이언트 멤버십 확인
    if (userIds.length > 0 && webinar.client_id) {
      const { data: clientMembers } = await admin
        .from('client_members')
        .select('user_id')
        .eq('client_id', webinar.client_id)
        .in('user_id', userIds)
      
      if (clientMembers) {
        clientMembers.forEach((m: any) => {
          adminUsersSet.add(m.user_id)
        })
      }
    }
    
    // 각 사용자의 웨비나 등록 정보 조회 (nickname 포함)
    const registrationsMap = new Map()
    if (userIds.length > 0) {
      const { data: registrations } = await admin
        .from('registrations')
        .select('user_id, role, nickname')
        .eq('webinar_id', webinarId)
        .in('user_id', userIds)
      
      if (registrations) {
        registrations.forEach((r: any) => {
          registrationsMap.set(r.user_id, { role: r.role, nickname: r.nickname })
        })
      }
    }
    
    // 메시지와 프로필 정보 결합 (nickname 우선 사용)
    const formattedMessages = loadedMessages.map((msg: any) => {
      const profile = profilesMap.get(msg.user_id) || null
      const registration = registrationsMap.get(msg.user_id)
      
      // displayName 결정: registrations.nickname > profiles.nickname > display_name > email > '익명'
      let displayName = '익명'
      if (registration?.nickname) {
        // 웨비나별 닉네임이 최우선
        displayName = registration.nickname
      } else if (profile?.nickname) {
        // 프로필 기본 닉네임
        displayName = profile.nickname
      } else if (profile?.display_name) {
        // 이름
        displayName = profile.display_name
      } else if (profile?.email) {
        // 이메일
        displayName = profile.email
      }
      
      return {
        id: msg.id,
        user_id: msg.user_id,
        content: msg.content,
        created_at: msg.created_at,
        hidden: msg.hidden,
        client_msg_id: msg.client_msg_id,
        user: profile ? {
          ...profile,
          display_name: displayName,
        } : {
          id: msg.user_id,
          display_name: displayName,
          email: null,
        },
      }
    })
    
    // 응답: 오름차순으로 반환 (렌더링 단순화)
    // DB에서는 DESC로 가져왔으므로 reverse
    const sortedMessages = formattedMessages.reverse()
    
    // 커서 필터링: beforeTs와 beforeId가 모두 제공된 경우,
    // 같은 시간대의 메시지 중 beforeId보다 작은 것만 포함
    let filteredMessages = sortedMessages
    if (beforeTs && beforeId) {
      const beforeTsDate = new Date(beforeTs)
      const beforeIdNum = parseInt(beforeId, 10)
      if (!isNaN(beforeTsDate.getTime()) && !isNaN(beforeIdNum)) {
        filteredMessages = sortedMessages.filter((msg) => {
          const msgDate = new Date(msg.created_at)
          const msgId = typeof msg.id === 'number' ? msg.id : parseInt(String(msg.id), 10)
          
          // created_at < beforeTs OR (created_at = beforeTs AND id < beforeId)
          if (msgDate.getTime() < beforeTsDate.getTime()) {
            return true
          }
          if (msgDate.getTime() === beforeTsDate.getTime() && msgId < beforeIdNum) {
            return true
          }
          return false
        })
      }
    }
    
    // 다음 커서 계산 (가장 오래된 메시지의 created_at, id)
    let nextCursor: { beforeTs: string; beforeId: number } | null = null
    if (filteredMessages.length > 0) {
      const oldestMsg = filteredMessages[0]
      nextCursor = {
        beforeTs: oldestMsg.created_at,
        beforeId: typeof oldestMsg.id === 'number' ? oldestMsg.id : parseInt(String(oldestMsg.id), 10),
      }
    }
    
    // hasMore: limit만큼 가져왔으면 더 있을 가능성이 있음
    const hasMore = loadedMessages.length === limit
    
    // ETag 계산: 마지막 메시지 ID와 메시지 수를 기반으로 생성
    // 증분 폴링(after)의 경우 마지막 메시지 ID 사용, 그 외에는 첫 메시지 ID 사용
    const lastMsgId = filteredMessages.length > 0 
      ? (typeof filteredMessages[filteredMessages.length - 1].id === 'number' 
          ? filteredMessages[filteredMessages.length - 1].id 
          : parseInt(String(filteredMessages[filteredMessages.length - 1].id), 10))
      : 0
    const firstMsgId = filteredMessages.length > 0
      ? (typeof filteredMessages[0].id === 'number'
          ? filteredMessages[0].id
          : parseInt(String(filteredMessages[0].id), 10))
      : 0
    
    // ETag: webinarId:lastMsgId:firstMsgId:count 형식
    // 증분 폴링의 경우 afterId를 포함하여 더 정확한 캐싱
    const etagKey = afterId 
      ? `${webinarId}:after:${afterId}:${lastMsgId}:${filteredMessages.length}`
      : `${webinarId}:${firstMsgId}:${lastMsgId}:${filteredMessages.length}:${includeHidden ? 'all' : 'visible'}`
    const etag = `"${etagKey}"`
    
    // If-None-Match 헤더 확인 (304 응답)
    const ifNoneMatch = req.headers.get('if-none-match')
    if (ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          'Cache-Control': 'public, s-maxage=1, stale-while-revalidate=9',
          'ETag': etag,
        }
      })
    }
    
    return NextResponse.json({
      success: true,
      messages: filteredMessages,
      nextCursor,
      hasMore,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=1, stale-while-revalidate=9',
        'ETag': etag,
      }
    })
  } catch (error: any) {
    console.error('메시지 조회 API 에러:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

