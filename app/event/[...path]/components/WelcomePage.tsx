'use client'

import QRCodeDisplay from './QRCodeDisplay'

interface WelcomePageProps {
  campaign: any
  baseUrl: string
  isDraft?: boolean
  campaignType?: string
}

export default function WelcomePage({ campaign, baseUrl, isDraft = false, campaignType = 'survey' }: WelcomePageProps) {
  const isRegistration = campaignType === 'registration'
  const actionUrl = isRegistration 
    ? `${baseUrl}/event${campaign.public_path}/register`
    : `${baseUrl}/event${campaign.public_path}/survey`
  const lookupUrl = isRegistration
    ? `${baseUrl}/event${campaign.public_path}/register?lookup=true`
    : `${baseUrl}/event${campaign.public_path}/survey?lookup=true`
  
  // 헤더 이미지 URL - 등록 페이지는 사용자 제공 이미지 사용
  const headerImageUrl = isRegistration
    ? 'https://yqsayphssjznthrxpgfb.supabase.co/storage/v1/object/public/webinar-thumbnails/edm_header_1600_1.jpg'
    : 'https://yqsayphssjznthrxpgfb.supabase.co/storage/v1/object/public/webinar-thumbnails/hpe-booth-header.jpg'
  
  // welcome_schema에서 표시 옵션 읽기 (기본값: true)
  const welcomeSchema = campaign.welcome_schema || {}
  const showTitle = welcomeSchema.showTitle !== false // 기본값 true
  const showQRCode = welcomeSchema.showQRCode !== false // 기본값 true
  
  const handleRegistrationClick = (e: React.MouseEvent) => {
    e.preventDefault()
    if (isRegistration) {
      // 등록 페이지로 이동
      window.location.href = actionUrl
    } else {
      window.location.href = actionUrl
    }
  }
  
  return (
    <>
      <div className="min-h-screen bg-white font-sans text-gray-900 pb-20">
        {/* 상단 배너 */}
        <div className="w-full bg-white">
          <div className="max-w-[800px] mx-auto">
            <div className="relative w-full overflow-hidden flex justify-center">
              <img
                src={headerImageUrl}
                alt={campaign.title || '이벤트 헤더'}
                className="h-auto w-full"
              />
              {/* 등록 페이지일 때 이미지 위에 등록하기 버튼 오버레이 (장소 텍스트 아래 위치) */}
              {isRegistration && (
                <div className="absolute inset-0 flex items-end justify-center" style={{ paddingBottom: '8%' }}>
                  <button
                    onClick={handleRegistrationClick}
                    className="bg-[#00B388] text-white px-6 sm:px-8 py-2.5 sm:py-3 rounded-[2.5rem] text-base sm:text-lg md:text-xl font-bold shadow-2xl hover:bg-[#008f6d] transition-colors duration-200"
                    style={{
                      minWidth: '160px',
                      minHeight: '48px',
                      borderRadius: '15px',
                      textRendering: 'optimizeLegibility',
                      WebkitFontSmoothing: 'antialiased',
                      MozOsxFontSmoothing: 'grayscale',
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                    }}
                  >
                    등록하기
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* 등록 페이지가 아닐 때만 메인 콘텐츠 영역 표시 */}
        {!isRegistration && (
          <div className="max-w-[640px] mx-auto px-4 sm:px-5 py-6 sm:py-10">
            {isDraft && (
              <div className="mb-4 sm:mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-yellow-800 text-sm font-medium">
                  ⚠️ 이 캠페인은 초안 상태입니다. 관리자 대시보드에서 발행해주세요.
                </p>
              </div>
            )}
            
            <div className="bg-gray-50 rounded-lg shadow-md p-6 sm:p-8 md:p-10">
              {/* 제목 및 설명 영역 */}
              {showTitle && (
                <div className="text-center mb-8 sm:mb-10">
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 text-gray-900">
                    {campaign.title}
                  </h1>
                  {campaign.host && (
                    <p className="text-gray-600 text-sm sm:text-base mb-4">주최: {campaign.host}</p>
                  )}
                  <p className="text-base sm:text-lg text-gray-700 max-w-2xl mx-auto">
                    설문조사에 참여하시면 경품 이벤트에 참여하실 수 있습니다.
                  </p>
                </div>
              )}
              
              {/* 버튼 및 QR 코드 영역 */}
              <div className={`grid ${showQRCode ? 'md:grid-cols-2' : 'md:grid-cols-1'} gap-8 sm:gap-10 md:gap-12 mb-8 sm:mb-10`}>
                {/* 왼쪽: 버튼 영역 */}
                <div className="flex flex-col gap-4 sm:gap-5 justify-center">
                  <a
                    href={actionUrl}
                    className="w-full bg-[#00B388] text-white py-4 sm:py-5 rounded-md text-lg sm:text-xl font-bold shadow-lg hover:bg-[#008f6d] transition-colors text-center"
                  >
                    설문 참여하기
                  </a>
                  <a
                    href={lookupUrl}
                    className="w-full px-6 sm:px-8 py-3 sm:py-4 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all font-medium text-center text-base sm:text-lg"
                  >
                    참여 확인하기
                  </a>
                </div>
                
                {/* 오른쪽: QR 코드 영역 */}
                {showQRCode && (
                  <div className="flex flex-col items-center justify-center">
                    <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-4 sm:mb-5">QR 코드로 접속하기</h3>
                    <QRCodeDisplay url={actionUrl} />
                  </div>
                )}
              </div>
              
              {/* URL 표시 (섹션 전체 아래 가운데) */}
              <div className="pt-6 sm:pt-8 border-t border-gray-200 text-center">
                <p className="text-xs sm:text-sm text-gray-500 font-mono break-all px-4">
                  {actionUrl}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
      
    </>
  )
}
