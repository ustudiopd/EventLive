-- client_msg_id 칼럼 추가 및 인덱스 최적화
-- 목적: Optimistic 메시지와 실제 메시지의 정확한 1:1 매칭

-- client_msg_id 칼럼 추가
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS client_msg_id UUID;

-- 인덱스 생성 (조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_messages_client_msg_id 
ON public.messages(client_msg_id);

-- 증분 폴링 최적화를 위한 복합 인덱스 (webinar_id, id)
CREATE INDEX IF NOT EXISTS idx_messages_webinar_id_id
ON public.messages (webinar_id, id);

-- 고유 제약 조건 추가 (같은 웨비나/사용자에서 동일 client_msg_id 중복 방지)
-- 기존 제약 조건이 있을 수 있으므로 먼저 확인 후 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'messages_client_msg_unique'
  ) THEN
    ALTER TABLE public.messages
    ADD CONSTRAINT messages_client_msg_unique 
    UNIQUE (webinar_id, user_id, client_msg_id);
  END IF;
END $$;

-- 기존 메시지의 client_msg_id는 NULL로 유지 (호환성)
-- NULL 값은 유니크 제약 조건에서 제외되므로 기존 데이터와 호환됨

