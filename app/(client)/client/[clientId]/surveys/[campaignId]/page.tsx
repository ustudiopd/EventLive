import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/guards'
import SurveyCampaignDetailView from './components/SurveyCampaignDetailView'

export default async function SurveyCampaignDetailPage({
  params,
}: {
  params: Promise<{ clientId: string; campaignId: string }>
}) {
  const { clientId, campaignId } = await params
  const admin = createAdminSupabase()
  const { user, supabase } = await requireAuth()
  
  // 캠페인 정보 조회
  const { data: campaign, error: campaignError } = await admin
    .from('event_survey_campaigns')
    .select(`
      *,
      forms:form_id (
        id,
        title,
        kind,
        status
      )
    `)
    .eq('id', campaignId)
    .single()
  
  if (campaignError || !campaign) {
    redirect(`/client/${clientId}/surveys`)
  }
  
  // 권한 확인
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
      .eq('client_id', clientId)
      .eq('user_id', user.id)
      .maybeSingle()
    
    if (clientMember && ['owner', 'admin', 'operator', 'analyst', 'viewer'].includes(clientMember.role)) {
      hasPermission = true
    } else {
      // 에이전시 멤버십 확인
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
  
  if (!hasPermission) {
    redirect(`/client/${clientId}/surveys`)
  }
  
  // 통계 정보 조회
  const { count: completedCount } = await admin
    .from('event_survey_entries')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
  
  const { count: verifiedCount } = await admin
    .from('event_survey_entries')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .not('verified_at', 'is', null)
  
  const { count: prizeRecordedCount } = await admin
    .from('event_survey_entries')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .not('prize_recorded_at', 'is', null)
  
  // 참여자 목록 (전체, 답변 포함)
  const { data: entries } = await admin
    .from('event_survey_entries')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('completed_at', { ascending: false })
  
  // 각 참여자의 설문 답변도 함께 가져오기
  let entriesWithAnswers: any[] = entries || []
  
  if (campaign.form_id && entries && entries.length > 0) {
    // 폼 문항 조회 (한 번만)
    const { data: questions } = await admin
      .from('form_questions')
      .select('*')
      .eq('form_id', campaign.form_id)
      .order('order_no', { ascending: true })
    
    if (questions && questions.length > 0) {
      // 모든 submission_id 수집
      const submissionIds = entries
        .map((e: any) => e.form_submission_id)
        .filter(Boolean)
      
      // 모든 답변 한 번에 조회
      let allAnswers: any[] = []
      if (submissionIds.length > 0) {
        const { data: answersData } = await admin
          .from('form_answers')
          .select('*')
          .in('submission_id', submissionIds)
        
        allAnswers = answersData || []
      }
      
      // submission_id별로 답변 그룹화
      const answersBySubmission = new Map<string, any[]>()
      allAnswers.forEach((answer: any) => {
        if (!answersBySubmission.has(answer.submission_id)) {
          answersBySubmission.set(answer.submission_id, [])
        }
        answersBySubmission.get(answer.submission_id)!.push(answer)
      })
      
      // 각 참여자의 설문 답변 매핑
      entriesWithAnswers = entries.map((entry: any) => {
        if (!entry.form_submission_id) {
          return { ...entry, answers: [] }
        }
        
        const answers = answersBySubmission.get(entry.form_submission_id) || []
        if (answers.length === 0) {
          return { ...entry, answers: [] }
        }
        
        // 문항별 답변 매핑
        const answersMap = new Map(answers.map((a: any) => [a.question_id, a]))
        
        const detailedAnswers = questions.map((q: any) => {
          const answer = answersMap.get(q.id)
          const parsedOptions = q.options ? (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) : []
          
          let displayAnswer = '답변 없음'
          if (answer) {
            if (q.type === 'text') {
              displayAnswer = answer.text_answer || '답변 없음'
            } else if (q.type === 'single' || q.type === 'multiple') {
              if (answer.choice_ids && Array.isArray(answer.choice_ids) && answer.choice_ids.length > 0) {
                displayAnswer = answer.choice_ids.map((choiceId: string) => {
                  const option = parsedOptions.find((opt: any) => (opt.id || opt) === choiceId)
                  return option ? (option.text || option) : choiceId
                }).join(', ')
              }
            }
          }
          
          return {
            questionId: q.id,
            questionBody: q.body,
            questionType: q.type,
            orderNo: q.order_no,
            answer: displayAnswer,
          }
        })
        
        return {
          ...entry,
          answers: detailedAnswers,
        }
      })
    }
  }
  
  const campaignWithStats = {
    ...campaign,
    stats: {
      total_completed: completedCount || 0,
      total_verified: verifiedCount || 0,
      total_prize_recorded: prizeRecordedCount || 0,
    },
    entries: entriesWithAnswers,
  }
  
  return <SurveyCampaignDetailView campaign={campaignWithStats} clientId={clientId} />
}
