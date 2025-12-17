import nodemailer from 'nodemailer'

/**
 * 이메일 발송을 위한 transporter 생성
 */
function createTransporter() {
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com'
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10)
  const smtpUser = process.env.SMTP_USER || 'admin@modoolecture.com'
  // 환경 변수에서 따옴표 제거 (있을 경우)
  const smtpPass = process.env.SMTP_PASS?.replace(/^["']|["']$/g, '')

  if (!smtpPass) {
    console.warn('SMTP_PASS 환경 변수가 설정되지 않았습니다. 이메일 발송이 불가능합니다.')
    return null
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465, // 465 포트는 TLS 사용
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  })
}

/**
 * 웨비나 등록 확인 이메일 발송
 * @param webinarIdOrSlug - 웨비나 ID (UUID) 또는 slug
 */
export async function sendWebinarRegistrationEmail(
  to: string,
  displayName: string,
  webinarTitle: string,
  webinarIdOrSlug: string,
  startTime?: string | null
): Promise<boolean> {
  try {
    const transporter = createTransporter()
    if (!transporter) {
      console.error('이메일 transporter 생성 실패')
      return false
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    // 이메일 파라미터를 포함한 입장 링크 (자동 로그인용, slug 사용)
    const entryUrl = `${baseUrl}/webinar/${webinarIdOrSlug}/live?email=${encodeURIComponent(to)}`
    // 행사 썸네일 이미지 URL
    const thumbnailUrl = `${supabaseUrl}/storage/v1/object/public/webinar-thumbnails/edm.png`
    
    // 날짜/시간 포맷팅 (예: "2025.12.17 오후7시")
    let formattedDateTime = ''
    if (startTime) {
      try {
        const date = new Date(startTime)
        // 로컬 시간대로 변환
        const year = date.getFullYear()
        const month = date.getMonth() + 1
        const day = date.getDate()
        const hours = date.getHours()
        const ampm = hours >= 12 ? '오후' : '오전'
        const displayHour = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours)
        formattedDateTime = `${year}.${month.toString().padStart(2, '0')}.${day.toString().padStart(2, '0')} ${ampm}${displayHour}시`
      } catch (e) {
        console.error('날짜 포맷팅 오류:', e)
      }
    }

    const mailOptions = {
      from: `"모두의특강" <${process.env.SMTP_USER || 'admin@modoolecture.com'}>`,
      to,
      subject: `[모두의특강] 웨비나 등록이 완료되었습니다: ${webinarTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>웨비나 등록 완료</h1>
            </div>
            <div class="content">
              ${thumbnailUrl ? `
              <div style="text-align: center; margin-bottom: 30px;">
                <img src="${thumbnailUrl}" alt="${webinarTitle}" style="max-width: 100%; height: auto; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);" />
              </div>
              ` : ''}
              
              <div style="margin: 30px 0;">
                <p style="font-size: 18px; font-weight: 600; color: #1f2937; margin-bottom: 15px;">모두의 특강</p>
                <p style="font-size: 20px; font-weight: 700; color: #4b5563; margin-bottom: 20px; line-height: 1.5;">${webinarTitle}</p>
                <p style="font-size: 16px; color: #374151; line-height: 1.8; margin-bottom: 20px;">에 신청해주셔서 감사합니다</p>
                
                <p style="font-size: 16px; color: #374151; line-height: 1.8; margin-bottom: 10px;">해당 라이브는</p>
                ${formattedDateTime ? `<p style="font-size: 16px; color: #374151; line-height: 1.8; margin-bottom: 20px; font-weight: 600;">${formattedDateTime}에 시작합니다</p>` : ''}
                <p style="font-size: 16px; color: #374151; line-height: 1.8; margin-bottom: 30px;">해당링크를 눌러 접속하시면됩니다</p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${entryUrl}" class="button">웨비나 입장하기</a>
              </div>
              
              <p style="margin-top: 30px; font-size: 14px; color: #6b7280; text-align: center;">
                또는 아래 링크를 복사하여 브라우저에 붙여넣으세요:<br>
                <a href="${entryUrl}" style="color: #667eea; word-break: break-all;">${entryUrl}</a>
              </p>
              
              <p style="margin-top: 40px; font-size: 16px; color: #374151; text-align: center;">감사합니다</p>
            </div>
            <div class="footer">
              <p>본 이메일은 모두의특강 웨비나 등록 확인을 위해 발송되었습니다.</p>
              <p>(주)유스튜디오 | 모두의특강</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
모두의 특강
${webinarTitle}
에 신청해주셔서 감사합니다

해당 라이브는
${formattedDateTime ? formattedDateTime + '에 시작합니다' : '곧 시작합니다'}
해당링크를 눌러 접속하시면됩니다

${entryUrl}

감사합니다
      `.trim(),
    }

    const info = await transporter.sendMail(mailOptions)
    console.log('이메일 발송 성공:', info.messageId)
    return true
  } catch (error) {
    console.error('이메일 발송 실패:', error)
    return false
  }
}

