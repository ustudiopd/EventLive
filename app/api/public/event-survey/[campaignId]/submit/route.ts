import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * 설문조사 공개 제출 API
 * POST /api/public/event-survey/[campaignId]/submit
 * body: { name, company, phone, answers }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await params
    const { name, company, phone, answers, consentData } = await req.json()
    
    if (!name || !phone) {
      return NextResponse.json(
        { error: 'name and phone are required' },
        { status: 400 }
      )
    }
    
    const admin = createAdminSupabase()
    
    // 캠페인 조회
    const { data: campaign, error: campaignError } = await admin
      .from('event_survey_campaigns')
      .select('id, form_id, next_survey_no, client_id, agency_id')
      .eq('id', campaignId)
      .single()
    
    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }
    
    if (!campaign.form_id) {
      return NextResponse.json(
        { error: 'Form not configured for this campaign' },
        { status: 400 }
      )
    }
    
    // 전화번호 정규화 (숫자만 추출)
    const phoneNorm = phone.replace(/\D/g, '')
    
    if (!phoneNorm) {
      return NextResponse.json(
        { error: 'Invalid phone number' },
        { status: 400 }
      )
    }
    
    // 이미 참여한 경우 확인 (멱등성)
    const { data: existingEntry } = await admin
      .from('event_survey_entries')
      .select('survey_no, code6')
      .eq('campaign_id', campaignId)
      .eq('phone_norm', phoneNorm)
      .maybeSingle()
    
    if (existingEntry) {
      return NextResponse.json({
        success: true,
        alreadySubmitted: true,
        survey_no: existingEntry.survey_no,
        code6: existingEntry.code6,
        message: '이미 참여하셨습니다.',
      })
    }
    
    // survey_no 발급 (원자적 업데이트)
    const { data: currentCampaign } = await admin
      .from('event_survey_campaigns')
      .select('next_survey_no')
      .eq('id', campaignId)
      .single()
    
    if (!currentCampaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }
    
    const surveyNo = currentCampaign.next_survey_no || 1
    
    // next_survey_no 증가
    const { error: updateError } = await admin
      .from('event_survey_campaigns')
      .update({ next_survey_no: surveyNo + 1 })
      .eq('id', campaignId)
      .eq('next_survey_no', surveyNo) // 동시성 제어
    
    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to allocate survey number. Please try again.' },
        { status: 500 }
      )
    }
    
    // code6 생성 (survey_no를 6자리로 패딩)
    const code6 = surveyNo.toString().padStart(6, '0')
    
    // 폼 제출 처리 (form_submissions와 form_answers 생성)
    let formSubmissionId: string | null = null
    
    if (answers && Array.isArray(answers) && answers.length > 0 && campaign.form_id) {
      // form_submission 생성 (participant_id는 null - 공개 설문)
      const { data: submission, error: subError } = await admin
        .from('form_submissions')
        .insert({
          form_id: campaign.form_id,
          participant_id: null, // 공개 설문이므로 null
        })
        .select()
        .single()
      
      if (subError) {
        console.error('form_submission 생성 오류:', subError)
        return NextResponse.json(
          { error: 'Failed to create form submission: ' + subError.message },
          { status: 500 }
        )
      }
      
      formSubmissionId = submission.id
      
      // form_answers 생성
      const answerRows = answers.map((a: any) => ({
        form_id: campaign.form_id,
        submission_id: submission.id,
        question_id: a.questionId,
        participant_id: null, // 공개 설문이므로 null
        choice_ids: a.choiceIds || null, // JSONB는 자동으로 처리됨
        text_answer: a.textAnswer || null,
      }))
      
      const { error: answerError } = await admin
        .from('form_answers')
        .insert(answerRows)
      
      if (answerError) {
        console.error('form_answers 생성 오류:', answerError)
        // submission은 이미 생성되었으므로 롤백하지 않고 계속 진행
        // 하지만 로그는 남김
      }
    }
    
    // entry 생성 (개인정보 동의 데이터 포함)
    const { data: entry, error: entryError } = await admin
      .from('event_survey_entries')
      .insert({
        campaign_id: campaignId,
        name,
        company: company || null,
        phone_norm: phoneNorm,
        survey_no: surveyNo,
        code6,
        form_submission_id: formSubmissionId,
        consent_data: consentData ? {
          ...consentData,
          consented_at: new Date().toISOString(),
        } : null,
      })
      .select()
      .single()
    
    if (entryError) {
      return NextResponse.json(
        { error: entryError.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      survey_no: surveyNo,
      code6,
      entry_id: entry.id,
    })
  } catch (error: any) {
    console.error('설문 제출 오류:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

