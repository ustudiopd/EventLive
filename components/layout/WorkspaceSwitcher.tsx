'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useSidebar } from './SidebarContext'

interface WorkspaceState {
  mode: 'super' | 'agency' | 'client'
  currentAgency?: { id: string; name: string } | null
  currentClient?: { id: string; name: string } | null
  currentEvent?: { id: string; title: string } | null
}

interface WorkspaceSwitcherProps {
  organizations?: {
    isSuperAdmin: boolean
    agencies: Array<{ id: string; name: string; role: string }>
    clients: Array<{ id: string; name: string; role: string; agencyId: string; agencyName: string }>
  } | null
}

export default function WorkspaceSwitcher({ organizations }: WorkspaceSwitcherProps) {
  const pathname = usePathname()
  const params = useParams()
  const router = useRouter()
  const { isCollapsed } = useSidebar()
  const [workspace, setWorkspace] = useState<WorkspaceState>({
    mode: 'super',
    currentAgency: null,
    currentClient: null,
    currentEvent: null,
  })
  const [agencies, setAgencies] = useState<Array<{ id: string; name: string }>>([])
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([])
  const [events, setEvents] = useState<Array<{ id: string; title: string; slug?: string }>>([])

  // 경로에서 현재 모드 감지
  useEffect(() => {
    if (pathname.includes('/super/')) {
      setWorkspace(prev => ({ ...prev, mode: 'super' }))
    } else if (pathname.includes('/agency/')) {
      setWorkspace(prev => ({ ...prev, mode: 'agency' }))
    } else if (pathname.includes('/client/')) {
      setWorkspace(prev => ({ ...prev, mode: 'client' }))
    }
  }, [pathname])

  // URL에서 이벤트 ID 감지 및 Workspace 자동 세팅
  useEffect(() => {
    const eventIdFromUrl = (() => {
      const match = pathname.match(/^\/webinar\/([^\/]+)/)
      if (match) return match[1]
      return null
    })()

    if (eventIdFromUrl) {
      // 웨비나 정보 조회하여 client/agency까지 자동 세팅
      fetch(`/api/webinars/${eventIdFromUrl}/workspace-info`)
        .then(res => res.json())
        .then(data => {
          if (data.webinar && data.client && data.agency) {
            setWorkspace(prev => ({
              ...prev,
              currentAgency: data.agency,
              currentClient: data.client,
              currentEvent: {
                id: data.webinar.id,
                title: data.webinar.title
              }
            }))
          }
        })
        .catch(err => console.error('Workspace 정보 조회 실패:', err))
    }
  }, [pathname])

  // 현재 Agency/Client ID 추출
  const currentAgencyId = params?.agencyId as string
  const currentClientId = params?.clientId as string

  // 조직 목록 로드
  useEffect(() => {
    if (workspace.mode === 'super') {
      // 슈퍼 관리자: 전체 에이전시/클라이언트 조회
      // organizations가 슈퍼 관리자인지 확인
      if (organizations?.isSuperAdmin) {
        fetch('/api/super/sidebar-data')
          .then(res => {
            if (!res.ok) {
              throw new Error(`HTTP ${res.status}`)
            }
            return res.json()
          })
          .then(data => {
            if (data.agencies) setAgencies(data.agencies)
            if (data.clients) {
              // 선택된 Agency에 따라 클라이언트 필터링
              if (workspace.currentAgency) {
                const filtered = data.clients.filter(
                  (c: any) => c.agencyId === workspace.currentAgency?.id
                )
                setClients(filtered.map((c: any) => ({ id: c.id, name: c.name })))
              } else {
                setClients(data.clients.map((c: any) => ({ id: c.id, name: c.name })))
              }
            }
          })
          .catch(err => {
            console.error('슈퍼 관리자 데이터 조회 실패:', err)
            // 에러 발생 시 빈 배열로 설정
            setAgencies([])
            setClients([])
          })
      }
    } else if (workspace.mode === 'agency' && currentAgencyId) {
      // 에이전시: 소속 클라이언트 조회
      const loadAgencyClients = (clientsData: Array<{ id: string; name: string; agencyId: string }>) => {
        if (!clientsData || clientsData.length === 0) {
          console.log('[WorkspaceSwitcher] 클라이언트 데이터가 비어있음')
          setClients([])
          return
        }
        
        const agencyClients = clientsData.filter(
          (c: any) => c.agencyId === currentAgencyId
        )
        console.log('[WorkspaceSwitcher] 에이전시 모드 - 클라이언트 필터링:', {
          currentAgencyId,
          allClients: clientsData,
          agencyClients,
          filteredCount: agencyClients.length
        })
        setClients(agencyClients.map((c: any) => ({ id: c.id, name: c.name })))
      }

      // organizations가 있으면 사용 (항상 필터링)
      if (organizations?.clients) {
        loadAgencyClients(organizations.clients)
      } else if (organizations === null) {
        // organizations가 아직 로드되지 않은 경우, API로 직접 조회
        fetch('/api/user/organizations')
          .then(res => {
            if (!res.ok) {
              throw new Error(`HTTP ${res.status}`)
            }
            return res.json()
          })
          .then(data => {
            console.log('[WorkspaceSwitcher] API로 클라이언트 조회 완료:', {
              currentAgencyId,
              clientsCount: data.clients?.length || 0,
              data
            })
            if (data.clients && data.clients.length > 0) {
              loadAgencyClients(data.clients)
            } else {
              console.log('[WorkspaceSwitcher] 에이전시 모드 - 클라이언트 없음:', {
                currentAgencyId,
                mode: workspace.mode,
                data
              })
              setClients([])
            }
          })
          .catch(err => {
            console.error('클라이언트 목록 조회 실패:', err)
            setClients([])
          })
      } else {
        // organizations는 있지만 clients가 없는 경우
        console.log('[WorkspaceSwitcher] organizations는 있지만 clients가 없음:', {
          currentAgencyId,
          organizations
        })
        setClients([])
      }
    } else if (workspace.mode === 'client' && currentClientId) {
      // 클라이언트: 소속 웨비나 조회
      fetch(`/api/client/${currentClientId}/sidebar-data`)
        .then(res => {
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`)
          }
          return res.json()
        })
        .then(data => {
          if (data.workspace?.events) {
            setEvents(data.workspace.events)
          }
        })
        .catch(err => console.error('클라이언트 데이터 조회 실패:', err))
    }
  }, [workspace.mode, workspace.currentAgency, currentAgencyId, currentClientId, organizations])

  // 현재 선택된 조직 정보 업데이트 및 클라이언트 목록 재필터링
  useEffect(() => {
    if (currentAgencyId && organizations?.agencies) {
      const agency = organizations.agencies.find(a => a.id === currentAgencyId)
      if (agency) {
        setWorkspace(prev => ({
          ...prev,
          currentAgency: { id: agency.id, name: agency.name }
        }))
        // 에이전시 모드이고 organizations.clients가 있으면 항상 재필터링
        if (workspace.mode === 'agency' && organizations?.clients) {
          const agencyClients = organizations.clients.filter(
            c => c.agencyId === currentAgencyId
          )
          console.log('[WorkspaceSwitcher] 에이전시 업데이트 - 클라이언트 재필터링:', {
            currentAgencyId,
            allClients: organizations.clients,
            agencyClients,
            filteredCount: agencyClients.length
          })
          setClients(agencyClients.map(c => ({ id: c.id, name: c.name })))
        }
      }
    }
    if (currentClientId && organizations?.clients) {
      const client = organizations.clients.find(c => c.id === currentClientId)
      if (client) {
        setWorkspace(prev => ({
          ...prev,
          currentClient: { id: client.id, name: client.name }
        }))
      }
    }
  }, [currentAgencyId, currentClientId, organizations, workspace.mode])

  const handleAgencySelect = (agencyId: string) => {
    if (workspace.mode === 'super') {
      // 슈퍼 관리자: Agency 선택 시 클라이언트 목록 업데이트만
      const agency = agencies.find(a => a.id === agencyId)
      if (agency) {
        setWorkspace(prev => ({
          ...prev,
          currentAgency: { id: agency.id, name: agency.name },
          currentClient: null,
          currentEvent: null
        }))
      }
    } else {
      router.push(`/agency/${agencyId}/dashboard`)
    }
  }

  const handleClientSelect = (clientId: string) => {
    // 모든 모드에서 클라이언트 선택 시 해당 클라이언트 대시보드로 이동
    if (clientId) {
      router.push(`/client/${clientId}/dashboard`)
    }
  }

  const handleEventSelect = (eventId: string) => {
    const event = events.find(e => e.id === eventId || e.slug === eventId)
    if (event) {
      const eventPath = event.slug || event.id
      router.push(`/webinar/${eventPath}/console`)
    }
  }

  if (isCollapsed) {
    // 접힌 상태: 아이콘만 표시
    return (
      <div className="px-2 py-4 border-b border-gray-700">
        <div className="flex flex-col items-center gap-2">
          <div className="text-xs text-gray-400" title={workspace.mode === 'super' ? '슈퍼 관리자' : workspace.mode === 'agency' ? '에이전시' : '클라이언트'}>
            {workspace.mode === 'super' ? '👑' : workspace.mode === 'agency' ? '🏢' : '👥'}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-4 border-b border-gray-700 bg-gray-800">
      <div className="space-y-3">
        {/* Mode 표시 (슈퍼는 고정, 그 외는 전환 가능) */}
        <div>
          <div className="text-xs text-gray-400 mb-1">Mode</div>
          {workspace.mode === 'super' ? (
            <div className="px-3 py-2 bg-blue-600 rounded-lg text-sm font-medium">
              Super Admin
            </div>
          ) : (
            <div className="flex gap-2">
              {organizations?.agencies && organizations.agencies.length > 0 && (
                <button
                  onClick={() => {
                    if (organizations.agencies.length > 0) {
                      handleAgencySelect(organizations.agencies[0].id)
                    }
                  }}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    workspace.mode === 'agency'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Agency
                </button>
              )}
              {organizations?.clients && organizations.clients.length > 0 && (
                <button
                  onClick={() => {
                    if (organizations.clients.length > 0) {
                      handleClientSelect(organizations.clients[0].id)
                    }
                  }}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    workspace.mode === 'client'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Client
                </button>
              )}
            </div>
          )}
        </div>

        {/* Agency 선택 (슈퍼 또는 에이전시 모드) */}
        {(workspace.mode === 'super' || workspace.mode === 'agency') && (
          <div>
            <div className="text-xs text-gray-400 mb-1">Agency</div>
            {workspace.mode === 'super' ? (
              <select
                value={workspace.currentAgency?.id || ''}
                onChange={(e) => {
                  if (e.target.value) {
                    handleAgencySelect(e.target.value)
                  } else {
                    setWorkspace(prev => ({
                      ...prev,
                      currentAgency: null,
                      currentClient: null,
                      currentEvent: null
                    }))
                    setClients([])
                  }
                }}
                className="w-full px-3 py-2 bg-gray-700 rounded-lg text-sm text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">선택하세요</option>
                {agencies.map(agency => (
                  <option key={agency.id} value={agency.id}>
                    {agency.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="px-3 py-2 bg-gray-700 rounded-lg text-sm">
                {workspace.currentAgency?.name || '에이전시'}
              </div>
            )}
          </div>
        )}

        {/* Client 선택 */}
        {(workspace.mode === 'super' || workspace.mode === 'agency' || workspace.mode === 'client') && (
          <div>
            <div className="text-xs text-gray-400 mb-1">Client</div>
            {workspace.mode === 'super' || workspace.mode === 'agency' ? (
              <select
                value={workspace.currentClient?.id || ''}
                onChange={(e) => {
                  if (e.target.value) {
                    handleClientSelect(e.target.value)
                  }
                }}
                disabled={workspace.mode === 'agency' ? (!workspace.currentAgency || clients.length === 0) : !workspace.currentAgency}
                className="w-full px-3 py-2 bg-gray-700 rounded-lg text-sm text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">선택하세요</option>
                {clients.length > 0 ? (
                  clients.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))
                ) : (
                  workspace.mode === 'agency' && organizations?.clients && organizations.clients.length > 0 ? (
                    <option value="" disabled>클라이언트를 불러오는 중...</option>
                  ) : (
                    <option value="" disabled>클라이언트가 없습니다</option>
                  )
                )}
              </select>
            ) : (
              <div className="px-3 py-2 bg-gray-700 rounded-lg text-sm">
                {workspace.currentClient?.name || '클라이언트'}
              </div>
            )}
          </div>
        )}

        {/* Event 선택 (클라이언트 모드만) */}
        {workspace.mode === 'client' && (
          <div>
            <div className="text-xs text-gray-400 mb-1">Event</div>
            <select
              value={workspace.currentEvent?.id || ''}
              onChange={(e) => {
                if (e.target.value) {
                  handleEventSelect(e.target.value)
                }
              }}
              className="w-full px-3 py-2 bg-gray-700 rounded-lg text-sm text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">선택하세요</option>
              {events.map(event => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 에이전시에서 클라이언트 보기로 전환 시 돌아가기 버튼 */}
        {workspace.mode === 'client' && workspace.currentAgency && (
          <button
            onClick={() => handleAgencySelect(workspace.currentAgency!.id)}
            className="w-full px-3 py-2 text-xs text-blue-400 hover:text-blue-300 hover:bg-gray-700 rounded-lg transition-colors"
          >
            ← Agency: {workspace.currentAgency.name}로 돌아가기
          </button>
        )}
      </div>
    </div>
  )
}




