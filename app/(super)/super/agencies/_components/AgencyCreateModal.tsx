'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AgencyCreateModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/agencies/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          ownerEmail: ownerEmail || null,
        }),
      })

      const result = await response.json()

      if (!response.ok || result.error) {
        throw new Error(result.error || '에이전시 생성 실패')
      }

      // 성공 시 모달 닫고 새로고침
      setIsOpen(false)
      setName('')
      setOwnerEmail('')
      router.refresh()
    } catch (err: any) {
      setError(err.message || '에이전시 생성 중 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-lg"
      >
        + 에이전시 생성
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-4">에이전시 생성</h2>

              {error && (
                <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    에이전시 이름 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="에이전시 이름을 입력하세요"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    소유자 이메일 (선택)
                  </label>
                  <input
                    type="email"
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="소유자 이메일 (선택사항)"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    소유자 이메일을 입력하면 해당 사용자가 에이전시 소유자로 설정됩니다.
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false)
                      setError('')
                      setName('')
                      setOwnerEmail('')
                    }}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                    disabled={loading}
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={loading}
                  >
                    {loading ? '생성 중...' : '생성'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

