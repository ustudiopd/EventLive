# 설문조사 AI 분석 시스템 명세서 검토 보고서

**검토일**: 2026-01-06  
**검토자**: AI Assistant  
**명세서 버전**: 1.0

---

## 1. 전체 평가

### 1.1 강점 ✅

1. **구조적 완성도**: 기본 명세서(1-11장)가 체계적으로 구성되어 있음
2. **동적 처리 설명**: 문항 수 변경에 대한 자동 적응 메커니즘이 명확히 설명됨
3. **실용적 예시**: 3개/5개/10개 문항 설문조사별 생성 결과 예시 제공
4. **향후 개선 방향**: 고급 설계 패키지로 확장 가능성 제시

### 1.2 개선 필요 사항 ⚠️

1. **현재 구현 vs 향후 계획 혼재**: 기본 명세서와 고급 설계가 구분되지 않음
2. **버전 정보 불일치**: 실제 코드는 `ap-1.0`/`dp-1.0`, 고급 설계는 `ap-1.1`/`dp-1.1` 제안
3. **스키마 필드 누락**: 실제 스키마에 없는 필드들이 명세서에 언급됨
4. **파일 구조 불일치**: 일부 파일이 실제 구조와 다름

---

## 2. 상세 검토 결과

### 2.1 현재 구현 상태 vs 명세서 일치성

#### ✅ 일치하는 부분

| 항목 | 실제 코드 | 명세서 | 상태 |
|-----|---------|--------|------|
| Analysis Pack 버전 | `ap-1.0` | `ap-1.0` | ✅ 일치 |
| Decision Pack 버전 | `dp-1.0` | `dp-1.0` | ✅ 일치 |
| 문항 역할 추정 | `timeframe`, `project_type`, `followup_intent`, `other` | 동일 | ✅ 일치 |
| Evidence Catalog 구조 | `E1`, `E2`, ... | 동일 | ✅ 일치 |
| Decision Cards 구조 | `question`, `options`, `recommendation`, `evidenceIds` | 동일 | ✅ 일치 |
| Action Board 구조 | `d0`, `d7`, `d14` | 동일 | ✅ 일치 |

#### ⚠️ 불일치하는 부분

| 항목 | 실제 코드 | 명세서 | 문제점 |
|-----|---------|--------|--------|
| Decision Card `templateId` | ❌ 없음 | ✅ 있음 (고급 설계) | 향후 계획이 현재 상태로 오인될 수 있음 |
| Analysis Pack `analysisPlan` | ❌ 없음 | ✅ 있음 (고급 설계) | 향후 계획이 현재 상태로 오인될 수 있음 |
| Evidence `type` 필드 | ❌ 없음 | ✅ 있음 (고급 설계) | 향후 계획이 현재 상태로 오인될 수 있음 |
| Evidence `reliability` 필드 | ❌ 없음 | ✅ 있음 (고급 설계) | 향후 계획이 현재 상태로 오인될 수 있음 |
| Question `semantics` 필드 | ❌ 없음 | ✅ 있음 (고급 설계) | 향후 계획이 현재 상태로 오인될 수 있음 |

### 2.2 파일 구조 검증

#### ✅ 실제 존재하는 파일

```
lib/surveys/analysis/
├── buildAnalysisPack.ts          ✅ 존재
├── buildComputedMetrics.ts       ✅ 존재
├── generateDecisionPack.ts       ✅ 존재
├── mergeAnalysisAndDecisionPack.ts  ✅ 존재
├── renderFinalReportMD.ts        ✅ 존재
├── renderAnalysisPackMD.ts       ✅ 존재
├── analysisPackSchema.ts         ✅ 존재
├── decisionPackSchema.ts         ✅ 존재
└── lintDecisionPack.ts          ✅ 존재 (추정)
```

#### ⚠️ 명세서에 언급되었으나 확인 필요

- `cardTemplates.ts`: 고급 설계에서 제안된 파일 (현재 없음)

### 2.3 스키마 검증

#### Analysis Pack Schema (ap-1.0)

**실제 스키마**:
```typescript
{
  version: 'ap-1.0',
  campaign: { id, title, analyzedAtISO, sampleCount, totalQuestions },
  questions: Array<{ questionId, questionBody, questionType, responseCount, topChoices? }>,
  evidenceCatalog: Array<{ id, title, metric, valueText, n, source, notes? }>,
  crosstabs: Array<{ id, rowQuestionId, rowQuestionBody, colQuestionId, colQuestionBody, ... }>,
  highlights: Array<{ id, title, evidenceIds, statement, confidence }>,
  dataQuality: Array<{ level, message }>,
  leadQueue?: { distribution: Array<{ tier, count, pct }> }
}
```

**명세서 설명**: ✅ 대부분 일치

**고급 설계 제안 (ap-1.1)**:
- `questions[].semantics`: ❌ 현재 없음
- `analysisPlan`: ❌ 현재 없음
- `evidenceCatalog[].type`: ❌ 현재 없음
- `evidenceCatalog[].reliability`: ❌ 현재 없음

#### Decision Pack Schema (dp-1.0)

**실제 스키마**:
```typescript
{
  version: 'dp-1.0',
  decisionCards: Array<{ question, options, recommendation, evidenceIds, confidence, rationale }>,
  actionBoard: { d0?, d7?, d14? },
  playbooks: { sales: string[], marketing: string[] },
  surveyNextQuestions: Array<{ question, answerType, why }>
}
```

**명세서 설명**: ✅ 대부분 일치

**고급 설계 제안 (dp-1.1)**:
- `decisionCards[].templateId`: ❌ 현재 없음

---

## 3. 구체적 개선 제안

### 3.1 명세서 구조 개선

#### 제안 1: 섹션 분리

현재 명세서는 기본 명세서(1-11장)와 고급 설계(728줄 이후)가 혼재되어 있습니다.

**개선안**:
```
# 설문조사 AI 분석 시스템 명세서

## Part 1: 현재 구현 (Current Implementation)
- 1-11장: 현재 시스템 설명

## Part 2: 향후 개선 계획 (Future Enhancements)
- 12장: 고급 설계 패키지
  - 12.1 Decision Card 템플릿 시스템
  - 12.2 스키마 확장 (ap-1.1 / dp-1.1)
  - 12.3 Role Taxonomy 확장
  - 12.4 교차표 자동 선별
  - 12.5 DB 스냅샷/버전 관리
```

#### 제안 2: 버전 정보 명확화

각 섹션에 버전 정보를 명시:

```markdown
## 3. Analysis Pack 생성 (서버 계산)

**현재 버전**: ap-1.0  
**구현 상태**: ✅ 완료  
**참고 파일**: `lib/surveys/analysis/buildAnalysisPack.ts`

---

## 12. 향후 개선: Analysis Pack 확장 (ap-1.1)

**계획 버전**: ap-1.1  
**구현 상태**: ⏳ 계획 중  
**예상 일정**: TBD

### 12.1 추가 예정 필드
- `questions[].semantics`: 문항 의미 정보
- `analysisPlan`: 분석 계획 정보
- ...
```

### 3.2 스키마 문서화 개선

#### 제안 3: 실제 스키마와 제안 스키마 분리

```markdown
### 10. 데이터베이스 스키마

#### 10.1 현재 스키마 (ap-1.0 / dp-1.0)

[실제 구현된 스키마 설명]

#### 10.2 향후 확장 계획 (ap-1.1 / dp-1.1)

[제안된 확장 스키마 설명]
```

### 3.3 코드 예시 정확성 개선

#### 제안 4: 코드 예시에 버전/상태 표시

```typescript
// ✅ 현재 구현됨 (ap-1.0)
export const AnalysisPackSchema = z.object({
  version: z.literal('ap-1.0'),
  // ...
})

// ⏳ 향후 계획 (ap-1.1)
export const AnalysisPackSchemaV11 = z.object({
  version: z.literal('ap-1.1'),
  // ...
})
```

---

## 4. 누락된 정보

### 4.1 API 엔드포인트 상세

명세서에 API 엔드포인트가 언급되어 있으나, 실제 구현과의 일치성 확인 필요:

- `POST /api/event-survey/campaigns/[campaignId]/analysis/generate`
- 실제 구현 확인 필요

### 4.2 에러 처리 전략

명세서에 에러 처리 전략이 명시되어 있으나, 실제 구현과의 일치성 확인 필요:

- 재시도 로직 (최대 4회)
- 스키마 검증 실패 시 처리
- LLM 호출 실패 시 처리

### 4.3 성능 지표

명세서에 처리 시간이 언급되어 있으나, 실제 측정 데이터와의 비교 필요:

- Analysis Pack 생성: 1-3초 (명세서)
- Decision Pack 생성: 10-30초 (명세서)
- 실제 측정 데이터 필요

---

## 5. 우선순위별 개선 사항

### 🔴 높은 우선순위 (즉시 수정)

1. **현재 구현 vs 향후 계획 구분**
   - Part 1 / Part 2로 명확히 분리
   - 각 섹션에 "현재 구현" / "향후 계획" 표시

2. **버전 정보 명확화**
   - 현재: `ap-1.0` / `dp-1.0`
   - 향후: `ap-1.1` / `dp-1.1`
   - 각 섹션에 버전 정보 명시

3. **스키마 필드 정확성**
   - 실제 스키마에 없는 필드는 "향후 계획" 섹션으로 이동
   - 현재 스키마 필드만 "현재 구현" 섹션에 유지

### 🟡 중간 우선순위 (단기 개선)

4. **파일 구조 업데이트**
   - 실제 존재하는 파일만 명시
   - 향후 추가 예정 파일은 별도 섹션으로 분리

5. **코드 예시 정확성**
   - 실제 코드와 일치하는 예시만 사용
   - 향후 계획 코드는 "예시 (계획 중)" 표시

6. **API 명세 보완**
   - 실제 구현과 일치하는 API 명세 확인
   - 에러 응답 예시 추가

### 🟢 낮은 우선순위 (장기 개선)

7. **성능 지표 보완**
   - 실제 측정 데이터 추가
   - 벤치마크 결과 포함

8. **테스트 케이스 추가**
   - 실제 테스트 케이스 예시
   - 엣지 케이스 처리 방법

---

## 6. 검토 체크리스트

### 구조적 완성도
- [x] 목차 및 섹션 구조 명확
- [x] 코드 예시 제공
- [x] 다이어그램/플로우차트 제공
- [ ] 현재 구현 vs 향후 계획 구분

### 기술적 정확성
- [x] 스키마 정의 정확
- [x] API 명세 제공
- [ ] 실제 코드와 일치성 확인
- [ ] 버전 정보 정확

### 실용성
- [x] 사용 예시 제공
- [x] 개선 제안 포함
- [ ] 구현 우선순위 명시
- [ ] 마이그레이션 가이드

### 완성도
- [x] 기본 명세서 완성
- [x] 향후 개선 방향 제시
- [ ] 실제 구현 상태 반영
- [ ] 테스트 전략 포함

---

## 7. 권장 수정 사항 요약

### 즉시 수정 필요

1. **명세서 구조 재편성**
   ```
   Part 1: 현재 구현 (ap-1.0 / dp-1.0)
   Part 2: 향후 개선 계획 (ap-1.1 / dp-1.1)
   ```

2. **각 섹션에 상태 표시 추가**
   - ✅ 현재 구현됨
   - ⏳ 계획 중
   - 🔄 진행 중

3. **스키마 필드 정확성 보장**
   - 현재 스키마에 없는 필드는 "향후 계획"으로 이동
   - 실제 스키마 필드만 "현재 구현"에 유지

### 단기 개선 권장

4. **API 명세 보완**
   - 실제 구현 확인 후 업데이트
   - 에러 응답 예시 추가

5. **성능 지표 보완**
   - 실제 측정 데이터 추가
   - 벤치마크 결과 포함

---

## 8. 결론

명세서는 **구조적으로 잘 작성**되어 있으며, **동적 처리 메커니즘**에 대한 설명이 명확합니다. 다만, **현재 구현 상태와 향후 계획이 혼재**되어 있어 혼란을 줄 수 있습니다.

**핵심 개선 사항**:
1. 현재 구현과 향후 계획을 명확히 구분
2. 버전 정보를 각 섹션에 명시
3. 실제 스키마와 제안 스키마를 분리

이러한 개선을 통해 명세서의 **정확성과 실용성**이 크게 향상될 것입니다.

---

**검토 완료일**: 2026-01-06  
**다음 검토 예정일**: 구현 상태 변경 시
