'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useParams } from 'next/navigation'
import { createClientSupabase } from '@/lib/supabase/client'
import React, { useEffect, useState } from 'react'
import { useSidebar } from './SidebarContext'

interface TreeNode {
  id: string
  label: string
  type: 'super' | 'agency' | 'client' | 'webinar' | 'page'
  href?: string
  icon?: string
  children?: TreeNode[]
  expanded?: boolean
  active?: boolean
}

interface SidebarTreeProps {
  organizations?: {
    isSuperAdmin: boolean
    agencies: Array<{ id: string; name: string; role: string }>
    clients: Array<{ id: string; name: string; role: string; agencyId: string; agencyName: string }>
  } | null
}

export default function SidebarTree({ organizations }: SidebarTreeProps) {
  const pathname = usePathname()
  const params = useParams()
  const router = useRouter()
  const supabase = createClientSupabase()
  // 사이드바 접기 기능 제거됨
  const [user, setUser] = useState<any>(null)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [agencies, setAgencies] = useState<Array<{ id: string; name: string }>>([])
  const [clients, setClients] = useState<Array<{ id: string; name: string; agencyId: string }>>([])
  const [webinars, setWebinars] = useState<Map<string, Array<{ id: string; title: string; slug?: string; type?: 'webinar' | 'survey' }>>>(new Map())

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
    })
  }, [supabase])

  // SuperAdmin인 경우 전체 데이터 로드
  useEffect(() => {
    if (organizations?.isSuperAdmin) {
      fetch('/api/super/sidebar-data')
        .then(res => res.json())
        .then(data => {
          if (data.agencies) setAgencies(data.agencies)
          if (data.clients) setClients(data.clients)
        })
        .catch(err => console.error('슈퍼 관리자 데이터 조회 실패:', err))
    } else if (organizations) {
      // 일반 사용자는 organizations에서 가져옴
      setAgencies((organizations.agencies || []).map((a: any) => ({ id: a.id, name: a.name })))
      setClients((organizations.clients || []).map((c: any) => ({ id: c.id, name: c.name, agencyId: c.agencyId })))
    }
  }, [organizations])

  // 현재 경로에 따라 자동으로 노드 확장
  useEffect(() => {
    const newExpanded = new Set<string>()
    
    if (pathname.includes('/super/')) {
      newExpanded.add('super')
    } else if (pathname.includes('/agency/')) {
      const agencyId = params?.agencyId as string
      if (agencyId) {
        newExpanded.add('super')
        newExpanded.add(`agency-${agencyId}`)
      }
    } else if (pathname.includes('/client/')) {
      const clientId = params?.clientId as string
      if (clientId) {
        const client = clients.find(c => c.id === clientId)
        if (client) {
          newExpanded.add('super')
          if (client.agencyId) {
            newExpanded.add(`agency-${client.agencyId}`)
          }
          newExpanded.add(`client-${clientId}`)
        }
      }
    } else if (pathname.includes('/webinar/')) {
      const webinarId = pathname.match(/^\/webinar\/([^\/]+)/)?.[1]
      if (webinarId) {
        // 웨비나 정보 조회하여 계층 구조 파악
        fetch(`/api/webinars/${webinarId}/workspace-info`)
          .then(res => res.json())
          .then(data => {
            if (data.agency && data.client) {
              newExpanded.add('super')
              newExpanded.add(`agency-${data.agency.id}`)
              newExpanded.add(`client-${data.client.id}`)
              newExpanded.add(`webinar-${data.webinar.id}`)
              setExpandedNodes(newExpanded)
            }
          })
          .catch(err => console.error('웨비나 정보 조회 실패:', err))
      }
    }
    
    if (newExpanded.size > 0) {
      setExpandedNodes(newExpanded)
    }
  }, [pathname, params, clients])

  // 클라이언트별 웨비나 로드
  useEffect(() => {
    const loadWebinars = async (clientId: string) => {
      if (webinars.has(clientId)) return
      
      try {
        const res = await fetch(`/api/client/${clientId}/sidebar-data`)
        const data = await res.json()
        if (data.workspace?.events) {
          setWebinars(prev => new Map(prev).set(clientId, data.workspace.events))
        }
      } catch (err) {
        console.error(`클라이언트 ${clientId} 웨비나 조회 실패:`, err)
      }
    }

    clients.forEach(client => {
      if (expandedNodes.has(`client-${client.id}`)) {
        loadWebinars(client.id)
      }
    })
  }, [clients, expandedNodes, webinars])

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return next
    })
  }

  const buildTree = (): TreeNode[] => {
    const tree: TreeNode[] = []

    // Super Admin 루트 (항상 표시)
    if (organizations?.isSuperAdmin) {
      const superNode: TreeNode = {
        id: 'super',
        label: 'Super Admin',
        type: 'super',
        icon: '👑',
        expanded: expandedNodes.has('super'),
        active: pathname.includes('/super/'),
        children: [
          {
            id: 'super-dashboard',
            label: '대시보드',
            type: 'page',
            href: '/super/dashboard',
            icon: '📊',
            active: pathname === '/super/dashboard'
          },
          {
            id: 'super-agencies',
            label: '에이전시 관리',
            type: 'page',
            href: '/super/agencies',
            icon: '🏢',
            active: pathname.includes('/super/agencies')
          },
          {
            id: 'super-clients',
            label: '클라이언트 관리',
            type: 'page',
            href: '/super/clients',
            icon: '👥',
            active: pathname.includes('/super/clients')
          }
        ]
      }

      // Agency 목록
      agencies.forEach(agency => {
        const agencyNode: TreeNode = {
          id: `agency-${agency.id}`,
          label: agency.name,
          type: 'agency',
          href: `/agency/${agency.id}/dashboard`,
          icon: '🏢',
          expanded: expandedNodes.has(`agency-${agency.id}`),
          active: pathname.includes(`/agency/${agency.id}/`),
          children: [
            {
              id: `agency-${agency.id}-dashboard`,
              label: '대시보드',
              type: 'page',
              href: `/agency/${agency.id}/dashboard`,
              icon: '📊',
              active: pathname === `/agency/${agency.id}/dashboard`
            },
            {
              id: `agency-${agency.id}-clients`,
              label: '클라이언트',
              type: 'page',
              href: `/agency/${agency.id}/clients`,
              icon: '👥',
              active: pathname.includes(`/agency/${agency.id}/clients`)
            },
            {
              id: `agency-${agency.id}-reports`,
              label: '리포트',
              type: 'page',
              href: `/agency/${agency.id}/reports`,
              icon: '📈',
              active: pathname.includes(`/agency/${agency.id}/reports`)
            },
            {
              id: `agency-${agency.id}-domains`,
              label: '도메인',
              type: 'page',
              href: `/agency/${agency.id}/domains`,
              icon: '🌐',
              active: pathname.includes(`/agency/${agency.id}/domains`)
            }
          ]
        }

        // 해당 Agency의 클라이언트 목록
        const agencyClients = clients.filter(c => c.agencyId === agency.id)
        agencyClients.forEach(client => {
          const clientNode: TreeNode = {
            id: `client-${client.id}`,
            label: client.name,
            type: 'client',
            href: `/client/${client.id}/dashboard`,
            icon: '👥',
            expanded: expandedNodes.has(`client-${client.id}`),
            active: pathname.includes(`/client/${client.id}/`),
            children: [
              {
                id: `client-${client.id}-dashboard`,
                label: '대시보드',
                type: 'page',
                href: `/client/${client.id}/dashboard`,
                icon: '📊',
                active: pathname === `/client/${client.id}/dashboard`
              },
              {
                id: `client-${client.id}-accounts`,
                label: '가입계정관리',
                type: 'page',
                href: `/client/${client.id}/accounts`,
                icon: '👥',
                active: pathname.includes(`/client/${client.id}/accounts`)
              },
              {
                id: `client-${client.id}-branding`,
                label: '브랜딩',
                type: 'page',
                href: `/client/${client.id}/settings/branding`,
                icon: '🎨',
                active: pathname.includes(`/client/${client.id}/settings/branding`)
              }
            ]
          }

          // 해당 클라이언트의 웨비나/설문조사 목록
          const clientEvents = webinars.get(client.id) || []
          clientEvents.forEach(event => {
            const isSurvey = event.type === 'survey'
            const eventNode: TreeNode = {
              id: `${isSurvey ? 'survey' : 'webinar'}-${event.id}`,
              label: event.title,
              type: isSurvey ? 'webinar' : 'webinar', // TreeNode 타입은 webinar로 통일
              icon: isSurvey ? '📋' : '🎥',
              expanded: expandedNodes.has(`${isSurvey ? 'survey' : 'webinar'}-${event.id}`),
              active: isSurvey 
                ? pathname.includes(`/client/${client.id}/surveys/${event.id}`)
                : pathname.includes(`/webinar/${event.slug || event.id}/`),
              children: isSurvey ? [
                {
                  id: `survey-${event.id}-console`,
                  label: '콘솔',
                  type: 'page',
                  href: `/client/${client.id}/surveys/${event.id}`,
                  icon: '🎛️',
                  active: pathname.includes(`/client/${client.id}/surveys/${event.id}`)
                }
              ] : [
                {
                  id: `webinar-${event.id}-console`,
                  label: '운영 콘솔',
                  type: 'page',
                  href: `/webinar/${event.slug || event.id}/console`,
                  icon: '🎛️',
                  active: pathname.includes(`/webinar/${event.slug || event.id}/console`)
                },
                {
                  id: `webinar-${event.id}-registrants`,
                  label: '등록자',
                  type: 'page',
                  href: `/webinar/${event.slug || event.id}/registrants`,
                  icon: '👥',
                  active: pathname.includes(`/webinar/${event.slug || event.id}/registrants`)
                },
                {
                  id: `webinar-${event.id}-stats`,
                  label: '통계',
                  type: 'page',
                  href: `/webinar/${event.slug || event.id}/stats`,
                  icon: '📊',
                  active: pathname.includes(`/webinar/${event.slug || event.id}/stats`)
                }
              ]
            }
            clientNode.children!.push(eventNode)
          })

          agencyNode.children!.push(clientNode)
        })

        superNode.children!.push(agencyNode)
      })

      tree.push(superNode)
    } else {
      // 일반 사용자: Agency 또는 Client 모드
      if (organizations?.agencies && organizations.agencies.length > 0) {
        organizations.agencies.forEach(agency => {
          const agencyNode: TreeNode = {
            id: `agency-${agency.id}`,
            label: agency.name,
            type: 'agency',
            href: `/agency/${agency.id}/dashboard`,
            icon: '🏢',
            expanded: expandedNodes.has(`agency-${agency.id}`),
            active: pathname.includes(`/agency/${agency.id}/`),
            children: []
          }

          // 해당 Agency의 클라이언트
          const agencyClients = organizations.clients.filter(c => c.agencyId === agency.id)
          agencyClients.forEach(client => {
            const clientNode: TreeNode = {
              id: `client-${client.id}`,
              label: client.name,
              type: 'client',
              href: `/client/${client.id}/dashboard`,
              icon: '👥',
              expanded: expandedNodes.has(`client-${client.id}`),
              active: pathname.includes(`/client/${client.id}/`),
              children: []
            }

            // 웨비나/설문조사 로드
            const clientEvents = webinars.get(client.id) || []
            clientEvents.forEach(event => {
              const isSurvey = event.type === 'survey'
              const eventNode: TreeNode = {
                id: `${isSurvey ? 'survey' : 'webinar'}-${event.id}`,
                label: event.title,
                type: 'webinar', // TreeNode 타입은 webinar로 통일
                icon: isSurvey ? '📋' : '🎥',
                expanded: expandedNodes.has(`${isSurvey ? 'survey' : 'webinar'}-${event.id}`),
                active: isSurvey 
                  ? pathname.includes(`/client/${client.id}/surveys/${event.id}`)
                  : pathname.includes(`/webinar/${event.slug || event.id}/`),
                children: isSurvey ? [
                  {
                    id: `survey-${event.id}-console`,
                    label: '콘솔',
                    type: 'page',
                    href: `/client/${client.id}/surveys/${event.id}`,
                    icon: '🎛️',
                    active: pathname.includes(`/client/${client.id}/surveys/${event.id}`)
                  }
                ] : [
                  {
                    id: `webinar-${event.id}-console`,
                    label: '운영 콘솔',
                    type: 'page',
                    href: `/webinar/${event.slug || event.id}/console`,
                    icon: '🎛️',
                    active: pathname.includes(`/webinar/${event.slug || event.id}/console`)
                  },
                  {
                    id: `webinar-${event.id}-registrants`,
                    label: '등록자',
                    type: 'page',
                    href: `/webinar/${event.slug || event.id}/registrants`,
                    icon: '👥',
                    active: pathname.includes(`/webinar/${event.slug || event.id}/registrants`)
                  },
                  {
                    id: `webinar-${event.id}-stats`,
                    label: '통계',
                    type: 'page',
                    href: `/webinar/${event.slug || event.id}/stats`,
                    icon: '📊',
                    active: pathname.includes(`/webinar/${event.slug || event.id}/stats`)
                  }
                ]
              }
              clientNode.children!.push(eventNode)
            })

            agencyNode.children!.push(clientNode)
          })

          tree.push(agencyNode)
        })
      }

      // 직접 속한 클라이언트 (에이전시 없이)
      if (organizations?.clients) {
        const directClients = organizations.clients.filter(c => !c.agencyId || !organizations.agencies.some(a => a.id === c.agencyId))
        directClients.forEach(client => {
          const clientNode: TreeNode = {
            id: `client-${client.id}`,
            label: client.name,
            type: 'client',
            icon: '👥',
            expanded: expandedNodes.has(`client-${client.id}`),
            active: pathname.includes(`/client/${client.id}/`),
            children: [
              {
                id: `client-${client.id}-dashboard`,
                label: '대시보드',
                type: 'page',
                href: `/client/${client.id}/dashboard`,
                icon: '📊',
                active: pathname === `/client/${client.id}/dashboard`
              },
              {
                id: `client-${client.id}-accounts`,
                label: '가입계정관리',
                type: 'page',
                href: `/client/${client.id}/accounts`,
                icon: '👥',
                active: pathname.includes(`/client/${client.id}/accounts`)
              },
              {
                id: `client-${client.id}-branding`,
                label: '브랜딩',
                type: 'page',
                href: `/client/${client.id}/settings/branding`,
                icon: '🎨',
                active: pathname.includes(`/client/${client.id}/settings/branding`)
              }
            ]
          }

          const clientEvents = webinars.get(client.id) || []
          clientEvents.forEach(event => {
            const isSurvey = event.type === 'survey'
            const eventNode: TreeNode = {
              id: `${isSurvey ? 'survey' : 'webinar'}-${event.id}`,
              label: event.title,
              type: 'webinar', // TreeNode 타입은 webinar로 통일
              icon: isSurvey ? '📋' : '🎥',
              expanded: expandedNodes.has(`${isSurvey ? 'survey' : 'webinar'}-${event.id}`),
              active: isSurvey 
                ? pathname.includes(`/client/${client.id}/surveys/${event.id}`)
                : pathname.includes(`/webinar/${event.slug || event.id}/`),
              children: isSurvey ? [
                {
                  id: `survey-${event.id}-console`,
                  label: '콘솔',
                  type: 'page',
                  href: `/client/${client.id}/surveys/${event.id}`,
                  icon: '🎛️',
                  active: pathname.includes(`/client/${client.id}/surveys/${event.id}`)
                }
              ] : [
                {
                  id: `webinar-${event.id}-console`,
                  label: '운영 콘솔',
                  type: 'page',
                  href: `/webinar/${event.slug || event.id}/console`,
                  icon: '🎛️',
                  active: pathname.includes(`/webinar/${event.slug || event.id}/console`)
                },
                {
                  id: `webinar-${event.id}-registrants`,
                  label: '등록자',
                  type: 'page',
                  href: `/webinar/${event.slug || event.id}/registrants`,
                  icon: '👥',
                  active: pathname.includes(`/webinar/${event.slug || event.id}/registrants`)
                },
                {
                  id: `webinar-${event.id}-stats`,
                  label: '통계',
                  type: 'page',
                  href: `/webinar/${event.slug || event.id}/stats`,
                  icon: '📊',
                  active: pathname.includes(`/webinar/${event.slug || event.id}/stats`)
                }
              ]
            }
            clientNode.children!.push(eventNode)
          })

          tree.push(clientNode)
        })
      }
    }

    return tree
  }

  const renderTreeNode = (node: TreeNode, level: number = 0): React.ReactElement => {
    const hasChildren = node.children && node.children.length > 0
    const isExpanded = expandedNodes.has(node.id)
    const indent = level * 20

    return (
      <div key={node.id} className="select-none">
        {node.href ? (
          <div
            className={`
              flex items-center gap-2 px-3 py-2 transition-colors
              ${node.active ? 'bg-blue-600 text-white border-r-4 border-blue-400' : 'text-gray-300 hover:bg-gray-700'}
            `}
            style={{ paddingLeft: `${12 + indent}px` }}
          >
            {hasChildren && (
              <button
                className="w-4 h-4 flex items-center justify-center text-xs cursor-pointer hover:text-white"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  toggleNode(node.id)
                }}
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            )}
            {!hasChildren && <span className="w-4"></span>}
            {node.icon && <span className="text-lg flex-shrink-0">{node.icon}</span>}
            <Link
              href={node.href}
              className="flex-1 text-sm font-medium truncate cursor-pointer hover:underline"
              onClick={(e) => {
                // href가 있으면 항상 이동 (화살표 클릭과 구분)
                e.stopPropagation()
              }}
            >
              {node.label}
            </Link>
          </div>
        ) : (
          <div
            className={`
              flex items-center gap-2 px-3 py-2 transition-colors cursor-pointer
              ${node.active ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'}
            `}
            style={{ paddingLeft: `${12 + indent}px` }}
            onClick={() => {
              if (hasChildren) {
                toggleNode(node.id)
              }
            }}
          >
            {hasChildren && (
              <button
                className="w-4 h-4 flex items-center justify-center text-xs cursor-pointer hover:text-white"
                onClick={(e) => {
                  e.stopPropagation()
                  toggleNode(node.id)
                }}
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            )}
            {!hasChildren && <span className="w-4"></span>}
            {node.icon && <span className="text-lg flex-shrink-0">{node.icon}</span>}
            <span className="flex-1 text-sm font-medium truncate">{node.label}</span>
          </div>
        )}
        {hasChildren && isExpanded && (
          <div>
            {node.children!.map(child => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  const tree = buildTree()

  return (
    <nav className="flex-1 overflow-y-auto">
      {tree.map(node => renderTreeNode(node))}
    </nav>
  )
}

