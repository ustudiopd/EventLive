'use client'

import { useState } from 'react'

export default function ExportButton({ agencyId }: { agencyId: string }) {
  const [loading, setLoading] = useState(false)
  
  const handleExport = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/report/export?agencyId=${agencyId}&format=csv`)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `report-${agencyId}-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      alert('내보내기 실패')
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 shadow-lg hover:shadow-xl transition-all duration-200 font-medium disabled:opacity-50"
    >
      {loading ? '내보내는 중...' : '📊 CSV 내보내기'}
    </button>
  )
}

