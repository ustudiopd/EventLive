# messages 테이블 RLS 정책 분석 보고서

## 📋 분석 개요

`messages` 테이블의 RLS 정책을 확인하여 Realtime 이벤트 전달에 문제가 없는지 분석했습니다.

---

## ✅ RLS 활성화 상태

- **RLS 활성화**: ✅ `true`
- **테이블**: `public.messages`

---

## 🔍 RLS 정책 상세 분석

### 1. SELECT 정책: `read messages if in scope`

**정책명**: `read messages if in scope`  
**명령**: `SELECT`  
**조건 (using_expression)**:

```sql
(
  -- 1. 슈퍼어드민인 경우
  (SELECT me.is_super_admin FROM me) IS TRUE
) OR (
  -- 2. 에이전시 멤버인 경우
  EXISTS (
    SELECT 1 FROM my_agencies a
    WHERE a.agency_id = messages.agency_id
  )
) OR (
  -- 3. 클라이언트 멤버인 경우
  EXISTS (
    SELECT 1 FROM my_clients c
    WHERE c.client_id = messages.client_id
  )
) OR (
  -- 4. 웨비나에 등록된 경우
  EXISTS (
    SELECT 1 FROM registrations r
    WHERE r.webinar_id = messages.webinar_id
      AND r.user_id = auth.uid()
  )
)
```

**평가**: ✅ **정상**

- 4가지 조건 중 하나만 만족하면 메시지를 읽을 수 있습니다.
- 가장 일반적인 경우는 **4번 조건** (웨비나 등록)입니다.
- Realtime 이벤트가 전달되려면 사용자가 해당 메시지를 SELECT할 수 있어야 하므로, 이 정책이 Realtime 이벤트 전달을 제어합니다.

---

### 2. INSERT 정책: `insert message if registered`

**정책명**: `insert message if registered`  
**명령**: `INSERT`  
**조건 (with_check_expression)**:

```sql
(
  -- 1. 자신의 메시지인 경우
  user_id = auth.uid()
) AND (
  -- 2. 웨비나에 등록된 경우
  EXISTS (
    SELECT 1 FROM registrations r
    WHERE r.webinar_id = messages.webinar_id
      AND r.user_id = auth.uid()
  )
)
```

**평가**: ✅ **정상**

- 자신의 메시지만 생성할 수 있고, 웨비나에 등록되어 있어야 합니다.

---

### 3. UPDATE 정책: `update own messages`

**정책명**: `update own messages`  
**명령**: `UPDATE`  
**조건 (using_expression & with_check_expression)**:

```sql
(
  -- 1. 자신의 메시지인 경우
  user_id = auth.uid()
) OR (
  -- 2. 슈퍼어드민인 경우
  (SELECT me.is_super_admin FROM me) IS TRUE
) OR (
  -- 3. 클라이언트 관리자인 경우
  EXISTS (
    SELECT 1 FROM my_clients c
    WHERE c.client_id = messages.client_id
      AND c.role IN ('owner', 'admin', 'operator')
  )
)
```

**평가**: ✅ **정상**

- 자신의 메시지, 슈퍼어드민, 또는 클라이언트 관리자가 수정할 수 있습니다.

---

### 4. DELETE 정책: `delete own messages`

**정책명**: `delete own messages`  
**명령**: `DELETE`  
**조건 (using_expression)**:

```sql
(
  -- 1. 자신의 메시지인 경우
  user_id = auth.uid()
) OR (
  -- 2. 슈퍼어드민인 경우
  (SELECT me.is_super_admin FROM me) IS TRUE
) OR (
  -- 3. 클라이언트 관리자인 경우
  EXISTS (
    SELECT 1 FROM my_clients c
    WHERE c.client_id = messages.client_id
      AND c.role IN ('owner', 'admin', 'operator')
  )
)
```

**평가**: ✅ **정상**

- UPDATE 정책과 동일한 조건입니다.

---

## 🔗 관련 뷰 정의

### 1. `me` 뷰

```sql
SELECT 
  id AS user_id,
  is_super_admin
FROM profiles p
WHERE id = auth.uid();
```

**평가**: ✅ **정상**

- 자신의 프로필만 조회하므로 `read own profile` 정책이 적용됩니다.
- 재귀 문제 없음 (자신의 프로필만 조회).

### 2. `my_agencies` 뷰

```sql
SELECT 
  agency_id,
  role
FROM agency_members
WHERE user_id = auth.uid();
```

**평가**: ✅ **정상**

- 자신의 에이전시 멤버십만 조회합니다.

### 3. `my_clients` 뷰

```sql
SELECT 
  client_id,
  role
FROM client_members
WHERE user_id = auth.uid();
```

**평가**: ✅ **정상**

- 자신의 클라이언트 멤버십만 조회합니다.

---

## ⚠️ 잠재적 문제점

### 1. `profiles` 테이블 RLS 정책의 복잡성

**정책**: `read profiles for webinar participants`

```sql
(
  id = auth.uid()
) OR (
  -- 같은 웨비나에 등록된 사용자
  EXISTS (
    SELECT 1 FROM (registrations r1
      JOIN registrations r2 ON r1.webinar_id = r2.webinar_id)
    WHERE r1.user_id = auth.uid()
      AND r2.user_id = profiles.id
  )
) OR (
  -- 같은 클라이언트 멤버
  EXISTS (
    SELECT 1 FROM (client_members cm1
      JOIN client_members cm2 ON cm1.client_id = cm2.client_id)
    WHERE cm1.user_id = auth.uid()
      AND cm2.user_id = profiles.id
  )
) OR (
  -- 같은 에이전시 멤버
  EXISTS (
    SELECT 1 FROM (agency_members am1
      JOIN agency_members am2 ON am1.agency_id = am2.agency_id)
    WHERE am1.user_id = auth.uid()
      AND am2.user_id = profiles.id
  )
) OR (
  -- 슈퍼어드민은 모든 프로필 읽기 가능
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.is_super_admin = true
  )
)
```

**문제점**:
- 마지막 조건에서 `profiles` 테이블을 다시 조회합니다.
- 하지만 `me` 뷰는 `id = auth.uid()`로 자신의 프로필만 조회하므로, `read own profile` 정책이 적용되어 재귀가 발생하지 않습니다.

**평가**: ✅ **재귀 문제 없음**

---

## 🎯 Realtime 이벤트 전달 조건

Realtime 이벤트가 전달되려면, 사용자가 해당 메시지를 **SELECT할 수 있어야** 합니다.

### 정상적인 경우

1. **웨비나에 등록된 사용자**: ✅
   - `registrations` 테이블에 레코드가 있으면 메시지를 읽을 수 있습니다.
   - 가장 일반적인 경우입니다.

2. **에이전시/클라이언트 멤버**: ✅
   - 해당 웨비나의 에이전시/클라이언트 멤버인 경우 메시지를 읽을 수 있습니다.

3. **슈퍼어드민**: ✅
   - `me.is_super_admin = true`인 경우 모든 메시지를 읽을 수 있습니다.

### 문제가 발생할 수 있는 경우

1. **웨비나에 등록되지 않은 사용자**: ❌
   - `registrations` 테이블에 레코드가 없으면 메시지를 읽을 수 없습니다.
   - Realtime 이벤트가 전달되지 않습니다.

2. **등록 정보가 늦게 생성되는 경우**: ⚠️
   - 메시지 전송 시점에 `registrations` 레코드가 아직 생성되지 않았을 수 있습니다.
   - 하지만 API에서 자동 등록 로직이 있으므로 문제가 없어야 합니다.

---

## 🔍 실제 문제 진단

### 확인해야 할 사항

1. **사용자가 웨비나에 등록되어 있는지 확인**
   ```sql
   SELECT * FROM registrations
   WHERE webinar_id = '<webinar_id>'
     AND user_id = '<user_id>';
   ```

2. **메시지의 agency_id, client_id 확인**
   ```sql
   SELECT agency_id, client_id, webinar_id
   FROM messages
   WHERE id = '<message_id>';
   ```

3. **사용자의 멤버십 확인**
   ```sql
   -- 에이전시 멤버십
   SELECT * FROM agency_members
   WHERE user_id = '<user_id>';
   
   -- 클라이언트 멤버십
   SELECT * FROM client_members
   WHERE user_id = '<user_id>';
   ```

---

## ✅ 결론

### RLS 정책 상태: ✅ **정상**

1. **재귀 문제 없음**: `me` 뷰는 자신의 프로필만 조회하므로 재귀가 발생하지 않습니다.
2. **정책 구조 합리적**: SELECT 정책이 4가지 조건을 OR로 연결하여 유연하게 처리합니다.
3. **Realtime 이벤트 전달 조건 명확**: 웨비나 등록, 멤버십, 또는 슈퍼어드민 권한이 있으면 이벤트가 전달됩니다.

### 잠재적 문제

1. **웨비나 등록 확인**: 사용자가 웨비나에 등록되어 있지 않으면 Realtime 이벤트가 전달되지 않습니다.
   - **해결책**: API에서 자동 등록 로직이 이미 구현되어 있습니다 (`/api/webinars/[webinarId]/messages`).

2. **등록 정보 생성 타이밍**: 메시지 전송 시점에 등록 정보가 아직 생성되지 않았을 수 있습니다.
   - **해결책**: API에서 등록 확인 및 자동 등록 로직이 있습니다.

### 권장 사항

1. **등록 확인 강화**: 메시지 전송 전에 등록 정보를 확인하고, 없으면 자동 등록하도록 보장합니다.
2. **에러 로깅**: Realtime 이벤트가 전달되지 않는 경우, RLS 정책 위반 여부를 로깅합니다.
3. **테스트**: 다양한 시나리오에서 Realtime 이벤트 전달을 테스트합니다.

---

## 📝 요약

**RLS 정책 자체는 문제가 없습니다.** Realtime 이벤트가 전달되지 않는 경우, 다음을 확인해야 합니다:

1. ✅ 사용자가 웨비나에 등록되어 있는지
2. ✅ 메시지의 agency_id, client_id가 올바른지
3. ✅ 사용자의 멤버십 정보가 올바른지
4. ✅ 네트워크/WebSocket 연결 문제는 아닌지

RLS 정책 문제는 아닌 것으로 보이며, 다른 원인(네트워크, WebSocket 연결, 인증 토큰 등)을 확인해야 합니다.

