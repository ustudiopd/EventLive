'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Domain {
  id: string
  domain: string
  verified: boolean
  verified_at: string | null
  created_at: string
}

export default function DomainList({ domains, agencyId }: { domains: Domain[], agencyId: string }) {
  const router = useRouter()
  
  const handleVerify = async (domainId: string) => {
    try {
      const response = await fetch(`/api/domains/${domainId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agencyId }),
      })
      
      const result = await response.json()
      
      if (!response.ok || result.error) {
        alert(result.error || '도메인 검증 실패')
        return
      }
      
      router.refresh()
    } catch (error) {
      alert('도메인 검증 중 오류가 발생했습니다')
    }
  }
  
  const handleDelete = async (domainId: string) => {
    if (!confirm('정말 이 도메인을 삭제하시겠습니까?')) {
      return
    }
    
    try {
      const response = await fetch(`/api/domains/${domainId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agencyId }),
      })
      
      const result = await response.json()
      
      if (!response.ok || result.error) {
        alert(result.error || '도메인 삭제 실패')
        return
      }
      
      router.refresh()
    } catch (error) {
      alert('도메인 삭제 중 오류가 발생했습니다')
    }
  }
  
  if (domains.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        등록된 도메인이 없습니다.
      </div>
    )
  }
  
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">도메인</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">등록일</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">작업</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {domains.map((domain) => (
            <tr key={domain.id}>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="text-sm font-medium">{domain.domain}</span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {domain.verified ? (
                  <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-800">
                    검증됨
                  </span>
                ) : (
                  <span className="px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-800">
                    미검증
                  </span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {new Date(domain.created_at).toLocaleDateString('ko-KR')}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                {!domain.verified && (
                  <button
                    onClick={() => handleVerify(domain.id)}
                    className="text-blue-600 hover:underline mr-4"
                  >
                    검증
                  </button>
                )}
                <button
                  onClick={() => handleDelete(domain.id)}
                  className="text-red-600 hover:underline"
                >
                  삭제
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

