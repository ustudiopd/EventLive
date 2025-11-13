'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Client {
  id: string
  name: string
  logo_url: string | null
  brand_config: any
}

export default function BrandingForm({ client }: { client: Client }) {
  const router = useRouter()
  const [formData, setFormData] = useState({
    logoUrl: client.logo_url || '',
    primaryColor: client.brand_config?.primaryColor || '#3B82F6',
    secondaryColor: client.brand_config?.secondaryColor || '#10B981',
    fontFamily: client.brand_config?.fontFamily || 'Inter',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)
    setLoading(true)
    
    try {
      const brandConfig = {
        primaryColor: formData.primaryColor,
        secondaryColor: formData.secondaryColor,
        fontFamily: formData.fontFamily,
      }
      
      const response = await fetch(`/api/clients/${client.id}/branding`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logoUrl: formData.logoUrl || null,
          brandConfig,
        }),
      })
      
      const result = await response.json()
      
      if (!response.ok || result.error) {
        throw new Error(result.error || '브랜딩 설정 저장 실패')
      }
      
      setSuccess(true)
      setTimeout(() => {
        router.refresh()
      }, 1000)
    } catch (err: any) {
      setError(err.message || '브랜딩 설정 저장 중 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-lg">
          {error}
        </div>
      )}
      
      {success && (
        <div className="p-4 bg-green-50 border-l-4 border-green-500 text-green-700 rounded-lg">
          ✅ 브랜딩 설정이 저장되었습니다!
        </div>
      )}
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">로고 URL</label>
        <input
          type="url"
          value={formData.logoUrl}
          onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
          placeholder="https://example.com/logo.png"
        />
        {formData.logoUrl && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <p className="text-sm text-gray-600 mb-2">로고 미리보기:</p>
            <img src={formData.logoUrl} alt="Logo preview" className="h-20 w-auto rounded" onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none'
            }} />
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">주요 색상</label>
          <div className="flex gap-3 items-center">
            <input
              type="color"
              value={formData.primaryColor}
              onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
              className="h-12 w-16 border-2 border-gray-300 rounded-lg cursor-pointer"
            />
            <input
              type="text"
              value={formData.primaryColor}
              onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all font-mono text-sm"
            />
          </div>
          <div className="mt-2 h-3 rounded" style={{ backgroundColor: formData.primaryColor }}></div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">보조 색상</label>
          <div className="flex gap-3 items-center">
            <input
              type="color"
              value={formData.secondaryColor}
              onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
              className="h-12 w-16 border-2 border-gray-300 rounded-lg cursor-pointer"
            />
            <input
              type="text"
              value={formData.secondaryColor}
              onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all font-mono text-sm"
            />
          </div>
          <div className="mt-2 h-3 rounded" style={{ backgroundColor: formData.secondaryColor }}></div>
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">폰트 패밀리</label>
        <select
          value={formData.fontFamily}
          onChange={(e) => setFormData({ ...formData, fontFamily: e.target.value })}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
        >
          <option value="Inter">Inter</option>
          <option value="Roboto">Roboto</option>
          <option value="Open Sans">Open Sans</option>
          <option value="Lato">Lato</option>
          <option value="Montserrat">Montserrat</option>
        </select>
        <div className="mt-2 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600" style={{ fontFamily: formData.fontFamily }}>
            미리보기: The quick brown fox jumps over the lazy dog
          </p>
        </div>
      </div>
      
      <div className="flex justify-end pt-4 border-t">
        <button
          type="submit"
          disabled={loading}
          className="px-8 py-3 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-lg font-medium hover:from-pink-700 hover:to-purple-700 disabled:opacity-50 transition-all shadow-lg hover:shadow-xl"
        >
          {loading ? '저장 중...' : '💾 저장'}
        </button>
      </div>
    </form>
  )
}

