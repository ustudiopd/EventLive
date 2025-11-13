'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ClientInviteModal({ agencyId }: { agencyId: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const router = useRouter()
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    
    try {
      const response = await fetch('/api/clients/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agencyId,
          email: email || null,
        }),
      })
      
      const result = await response.json()
      
      if (!response.ok || result.error) {
        throw new Error(result.error || '초대 생성 실패')
      }
      
      setInviteLink(result.inviteLink)
    } catch (err: any) {
      setError(err.message || '초대 생성 중 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(inviteLink)
    alert('초대 링크가 클립보드에 복사되었습니다!')
  }
  
  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 shadow-lg hover:shadow-xl transition-all duration-200 font-medium"
      >
        + 클라이언트 초대
      </button>
      
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">클라이언트 초대</h2>
            
            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {error}
              </div>
            )}
            
            {inviteLink ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">초대 링크</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={inviteLink}
                      readOnly
                      className="flex-1 px-3 py-2 border rounded bg-gray-50"
                    />
                    <button
                      onClick={copyToClipboard}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      복사
                    </button>
                  </div>
                </div>
                <div className="text-sm text-gray-600">
                  이 링크를 클라이언트에게 전달하세요. 링크를 통해 회원가입할 수 있습니다.
                </div>
                <button
                  onClick={() => {
                    setIsOpen(false)
                    setEmail('')
                    setInviteLink('')
                    router.refresh()
                  }}
                  className="w-full px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  닫기
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">이메일 (선택)</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border rounded"
                    placeholder="client@example.com"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    이메일을 입력하면 초대 링크를 이메일로 전송할 수 있습니다. (선택사항)
                  </p>
                </div>
                
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-2 border rounded hover:bg-gray-50"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    {loading ? '생성 중...' : '초대 링크 생성'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}

