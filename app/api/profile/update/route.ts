import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/guards'
import { createAdminSupabase } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * 프로필 정보 수정 (자신의 프로필만 수정 가능)
 */
export async function PATCH(req: Request) {
  try {
    const { user } = await requireAuth()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { display_name, nickname } = body

    // display_name 검증
    if (display_name !== undefined) {
      if (typeof display_name !== 'string') {
        return NextResponse.json(
          { error: 'display_name must be a string' },
          { status: 400 }
        )
      }
      if (display_name.trim().length === 0) {
        return NextResponse.json(
          { error: 'display_name cannot be empty' },
          { status: 400 }
        )
      }
      if (display_name.length > 100) {
        return NextResponse.json(
          { error: 'display_name must be 100 characters or less' },
          { status: 400 }
        )
      }
    }

    // nickname 검증
    if (nickname !== undefined && nickname !== null) {
      if (typeof nickname !== 'string') {
        return NextResponse.json(
          { error: 'nickname must be a string' },
          { status: 400 }
        )
      }
      if (nickname.trim().length > 50) {
        return NextResponse.json(
          { error: 'nickname must be 50 characters or less' },
          { status: 400 }
        )
      }
    }

    const admin = createAdminSupabase()

    // 프로필 업데이트
    const updateData: { display_name?: string; nickname?: string | null } = {}
    if (display_name !== undefined) {
      updateData.display_name = display_name.trim()
    }
    if (nickname !== undefined) {
      updateData.nickname = nickname === null || nickname.trim() === '' ? null : nickname.trim()
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

    const { data: updatedProfile, error: updateError } = await admin
      .from('profiles')
      .update(updateData)
      .eq('id', user.id)
      .select('id, display_name, email, nickname')
      .single()

    if (updateError) {
      console.error('프로필 업데이트 오류:', updateError)
      return NextResponse.json(
        { error: updateError.message || 'Failed to update profile' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      profile: updatedProfile,
    })
  } catch (error: any) {
    console.error('프로필 업데이트 오류:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

