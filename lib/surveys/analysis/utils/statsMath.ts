/**
 * 통계 계산 유틸리티
 * 안전한 수학 연산 (0으로 나누기 방지 등)
 */

/**
 * 백분율 계산 (0으로 나누기 방지)
 */
export function safePercentage(numerator: number, denominator: number): number {
  if (denominator === 0 || !Number.isFinite(denominator)) {
    return 0
  }
  const pct = (numerator / denominator) * 100
  return Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0
}

/**
 * 백분율 포맷팅 (소수점 자릿수 지정)
 */
export function formatPercentage(
  numerator: number,
  denominator: number,
  decimals: number = 1
): string {
  const pct = safePercentage(numerator, denominator)
  return pct.toFixed(decimals)
}

/**
 * Lift 계산 (교차표 분석용)
 * lift = (observed / expected) - 1
 * expected = (rowTotal / total) * (colTotal / total) * total
 */
export function calculateLift(
  cellCount: number,
  rowTotal: number,
  colTotal: number,
  grandTotal: number
): number {
  if (grandTotal === 0 || rowTotal === 0 || colTotal === 0) {
    return 0
  }

  const expected = (rowTotal / grandTotal) * (colTotal / grandTotal) * grandTotal
  if (expected === 0) {
    return 0
  }

  const lift = cellCount / expected - 1
  return Number.isFinite(lift) ? lift : 0
}

/**
 * Cramér's V 계산 (카테고리 변수 간 연관성 측정)
 * 범위: 0 (독립) ~ 1 (완전 연관)
 */
export function calculateCramersV(
  chiSquare: number,
  n: number,
  minRows: number,
  minCols: number
): number {
  if (n === 0 || minRows < 2 || minCols < 2) {
    return 0
  }

  const k = Math.min(minRows - 1, minCols - 1)
  if (k <= 0) {
    return 0
  }

  const v = Math.sqrt(chiSquare / (n * k))
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0
}

/**
 * Chi-square 근사값 계산 (교차표 분석용)
 * 간단한 근사: Σ((observed - expected)² / expected)
 */
export function calculateChiSquareApprox(
  cells: Array<{ observed: number; expected: number }>
): number {
  let chiSquare = 0

  for (const cell of cells) {
    if (cell.expected > 0) {
      const diff = cell.observed - cell.expected
      chiSquare += (diff * diff) / cell.expected
    }
  }

  return Number.isFinite(chiSquare) ? chiSquare : 0
}

/**
 * 평균 계산 (빈 배열 처리)
 */
export function safeMean(values: number[]): number {
  if (values.length === 0) {
    return 0
  }
  const sum = values.reduce((acc, val) => acc + (Number.isFinite(val) ? val : 0), 0)
  return sum / values.length
}

/**
 * 중앙값 계산
 */
export function safeMedian(values: number[]): number {
  if (values.length === 0) {
    return 0
  }
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

/**
 * 표준편차 계산
 */
export function safeStdDev(values: number[]): number {
  if (values.length === 0) {
    return 0
  }
  const mean = safeMean(values)
  const variance =
    values.reduce((acc, val) => {
      const diff = val - mean
      return acc + diff * diff
    }, 0) / values.length
  return Math.sqrt(variance)
}
