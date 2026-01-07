/**
 * 설문조사 질문 복사 스크립트
 * 한 캠페인의 질문들을 다른 캠페인으로 복사
 */

import { createAdminSupabase } from '../lib/supabase/admin'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function copyQuestionsToCampaign(
  sourcePublicPath: string,
  targetPublicPath: string
) {
  const admin = createAdminSupabase()

  console.log(`\n=== 질문 복사 시작 ===`)
  console.log(`소스: ${sourcePublicPath}`)
  console.log(`대상: ${targetPublicPath}\n`)

  // 1. 소스 캠페인 조회
  const { data: sourceCampaign, error: sourceError } = await admin
    .from('event_survey_campaigns')
    .select('id, title, form_id')
    .eq('public_path', sourcePublicPath)
    .single()

  if (sourceError || !sourceCampaign) {
    console.error('소스 캠페인을 찾을 수 없습니다:', sourceError)
    process.exit(1)
  }

  console.log(`소스 캠페인: ${sourceCampaign.title} (${sourceCampaign.id})`)

  if (!sourceCampaign.form_id) {
    console.error('소스 캠페인에 폼이 없습니다.')
    process.exit(1)
  }

  // 2. 대상 캠페인 조회
  const { data: targetCampaign, error: targetError } = await admin
    .from('event_survey_campaigns')
    .select('id, title, form_id')
    .eq('public_path', targetPublicPath)
    .single()

  if (targetError || !targetCampaign) {
    console.error('대상 캠페인을 찾을 수 없습니다:', targetError)
    process.exit(1)
  }

  console.log(`대상 캠페인: ${targetCampaign.title} (${targetCampaign.id})`)

  // 3. 소스 폼의 질문들 조회
  const { data: sourceQuestions, error: questionsError } = await admin
    .from('form_questions')
    .select('*')
    .eq('form_id', sourceCampaign.form_id)
    .order('order_no', { ascending: true })

  if (questionsError || !sourceQuestions || sourceQuestions.length === 0) {
    console.error('소스 질문을 찾을 수 없습니다:', questionsError)
    process.exit(1)
  }

  console.log(`\n소스 질문 ${sourceQuestions.length}개 발견:`)
  sourceQuestions.forEach((q, idx) => {
    console.log(`  ${idx + 1}. ${q.body} (${q.type})`)
  })

  // 4. 대상 폼 확인 및 생성
  let targetFormId = targetCampaign.form_id

  if (!targetFormId) {
    console.log('\n대상 캠페인에 폼이 없습니다. 새로 생성합니다...')
    
    const { data: newForm, error: formError } = await admin
      .from('forms')
      .insert({
        campaign_id: targetCampaign.id,
        type: 'survey',
        config: {},
      })
      .select()
      .single()

    if (formError || !newForm) {
      console.error('폼 생성 실패:', formError)
      process.exit(1)
    }

    targetFormId = newForm.id

    // 캠페인에 폼 연결
    const { error: updateError } = await admin
      .from('event_survey_campaigns')
      .update({ form_id: targetFormId })
      .eq('id', targetCampaign.id)

    if (updateError) {
      console.error('캠페인 업데이트 실패:', updateError)
      process.exit(1)
    }

    console.log(`새 폼 생성 완료: ${targetFormId}`)
  } else {
    console.log(`\n대상 폼 ID: ${targetFormId}`)
    
    // 기존 질문 삭제
    const { error: deleteError } = await admin
      .from('form_questions')
      .delete()
      .eq('form_id', targetFormId)

    if (deleteError) {
      console.error('기존 질문 삭제 실패:', deleteError)
      process.exit(1)
    }

    console.log('기존 질문 삭제 완료')
  }

  // 5. 질문들 복사 (기본 필드만 포함)
  const questionsToInsert = sourceQuestions.map((q) => {
    const questionData: any = {
      form_id: targetFormId,
      order_no: q.order_no,
      body: q.body,
      type: q.type,
      options: q.options,
    }
    
    // 선택적 필드들 (존재하는 경우에만 포함)
    if (q.analysis_role_override !== undefined && q.analysis_role_override !== null) {
      questionData.analysis_role_override = q.analysis_role_override
    }
    
    return questionData
  })

  const { data: insertedQuestions, error: insertError } = await admin
    .from('form_questions')
    .insert(questionsToInsert)
    .select()

  if (insertError || !insertedQuestions) {
    console.error('질문 복사 실패:', insertError)
    process.exit(1)
  }

  console.log(`\n✅ 질문 ${insertedQuestions.length}개 복사 완료!`)
  console.log('\n복사된 질문:')
  insertedQuestions.forEach((q, idx) => {
    console.log(`  ${idx + 1}. ${q.body} (${q.type})`)
  })

  console.log(`\n=== 완료 ===`)
}

// 실행
const sourcePath = process.argv[2]
const targetPath = process.argv[3]

if (!sourcePath || !targetPath) {
  console.error('사용법: npx tsx scripts/copy-questions-to-campaign.ts <소스_경로> <대상_경로>')
  console.error('예: npx tsx scripts/copy-questions-to-campaign.ts /345870 /test-survey-copy-modu')
  process.exit(1)
}

copyQuestionsToCampaign(sourcePath, targetPath)
  .then(() => {
    console.log('\n성공적으로 완료되었습니다.')
    process.exit(0)
  })
  .catch((error) => {
    console.error('오류 발생:', error)
    process.exit(1)
  })
