import { createAdminSupabase } from '../lib/supabase/admin'
import { buildAnalysisPack } from '../lib/surveys/analysis/buildAnalysisPack'
import { generateDecisionPackWithRetry } from '../lib/surveys/analysis/generateDecisionPack'
import { mergeAnalysisAndDecisionPack } from '../lib/surveys/analysis/mergeAnalysisAndDecisionPack'
import { renderFinalReportMD } from '../lib/surveys/analysis/renderFinalReportMD'
import { renderAnalysisPackMD } from '../lib/surveys/analysis/renderAnalysisPackMD'
import { getReferencesUsed } from '../lib/references/survey-analysis-references'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

/**
 * AI 분석 보고서 생성 스크립트
 * 사용법: npx tsx scripts/generate-analysis-report.ts <public_path>
 */
async function generateAnalysisReport(publicPath: string) {
  try {
    const admin = createAdminSupabase()
    
    console.log(`🔍 캠페인 조회 중: ${publicPath}`)
    
    // 캠페인 조회
    const { data: campaign, error: campaignError } = await admin
      .from('event_survey_campaigns')
      .select('id, title, public_path, client_id, agency_id, form_id')
      .eq('public_path', publicPath)
      .maybeSingle()
    
    if (campaignError) {
      console.error(`❌ 조회 오류: ${campaignError.message}`)
      process.exit(1)
    }
    
    if (!campaign) {
      console.error(`❌ 캠페인을 찾을 수 없습니다: ${publicPath}`)
      process.exit(1)
    }
    
    if (!campaign.form_id) {
      console.error(`❌ 캠페인에 연결된 폼이 없습니다.`)
      process.exit(1)
    }
    
    console.log(`✅ 캠페인 찾음:`, {
      id: campaign.id,
      title: campaign.title,
      public_path: campaign.public_path,
      form_id: campaign.form_id,
    })
    
    const analyzedAt = new Date().toISOString()
    
    console.log(`\n📊 Analysis Pack 생성 중...`)
    const analysisPack = await buildAnalysisPack(campaign.id, campaign)
    console.log(`✅ Analysis Pack 생성 완료:`, {
      evidenceCount: analysisPack.evidenceCatalog.length,
      highlightsCount: analysisPack.highlights.length,
      questionsCount: analysisPack.questions.length,
    })
    
    console.log(`\n🎯 Decision Pack 생성 중...`)
    let decisionPack: any = null
    let decisionPackWarnings: any[] = []
    let decisionPackError: Error | null = null
    
    try {
      const result = await generateDecisionPackWithRetry(analysisPack)
      decisionPack = result.decisionPack
      decisionPackWarnings = result.warnings
      console.log(`✅ Decision Pack 생성 완료:`, {
        decisionCardsCount: decisionPack.decisionCards.length,
        warningsCount: decisionPackWarnings.length,
      })
    } catch (error: any) {
      console.error(`❌ Decision Pack 생성 실패:`, error.message)
      decisionPackError = error
    }
    
    let mergedReport: any = null
    let reportMd: string = ''
    let analysisPackMd: string = ''
    
    if (decisionPack) {
      console.log(`\n🔗 병합 및 검증 중...`)
      try {
        mergedReport = mergeAnalysisAndDecisionPack(analysisPack, decisionPack)
        console.log(`✅ 병합 완료`)
        
        console.log(`\n📝 보고서 렌더링 중...`)
        reportMd = renderFinalReportMD(mergedReport)
        analysisPackMd = renderAnalysisPackMD(analysisPack)
        console.log(`✅ 보고서 렌더링 완료`)
      } catch (error: any) {
        console.error(`❌ 병합/렌더링 실패:`, error.message)
        decisionPack = null
        decisionPackError = error
      }
    }
    
    if (!decisionPack) {
      console.log(`⚠️  Decision Pack 없음, Analysis Pack만 저장`)
      reportMd = renderAnalysisPackMD(analysisPack)
      analysisPackMd = reportMd
    }
    
    const referencesUsed = getReferencesUsed()
    const reportTitle = `${new Date(analyzedAt).toLocaleDateString('ko-KR')} ${new Date(analyzedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 분석 보고서`
    
    console.log(`\n💾 DB 저장 중...`)
    const { data: report, error: insertError } = await admin
      .from('survey_analysis_reports')
      .insert({
        campaign_id: campaign.id,
        analyzed_at: analyzedAt,
        sample_count: analysisPack.campaign.sampleCount,
        total_questions: analysisPack.campaign.totalQuestions,
        report_title: reportTitle,
        report_content: reportMd,
        report_content_md: decisionPack?.decisionCards?.[0]?.question || '기초 분석 보고서',
        report_content_full_md: reportMd,
        report_md: reportMd,
        summary: decisionPack?.decisionCards?.[0]?.question || '기초 분석 보고서',
        statistics_snapshot: {
          campaign: {
            id: campaign.id,
            title: campaign.title,
            analyzed_at: analyzedAt,
          },
          sample_count: analysisPack.campaign.sampleCount,
          total_questions: analysisPack.campaign.totalQuestions,
          snapshot_version: decisionPack ? '3.0' : '2.5',
          analysis_pack: analysisPack,
          decision_pack: decisionPack || null,
        },
        references_used: referencesUsed,
        action_pack: null,
        analysis_pack: analysisPack,
        decision_pack: decisionPack || null,
        generation_warnings: decisionPackError
          ? [
              {
                level: 'error',
                message: decisionPackError.message,
                details: (decisionPackError as any).issues || [],
              },
              ...decisionPackWarnings,
            ]
          : decisionPackWarnings.length > 0
            ? decisionPackWarnings
            : null,
        lens: 'general',
        created_by: null, // 스크립트 실행 시에는 null
      })
      .select()
      .single()
    
    if (insertError) {
      console.error(`❌ 저장 실패: ${insertError.message}`)
      process.exit(1)
    }
    
    console.log(`\n✅ AI 분석 보고서 생성 완료!`)
    console.log(`   보고서 ID: ${report.id}`)
    console.log(`   분석 시점: ${report.analyzed_at}`)
    console.log(`   샘플 수: ${report.sample_count}명`)
    console.log(`   문항 수: ${report.total_questions}개`)
    
    if (decisionPack) {
      console.log(`\n📋 Decision Pack 정보:`)
      console.log(`   - Decision Cards: ${decisionPack.decisionCards.length}개`)
      const d0 = decisionPack.actionBoard.d0?.length || 0
      const d7 = decisionPack.actionBoard.d7?.length || 0
      const d14 = decisionPack.actionBoard.d14?.length || 0
      console.log(`   - Action Board: D+0(${d0}), D+7(${d7}), D+14(${d14})`)
      if (decisionPack.playbooks) {
        console.log(`   - Playbooks: 세일즈(${decisionPack.playbooks.sales?.length || 0}), 마케팅(${decisionPack.playbooks.marketing?.length || 0})`)
      }
      if (decisionPack.surveyNextQuestions) {
        console.log(`   - 설문 개선 제안: ${decisionPack.surveyNextQuestions.length}개`)
      }
    }
  } catch (error: any) {
    console.error('❌ 오류 발생:', error)
    console.error('스택:', error.stack)
    process.exit(1)
  }
}

// 명령줄 인자 확인
const publicPath = process.argv[2]

if (!publicPath) {
  console.error('❌ 사용법: npx tsx scripts/generate-analysis-report.ts <public_path>')
  console.error('   예시: npx tsx scripts/generate-analysis-report.ts /test-survey-copy')
  process.exit(1)
}

generateAnalysisReport(publicPath)
