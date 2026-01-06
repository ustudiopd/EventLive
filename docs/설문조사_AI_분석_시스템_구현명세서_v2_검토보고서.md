# 설문조사 AI 분석 시스템 구현명세서 v2 검토 보고서

**검토일**: 2026-01-06  
**검토 대상**: `docs/설문조사_AI_분석_시스템_구현명세서_v2.md`  
**현재 시스템**: Analysis Pack (ap-1.0) + Decision Pack (dp-1.0) 2단계 파이프라인

---

## 1. 현재 상태 분석 (명세서 v2의 진단 정확성)

### ✅ 정확한 진단

1. **역할 자동추정 한계**
   - 현재 `roleInference.ts`는 `timeframe`, `project_type`, `followup_intent`, `other` 4개만 지원
   - 예산/권한 문항이 `other`로 분류되어 교차표/리드스코어링에서 제외됨
   - **명세서의 진단이 정확함**

2. **부분 대응 상태**
   - 문항별 분포/Evidence Catalog에는 모든 문항 포함 ✅
   - 교차표/리드스코어링은 role 기반으로만 동작 ⚠️
   - **명세서의 평가가 정확함**

3. **디시전카드 중심 설계 부족**
   - 현재 Decision Pack은 Evidence 기반이지만, "예산+권한 있는 단기 리드" 같은 복합 조건이 자동으로 강화되지 않음
   - **명세서의 결론이 타당함**

### ⚠️ 보완 필요 사항

1. **현재 시스템의 강점 언급 부족**
   - `analysis_role_override` 컬럼이 이미 존재하여 수동 override 가능
   - 정규화 모듈(`normalizeQuestions`, `normalizeAnswers`)로 동적 문항 처리 가능
   - Evidence Catalog로 재현성 확보

2. **점진적 개선 경로 제시 부족**
   - Guideline Pack 전체 구현 전에, 기존 시스템 확장으로도 부분 해결 가능

---

## 2. Guideline Pack 제안의 타당성 평가

### ✅ 강력한 타당성

1. **BANT 완전 커버**
   - 현재: Budget/Authority가 `other`로 분류되어 활용도 낮음
   - 제안: `budget_status`, `authority_level` 명시적 역할로 BANT 완전 지원
   - **비즈니스 가치가 명확함**

2. **재현성 및 추적성**
   - 폼 변경 감지(fingerprint)로 지침 stale 여부 자동 감지
   - 보고서에 사용된 지침 스냅샷 저장으로 재현성 확보
   - **운영/디버깅 관점에서 매우 유용**

3. **사람의 의도 반영**
   - "이번 캠페인은 예산보다 권한을 더 보자" 같은 운영 의도 반영 가능
   - 선택지 그룹핑(단기/중기/장기)으로 보고서 가독성 향상
   - **실무 활용도가 높음**

### ⚠️ 고려 사항

1. **복잡도 증가**
   - 현재: 2단계 파이프라인 (Analysis → Decision)
   - 제안: 3단계 파이프라인 (Guideline → Analysis → Decision)
   - UI 추가 (지침 편집 화면)
   - **학습 곡선 및 유지보수 비용 증가**

2. **점진적 도입 전략 필요**
   - 모든 기능을 한 번에 구현하기보다, 단계적 확장이 현실적

---

## 3. 구현 가능성 및 기술적 검토

### ✅ 기술적 실현 가능성

1. **기존 인프라 활용**
   - Next.js Route Handler 패턴 그대로 사용 가능
   - Supabase JSONB로 Guideline Pack 저장 (기존 `analysis_pack`, `decision_pack` 패턴과 동일)
   - Zod 스키마 검증 패턴 재사용 가능
   - **기술적 부담이 낮음**

2. **기존 코드와의 호환성**
   - `buildAnalysisPack.ts`에 guideline 적용 훅만 추가하면 됨
   - `generateDecisionPack.ts`에 guideline 프롬프트 포함만 추가
   - **기존 코드 대규모 수정 불필요**

### ⚠️ 주의 사항

1. **LLM 호출 추가**
   - Guideline Pack 생성 시 LLM 호출 필요 (JSON mode)
   - 기존 Decision Pack 생성과 동일한 패턴이지만, 비용/지연 시간 증가
   - **재시도/폴백 전략 필수**

2. **UI 복잡도**
   - 문항 매핑 에디터, 옵션 그룹핑 UI, 리드 스코어링 설정 등
   - **프론트엔드 개발 리소스 필요**

---

## 4. 명세서의 강점

### ✅ 매우 잘 설계된 부분

1. **명확한 아키텍처**
   - 3단계 Pack 구조가 논리적이고 확장 가능
   - 폼 fingerprint로 변경 감지 자동화
   - Publish 개념으로 버전 관리 명확

2. **실무 중심 설계**
   - HPE 네트워크 캠페인 예시로 구체적 가치 제시
   - BANT 기반 리드 스코어링으로 영업 활용도 높음
   - 디시전카드 질문 후보로 의사결정 지원 강화

3. **구현 가이드 상세**
   - DB 스키마, API 명세, 서버 코드 구조, UI/UX까지 포함
   - 마이그레이션 순서 제시
   - Lint/검증 규칙 명시

---

## 5. 개선 제안

### 5.1 단계적 구현 전략 제안

**Phase 1: 핵심 기능만 (MVP)**
1. Role taxonomy 확장 (`budget_status`, `authority_level` 추가)
2. `analysis_role_override` UI 개선 (드롭다운에 새 역할 추가)
3. 교차표/리드스코어링에 새 역할 반영
4. **목표**: 예산/권한 문항이 교차표/리드스코어링에 포함되도록

**Phase 2: Guideline Pack 기본 구조**
1. DB 테이블 생성 (`survey_analysis_guidelines`)
2. GuidelinePack 스키마 (Zod)
3. 자동 생성 API (LLM 기반)
4. **목표**: 지침 자동 생성 및 저장

**Phase 3: Guideline 적용**
1. `buildAnalysisPack`에 guideline 적용 로직
2. `generateDecisionPack`에 guideline 프롬프트 포함
3. 보고서 생성 시 guideline 사용
4. **목표**: 지침 기반 분석 파이프라인 동작

**Phase 4: UI 및 고급 기능**
1. 지침 편집 UI
2. Publish 기능
3. 선택지 그룹핑 UI
4. 리드 스코어링 설정 UI
5. **목표**: 완전한 지침 관리 시스템

### 5.2 명세서 보완 제안

1. **하위 호환성 명시**
   - Guideline이 없을 때 기존 동작 유지 (auto-guideline 생성)
   - 기존 보고서는 그대로 유지

2. **성능 고려사항 추가**
   - Guideline Pack 생성 시 LLM 호출 시간/비용
   - 폼 fingerprint 계산 비용 (SHA256)
   - 대량 캠페인에서의 인덱스 최적화

3. **에러 처리 전략**
   - Guideline 생성 실패 시 폴백 (기존 role 추정 사용)
   - Stale guideline 감지 시 자동 재생성 옵션

4. **테스트 전략**
   - Guideline Pack 스키마 검증 테스트
   - 폼 변경 감지 테스트
   - 교차표/리드스코어링 guideline 적용 테스트

---

## 6. 최종 평가 및 권장사항

### ✅ 전체적으로 매우 우수한 명세서

**강점:**
- 현재 시스템의 한계를 정확히 진단
- BANT 완전 커버로 비즈니스 가치 명확
- 기술적 실현 가능성 높음
- 단계적 구현 경로 제시

**권장사항:**

1. **즉시 구현 가능 (Phase 1)**
   - Role taxonomy 확장만으로도 큰 가치
   - 기존 코드 수정 최소화
   - 빠른 ROI

2. **중기 구현 (Phase 2-3)**
   - Guideline Pack 기본 구조
   - 자동 생성 및 적용
   - 재현성 확보

3. **장기 구현 (Phase 4)**
   - 완전한 UI 및 고급 기능
   - 사용자 편의성 극대화

### ⚠️ 주의사항

1. **복잡도 관리**
   - 단계적 도입으로 리스크 최소화
   - 각 단계마다 검증 및 피드백 수집

2. **사용자 교육**
   - Guideline Pack 개념 및 사용법 교육 필요
   - 기본 템플릿 제공으로 진입 장벽 낮추기

3. **성능 모니터링**
   - LLM 호출 시간/비용 추적
   - 폼 fingerprint 계산 성능 확인

---

## 7. 결론

명세서 v2는 **현재 시스템의 한계를 정확히 진단하고, 실용적인 해결책을 제시**하는 우수한 설계 문서입니다. 

**즉시 시작 가능한 작업:**
- Role taxonomy 확장 (`budget_status`, `authority_level` 추가)
- `analysis_role_override` UI 개선
- 교차표/리드스코어링에 새 역할 반영

**중기 목표:**
- Guideline Pack 기본 구조 구현
- 자동 생성 및 적용 파이프라인 구축

**장기 비전:**
- 완전한 지침 관리 시스템
- 사용자 친화적 UI 및 고급 기능

전체 구현은 복잡하지만, 단계적 접근으로 리스크를 관리하면서 가치를 단계적으로 제공할 수 있습니다.
