'use client'

import { useState, useEffect } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface Client {
  id: string
  name: string
}

export default function StatsDashboard({ 
  agencyId, 
  clients 
}: { 
  agencyId: string
  clients: Client[] 
}) {
  const [selectedClientId, setSelectedClientId] = useState<string>('all')
  const [stats, setStats] = useState<any>(null)
  const [chartData, setChartData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    fetchStats()
    fetchChartData()
  }, [selectedClientId])
  
  const fetchStats = async () => {
    setLoading(true)
    try {
      const url = `/api/reports/stats?agencyId=${agencyId}${selectedClientId !== 'all' ? `&clientId=${selectedClientId}` : ''}`
      const response = await fetch(url)
      const data = await response.json()
      setStats(data)
    } catch (error) {
      console.error('통계 조회 실패:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const fetchChartData = async () => {
    try {
      const url = `/api/reports/chart-data?agencyId=${agencyId}${selectedClientId !== 'all' ? `&clientId=${selectedClientId}` : ''}`
      const response = await fetch(url)
      const data = await response.json()
      setChartData(data || [])
    } catch (error) {
      console.error('차트 데이터 조회 실패:', error)
    }
  }
  
  if (loading) {
    return <div className="text-center py-8">통계를 불러오는 중...</div>
  }
  
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-2">클라이언트 선택</label>
        <select
          value={selectedClientId}
          onChange={(e) => setSelectedClientId(e.target.value)}
          className="px-3 py-2 border rounded"
        >
          <option value="all">전체</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </div>
      
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow border-l-4 border-blue-500">
            <h3 className="text-sm font-medium text-gray-600 mb-2">웨비나 수</h3>
            <p className="text-4xl font-bold text-gray-900">{stats.webinarCount || 0}</p>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow border-l-4 border-green-500">
            <h3 className="text-sm font-medium text-gray-600 mb-2">총 참여자 수</h3>
            <p className="text-4xl font-bold text-gray-900">{stats.totalParticipants || 0}</p>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow border-l-4 border-yellow-500">
            <h3 className="text-sm font-medium text-gray-600 mb-2">총 메시지 수</h3>
            <p className="text-4xl font-bold text-gray-900">{stats.totalMessages || 0}</p>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow border-l-4 border-red-500">
            <h3 className="text-sm font-medium text-gray-600 mb-2">총 질문 수</h3>
            <p className="text-4xl font-bold text-gray-900">{stats.totalQuestions || 0}</p>
          </div>
        </div>
      )}
      
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">월별 웨비나 생성 추이</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                <Legend />
                <Line type="monotone" dataKey="webinars" stroke="#3B82F6" strokeWidth={2} name="웨비나 수" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">월별 참여자 수</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                <Legend />
                <Bar dataKey="participants" fill="#10B981" name="참여자 수" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">월별 메시지 수</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                <Legend />
                <Line type="monotone" dataKey="messages" stroke="#F59E0B" strokeWidth={2} name="메시지 수" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">월별 질문 수</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                <Legend />
                <Bar dataKey="questions" fill="#EF4444" name="질문 수" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}

