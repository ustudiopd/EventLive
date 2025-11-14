-- 커서 기반 페이지네이션을 위한 복합 인덱스
-- 목적: (created_at DESC, id DESC) 정렬과 일치하는 인덱스로 성능 최적화

-- 커서 페이지네이션 최적화를 위한 복합 인덱스
-- 정렬 순서와 동일하게 (webinar_id, created_at DESC, id DESC)
CREATE INDEX IF NOT EXISTS idx_messages_webinar_created_id
ON public.messages (webinar_id, created_at DESC, id DESC);

-- 기존 인덱스는 유지 (다른 쿼리 패턴에서 사용 가능)
-- idx_messages_webinar_id_id는 (webinar_id, id)로 유지

