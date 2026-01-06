import { createAdminSupabase } from '../lib/supabase/admin'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

/**
 * dashboard_code 확인 및 생성 스크립트
 */

async function checkDashboardCode(campaignId: string) {
  const admin = createAdminSupabase()

  console.log('='.repeat(60))
  console.log('dashboard_code 확인')
  console.log('='.repeat(60))
  console.log(`campaign_id: ${campaignId}`)
  console.log('')

  // 캠페인 조회
  const { data: campaign, error: campaignError } = await admin
    .from('event_survey_campaigns')
    .select('id, title, status, dashboard_code')
    .eq('id', campaignId)
    .single()

  if (campaignError || !campaign) {
    console.error('❌ 캠페인을 찾을 수 없습니다:', campaignError)
    process.exit(1)
  }

  console.log(`✅ 캠페인 찾음: ${campaign.title}`)
  console.log(`   - status: ${campaign.status}`)
  console.log(`   - dashboard_code: ${campaign.dashboard_code || '(없음)'}`)
  console.log('')

  if (!campaign.dashboard_code) {
    console.log('⚠️  dashboard_code가 없습니다. 생성하시겠습니까?')
    console.log('   API를 호출하여 생성할 수 있습니다:')
    console.log(`   POST /api/event-survey/campaigns/${campaignId}/generate-dashboard-code`)
  } else {
    console.log(`✅ dashboard_code: ${campaign.dashboard_code}`)
    console.log(`   공개 대시보드 URL: https://eventflow.kr/event/dashboard/${campaign.dashboard_code}`)
    
    if (campaign.status !== 'published') {
      console.log('')
      console.log('⚠️  캠페인 상태가 "published"가 아닙니다.')
      console.log(`   현재 상태: ${campaign.status}`)
      console.log('   공개 대시보드는 "published" 상태인 캠페인만 접근 가능합니다.')
    }
  }
}

const args = process.argv.slice(2)

if (args.length < 1) {
  console.error('사용법: npx tsx scripts/check-dashboard-code.ts <campaign_id>')
  console.error('예시: npx tsx scripts/check-dashboard-code.ts 8128c3df-0b9c-4a6d-ba57-fb61f10bd0e6')
  process.exit(1)
}

const campaignId = args[0]

checkDashboardCode(campaignId)
  .then(() => {
    console.log('스크립트 실행 완료')
    process.exit(0)
  })
  .catch((error) => {
    console.error('스크립트 실행 오류:', error)
    process.exit(1)
  })
