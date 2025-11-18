/**
 * Webinar Broadcast 전파 유틸리티
 * 
 * 서버 측에서 Broadcast 이벤트를 전파하는 헬퍼 함수
 */

import { createClient } from '@supabase/supabase-js'
import type { BroadcastEnvelope, BroadcastEventType, ChatMessagePayload } from './realtime'
import { createBroadcastEnvelope } from './realtime'

/**
 * Supabase Admin 클라이언트 (Service Role Key 사용)
 * Broadcast 전파용
 */
let adminRealtimeClient: ReturnType<typeof createClient> | null = null

function getAdminRealtimeClient() {
  if (adminRealtimeClient) {
    return adminRealtimeClient
  }
  
  adminRealtimeClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
  
  return adminRealtimeClient
}

/**
 * Webinar 채널에 Broadcast 이벤트 전파
 * 
 * @param webinarId 웨비나 ID
 * @param eventType 이벤트 타입
 * @param payload 이벤트 payload
 * @param senderId 송신자 ID
 * @param clientMsgId 클라이언트 메시지 ID (선택)
 * @returns 전파 성공 여부
 */
export async function broadcastToWebinar<T = any>(
  webinarId: string,
  eventType: BroadcastEventType,
  payload: T,
  senderId: string,
  clientMsgId?: string
): Promise<boolean> {
  try {
    const supabase = getAdminRealtimeClient()
    const channelName = `webinar:${webinarId}`
    
    // 채널 가져오기 또는 생성
    let channel = supabase.getChannels().find(ch => ch.topic === `realtime:${channelName}`)
    
    if (!channel) {
      channel = supabase.channel(channelName, {
        config: {
          broadcast: { self: false },
        },
      })
      
      // 채널 구독 (전파를 위해 필요)
      await channel.subscribe()
    }
    
    // BroadcastEnvelope 생성
    const envelope = createBroadcastEnvelope(eventType, payload, senderId, clientMsgId)
    
    // Broadcast 전파
    const result = await channel.send({
      type: 'broadcast',
      event: eventType,
      payload: envelope,
    })
    
    if (result === 'ok') {
      console.log(`✅ Broadcast 전파 성공: ${eventType} to ${channelName}`)
      return true
    } else {
      console.warn(`⚠️ Broadcast 전파 실패: ${eventType} to ${channelName}, status: ${result}`)
      return false
    }
  } catch (error) {
    console.error(`❌ Broadcast 전파 오류: ${eventType} to webinar:${webinarId}`, error)
    return false
  }
}

/**
 * 채팅 메시지 Broadcast 전파 (편의 함수)
 */
export async function broadcastChatMessage(
  webinarId: string,
  message: ChatMessagePayload,
  senderId: string,
  clientMsgId?: string
): Promise<boolean> {
  return broadcastToWebinar<ChatMessagePayload>(
    webinarId,
    'chat:new',
    message,
    senderId,
    clientMsgId
  )
}

/**
 * 채팅 메시지 업데이트 Broadcast 전파
 */
export async function broadcastChatUpdate(
  webinarId: string,
  message: ChatMessagePayload,
  senderId: string
): Promise<boolean> {
  return broadcastToWebinar<ChatMessagePayload>(
    webinarId,
    'chat:update',
    message,
    senderId
  )
}

/**
 * 채팅 메시지 삭제 Broadcast 전파
 */
export async function broadcastChatDelete(
  webinarId: string,
  messageId: number,
  senderId: string
): Promise<boolean> {
  return broadcastToWebinar<{ id: number }>(
    webinarId,
    'chat:delete',
    { id: messageId },
    senderId
  )
}

/**
 * Phase 3: 퀴즈/설문/추첨 이벤트 Broadcast 전파
 */

/**
 * 퀴즈 열기 Broadcast 전파
 */
export async function broadcastQuizOpen(
  webinarId: string,
  quizData: any,
  senderId: string
): Promise<boolean> {
  return broadcastToWebinar(webinarId, 'quiz:open', quizData, senderId)
}

/**
 * 퀴즈 닫기 Broadcast 전파
 */
export async function broadcastQuizClose(
  webinarId: string,
  quizData: any,
  senderId: string
): Promise<boolean> {
  return broadcastToWebinar(webinarId, 'quiz:close', quizData, senderId)
}

/**
 * 설문 열기 Broadcast 전파
 */
export async function broadcastPollOpen(
  webinarId: string,
  pollData: any,
  senderId: string
): Promise<boolean> {
  return broadcastToWebinar(webinarId, 'poll:open', pollData, senderId)
}

/**
 * 설문 닫기 Broadcast 전파
 */
export async function broadcastPollClose(
  webinarId: string,
  pollData: any,
  senderId: string
): Promise<boolean> {
  return broadcastToWebinar(webinarId, 'poll:close', pollData, senderId)
}

/**
 * 추첨 시작 Broadcast 전파
 */
export async function broadcastRaffleStart(
  webinarId: string,
  raffleData: any,
  senderId: string
): Promise<boolean> {
  return broadcastToWebinar(webinarId, 'raffle:start', raffleData, senderId)
}

/**
 * 추첨 당첨자 발표 Broadcast 전파
 */
export async function broadcastRaffleDraw(
  webinarId: string,
  raffleData: any,
  senderId: string
): Promise<boolean> {
  return broadcastToWebinar(webinarId, 'raffle:draw', raffleData, senderId)
}

/**
 * 추첨 완료 Broadcast 전파
 */
export async function broadcastRaffleDone(
  webinarId: string,
  raffleData: any,
  senderId: string
): Promise<boolean> {
  return broadcastToWebinar(webinarId, 'raffle:done', raffleData, senderId)
}

