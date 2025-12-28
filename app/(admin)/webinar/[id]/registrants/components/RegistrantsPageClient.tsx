'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Registrant {
  id: string
  created_at: string
  registered_via: string | null
  profiles: {
    id: string
    email: string
    display_name: string | null
  } | null
}

interface Webinar {
  id: string
  title: string
  slug: string | null
}

interface RegistrantsPageClientProps {
  webinar: Webinar
  registrations: any[]
}

export default function RegistrantsPageClient({
  webinar,
  registrations,
}: RegistrantsPageClientProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterVia, setFilterVia] = useState<string>('all')

  // 등록 출처별 통계
  const stats = {
    total: registrations.length,
    email: registrations.filter(r => r.registered_via === 'email').length,
    manual: registrations.filter(r => r.registered_via === 'manual').length,
    invite: registrations.filter(r => r.registered_via === 'invite').length,
    unknown: registrations.filter(r => !r.registered_via).length,
  }

  // 필터링
  const filteredRegistrations = registrations.filter((reg) => {
    const email = reg.profiles?.email || ''
    const name = reg.profiles?.display_name || ''
    const searchMatch = searchTerm === '' || 
      email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      name.toLowerCase().includes(searchTerm.toLowerCase())
    
    const viaMatch = filterVia === 'all' || reg.registered_via === filterVia || 
      (filterVia === 'unknown' && !reg.registered_via)

    return searchMatch && viaMatch
  })

  // CSV 내보내기
  const handleExportCSV = () => {
    const headers = ['이메일', '이름', '등록 시간', '등록 출처']
    const rows = filteredRegistrations.map(reg => [
      reg.profiles?.email || '',
      reg.profiles?.display_name || '',
      new Date(reg.created_at).toLocaleString('ko-KR'),
      reg.registered_via || '알 수 없음'
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${webinar.title}_등록자_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const webinarId = webinar.slug || webinar.id

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                등록자 관리
              </h1>
              <p className="text-gray-600">{webinar.title}</p>
            </div>
            <div className="flex gap-3">
              <Link
                href={`/webinar/${webinarId}/console`}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                ← 운영 콘솔로
              </Link>
              <button
                onClick={handleExportCSV}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                📥 CSV 내보내기
              </button>
            </div>
          </div>

          {/* 통계 카드 */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-sm text-gray-600 mb-1">총 등록자</div>
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-sm text-gray-600 mb-1">이메일</div>
              <div className="text-2xl font-bold text-blue-600">{stats.email}</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-sm text-gray-600 mb-1">수동</div>
              <div className="text-2xl font-bold text-green-600">{stats.manual}</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-sm text-gray-600 mb-1">초대</div>
              <div className="text-2xl font-bold text-purple-600">{stats.invite}</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-sm text-gray-600 mb-1">알 수 없음</div>
              <div className="text-2xl font-bold text-gray-600">{stats.unknown}</div>
            </div>
          </div>

          {/* 검색 및 필터 */}
          <div className="bg-white p-4 rounded-lg shadow mb-6">
            <div className="flex gap-4">
              <input
                type="text"
                placeholder="이메일 또는 이름으로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={filterVia}
                onChange={(e) => setFilterVia(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">전체</option>
                <option value="email">이메일</option>
                <option value="manual">수동</option>
                <option value="invite">초대</option>
                <option value="unknown">알 수 없음</option>
              </select>
            </div>
          </div>
        </div>

        {/* 등록자 목록 */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6">
            <h2 className="text-xl font-semibold text-white">
              등록자 목록 ({filteredRegistrations.length}명)
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    이메일
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    이름
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    등록 시간
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    등록 출처
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRegistrations.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                      등록자가 없습니다
                    </td>
                  </tr>
                ) : (
                  filteredRegistrations.map((reg) => (
                    <tr key={reg.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {reg.profiles?.email || '알 수 없음'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {reg.profiles?.display_name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(reg.created_at).toLocaleString('ko-KR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          reg.registered_via === 'email'
                            ? 'bg-blue-100 text-blue-800'
                            : reg.registered_via === 'manual'
                            ? 'bg-green-100 text-green-800'
                            : reg.registered_via === 'invite'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {reg.registered_via === 'email'
                            ? '이메일'
                            : reg.registered_via === 'manual'
                            ? '수동'
                            : reg.registered_via === 'invite'
                            ? '초대'
                            : '알 수 없음'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}




