/**
 * UUID 형식인지 확인
 * UUID는 8-4-4-4-12 형식 (36자, 하이픈 포함)
 */
export function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

/**
 * 웨비나 ID 또는 slug로 웨비나 조회
 * UUID인지 slug인지 자동 판별
 */
export function getWebinarQuery(idOrSlug: string) {
  if (isUUID(idOrSlug)) {
    return { column: 'id', value: idOrSlug }
  } else {
    return { column: 'slug', value: idOrSlug }
  }
}

