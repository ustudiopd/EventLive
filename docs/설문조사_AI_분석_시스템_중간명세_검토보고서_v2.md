# 설문조사 AI 분석 시스템 중간명세 검토 보고서 v2

**검토 일자**: 2026-01-07  
**검토 대상**: `docs/설문조사_AI_분석_시스템_중간명세.md`  
**현재 구현 상태**: Phase A-C 완료 (Guideline Pack 기본 구조 + 통합 완료)

---

## 1. 전체 평가

### ✅ 명세서의 강점

1. **완전한 아키텍처 설계**: Registry 기반 "하드코딩 제거" 방향이 매우 명확합니다.
2. **실행 가능한 명세**: DB 스키마, API 엔드포인트, UI 구성까지 구체적으로 제시되어 있습니다.
3. **확장성 고려**: Role/Option/Card Template Registry를 통한 외부화는 장기적 유지보수에 유리합니다.
4. **문항 유동성 대응**: Fingerprint, Logical Key, Snapshot 전략이 체계적입니다.

### ⚠️ 현재 구현과의 차이점

1. **Registry 테이블 미구현**: Role/Option/Card Template Registry가 아직 DB 테이블로 구현되지 않았습니다.
2. **스키마 구조 차이**: 현재 gp-1.0 스키마와 명세서 제안 스키마가 약간 다릅니다.
3. **Decision Card Template Registry**: 아직 구현되지 않았습니다.

---

## 2. 상세 비교 분석

### 2.1 Guideline Pack 스키마 비교

#### 명세서 제안 (gp-1.0)
```typescript
interface GuidelinePackV10 {
  version: "gp-1.0"
  status: "draft" | "published"
  formFingerprint: string
  formRevision: number
  lens: "general" | "sales" | "marketing"
  decisionObjectives: {
    primaryQuestions: string[]
    successMetrics?: string[]
  }
  questionMap: QuestionGuideline[]
  analysisPlan: {
    crosstabs: CrosstabPlan[]
    leadScoring?: LeadScoringPlan
    segments?: SegmentPlan[]
    decisionCardPlan: DecisionCardPlan
  }
  changeLog?: { message: string; createdAt: string }[]
}
```

#### 현재 구현 (GP-1.0)
```typescript
interface GuidelinePack {
  version: "gp-1.0"
  formId: string
  formFingerprint: string
  objectives: {
    primaryDecisionQuestions: string[]
    reportLensDefault: "general" | "sales" | "marketing"
  }
  questionMap: QuestionMapItem[]
  crosstabPlan?: CrosstabPlanItem[]
  crosstabs?: CrosstabsConfig
  leadScoring: LeadScoring
  decisionCards?: DecisionCardsConfig
  validation?: ValidationRules
}
```

#### 차이점 분석

| 항목 | 명세서 | 현재 구현 | 평가 |
|------|--------|----------|------|
| **status** | Guideline Pack 내부 | DB 테이블에 저장 | ✅ DB 저장이 더 적절 (버전 관리 용이) |
| **formRevision** | 있음 | 없음 | ⚠️ **추가 필요** (문항 변경 추적) |
| **lens** | top-level | objectives 내부 | ⚠️ **구조 차이**, 명세서 방식이 더 명확 |
| **decisionObjectives** | primaryQuestions + successMetrics | primaryDecisionQuestions만 | ⚠️ **successMetrics 추가 가능** |
| **analysisPlan** | 별도 객체 | top-level | ⚠️ **구조 차이**, 명세서 방식이 더 체계적 |
| **segments** | 있음 | 없음 | ⚠️ **향후 추가 가능** |
| **decisionCardPlan** | 별도 객체 | decisionCards (간단) | ⚠️ **명세서 방식이 더 상세** |
| **changeLog** | 있음 | 없음 | ⚠️ **추가 필요** (히스토리 추적) |

### 2.2 QuestionGuideline 비교

#### 명세서 제안
```typescript
interface QuestionGuideline {
  questionId: string
  logicalKey?: string
  roleKey: string              // role registry의 key
  roleConfidence: "high" | "medium" | "low"
  importance: "key" | "support" | "ignore"
  optionTemplateKey?: string   // option template registry
  optionGroups?: Array<{
    groupKey: string
    label: string
    optionIds: string[]
    score?: number
  }>
  scoring?: {
    enabled: boolean
    scoringMode: "option" | "group" | "none"
    weight?: number
  }
}
```

#### 현재 구현
```typescript
interface QuestionMapItem {
  questionId: string
  logicalKey?: string
  orderNo: number
  role: Role
  importance: "core" | "supporting" | "ignore"
  questionType?: "single" | "multiple" | "text"
  label?: string
  optionMap?: OptionMap
  groups?: Record<string, OptionGroupDefinition>
  multiSelectStrategy?: "max" | "sumCap" | "binaryAny"
  optionGroups?: OptionGroup[]  // 레거시
  scoring?: QuestionScoring
}
```

#### 차이점 분석

| 항목 | 명세서 | 현재 구현 | 평가 |
|------|--------|----------|------|
| **roleKey** | role registry의 key | Role enum | ⚠️ **Registry 미구현**, 현재는 enum 사용 |
| **roleConfidence** | 있음 | 없음 | ⚠️ **추가 필요** (추정 신뢰도) |
| **importance** | "key" | "support" | "ignore" | "core" | "supporting" | "ignore" | ⚠️ **명칭 차이**, 매핑 필요 |
| **optionTemplateKey** | 있음 | 없음 | ⚠️ **Registry 미구현** |
| **scoringMode** | "option" | "group" | "none" | weightsByGroupKey/weightsByChoiceId | ⚠️ **구조 차이**, 명세서 방식이 더 명확 |
| **multiSelectStrategy** | 없음 | 있음 | ✅ **현재 구현이 더 상세** |

### 2.3 Registry 테이블 비교

#### 명세서 제안

1. **survey_engine_roles**: Role Registry
2. **survey_engine_option_templates**: Option Grouping Template Registry
3. **survey_engine_card_templates**: Decision Card Template Registry

#### 현재 구현

- ❌ **Registry 테이블 미구현**
- 현재는 코드에 하드코딩된 Role enum, Option grouping 로직, Decision Card 템플릿 없음

**평가**: Registry 테이블은 **장기적 확장성**을 위해 매우 중요하지만, 현재는 enum/코드 기반으로도 동작 가능합니다.

### 2.4 DB 스키마 비교

#### 명세서 제안
```sql
survey_analysis_guidelines (
  id, campaign_id, form_id,
  form_fingerprint, form_revision,
  status, version,
  guideline_pack jsonb,
  guideline_pack_compiled jsonb,  -- 컴파일 결과
  guideline_md text,               -- 사람이 보는 요약
  warnings jsonb,
  created_by, created_at, updated_at
)
```

#### 현재 구현
```sql
survey_analysis_guidelines (
  id, campaign_id, form_id,
  status, version_int,
  title, description,
  form_fingerprint,
  guideline_pack jsonb,
  agency_id, client_id,
  created_by, created_at, updated_at, published_at
)
```

#### 차이점 분석

| 항목 | 명세서 | 현재 구현 | 평가 |
|------|--------|----------|------|
| **form_revision** | 있음 | 없음 | ⚠️ **추가 필요** |
| **guideline_pack_compiled** | 있음 | 없음 | ⚠️ **추가 가능** (성능 최적화) |
| **guideline_md** | 있음 | 없음 | ✅ **렌더링 함수로 대체 가능** |
| **warnings** | 있음 | 없음 | ⚠️ **추가 가능** (검증 결과 저장) |
| **title, description** | 없음 | 있음 | ✅ **현재 구현이 더 사용자 친화적** |
| **published_at** | 없음 | 있음 | ✅ **현재 구현이 더 명확** |

### 2.5 Guideline 생성 엔진 비교

#### 명세서 제안 단계

1. **Step A**: Form Fingerprint 계산 ✅ 구현됨
2. **Step B**: 역할 부여 (Hard rule + Override + LLM fallback) ✅ 부분 구현 (LLM fallback 없음)
3. **Step C**: logical_key 자동 제안 ⚠️ 부분 구현 (자동 제안 없음)
4. **Step D**: Option Grouping 자동 제안 ⚠️ 부분 구현 (Registry 기반 자동 제안 없음)
5. **Step E**: 분석 계획 생성 ✅ 부분 구현 (규칙 기반만, LLM 보강 없음)
6. **Step F**: Lint & Compile ✅ 구현됨 (Lint는 있음, Compile은 없음)

#### 현재 구현 상태

- ✅ Form Fingerprint 계산
- ✅ 역할 부여 (Override 우선, Heuristic 기반)
- ⚠️ logical_key 자동 제안 없음 (수동 설정만)
- ⚠️ Option Grouping 자동 제안 없음 (LLM이 생성)
- ✅ 분석 계획 생성 (LLM 기반)
- ✅ Lint 검증
- ❌ Compile 단계 없음 (roleKey/logicalKey → questionId resolve 없음)

---

## 3. 명세서 제안사항 평가

### 3.1 Registry 테이블 도입 ⭐⭐⭐⭐⭐ (장기적 필수)

**명세서 제안**: Role/Option/Card Template Registry를 DB로 외부화

**현재 상태**: 코드에 하드코딩 (Role enum, Option grouping 로직)

**권장 개선**:
- **단기**: 현재 enum/코드 기반으로도 충분히 동작
- **장기**: Registry 테이블 도입으로 확장성 확보

**우선순위**: 중간 (현재는 선택사항, 향후 확장 시 필수)

### 3.2 form_revision 추가 ⭐⭐⭐⭐

**명세서 제안**: `form_revision` 필드로 문항 변경 추적

**현재 상태**: 없음

**권장 추가**:
```sql
ALTER TABLE survey_analysis_guidelines
  ADD COLUMN form_revision INT NOT NULL DEFAULT 1;
```

**우선순위**: 높음 (문항 변경 추적에 중요)

### 3.3 Compile 단계 도입 ⭐⭐⭐⭐

**명세서 제안**: roleKey/logicalKey → 실제 questionId로 resolve하는 컴파일 단계

**현재 상태**: 없음 (직접 questionId 사용)

**권장 구현**:
```typescript
function compileGuideline(
  guideline: GuidelinePack,
  currentQuestions: Question[]
): CompiledGuideline {
  // roleKey/logicalKey → questionId resolve
  // 존재하지 않는 참조 제거
  // 실행용 최적화된 config 생성
}
```

**우선순위**: 높음 (문항 유동성 대응에 필수)

### 3.4 Decision Card Template Registry ⭐⭐⭐

**명세서 제안**: Decision Card 템플릿을 Registry로 관리

**현재 상태**: 없음 (LLM이 자유롭게 생성)

**권장 추가**:
- 템플릿 Registry 테이블 생성
- dp-1.1에 templateId 필드 추가
- LLM이 allowedTemplateIds 안에서만 선택하도록 제한

**우선순위**: 중간 (품질 게이트 강화)

### 3.5 analysisPlan 구조 개선 ⭐⭐⭐

**명세서 제안**: crosstabs, leadScoring, segments, decisionCardPlan을 analysisPlan 객체로 묶기

**현재 상태**: top-level에 분산

**권장 개선**: 구조는 더 체계적이지만, 현재 구조도 충분히 동작함

**우선순위**: 낮음 (리팩토링은 선택사항)

---

## 4. 구현 우선순위 제안

### Phase D: Registry 기반 확장 (2-3주)

1. **form_revision 추가**
   - DB 마이그레이션
   - Guideline 생성 시 revision 계산

2. **Compile 단계 구현**
   - `compileGuideline` 함수
   - roleKey/logicalKey → questionId resolve
   - compiled config 저장

3. **Role Registry 테이블** (선택)
   - `survey_engine_roles` 테이블 생성
   - seed 데이터 마이그레이션
   - Role enum → Registry 조회로 전환

### Phase E: Decision Card Template (1-2주)

4. **Decision Card Template Registry**
   - `survey_engine_card_templates` 테이블 생성
   - dp-1.1 스키마에 templateId 추가
   - LLM 프롬프트에 templateId 제약 추가

5. **Option Template Registry** (선택)
   - `survey_engine_option_templates` 테이블 생성
   - 자동 Option Grouping 개선

### Phase F: 고급 기능 (1-2주)

6. **segments 추가**
   - SegmentPlan 스키마
   - 세그먼트 분석 로직

7. **changeLog 추가**
   - Guideline 수정 히스토리 추적

---

## 5. 명세서의 강점 요약

1. **완전한 아키텍처**: Registry 기반 설계로 확장성 확보
2. **실행 가능한 명세**: DB 스키마, API, UI까지 구체적
3. **문항 유동성 대응**: Fingerprint, Logical Key, Snapshot 전략
4. **품질 게이트**: Compile, Lint, Template Registry를 통한 검증

---

## 6. 결론 및 권장사항

### 전체 평가: ⭐⭐⭐⭐⭐ (5/5)

**명세서는 매우 완성도 높고 실행 가능한 수준입니다.** 현재 구현과 비교했을 때:

1. **방향성**: ✅ 완벽히 일치
2. **구체성**: ✅ 매우 구체적
3. **실현 가능성**: ✅ 높음 (대부분 이미 구현됨)
4. **확장성**: ✅ Registry 기반 설계로 장기적 유지보수 용이

### 즉시 적용 가능한 개선사항

1. **form_revision 추가** (높은 우선순위)
2. **Compile 단계 구현** (높은 우선순위)
3. **analysisPlan 구조 개선** (선택)

### 장기 개선 방향

1. **Registry 테이블 도입** (확장성)
2. **Decision Card Template Registry** (품질 게이트)
3. **segments 추가** (고급 분석)

---

## 7. 다음 단계 제안

1. **명세서의 form_revision, Compile 단계를 우선 구현**
2. **Registry 테이블은 선택적으로 단계적 도입**
3. **현재 구현과 명세서 제안을 점진적으로 통합**

명세서는 **현재 구현의 확장 가이드**로 활용하기에 매우 적합합니다.
