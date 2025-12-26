import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/guards'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createServerSupabase } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * 설문조사 캠페인에 샘플 폼 생성
 * POST /api/event-survey/campaigns/[campaignId]/create-sample-form
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await params
    
    const admin = createAdminSupabase()
    
    // 캠페인 정보 조회
    const { data: campaign, error: campaignError } = await admin
      .from('event_survey_campaigns')
      .select('id, title, client_id, agency_id')
      .eq('id', campaignId)
      .single()
    
    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }
    
    // 권한 확인
    const { user } = await requireAuth()
    const supabase = await createServerSupabase()
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single()
    
    let hasPermission = false
    
    // 슈퍼 관리자는 항상 허용
    if (profile?.is_super_admin) {
      hasPermission = true
    } else {
      // 클라이언트 멤버십 확인
      const { data: clientMember } = await supabase
        .from('client_members')
        .select('role')
        .eq('client_id', campaign.client_id)
        .eq('user_id', user.id)
        .maybeSingle()
      
      if (clientMember && ['owner', 'admin', 'operator'].includes(clientMember.role)) {
        hasPermission = true
      } else {
        // 에이전시 멤버십 확인
        if (campaign.agency_id) {
          const { data: agencyMember } = await supabase
            .from('agency_members')
            .select('role')
            .eq('agency_id', campaign.agency_id)
            .eq('user_id', user.id)
            .maybeSingle()
          
          if (agencyMember && ['owner', 'admin'].includes(agencyMember.role)) {
            hasPermission = true
          }
        }
      }
    }
    
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }
    
    // 기존 폼이 있는지 확인
    const { data: existingForm } = await admin
      .from('forms')
      .select('id')
      .eq('campaign_id', campaignId)
      .maybeSingle()
    
    if (existingForm) {
      return NextResponse.json(
        { error: 'Form already exists for this campaign', formId: existingForm.id },
        { status: 400 }
      )
    }
    
    // 샘플 폼 생성
    const defaultConfig = {
      basicFields: {
        company: { enabled: true, required: true, label: '회사명' },
        name: { enabled: true, required: true, label: '이름' },
        phone: { enabled: true, required: true, label: '휴대전화번호' },
      },
      consentFields: [
        {
          id: 'consent1',
          enabled: true,
          required: true,
          title: '개인정보 공유 동의',
          content:
            'HPE (은)가 귀하의 개인정보를 수집ㆍ이용하는 목적은 다음과 같습니다 제품과 서비스에 대해 귀하와의 연락, 고객 서비스 증진, 제품 및 서비스에 대한 정보 제공 및 판매, 새로운 서비스와 혜택에 대한 업데이트, 개별 프로모션 제안, 제품 및 서비스에 대한 시장 조사\n\n수집하려는 개인정보의 항목: 이름 회사명 휴대전화번호\n\n개인정보의 보유 및 이용 기간: 처리 목적 달성시까지\n\n개인정보를 공유받는 자의 개인정보 보유 및 이용 기간: 개인정보 수집 및 이용 목적 달성 시까지 보관합니다.\n\n동의를 거부할 권리 및 동의 거부에 따른 불이익: 귀하는 위2항의 선택정보 개인정보의 수집ㆍ이용에 대한 동의를 거부할 수 있으며, 동의를 거부한 경우에는 HPE (은)는 귀하에게 그와 관련된 정보나 혜택은 제공하지 않게 됩니다.\n\n촬영 동의\n본인은 HPE Discover More AI Seoul 2026 행사 중 촬영되는 사진·영상이 HPE 홍보 목적으로 활용될 수 있음에 동의합니다. (활용기간: 목적 달성 시)\n\n기념품 수령 정책 동의\n본인은 소속 기관의 기념품·금품 수령 관련 규정을 이해하며, 이를 준수하는 책임이 본인에게 있음을 확인합니다. HPE는 이에 대한 책임이 없음을 확인합니다.',
        },
        {
          id: 'consent2',
          enabled: true,
          required: true,
          title: '개인정보 취급위탁 동의',
          content:
            'HPE (은)는 다음과 같은 마케팅과 커뮤니케이션 등의 목적으로 HPE (은)(을)를 보조하는 서비스 제공자와 공급자에게 개인정보 취급을 위탁할 수 있습니다.\n\n수탁자: ㈜언택트온\n\n위탁하는 업무의 내용: 세미나/이벤트 등 마케팅 프로모션 참석 및 등록 확인, 세미나/이벤트 설문지 키인 작업 및 통계 분석, 기프트 제공',
        },
        {
          id: 'consent3',
          enabled: true,
          required: true,
          title: '전화, 이메일, SMS 수신 동의',
          content:
            'HPE (은)는 제품 및 서비스, 프로모션 또는 시장조사 등의 유용한 정보를 온·오프라인을 통해 안내 드리고자 합니다.\n\n기프트 제공 또는 기프티콘 발송을 위하여 전화 연락 또는 SMS 발송을 드릴 수 있습니다.',
        },
      ],
    }
    
    const { data: form, error: formError } = await admin
      .from('forms')
      .insert({
        campaign_id: campaignId,
        agency_id: campaign.agency_id,
        client_id: campaign.client_id,
        title: `${campaign.title} - 설문조사`,
        description: '이벤트 참여 설문조사입니다.',
        kind: 'survey',
        status: 'open',
        config: defaultConfig,
        created_by: user.id,
      })
      .select()
      .single()
    
    if (formError) {
      return NextResponse.json(
        { error: formError.message },
        { status: 500 }
      )
    }
    
    // 샘플 문항 생성 (HPE 부스 이벤트 설문조사 - 설문조사샘플.html 참고)
    // Supabase의 jsonb 타입은 자동으로 JSON으로 변환되므로 배열을 그대로 전달
    const sampleQuestions = [
      {
        form_id: form.id,
        order_no: 1,
        type: 'single',
        body: '현재 데이터센터 네트워크 프로젝트 계획이 있으시다면 언제입니까?',
        options: [
          { id: '1', text: '1주일 이내' },
          { id: '2', text: '1개월 이내' },
          { id: '3', text: '1개월 - 3개월' },
          { id: '4', text: '3개월 - 6개월' },
          { id: '5', text: '6개월 - 12개월' },
          { id: '6', text: '1년 이후' },
          { id: '7', text: '계획없음' },
        ],
      },
      {
        form_id: form.id,
        order_no: 2,
        type: 'single',
        body: '데이터센터 외 네트워크 프로젝트 계획이 있으시다면 어떤 것입니까?',
        options: [
          { id: '1', text: '유무선 캠퍼스 & 브랜치 네트워크' },
          { id: '2', text: '엔터프라이즈 라우팅 (SD-WAN 포함)' },
          { id: '3', text: '네트워크 보안' },
          { id: '4', text: '해당 없음' },
        ],
      },
      {
        form_id: form.id,
        order_no: 3,
        type: 'single',
        body: 'HPE의 데이터센터 네트워크 솔루션에 대해 보다 더 자세한 내용을 들어 보실 의향이 있으십니까?',
        options: [
          { id: '1', text: 'HPE 네트워크 전문가의 방문 요청' },
          { id: '2', text: 'HPE 네트워크 전문가의 온라인 미팅 요청' },
          { id: '3', text: 'HPE 네트워크 전문가의 전화 상담 요청' },
          { id: '4', text: '관심 없음' },
        ],
      },
      {
        form_id: form.id,
        order_no: 4,
        type: 'text',
        body: '부스 스태프로부터 받으신 메시지 카드 번호를 입력해 주세요.',
      },
    ]
    
    const { data: insertedQuestions, error: questionsError } = await admin
      .from('form_questions')
      .insert(sampleQuestions)
      .select()
    
    if (questionsError) {
      console.error('문항 생성 오류:', questionsError)
      return NextResponse.json(
        { error: questionsError.message },
        { status: 500 }
      )
    }
    
    console.log('샘플 문항 생성 완료:', {
      formId: form.id,
      questionCount: insertedQuestions?.length || 0,
      questions: insertedQuestions?.map(q => ({ id: q.id, order_no: q.order_no, body: q.body }))
    })
    
    // 캠페인에 폼 연결
    const { error: updateError } = await admin
      .from('event_survey_campaigns')
      .update({ form_id: form.id, updated_at: new Date().toISOString() })
      .eq('id', campaignId)
    
    if (updateError) {
      console.error('캠페인 폼 연결 오류:', updateError)
      return NextResponse.json(
        { error: updateError.message || '캠페인에 폼을 연결하는데 실패했습니다' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ 
      success: true, 
      form: {
        id: form.id,
        title: form.title,
      }
    })
  } catch (error: any) {
    console.error('샘플 폼 생성 오류:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

