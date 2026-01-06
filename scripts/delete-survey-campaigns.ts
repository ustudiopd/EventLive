import { createAdminSupabase } from '../lib/supabase/admin'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

/**
 * 설문조사 캠페인 삭제 스크립트
 * 사용법: npx tsx scripts/delete-survey-campaigns.ts
 */
async function deleteSurveyCampaigns() {
  try {
    const admin = createAdminSupabase()
    
    const publicPaths = ['/test-survey-2025', '/test-survey']
    
    for (const publicPath of publicPaths) {
      console.log(`\n🔍 캠페인 조회 중: ${publicPath}`)
      
      // 캠페인 조회
      const { data: campaign, error: campaignError } = await admin
        .from('event_survey_campaigns')
        .select('id, title, public_path, form_id')
        .eq('public_path', publicPath)
        .maybeSingle()
      
      if (campaignError) {
        console.error(`❌ 조회 오류: ${campaignError.message}`)
        continue
      }
      
      if (!campaign) {
        console.log(`⚠️  캠페인을 찾을 수 없습니다: ${publicPath}`)
        continue
      }
      
      console.log(`✅ 캠페인 찾음:`, {
        id: campaign.id,
        title: campaign.title,
        public_path: campaign.public_path,
        form_id: campaign.form_id,
      })
      
      // form_id가 있으면 먼저 처리
      if (campaign.form_id) {
        console.log(`\n📋 연결된 폼 처리 중: ${campaign.form_id}`)
        
        // form 정보 조회
        const { data: form, error: formError } = await admin
          .from('forms')
          .select('id, title, webinar_id, campaign_id')
          .eq('id', campaign.form_id)
          .single()
        
        if (form) {
          console.log(`   폼 정보: ${form.title}`)
          console.log(`   webinar_id: ${form.webinar_id || '없음'}`)
          console.log(`   campaign_id: ${form.campaign_id || '없음'}`)
          
          // webinar_id가 없으면 form도 삭제해야 함 (check constraint 위반 방지)
          if (!form.webinar_id) {
            console.log(`   🗑️  form 삭제 중 (webinar_id 없음)...`)
            const { error: deleteFormError } = await admin
              .from('forms')
              .delete()
              .eq('id', campaign.form_id)
            
            if (deleteFormError) {
              console.error(`   ❌ form 삭제 실패: ${deleteFormError.message}`)
            } else {
              console.log(`   ✅ form 삭제 완료`)
            }
          } else {
            // webinar_id가 있으면 campaign_id만 null로 설정
            console.log(`   🔧 form의 campaign_id를 null로 설정 중...`)
            const { error: updateFormError } = await admin
              .from('forms')
              .update({ campaign_id: null })
              .eq('id', campaign.form_id)
            
            if (updateFormError) {
              console.error(`   ❌ form 업데이트 실패: ${updateFormError.message}`)
            } else {
              console.log(`   ✅ form 업데이트 완료`)
            }
          }
          
          // 캠페인의 form_id를 null로 설정
          console.log(`   🔧 캠페인의 form_id를 null로 설정 중...`)
          const { error: updateCampaignError } = await admin
            .from('event_survey_campaigns')
            .update({ form_id: null })
            .eq('id', campaign.id)
          
          if (updateCampaignError) {
            console.error(`   ❌ 캠페인 form_id 업데이트 실패: ${updateCampaignError.message}`)
          } else {
            console.log(`   ✅ 캠페인 form_id 업데이트 완료`)
          }
        }
      }
      
      // 삭제 실행
      console.log(`\n🗑️  캠페인 삭제 중: ${campaign.title}`)
      const { error: deleteError } = await admin
        .from('event_survey_campaigns')
        .delete()
        .eq('id', campaign.id)
      
      if (deleteError) {
        console.error(`❌ 삭제 실패: ${deleteError.message}`)
      } else {
        console.log(`✅ 삭제 완료: ${campaign.title}`)
      }
    }
    
    console.log('\n✅ 모든 작업 완료')
  } catch (error: any) {
    console.error('❌ 오류 발생:', error)
    process.exit(1)
  }
}

deleteSurveyCampaigns()
