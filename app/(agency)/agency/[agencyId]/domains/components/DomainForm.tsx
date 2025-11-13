'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DomainForm({ agencyId }: { agencyId: string }) {
  const [domain, setDomain] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)
    setLoading(true)
    
    try {
      // 도메인 형식 검증
      const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/
      if (!domainRegex.test(domain)) {
        throw new Error('올바른 도메인 형식이 아닙니다. (예: example.com)')
      }
      
      const response = await fetch('/api/domains/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agencyId,
          domain: domain.toLowerCase().trim(),
        }),
      })
      
      const result = await response.json()
      
      if (!response.ok || result.error) {
        throw new Error(result.error || '도메인 등록 실패')
      }
      
      setSuccess(true)
      setDomain('')
      setTimeout(() => {
        router.refresh()
      }, 1000)
    } catch (err: any) {
      setError(err.message || '도메인 등록 중 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}
      
      {success && (
        <div className="p-3 bg-green-100 border border-green-400 text-green-700 rounded">
          도메인이 등록되었습니다! DNS 설정을 확인해주세요.
        </div>
      )}
      
      <div className="flex gap-2">
        <input
          type="text"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="example.com"
          className="flex-1 px-3 py-2 border rounded"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? '등록 중...' : '도메인 등록'}
        </button>
      </div>
      
      <div className="text-sm text-gray-600">
        <p className="mb-2">도메인을 등록한 후, 다음 DNS 레코드를 추가해야 합니다:</p>
        <code className="block bg-gray-100 p-2 rounded">
          TXT 레코드: eventlive-verify={agencyId.slice(0, 8)}
        </code>
      </div>
    </form>
  )
}

