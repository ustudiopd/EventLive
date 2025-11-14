-- 질문 답변 내용을 저장할 컬럼 추가
ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS answer TEXT;

-- 답변 내용에 대한 인덱스 추가 (선택사항, 검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_questions_answer ON public.questions(answer) WHERE answer IS NOT NULL;

