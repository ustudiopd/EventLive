-- 마이그레이션: Registry 초기 데이터 (Seed)
-- 명세서 기반: 표준 Role/Option/Card Template 데이터

begin;

-- 1. Role Registry 초기 데이터
insert into public.survey_engine_roles (role_key, label_ko, label_en, allowed_question_types, pattern_rules, default_is_key_driver, default_scoring_hint)
values
  ('timeline', '타임라인', 'Timeline', '["single","multiple"]'::jsonb, 
   '{"keywords": ["언제", "시기", "계획", "기간", "도입", "구매", "예정"], "optionPatterns": ["1주", "2주", "1개월", "3개월", "6개월", "올해", "내년", "즉시"]}'::jsonb,
   true, '{"highScore": "단기", "lowScore": "장기"}'::jsonb),
  
  ('intent_followup', '접촉 의향', 'Follow-up Intent', '["single","multiple"]'::jsonb,
   '{"keywords": ["의향", "요청", "연락", "미팅", "데모", "상담", "제안", "자료", "방문", "컨택"], "optionPatterns": ["방문", "전화", "온라인", "데모", "자료", "관심 없음"]}'::jsonb,
   true, '{"highScore": "높은 의향", "lowScore": "낮은 의향"}'::jsonb),
  
  ('usecase_project_type', '프로젝트 유형', 'Project Type', '["single","multiple"]'::jsonb,
   '{"keywords": ["프로젝트", "분야", "영역", "종류", "유형", "적용", "용도", "사용", "구축"], "optionPatterns": ["데이터센터", "보안", "네트워크", "클라우드"]}'::jsonb,
   false, null),
  
  ('budget_status', '예산 상태', 'Budget Status', '["single"]'::jsonb,
   '{"keywords": ["예산", "확보", "예산이", "예산은"], "optionPatterns": ["예", "아니오", "확보", "미확보"]}'::jsonb,
   true, '{"highScore": "예산 확보", "lowScore": "미확보"}'::jsonb),
  
  ('authority', '의사결정 권한', 'Authority', '["single"]'::jsonb,
   '{"keywords": ["권한", "담당자", "의사결정", "구매", "Authorized Buyer", "결정권"], "optionPatterns": ["예", "아니오", "권한", "담당자"]}'::jsonb,
   true, '{"highScore": "결정권 보유", "lowScore": "비결정권"}'::jsonb),
  
  ('channel_preference', '채널 선호도', 'Channel Preference', '["single","multiple"]'::jsonb,
   '{"keywords": ["채널", "선호", "방식", "연락"], "optionPatterns": ["이메일", "전화", "방문", "온라인"]}'::jsonb,
   false, null),
  
  ('need_pain', '니즈/페인', 'Need/Pain', '["single","multiple","text"]'::jsonb,
   '{"keywords": ["문제", "어려움", "불편", "개선", "필요"], "optionPatterns": []}'::jsonb,
   false, null),
  
  ('barrier_risk', '장벽/리스크', 'Barrier/Risk', '["single","multiple","text"]'::jsonb,
   '{"keywords": ["장벽", "리스크", "우려", "걱정", "방해"], "optionPatterns": []}'::jsonb,
   false, null),
  
  ('company_profile', '회사 프로필', 'Company Profile', '["single","multiple","text"]'::jsonb,
   '{"keywords": ["회사", "규모", "업종", "산업"], "optionPatterns": []}'::jsonb,
   false, null),
  
  ('free_text_voice', '자유 텍스트 의견', 'Free Text Voice', '["text"]'::jsonb,
   '{"keywords": [], "optionPatterns": []}'::jsonb,
   false, null),
  
  ('other', '기타', 'Other', '["single","multiple","text"]'::jsonb,
   '{"keywords": [], "optionPatterns": []}'::jsonb,
   false, null)
on conflict (role_key) do update set
  label_ko = excluded.label_ko,
  label_en = excluded.label_en,
  pattern_rules = excluded.pattern_rules,
  default_is_key_driver = excluded.default_is_key_driver,
  updated_at = now();

-- 2. Option Template Registry 초기 데이터
insert into public.survey_engine_option_templates (template_key, label_ko, label_en, detection_rules, canonical_groups)
values
  ('time_buckets', '시간 구간', 'Time Buckets', 
   '{"keywords": ["개월", "년", "주", "일"], "optionCount": {"min": 3, "max": 10}}'::jsonb,
   '[
     {"groupKey": "immediate", "label": "즉시", "score": 100, "order": 1},
     {"groupKey": "short", "label": "단기", "score": 80, "order": 2},
     {"groupKey": "mid", "label": "중기", "score": 50, "order": 3},
     {"groupKey": "long", "label": "장기", "score": 30, "order": 4},
     {"groupKey": "no_plan", "label": "계획없음", "score": 0, "order": 5}
   ]'::jsonb),
  
  ('yes_no', '예/아니오', 'Yes/No',
   '{"keywords": ["예", "아니오", "yes", "no"], "optionCount": {"min": 2, "max": 2}}'::jsonb,
   '[
     {"groupKey": "yes", "label": "예", "score": 100, "order": 1},
     {"groupKey": "no", "label": "아니오", "score": 0, "order": 2}
   ]'::jsonb),
  
  ('likert_5', '5점 척도', 'Likert 5-Point',
   '{"optionCount": {"min": 5, "max": 5}, "patterns": ["매우", "약간", "보통"]}'::jsonb,
   '[
     {"groupKey": "strong_agree", "label": "매우 동의", "score": 100, "order": 1},
     {"groupKey": "agree", "label": "동의", "score": 75, "order": 2},
     {"groupKey": "neutral", "label": "보통", "score": 50, "order": 3},
     {"groupKey": "disagree", "label": "비동의", "score": 25, "order": 4},
     {"groupKey": "strong_disagree", "label": "매우 비동의", "score": 0, "order": 5}
   ]'::jsonb),
  
  ('none', '그룹핑 없음', 'No Grouping',
   '{"optionCount": {"min": 1, "max": 100}}'::jsonb,
   '[]'::jsonb)
on conflict (template_key) do update set
  label_ko = excluded.label_ko,
  detection_rules = excluded.detection_rules,
  canonical_groups = excluded.canonical_groups,
  updated_at = now();

-- 3. Decision Card Template Registry 초기 데이터
insert into public.survey_engine_card_templates (template_id, title, description, required_roles, required_evidence_types, prompt_snippet, output_constraints)
values
  ('lead_immediate_contact', '즉시 컨택 리드', '타임라인과 접촉 의향이 높은 리드를 식별',
   '["timeline", "intent_followup"]'::jsonb,
   '["lead_signal", "crosstab"]'::jsonb,
   '타임라인이 단기(1개월 이내)이고 접촉 의향이 높은 리드를 식별하여 즉시 컨택이 필요한 리드 카드를 생성하세요.',
   '{"minEvidenceCount": 2, "forbidAllHypothesis": true}'::jsonb),
  
  ('timeline_focus', '타임라인 중심 전략', '프로젝트 타임라인에 따른 우선순위 전략',
   '["timeline"]'::jsonb,
   '["question_stat", "crosstab"]'::jsonb,
   '프로젝트 타임라인 분포를 분석하여 단기/중기/장기별 전략 카드를 생성하세요.',
   '{"minEvidenceCount": 1}'::jsonb),
  
  ('budget_authority_priority', '예산/권한 우선순위', '예산 확보 및 의사결정 권한을 가진 리드 우선순위',
   '["budget_status", "authority"]'::jsonb,
   '["lead_signal", "crosstab"]'::jsonb,
   '예산이 확보되고 의사결정 권한이 있는 리드를 우선순위로 식별하는 카드를 생성하세요.',
   '{"minEvidenceCount": 2}'::jsonb),
  
  ('followup_script', '접촉 스크립트', '접촉 의향과 채널 선호도에 따른 맞춤 스크립트',
   '["intent_followup", "channel_preference"]'::jsonb,
   '["question_stat", "crosstab"]'::jsonb,
   '접촉 의향과 선호 채널을 분석하여 맞춤형 접촉 스크립트 카드를 생성하세요.',
   '{"minEvidenceCount": 1}'::jsonb)
on conflict (template_id) do update set
  title = excluded.title,
  description = excluded.description,
  required_roles = excluded.required_roles,
  required_evidence_types = excluded.required_evidence_types,
  prompt_snippet = excluded.prompt_snippet,
  output_constraints = excluded.output_constraints,
  updated_at = now();

commit;
