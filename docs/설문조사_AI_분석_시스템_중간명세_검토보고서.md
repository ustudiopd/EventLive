# 설문조사 AI 분석 시스템 중간명세 검토 보고서

**검토 일자**: 2026-01-06  
**검토 대상**: `docs/설문조사_AI_분석_시스템_중간명세.md`  
**현재 구현 상태**: Phase 1-4 완료 (기본 구조 구현됨)

---

## 1. 전체 평가

### ✅ 명세서의 강점

1. **구현 가능성**: 명세서가 제시한 방향은 현재 프로젝트의 구현 상태와 매우 잘 맞습니다.
2. **실무적 관점**: "옵션 그룹 매핑이 비어 있음", "다중선택 처리 전략 없음" 등 실제 구현 시 막히는 부분을 정확히 지적했습니다.
3. **구체적 예시**: 5문항용 gp-1.0 샘플이 실제 구현에 바로 활용 가능한 수준입니다.
4. **아키텍처 일관성**: 기존 ap-1.0/dp-1.0 파이프라인을 깨지 않고 확장하는 방향이 명확합니다.

### ⚠️ 현재 구현과의 차이점

1. **스키마 구조 차이**: 현재 구현된 스키마와 명세서 제안 스키마가 약간 다릅니다.
2. **Role Taxonomy 불일치**: 명세서의 표준화 제안과 현재 구현이 완전히 일치하지 않습니다.
3. **일부 기능 미구현**: reconcile, validation, decisionCards 연결 등이 아직 구현되지 않았습니다.

---

## 2. 상세 비교 분석

### 2.1 Guideline Pack 스키마 비교

#### 명세서 제안 (gp-1.0)
```typescript
{
  version: "gp-1.0"
  meta: { campaignId, formId, formFingerprint, status, ... }
  purpose: { lens, decisionQuestions }
  questions: Array<{
    questionId, logicalKey, role, importance, questionType,
    optionMap: { byOptionId?, byOptionText? },
    groups: Record<string, { title, description?, score? }>,
    multiSelectStrategy?: "max" | "sumCap" | "binaryAny"
  }>
  crosstabs: { pinned, autoPick }
  leadScoring: { enabled, components, normalize, tiers, recommendedActions }
  decisionCards: { preferredTemplates, allowTemplates? }
  validation: { minSampleCountToUseLeadScoring, requireRolesForLeadScoringAny, ... }
}
```

#### 현재 구현 (GP-1.0)
```typescript
{
  version: "gp-1.0"
  formId, formFingerprint
  objectives: { primaryDecisionQuestions, reportLensDefault }
  questionMap: Array<{
    questionId, orderNo, role, importance,
    label?, optionGroups?, scoring?
  }>
  crosstabPlan: Array<{ rowRole, colRole, minCellN, topKRows, topKCols, note? }>
  leadScoring: { enabled, tierThresholds, components, recommendedActionsByTier }
}
```

#### 차이점 분석

| 항목 | 명세서 | 현재 구현 | 평가 |
|------|--------|----------|------|
| **meta 필드** | 별도 객체 | 없음 (DB에 저장) | ✅ DB에 저장되므로 문제 없음 |
| **logicalKey** | questions 내부 | 없음 | ⚠️ **추가 필요** (문항 유동성 대응) |
| **optionMap 구조** | byOptionId/byOptionText | optionGroups (배열) | ⚠️ **구조 차이**, 명세서 방식이 더 유연함 |
| **groups 스코어** | groups 내부에 score | scoring 별도 객체 | ⚠️ **구조 차이**, 명세서 방식이 더 직관적 |
| **multiSelectStrategy** | 있음 | 없음 | ⚠️ **추가 필요** (다중선택 처리) |
| **crosstabs 구조** | pinned + autoPick | crosstabPlan (배열) | ⚠️ **구조 차이**, 명세서 방식이 더 명확함 |
| **decisionCards** | 있음 | 없음 | ⚠️ **추가 필요** (템플릿 연결) |
| **validation** | 있음 | 없음 | ⚠️ **추가 필요** (발행 게이트) |

### 2.2 Role Taxonomy 비교

#### 명세서 권장 (표준화)
```
timeline, intent_followup, usecase_project_type, budget_status, 
authority, channel_preference, need_pain, barrier_risk, 
company_profile, free_text_voice, other
```

#### 현재 구현
```
timeline, need_area, budget_status, authority_level, 
engagement_intent, other
```

#### 매핑 관계
| 명세서 | 현재 구현 | 매핑 상태 |
|--------|----------|----------|
| `timeline` | `timeline` | ✅ 일치 |
| `intent_followup` | `engagement_intent` | ⚠️ 이름 불일치 (매핑 함수로 해결 중) |
| `usecase_project_type` | `need_area` | ⚠️ 이름 불일치 (매핑 함수로 해결 중) |
| `budget_status` | `budget_status` | ✅ 일치 |
| `authority` | `authority_level` | ⚠️ 이름 불일치 (매핑 함수로 해결 중) |

**현재 해결 방법**: `applyGuidelineToMetrics.ts`에서 매핑 함수로 변환 중  
**권장 개선**: 명세서 제안대로 표준 taxonomy로 통일

### 2.3 기능 구현 상태

#### ✅ 구현 완료
- [x] Guideline Pack 기본 구조 (DB, 스키마, 생성)
- [x] Form Fingerprint 생성
- [x] Survey Blueprint 생성
- [x] Guideline Linter (기본 검증)
- [x] Guideline 생성/조회/수정/발행 API
- [x] Guideline 적용 유틸리티 (role 매핑)
- [x] Markdown 렌더링

#### ⚠️ 부분 구현
- [ ] **옵션 그룹 매핑**: 구조는 있으나 `byOptionId/byOptionText` 방식 미지원
- [ ] **다중선택 전략**: `multiSelectStrategy` 필드 없음
- [ ] **교차표 pinned/autoPick**: 현재는 `crosstabPlan` 배열만 지원
- [ ] **리드 스코어링 적용**: Guideline의 규칙이 실제 계산에 반영되지 않음

#### ❌ 미구현
- [ ] **logicalKey**: 문항 안정 키 지원 없음
- [ ] **reconcileGuideline**: Fingerprint mismatch 시 자동 조정 없음
- [ ] **validation 엔드포인트**: 발행 전 검증 API 없음
- [ ] **decisionCards 연결**: 템플릿 선택/우선순위 기능 없음
- [ ] **buildAnalysisPack 통합**: Guideline이 실제 분석에 적용되지 않음
- [ ] **snapshot 지원**: form_answers에 문항 스냅샷 저장 없음

---

## 3. 명세서 제안사항 평가

### 3.1 옵션 그룹 매핑 보강 ⭐⭐⭐⭐⭐ (최우선)

**명세서 지적**: "옵션 그룹 매핑이 비어 있음"  
**현재 상태**: `optionGroups` 배열 구조는 있으나, 실제 옵션 ID/텍스트와의 매핑이 불명확

**권장 개선**:
```typescript
// 현재
optionGroups?: Array<{
  groupKey: string
  groupLabel: string
  choiceIds: string[]
}>

// 명세서 제안 (더 유연)
optionMap?: {
  byOptionId?: Record<string, { groupKey: string }>
  byOptionText?: Record<string, { groupKey: string }>
}
groups?: Record<string, {
  title: string
  description?: string
  score?: number
}>
```

**우선순위**: 최우선 (다른 기능의 기반)

### 3.2 다중선택 처리 전략 ⭐⭐⭐⭐

**명세서 지적**: "다중선택(문항2)에 대한 처리 전략이 없음"  
**현재 상태**: 다중선택 문항에 대한 특별 처리 없음

**권장 추가**:
```typescript
multiSelectStrategy?: "max" | "sumCap" | "binaryAny"
```

**우선순위**: 높음 (리드 스코어링 정확도에 영향)

### 3.3 Role Taxonomy 표준화 ⭐⭐⭐⭐

**명세서 제안**: `engagement_intent` → `intent_followup`, `authority_level` → `authority` 등

**현재 상태**: 매핑 함수로 해결 중이지만, 근본적으로는 표준 taxonomy로 통일 필요

**권장 개선**:
1. `guidelinePackSchema.ts`의 `RoleSchema`를 명세서 제안대로 확장
2. 기존 데이터 마이그레이션 (또는 호환성 유지)
3. `roleInference.ts`도 표준 taxonomy 사용

**우선순위**: 높음 (시스템 일관성)

### 3.4 Fingerprint Mismatch 처리 ⭐⭐⭐

**명세서 제안**: reconcile + 경고 + lead scoring 제한  
**현재 상태**: Fingerprint는 생성/저장되지만, mismatch 시 처리 로직 없음

**권장 구현**:
```typescript
// lib/surveys/analysis/reconcileGuideline.ts
export function reconcileGuideline(
  guideline: GuidelinePack,
  currentFormFingerprint: string
): {
  canReconcile: boolean
  confidence: number
  warnings: string[]
  reconciled?: GuidelinePack
}
```

**우선순위**: 중간 (운영 안정성)

### 3.5 Decision Cards 템플릿 연결 ⭐⭐⭐

**명세서 제안**: `decisionCards.preferredTemplates`로 카드 템플릿 제어  
**현재 상태**: Decision Pack 생성 시 템플릿 선택 기능 없음

**권장 추가**:
```typescript
decisionCards: {
  preferredTemplates: CardTemplateId[]
  allowTemplates?: CardTemplateId[]
}
```

**우선순위**: 중간 (향후 개선)

---

## 4. 구현 우선순위 제안

### Phase A: 핵심 보강 (1-2주)

1. **옵션 그룹 매핑 구조 개선**
   - `optionMap` (byOptionId/byOptionText) 지원
   - `groups` 스코어 구조 통합
   - 기존 `optionGroups`와 호환성 유지

2. **다중선택 전략 추가**
   - `multiSelectStrategy` 필드 추가
   - 리드 스코어링 계산에 반영

3. **Role Taxonomy 표준화**
   - 표준 role 세트로 확장
   - 기존 데이터 마이그레이션 또는 호환성 레이어

### Phase B: 안정성 강화 (1주)

4. **logicalKey 지원**
   - `form_questions.logical_key` 컬럼 추가
   - Guideline에 logicalKey 저장/매칭

5. **Fingerprint Mismatch 처리**
   - `reconcileGuideline` 함수 구현
   - 보고서 생성 시 자동 reconcile + 경고

6. **Validation 엔드포인트**
   - `POST /api/.../guidelines/[id]/validate` 구현
   - 발행 전 필수 검증

### Phase C: 고급 기능 (1-2주)

7. **buildAnalysisPack 통합**
   - Guideline의 role/옵션 그룹/스코어 규칙 적용
   - pinned crosstab 생성
   - 리드 스코어링 계산에 Guideline 규칙 반영

8. **Decision Cards 템플릿 연결**
   - 템플릿 Registry 구조 설계
   - Guideline의 preferredTemplates 반영

9. **Snapshot 지원** (선택)
   - `form_answers`에 문항 스냅샷 저장
   - 재현성 보장

---

## 5. 명세서 샘플 검토

명세서의 5문항용 gp-1.0 샘플(466-625줄)은 **현재 구현에 바로 적용 가능한 수준**입니다.

### ✅ 잘 된 점
- 옵션 그룹 매핑이 구체적으로 채워져 있음
- 스코어 값이 명시되어 있음
- 다중선택 전략(`max`)이 명시되어 있음
- 교차표 계획이 구체적임
- 리드 스코어링 티어/액션이 명확함

### ⚠️ 주의사항
- 실제 옵션 ID는 DB에서 가져와야 함 (`byOptionText`는 fallback)
- Role 이름이 현재 구현과 다름 (매핑 필요)

---

## 6. 결론 및 권장사항

### 전체 평가: ⭐⭐⭐⭐ (4/5)

**명세서는 매우 실무적이고 구현 가능한 수준입니다.** 현재 프로젝트의 구현 상태와 비교했을 때:

1. **방향성**: ✅ 완벽히 일치
2. **구체성**: ✅ 매우 구체적
3. **실현 가능성**: ✅ 높음 (대부분 이미 구현됨)
4. **보완 필요**: ⚠️ 옵션 매핑, 다중선택 전략, reconcile 등 추가 필요

### 즉시 적용 가능한 개선사항

1. **옵션 그룹 매핑 구조 개선** (최우선)
2. **다중선택 전략 추가**
3. **Role Taxonomy 표준화**
4. **Fingerprint Mismatch 처리**

### 장기 개선 방향

1. **Decision Cards 템플릿 Registry**
2. **Snapshot 지원** (재현성)
3. **고급 reconcile 로직**

---

## 7. 다음 단계 제안

1. **명세서의 샘플을 실제 DB 데이터로 변환하여 테스트**
2. **옵션 매핑 구조 개선 작업 시작** (Phase A-1)
3. **명세서의 스키마 제안을 현재 스키마에 점진적으로 통합**

명세서는 **현재 구현의 보완 가이드**로 활용하기에 매우 적합합니다.
