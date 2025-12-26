import { notFound, redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createAdminSupabase } from '@/lib/supabase/admin'
import QRCodeDisplay from './components/QRCodeDisplay'
import SurveyPage from './components/SurveyPage'

/**
 * 설문조사 공개 페이지 catch-all 라우트
 * 
 * URL 구조:
 * - /event/{public_path} -> 시작 페이지
 * - /event/{public_path}/survey -> 설문 페이지
 * - /event/{public_path}/done -> 완료 페이지
 * - /event/{public_path}/display -> 디스플레이 페이지
 */
export default async function SurveyPublicPage({
  params,
}: {
  params: Promise<{ path: string[] }>
}) {
  const { path } = await params
  
  // 경로가 없으면 404
  if (!path || path.length === 0) {
    notFound()
  }
  
  // public_path 구성
  // 예: /event/test/survey -> public_path = /test, subPath = survey
  // 예: /event/test -> public_path = /test, subPath = null
  // 예: /event/2025/triz/triz_1211_booth/survey -> public_path = /2025/triz/triz_1211_booth, subPath = survey
  
  // 마지막 경로가 survey, done, display 중 하나면 subPath로 처리
  const lastPath = path[path.length - 1]
  const isSubPath = ['survey', 'done', 'display'].includes(lastPath)
  
  const subPath = isSubPath ? lastPath : null
  const publicPath = '/' + (isSubPath ? path.slice(0, -1) : path).join('/')
  
  const admin = createAdminSupabase()
  
  // 디버깅: public_path 확인
  console.log('[SurveyPublicPage] 경로 정보:', {
    path,
    subPath,
    publicPath,
    constructedPath: publicPath
  })
  
  // public_path로 캠페인 조회 (슬래시 포함/미포함 모두 시도)
  let campaign = null
  let campaignError: any = null
  
  // 먼저 슬래시 포함 경로로 시도
  console.log('[SurveyPublicPage] 슬래시 포함 경로로 조회:', publicPath)
  const { data: campaignWithSlash, error: errorWithSlash } = await admin
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
    .eq('public_path', publicPath)
    .eq('status', 'published')
    .maybeSingle()
  
  console.log('[SurveyPublicPage] 슬래시 포함 조회 결과:', {
    found: !!campaignWithSlash,
    error: errorWithSlash,
    campaign: campaignWithSlash ? { id: campaignWithSlash.id, title: campaignWithSlash.title, public_path: campaignWithSlash.public_path, status: campaignWithSlash.status } : null
  })
  
  if (campaignWithSlash) {
    campaign = campaignWithSlash
  } else {
    // 슬래시 없이 저장된 경우를 대비해 슬래시 없는 경로로도 시도
    const publicPathWithoutSlash = publicPath.startsWith('/') ? publicPath.slice(1) : publicPath
    console.log('[SurveyPublicPage] 슬래시 없는 경로로 조회:', publicPathWithoutSlash)
    
    const { data: campaignWithoutSlash, error: errorWithoutSlash } = await admin
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
      .eq('public_path', publicPathWithoutSlash)
      .eq('status', 'published')
      .maybeSingle()
    
  console.log('[SurveyPublicPage] 슬래시 없는 조회 결과:', JSON.stringify({
    found: !!campaignWithoutSlash,
    error: errorWithoutSlash ? { message: errorWithoutSlash.message, code: errorWithoutSlash.code, details: errorWithoutSlash.details } : null,
    campaign: campaignWithoutSlash ? { id: campaignWithoutSlash.id, title: campaignWithoutSlash.title, public_path: campaignWithoutSlash.public_path, status: campaignWithoutSlash.status } : null,
    searchedPath: publicPathWithoutSlash
  }, null, 2))
    
    if (campaignWithoutSlash) {
      campaign = campaignWithoutSlash
    }
    
    // 캠페인을 찾지 못한 경우, 상태 무관 조회 결과 사용
    if (!campaign) {
      // 상태 무관하게 조회해보기 (디버깅용)
      // 숫자만 있는 경우 짧은 링크와 충돌 가능성 확인
      const isNumericOnly = /^\d+$/.test(publicPathWithoutSlash)
      
      console.log('[SurveyPublicPage] 상태 무관 조회 시작:', {
        publicPath,
        publicPathWithoutSlash,
        isNumericOnly
      })
      
      // OR 쿼리 대신 각각 조회해보기
      const { data: campaignsWithSlash } = await admin
        .from('event_survey_campaigns')
        .select('id, title, public_path, status')
        .eq('public_path', publicPath)
        .limit(10)
      
      const { data: campaignsWithoutSlash } = await admin
        .from('event_survey_campaigns')
        .select('id, title, public_path, status')
        .eq('public_path', publicPathWithoutSlash)
        .limit(10)
      
      const allCampaigns = [
        ...(campaignsWithSlash || []),
        ...(campaignsWithoutSlash || [])
      ]
      
      // 중복 제거
      const uniqueCampaigns = Array.from(
        new Map(allCampaigns.map(c => [c.id, c])).values()
      )
      
      console.log('[SurveyPublicPage] 상태 무관 조회 결과:', JSON.stringify({
        found: uniqueCampaigns.length,
        campaigns: uniqueCampaigns.map(c => ({ 
          id: c.id, 
          title: c.title, 
          public_path: c.public_path, 
          status: c.status 
        })),
        searchedPaths: [publicPath, publicPathWithoutSlash],
        isNumericOnly,
        warning: isNumericOnly ? '6자리 숫자는 짧은 링크(/s/[code])와 충돌할 수 있습니다' : null
      }, null, 2))
      
      // 숫자만 있는 경우, 짧은 링크 테이블도 확인해보기
      if (isNumericOnly) {
        const { data: shortLink } = await admin
          .from('short_links')
          .select('code, webinar_id')
          .eq('code', publicPathWithoutSlash)
          .maybeSingle()
        
        if (shortLink) {
          console.log('[SurveyPublicPage] 짧은 링크 충돌 감지:', JSON.stringify({
            code: shortLink.code,
            webinar_id: shortLink.webinar_id,
            message: '이 코드는 짧은 링크로 사용 중입니다. 다른 public_path를 사용하세요.'
          }, null, 2))
        }
      }
      
      // 모든 캠페인 목록 조회 (디버깅용)
      const { data: allCampaignsDebug } = await admin
        .from('event_survey_campaigns')
        .select('id, title, public_path, status')
        .limit(20)
      
      console.log('[SurveyPublicPage] 최근 캠페인 목록 (디버깅용):', JSON.stringify({
        total: allCampaignsDebug?.length || 0,
        campaigns: allCampaignsDebug?.map(c => ({
          id: c.id,
          title: c.title,
          public_path: c.public_path,
          status: c.status
        }))
      }, null, 2))
      
      // 상태 무관 조회에서 캠페인을 찾았으면 사용 (draft 상태도 허용)
      if (uniqueCampaigns.length > 0) {
        const foundCampaignId = uniqueCampaigns[0].id
        // form_id를 포함해서 다시 조회
        const { data: fullCampaign } = await admin
          .from('event_survey_campaigns')
          .select(`*, forms:form_id (id, title, kind, status)`)
          .eq('id', foundCampaignId)
          .single()
        
        if (fullCampaign) {
          campaign = fullCampaign
          console.log('[SurveyPublicPage] 상태 무관 조회에서 캠페인 찾음 (draft 상태 허용):', {
            id: campaign.id,
            status: campaign.status,
            form_id: campaign.form_id
          })
        } else {
          campaign = uniqueCampaigns[0]
        }
      } else {
        campaignError = errorWithoutSlash || errorWithSlash || { message: 'Campaign not found' }
      }
    }
  }
  
  if (campaignError || !campaign) {
    const errorInfo = {
      publicPath,
      publicPathWithoutSlash: publicPath.startsWith('/') ? publicPath.slice(1) : publicPath,
      error: campaignError ? {
        message: campaignError.message,
        code: campaignError.code,
        details: campaignError.details,
        hint: campaignError.hint
      } : null,
      searchedPaths: [publicPath, publicPath.startsWith('/') ? publicPath.slice(1) : publicPath],
      pathArray: path
    }
    console.error('[SurveyPublicPage] 캠페인 조회 실패:', JSON.stringify(errorInfo, null, 2))
    notFound()
  }
  
  console.log('[SurveyPublicPage] 캠페인 조회 성공:', JSON.stringify({
    campaignId: campaign.id,
    title: campaign.title,
    public_path: campaign.public_path,
    status: campaign.status
  }, null, 2))
  
  // subPath에 따라 다른 페이지 렌더링
  if (!subPath) {
    // 시작 페이지 (웰컴 페이지)
    const headersList = await headers()
    const host = headersList.get('host') || 'localhost:3000'
    const protocol = headersList.get('x-forwarded-proto') || 'http'
    const baseUrl = `${protocol}://${host}`
    
    // draft 상태인 경우 경고 표시
    const isDraft = campaign.status === 'draft'
    
    return <WelcomePage campaign={campaign} baseUrl={baseUrl} isDraft={isDraft} />
  } else if (subPath === 'survey') {
    // 설문 페이지
    const headersList = await headers()
    const host = headersList.get('host') || 'localhost:3000'
    const protocol = headersList.get('x-forwarded-proto') || 'http'
    const baseUrl = `${protocol}://${host}`
    return <SurveyPage campaign={campaign} baseUrl={baseUrl} />
  } else if (subPath === 'done') {
    // 완료 페이지
    return <DonePage campaign={campaign} />
  } else if (subPath === 'display') {
    // 디스플레이 페이지
    return <DisplayPage campaign={campaign} />
  } else {
    // 알 수 없는 경로
    notFound()
  }
}

// 시작 페이지 컴포넌트
function WelcomePage({ campaign, baseUrl, isDraft = false }: { campaign: any; baseUrl: string; isDraft?: boolean }) {
  const surveyUrl = `${baseUrl}/event${campaign.public_path}/survey`
  // 헤더 이미지 URL (HPE 부스 이벤트 이미지)
  const headerImageUrl = 'https://yqsayphssjznthrxpgfb.supabase.co/storage/v1/object/public/webinar-thumbnails/hpe-booth-header.jpg'
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50">
      {/* 헤더 이미지 영역 */}
      <div className="relative w-full overflow-hidden bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50 flex items-center justify-center">
        <img 
          src={headerImageUrl} 
          alt={campaign.title || '이벤트 헤더'}
          className="w-1/2 h-auto object-contain"
        />
        {/* 오버레이 그라데이션 (텍스트 가독성 향상) */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-transparent pointer-events-none"></div>
      </div>
      
      {/* 메인 콘텐츠 영역 */}
      <div className="w-1/2 mx-auto px-4 py-8 md:py-12">
        {isDraft && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800 text-sm font-medium">
              ⚠️ 이 캠페인은 초안 상태입니다. 관리자 대시보드에서 발행해주세요.
            </p>
          </div>
        )}
        
        <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">
              {campaign.title}
            </h1>
            {campaign.host && (
              <p className="text-gray-600 text-sm mb-4">주최: {campaign.host}</p>
            )}
            <p className="text-gray-700 text-base md:text-lg">
              설문조사에 참여하시면 경품 이벤트에 참여하실 수 있습니다.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 items-center">
            {/* 왼쪽: 버튼 영역 */}
            <div className="flex flex-col gap-4">
              <a
                href={`/event${campaign.public_path}/survey`}
                className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-teal-600 text-white rounded-lg hover:from-cyan-600 hover:to-teal-700 shadow-lg hover:shadow-xl transition-all font-medium text-center text-lg"
              >
                설문 참여하기
              </a>
              <a
                href={`/event${campaign.public_path}/survey?lookup=true`}
                className="px-8 py-4 border-2 border-cyan-500 text-cyan-600 rounded-lg hover:bg-cyan-50 transition-all font-medium text-center"
              >
                참여 확인하기
              </a>
            </div>
            
            {/* 오른쪽: QR 코드 영역 */}
            <div className="flex flex-col items-center">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">QR 코드로 접속하기</h3>
              <QRCodeDisplay url={surveyUrl} />
              <p className="text-xs text-gray-500 mt-4 text-center">
                QR 코드를 스캔하여 설문조사에 바로 참여하세요
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


// 완료 페이지 컴포넌트 (임시)
function DonePage({ campaign }: { campaign: any }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-8">
      <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="text-6xl mb-4">✓</div>
        <h1 className="text-3xl font-bold mb-4 text-green-600">설문 완료되었습니다</h1>
        <p className="text-gray-600 mb-8">
          완료번호와 확인코드를 부스 스태프에게 보여주세요.
        </p>
      </div>
    </div>
  )
}

// 디스플레이 페이지 컴포넌트 (임시)
function DisplayPage({ campaign }: { campaign: any }) {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-6xl font-bold mb-8">{campaign.title}</h1>
        <div className="text-4xl mb-8">
          <div className="mb-4">QR 코드를 스캔하여</div>
          <div>설문조사에 참여하세요</div>
        </div>
        <div className="text-2xl text-gray-400">
          /event{campaign.public_path}
        </div>
      </div>
    </div>
  )
}

