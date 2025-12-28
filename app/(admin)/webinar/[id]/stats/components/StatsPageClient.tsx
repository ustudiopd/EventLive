'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

interface Webinar {
  id: string
  title: string
  slug: string | null
  start_time?: string | null
  end_time?: string | null
}

interface StatsPageClientProps {
  webinar: Webinar
}

interface StatsData {
  chat?: {
    totalMessages: number
    uniqueSenders: number
    participationRate: number
    timeline: Array<{ time_slot: string; message_count: number; sender_count: number }>
    topSenders: Array<{ user_id: string; nickname: string; message_count: number }>
    peakTime: { time: string; messageCount: number } | null
  }
  qa?: {
    totalQuestions: number
    answeredQuestions: number
    uniqueQuestioners: number
    answerTime: { avgMinutes: number; minMinutes: number; maxMinutes: number }
    timeline: Array<{ time_slot: string; question_count: number; answered_count: number }>
    topQuestioners: Array<{ user_id: string; nickname: string; question_count: number }>
    answerTimeDistribution: Array<{ range: string; count: number }>
  }
  forms?: {
    totalSurveys: number
    totalQuizzes: number
    survey: { totalSubmissions: number; uniqueRespondents: number }
    quiz: { totalAttempts: number; uniqueParticipants: number; avgScore: number; maxScore: number; minScore: number }
  }
  giveaways?: {
    totalGiveaways: number
    drawnGiveaways: number
    totalEntries: number
    uniqueParticipants: number
    timeline: Array<{ time_slot: string; entry_count: number; participant_count: number }>
  }
  files?: {
    totalFiles: number
    totalDownloads: number
    uniqueDownloaders: number
    fileDownloads: Array<{ file_id: number; file_name: string; file_size: number; download_count: number }>
  }
  registrants?: {
    totalRegistrants: number
    registrationSources: Array<{ source: string; count: number }>
    maxConcurrentParticipants: number
  }
  access?: {
    maxConcurrentParticipants: number
    avgConcurrentParticipants: number
    timeline: Array<{
      time: string
      avgParticipants: number
      maxParticipants: number
      minParticipants: number
      lastParticipants: number
    }>
    peakTime: { time: string; participantCount: number } | null
  }
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']

export default function StatsPageClient({ webinar }: StatsPageClientProps) {
  const webinarId = webinar.slug || webinar.id
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'month'>('all')

  useEffect(() => {
    fetchStats()
  }, [webinarId, dateRange])

  const fetchStats = async () => {
    setLoading(true)
    setError(null)
    try {
      // 날짜 범위 계산
      const now = new Date()
      let from: string | undefined
      let to: string | undefined

      if (dateRange === 'today') {
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
        to = now.toISOString()
      } else if (dateRange === 'week') {
        from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
        to = now.toISOString()
      } else if (dateRange === 'month') {
        from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
        to = now.toISOString()
      }

      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      params.set('interval', '5m')

      const response = await fetch(`/api/webinars/${webinarId}/stats?${params.toString()}`)
      const result = await response.json()

      if (result.success) {
        setStats(result.data)
      } else {
        setError(result.error || '통계 조회 실패')
      }
    } catch (err: any) {
      setError(err.message || '통계 조회 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">통계를 불러오는 중...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">오류: {error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!stats) {
    return null
  }

  // 차트 데이터 준비
  const chatTimelineData = stats.chat?.timeline.map((item) => ({
    time: new Date(item.time_slot).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    messages: item.message_count,
    senders: item.sender_count,
  })) || []

  const qaTimelineData = stats.qa?.timeline.map((item) => ({
    time: new Date(item.time_slot).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    questions: item.question_count,
    answered: item.answered_count,
  })) || []

  const accessTimelineData = stats.access?.timeline.map((item) => ({
    time: new Date(item.time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    avg: Math.round(item.avgParticipants),
    max: item.maxParticipants,
    min: item.minParticipants,
  })) || []

  const registrationSourceData =
    stats.registrants?.registrationSources.map((item) => ({
      name: item.source === 'email' ? '이메일' : item.source === 'manual' ? '수동' : item.source === 'invite' ? '초대' : item.source,
      value: item.count,
    })) || []

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                통계
              </h1>
              <p className="text-gray-600">{webinar.title}</p>
            </div>
            <div className="flex items-center gap-4">
              {/* 날짜 범위 선택 */}
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 rounded-lg bg-white"
              >
                <option value="all">전체</option>
                <option value="today">오늘</option>
                <option value="week">최근 7일</option>
                <option value="month">최근 30일</option>
              </select>
              <Link
                href={`/webinar/${webinarId}/console`}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                ← 운영 콘솔로
              </Link>
            </div>
          </div>
        </div>

        {/* 개요 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <div className="text-sm text-gray-600 mb-2">총 등록자 수</div>
            <div className="text-3xl font-bold text-blue-600">{stats.registrants?.totalRegistrants || 0}</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <div className="text-sm text-gray-600 mb-2">최대 동시 접속자</div>
            <div className="text-3xl font-bold text-green-600">
              {stats.access?.maxConcurrentParticipants || stats.registrants?.maxConcurrentParticipants || 0}
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <div className="text-sm text-gray-600 mb-2">채팅 참여율</div>
            <div className="text-3xl font-bold text-purple-600">
              {stats.chat?.participationRate ? `${stats.chat.participationRate.toFixed(1)}%` : '0%'}
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <div className="text-sm text-gray-600 mb-2">평균 동시 접속자</div>
            <div className="text-3xl font-bold text-orange-600">
              {stats.access?.avgConcurrentParticipants
                ? Math.round(stats.access.avgConcurrentParticipants)
                : 0}
            </div>
          </div>
        </div>

        {/* 채팅 통계 */}
        {stats.chat && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">채팅 통계</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div>
                <div className="text-sm text-gray-600 mb-1">총 메시지 수</div>
                <div className="text-2xl font-bold text-gray-900">{stats.chat.totalMessages}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">발신자 수</div>
                <div className="text-2xl font-bold text-gray-900">{stats.chat.uniqueSenders}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">참여율</div>
                <div className="text-2xl font-bold text-green-600">{stats.chat.participationRate.toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">피크 시간</div>
                <div className="text-lg font-bold text-blue-600">
                  {stats.chat.peakTime
                    ? new Date(stats.chat.peakTime.time).toLocaleTimeString('ko-KR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '-'}
                </div>
              </div>
            </div>
            {chatTimelineData.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-4">시간대별 메시지 추이</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chatTimelineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="time" stroke="#6b7280" />
                    <YAxis stroke="#6b7280" />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '8px',
                        border: 'none',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                      }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="messages" stroke="#3B82F6" strokeWidth={2} name="메시지 수" />
                    <Line type="monotone" dataKey="senders" stroke="#10B981" strokeWidth={2} name="발신자 수" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {stats.chat.topSenders && stats.chat.topSenders.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-4">최다 발신자</h3>
                <div className="space-y-2">
                  {stats.chat.topSenders.slice(0, 5).map((sender, index) => (
                    <div key={sender.user_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-gray-500 font-bold">#{index + 1}</span>
                        <span className="font-medium">{sender.nickname}</span>
                      </div>
                      <span className="text-blue-600 font-bold">{sender.message_count}개</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Q&A 통계 */}
        {stats.qa && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Q&A 통계</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div>
                <div className="text-sm text-gray-600 mb-1">총 질문 수</div>
                <div className="text-2xl font-bold text-gray-900">{stats.qa.totalQuestions}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">답변 수</div>
                <div className="text-2xl font-bold text-green-600">{stats.qa.answeredQuestions}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">답변률</div>
                <div className="text-2xl font-bold text-blue-600">
                  {stats.qa.totalQuestions > 0
                    ? ((stats.qa.answeredQuestions / stats.qa.totalQuestions) * 100).toFixed(1)
                    : 0}
                  %
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">평균 답변 시간</div>
                <div className="text-2xl font-bold text-purple-600">
                  {stats.qa.answerTime.avgMinutes > 0 ? `${stats.qa.answerTime.avgMinutes.toFixed(1)}분` : '-'}
                </div>
              </div>
            </div>
            {qaTimelineData.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-4">시간대별 질문 추이</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={qaTimelineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="time" stroke="#6b7280" />
                    <YAxis stroke="#6b7280" />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '8px',
                        border: 'none',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                      }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="questions" stroke="#F59E0B" strokeWidth={2} name="질문 수" />
                    <Line type="monotone" dataKey="answered" stroke="#10B981" strokeWidth={2} name="답변 수" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {stats.qa.topQuestioners && stats.qa.topQuestioners.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-4">최다 질문자</h3>
                <div className="space-y-2">
                  {stats.qa.topQuestioners.slice(0, 5).map((questioner, index) => (
                    <div
                      key={questioner.user_id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-gray-500 font-bold">#{index + 1}</span>
                        <span className="font-medium">{questioner.nickname}</span>
                      </div>
                      <span className="text-orange-600 font-bold">{questioner.question_count}개</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 접속 통계 */}
        {stats.access && accessTimelineData.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">접속 통계</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              <div>
                <div className="text-sm text-gray-600 mb-1">최대 동시 접속자</div>
                <div className="text-2xl font-bold text-green-600">{stats.access.maxConcurrentParticipants}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">평균 동시 접속자</div>
                <div className="text-2xl font-bold text-blue-600">
                  {Math.round(stats.access.avgConcurrentParticipants)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">피크 시간</div>
                <div className="text-lg font-bold text-purple-600">
                  {stats.access.peakTime
                    ? new Date(stats.access.peakTime.time).toLocaleTimeString('ko-KR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '-'}
                </div>
              </div>
            </div>
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-4">시간대별 접속자 수 추이</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={accessTimelineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="time" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: 'none',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="avg" stroke="#3B82F6" strokeWidth={2} name="평균 접속자" />
                  <Line type="monotone" dataKey="max" stroke="#10B981" strokeWidth={2} name="최대 접속자" />
                  <Line type="monotone" dataKey="min" stroke="#EF4444" strokeWidth={2} name="최소 접속자" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* 폼/퀴즈 통계 */}
        {stats.forms && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">폼/퀴즈 통계</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-gray-600 mb-1">설문 수</div>
                <div className="text-2xl font-bold text-gray-900">{stats.forms.totalSurveys}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">설문 응답 수</div>
                <div className="text-2xl font-bold text-gray-900">{stats.forms.survey.totalSubmissions}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">설문 응답자 수</div>
                <div className="text-2xl font-bold text-green-600">{stats.forms.survey.uniqueRespondents}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">퀴즈 수</div>
                <div className="text-2xl font-bold text-gray-900">{stats.forms.totalQuizzes}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">퀴즈 시도 수</div>
                <div className="text-2xl font-bold text-gray-900">{stats.forms.quiz.totalAttempts}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">평균 점수</div>
                <div className="text-2xl font-bold text-blue-600">{stats.forms.quiz.avgScore.toFixed(1)}</div>
              </div>
            </div>
          </div>
        )}

        {/* 추첨 통계 */}
        {stats.giveaways && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">추첨 통계</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-gray-600 mb-1">추첨 수</div>
                <div className="text-2xl font-bold text-gray-900">{stats.giveaways.totalGiveaways}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">완료된 추첨</div>
                <div className="text-2xl font-bold text-green-600">{stats.giveaways.drawnGiveaways}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">참여 수</div>
                <div className="text-2xl font-bold text-gray-900">{stats.giveaways.totalEntries}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">참여자 수</div>
                <div className="text-2xl font-bold text-purple-600">{stats.giveaways.uniqueParticipants}</div>
              </div>
            </div>
          </div>
        )}

        {/* 파일 통계 */}
        {stats.files && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">파일 통계</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div>
                <div className="text-sm text-gray-600 mb-1">파일 수</div>
                <div className="text-2xl font-bold text-gray-900">{stats.files.totalFiles}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">다운로드 수</div>
                <div className="text-2xl font-bold text-blue-600">{stats.files.totalDownloads}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">다운로더 수</div>
                <div className="text-2xl font-bold text-green-600">{stats.files.uniqueDownloaders}</div>
              </div>
            </div>
            {stats.files.fileDownloads && stats.files.fileDownloads.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-4">인기 파일</h3>
                <div className="space-y-2">
                  {stats.files.fileDownloads.slice(0, 5).map((file) => (
                    <div key={file.file_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium truncate flex-1">{file.file_name}</span>
                      <span className="text-blue-600 font-bold ml-4">{file.download_count}회</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 등록 출처 통계 */}
        {stats.registrants && registrationSourceData.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">등록 출처 통계</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="grid grid-cols-3 gap-4">
                  {stats.registrants.registrationSources.map((source) => (
                    <div key={source.source} className="text-center">
                      <div className="text-sm text-gray-600 mb-1">
                        {source.source === 'email'
                          ? '이메일'
                          : source.source === 'manual'
                            ? '수동'
                            : source.source === 'invite'
                              ? '초대'
                              : source.source}
                      </div>
                      <div className="text-2xl font-bold text-blue-600">{source.count}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {stats.registrants && stats.registrants.totalRegistrants > 0
                          ? ((source.count / stats.registrants.totalRegistrants) * 100).toFixed(1)
                          : 0}
                        %
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={registrationSourceData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {registrationSourceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}




