/**
 * Webinar Realtime Broadcast 이벤트 타입 정의
 * 
 * Broadcast 중심 아키텍처로 전환하여 RLS 영향 제거 및 재연결 문제 해결
 */

/**
 * Broadcast 이벤트 타입
 */
export type BroadcastEventType =
  | 'chat:new'
  | 'chat:update'
  | 'chat:delete'
  | 'quiz:open'
  | 'quiz:answer'
  | 'quiz:close'
  | 'poll:open'
  | 'poll:vote'
  | 'poll:close'
  | 'raffle:start'
  | 'raffle:draw'
  | 'raffle:done'
  | 'typing'

/**
 * Broadcast Envelope 구조
 * 모든 Broadcast 이벤트는 이 구조를 따릅니다.
 */
export type BroadcastEnvelope<T = any> = {
  v: 1 // schema version
  t: BroadcastEventType // event type
  mid?: string // client_msg_id (중복 방지/낙관적 교체)
  sid: string // sender user id
  ts: number // Date.now() 송신 시각
  payload: T // 도메인 데이터
  sig?: string // (선택) 호스트 제어 이벤트 서명
}

/**
 * Chat 메시지 payload 타입
 */
export type ChatMessagePayload = {
  id: number
  webinar_id: string
  user_id: string
  content: string
  created_at: string
  hidden?: boolean
  client_msg_id?: string
  user?: {
    id: string
    display_name?: string
    email?: string
  }
}

/**
 * Broadcast Envelope 검증
 */
export function isValidBroadcastEnvelope(env: any): env is BroadcastEnvelope {
  return (
    env &&
    typeof env === 'object' &&
    env.v === 1 &&
    typeof env.t === 'string' &&
    typeof env.sid === 'string' &&
    typeof env.ts === 'number' &&
    typeof env.payload === 'object'
  )
}

/**
 * Broadcast Envelope 생성 헬퍼
 */
export function createBroadcastEnvelope<T>(
  eventType: BroadcastEventType,
  payload: T,
  senderId: string,
  clientMsgId?: string,
  signature?: string
): BroadcastEnvelope<T> {
  return {
    v: 1,
    t: eventType,
    mid: clientMsgId,
    sid: senderId,
    ts: Date.now(),
    payload,
    sig: signature,
  }
}

