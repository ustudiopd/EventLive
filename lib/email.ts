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
 */
export async function sendWebinarRegistrationEmail(
  to: string,
  displayName: string,
  webinarTitle: string,
  webinarId: string
): Promise<boolean> {
  try {
    const transporter = createTransporter()
    if (!transporter) {
      console.error('이메일 transporter 생성 실패')
      return false
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const entryUrl = `${baseUrl}/webinar/${webinarId}`

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
              <p>안녕하세요, <strong>${displayName}</strong>님!</p>
              <p>웨비나 등록이 성공적으로 완료되었습니다.</p>
              
              <h2 style="color: #1f2937; margin-top: 30px;">등록된 웨비나</h2>
              <p style="font-size: 18px; font-weight: 600; color: #4b5563;">${webinarTitle}</p>
              
              <p style="margin-top: 30px;">아래 버튼을 클릭하여 웨비나에 입장하실 수 있습니다.</p>
              
              <div style="text-align: center;">
                <a href="${entryUrl}" class="button">웨비나 입장하기</a>
              </div>
              
              <p style="margin-top: 30px; font-size: 14px; color: #6b7280;">
                또는 아래 링크를 복사하여 브라우저에 붙여넣으세요:<br>
                <a href="${entryUrl}" style="color: #667eea; word-break: break-all;">${entryUrl}</a>
              </p>
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
안녕하세요, ${displayName}님!

웨비나 등록이 성공적으로 완료되었습니다.

등록된 웨비나: ${webinarTitle}

아래 링크를 클릭하여 웨비나에 입장하실 수 있습니다:
${entryUrl}

본 이메일은 모두의특강 웨비나 등록 확인을 위해 발송되었습니다.
(주)유스튜디오 | 모두의특강
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

