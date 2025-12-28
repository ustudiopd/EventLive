# Structured Output 적용 후 실패 원인 분석 및 해결 방안

**작성일**: 2025-01-XX  
**상태**: Structured Output 적용 후 여전히 실패 발생

---

## 🔍 현재 적용된 변경사항

### ✅ 적용 완료
1. **Structured Output 적용**
   - `zod-to-json-schema` 사용
   - `responseJsonSchema` 필드 추가
   - `$refStrategy: "none"` 설정

2. **systemInstruction 분리**
   - `systemPrompt`를 별도 필드로 분리

3. **propertyOrdering 추가**
   - Gemini 2.0용 필드 순서 명시

4. **에러 로깅 강화**
   - JSON Schema 생성 오류 감지
   - Structured Output 관련 오류 감지
   - 상세한 에러 메시지 출력

---

## 🚨 가능한 실패 원인

### 1. JSON Schema 생성 실패

**증상**:
- `zodToJsonSchema()` 호출 시 오류 발생
- 생성된 스키마가 유효하지 않음

**확인 방법**:
서버 로그에서 다음 메시지 확인:
```
❌ JSON Schema 생성 오류: ...
```

**해결책**:
- 스키마 생성 실패 시 Structured Output 없이 진행하도록 fallback 추가됨
- 로그에서 실제 오류 메시지 확인 필요

---

### 2. Gemini API가 스키마를 거부

**증상**:
- API 호출 시 400 에러
- 에러 메시지에 `response_json_schema` 또는 `schema` 포함

**확인 방법**:
서버 로그에서 다음 메시지 확인:
```
❌ Gemini API 오류: 400
⚠️ Structured Output 스키마 오류 감지
```

**가능한 원인**:
- 스키마가 너무 복잡함
- `propertyOrdering`이 스키마와 맞지 않음
- Gemini 2.0이 특정 스키마 구조를 지원하지 않음

**해결책**:
1. **모델 변경**: `gemini-2.5-flash`로 변경 (propertyOrdering 요구사항 완화)
2. **스키마 단순화**: 선택적 필드 제거 또는 최소 필수 필드만 포함
3. **propertyOrdering 제거**: 일단 제거하고 테스트

---

### 3. 스키마 검증 실패 (Zod)

**증상**:
- API 호출은 성공하지만 Zod 검증 실패
- 필수 필드 누락 또는 타입 불일치

**확인 방법**:
서버 로그에서 다음 메시지 확인:
```
=== 스키마 검증 오류 상세 ===
issues: [...]
```

**가능한 원인**:
- Structured Output이 작동하지 않아 잘못된 형식의 JSON 반환
- 필수 필드가 누락됨
- 타입 변환 실패 (문자열 → 숫자 등)

**해결책**:
- 재시도 로직이 이미 구현되어 있음
- 로그에서 실제 검증 오류 확인 필요

---

### 4. API 응답 없음

**증상**:
- `finishReason` 또는 `blockReason` 발생
- 콘텐츠가 차단됨

**확인 방법**:
서버 로그에서 다음 메시지 확인:
```
❌ AI 응답 없음: finishReason: ..., blockReason: ...
```

**가능한 원인**:
- 프롬프트가 정책 위반
- 응답 생성 실패
- 타임아웃

**해결책**:
- `finishReason`과 `blockReason` 값 확인
- 프롬프트 수정 필요할 수 있음

---

## 🛠️ 즉시 확인 사항

### 1. 서버 로그 확인

**로컬 개발**:
```bash
# 터미널에서 Next.js 서버 로그 확인
npm run dev
```

**확인할 로그 메시지**:
- `❌ JSON Schema 생성 오류:` - 스키마 생성 실패
- `⚠️ Structured Output 스키마 오류 감지` - API 스키마 거부
- `❌ Gemini API 오류:` - API 호출 실패
- `❌ AI 응답 없음:` - 응답 없음
- `=== 스키마 검증 오류 상세 ===` - Zod 검증 실패

### 2. 실제 에러 메시지 확인

다음 정보를 확인해주세요:
1. **에러 타입**: 400, 500, 또는 다른 상태 코드?
2. **에러 메시지**: 정확한 에러 텍스트
3. **서버 로그**: 위의 로그 메시지들

---

## 💡 단계별 해결 방안

### 단계 1: 에러 타입 확인

**현재 코드 상태**:
- Structured Output 적용됨
- 에러 로깅 강화됨
- Fallback 로직 추가됨

**다음 단계**:
1. 서버 로그에서 실제 에러 메시지 확인
2. 에러 타입에 따라 적절한 해결책 적용

### 단계 2: 모델 변경 (권장)

**해결책.md 제안**:
> 모델을 `gemini-2.5-flash`로 올리면 propertyOrdering 요구 같은 함정이 줄어듭니다.

**적용 방법**:
```typescript
const modelName = 'gemini-2.5-flash' // 또는 'gemini-2.5-flash-lite'
```

**예상 효과**:
- propertyOrdering 요구사항 완화
- 스키마 복잡도 허용 범위 증가
- 안정성 향상

### 단계 3: Structured Output 비활성화 테스트

**임시 해결책**:
Structured Output을 일시적으로 비활성화하여 문제가 Structured Output 때문인지 확인:

```typescript
// responseJsonSchema를 undefined로 설정
const responseJsonSchema = undefined
```

**확인 사항**:
- Structured Output 없이도 실패하는지
- 실패한다면 다른 원인 확인 필요

### 단계 4: 스키마 단순화

**문제**:
- 현재 스키마가 너무 복잡할 수 있음
- 선택적 필드(`segments`, `marketingPack`, `dataQuality`) 제거 고려

**해결책**:
필수 필드만 포함하는 최소 스키마로 테스트:
- `version`
- `lens`
- `executiveSummary`
- `insights` (최소 3개)
- `priorityQueue` (최소 3개)
- `surveyNextQuestions` (최소 1개)

---

## 🔄 다음 액션

### 우선순위 1: 즉시 확인
- [ ] 서버 로그에서 실제 에러 메시지 확인
- [ ] 에러 타입 분류 (400, 500, 또는 검증 실패)
- [ ] Structured Output 관련 오류 여부 확인

### 우선순위 2: 모델 변경
- [ ] `gemini-2.0-flash` → `gemini-2.5-flash` 변경
- [ ] propertyOrdering 요구사항 완화 효과 확인

### 우선순위 3: Fallback 테스트
- [ ] Structured Output 비활성화 테스트
- [ ] 문제가 Structured Output 때문인지 확인

### 우선순위 4: 스키마 단순화
- [ ] 최소 필수 필드만 포함하는 스키마로 테스트
- [ ] 단계적으로 필드 추가

---

## 📝 디버깅 체크리스트

실패 발생 시 다음 정보를 확인하세요:

1. **에러 상태 코드**: 400, 500, 또는 다른?
2. **에러 메시지**: 정확한 텍스트
3. **서버 로그**:
   - `❌ JSON Schema 생성 오류:` 있음?
   - `⚠️ Structured Output 스키마 오류 감지` 있음?
   - `❌ Gemini API 오류:` 있음?
   - `=== 스키마 검증 오류 상세 ===` 있음?
4. **환경 변수**: `GOOGLE_API_KEY` 설정 확인
5. **모델명**: 현재 사용 중인 모델 확인

---

## 💬 추가 지원 필요 시

다음 정보를 제공해주시면 더 정확한 해결책을 제시할 수 있습니다:

1. **서버 로그 전체** (에러 발생 시점)
2. **에러 메시지** (정확한 텍스트)
3. **요청 파라미터** (campaignId, lens 등)
4. **환경 정보** (로컬/프로덕션)

---

**보고서 작성자**: AI Assistant  
**마지막 업데이트**: 2025-01-XX


