'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface AgencyDeleteButtonProps {
  agencyId: string
  agencyName: string
  clientCount: number
}

export default function AgencyDeleteButton({ 
  agencyId, 
  agencyName,
  clientCount 
}: AgencyDeleteButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const router = useRouter()

  const handleDelete = async () => {
    if (!confirm(`정말로 "${agencyName}" 에이전시를 삭제하시겠습니까?\n\n⚠️ 경고: 이 작업은 되돌릴 수 없습니다.\n연관된 클라이언트 ${clientCount}개도 함께 삭제됩니다.`)) {
      return
    }

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/super/agencies/${agencyId}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!response.ok || result.error) {
        throw new Error(result.error || '에이전시 삭제 실패')
      }

      alert(result.message || '에이전시가 삭제되었습니다.')
      router.refresh()
    } catch (error: any) {
      alert('에이전시 삭제 중 오류가 발생했습니다: ' + error.message)
    } finally {
      setIsDeleting(false)
      setShowConfirm(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className="px-3 py-1 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      title="에이전시 삭제"
    >
      {isDeleting ? '삭제 중...' : '🗑️ 삭제'}
    </button>
  )
}

