'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface SettingsTabProps {
  campaign: {
    id: string
    title: string
    host?: string | null
    public_path: string
    status: string
    client_id: string
  }
  onCampaignUpdate?: (campaign: any) => void
}

export default function SettingsTab({ campaign, onCampaignUpdate }: SettingsTabProps) {
  const router = useRouter()
  const [formData, setFormData] = useState({
    title: campaign.title || '',
    host: campaign.host || '',
    status: campaign.status || 'draft',
  })
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch(`/api/event-survey/campaigns/${campaign.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title.trim(),
          host: formData.host?.trim() || null,
          status: formData.status,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '캠페인 수정 실패')
      }

      if (onCampaignUpdate && result.campaign) {
        onCampaignUpdate(result.campaign)
      }
      
      alert('캠페인이 성공적으로 수정되었습니다')
    } catch (err: any) {
      console.error('캠페인 수정 오류:', err)
      setError(err.message || '캠페인 수정 중 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('정말 이 설문조사 캠페인을 삭제하시겠습니까? 이 작업은 되돌릴 수 없으며, 관련된 모든 데이터도 함께 삭제됩니다.')) {
      return
    }

    setDeleting(true)
    try {
      const response = await fetch(`/api/event-survey/campaigns/${campaign.id}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '캠페인 삭제 실패')
      }

      alert('캠페인이 성공적으로 삭제되었습니다')
      // 클라이언트 대시보드로 리다이렉트
      router.push(`/client/${campaign.client_id}/dashboard`)
    } catch (err: any) {
      console.error('캠페인 삭제 오류:', err)
      setError(err.message || '캠페인 삭제 중 오류가 발생했습니다')
      setDeleting(false)
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            캠페인 제목 *
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="캠페인 제목을 입력하세요"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            호스트 (선택사항)
          </label>
          <input
            type="text"
            value={formData.host}
            onChange={(e) => setFormData({ ...formData, host: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="example.com"
          />
          <p className="mt-1 text-sm text-gray-500">
            도메인 식별용입니다. 비워두면 기본 도메인을 사용합니다.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            상태 *
          </label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="draft">초안 (Draft)</option>
            <option value="published">발행됨 (Published)</option>
            <option value="closed">종료됨 (Closed)</option>
          </select>
        </div>

        <div className="pt-4 border-t">
          <div className="text-sm text-gray-600 mb-4">
            <p className="font-medium mb-2">공개 경로:</p>
            <p className="font-mono text-blue-600">{campaign.public_path}</p>
            <p className="mt-2 text-xs text-gray-500">
              공개 경로는 변경할 수 없습니다.
            </p>
          </div>
        </div>

        <div className="flex gap-3 justify-end pt-4 border-t">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors font-medium"
          >
            {deleting ? '삭제 중...' : '삭제하기'}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
          >
            {loading ? '수정 중...' : '수정하기'}
          </button>
        </div>
      </form>
    </div>
  )
}

