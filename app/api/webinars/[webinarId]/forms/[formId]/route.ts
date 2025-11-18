import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createServerSupabase } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/guards'

export const runtime = 'nodejs'

// 폼 상세 조회
export async function GET(
  req: Request,
  { params }: { params: Promise<{ webinarId: string; formId: string }> }
) {
  try {
    const { webinarId, formId } = await params
    
    const supabase = await createServerSupabase()
    const admin = createAdminSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    // 필요한 컬럼만 선택하여 조회 (성능 최적화)
    const formSelectFields = 'id, webinar_id, agency_id, client_id, title, description, kind, status, time_limit_sec, max_attempts, created_by, created_at, opened_at, closed_at'
    const questionSelectFields = 'id, form_id, order_no, type, body, options, points, answer_key, created_at'
    
    // 모든 쿼리를 병렬로 실행 (성능 최적화)
    const [formResult, questionsResult] = await Promise.all([
      admin
        .from('forms')
        .select(formSelectFields)
        .eq('id', formId)
        .eq('webinar_id', webinarId)
        .single(),
      admin
        .from('form_questions')
        .select(questionSelectFields)
        .eq('form_id', formId)
        .order('order_no', { ascending: true })
    ])
    
    const { data: form, error: formError } = formResult
    const { data: questions, error: questionsError } = questionsResult
    
    if (formError || !form) {
      return NextResponse.json(
        { error: 'Form not found' },
        { status: 404 }
      )
    }
    
    if (questionsError) {
      return NextResponse.json(
        { error: questionsError.message },
        { status: 500 }
      )
    }
    
    // 제출 여부 및 권한 확인을 병렬로 실행 (성능 최적화)
    let canViewAnswers = false
    let isSubmitted = false
    let submissionData: any = null
    
    const parallelChecks = []
    
    // 설문인 경우 제출 여부 및 답안 확인
    if (form.kind === 'survey' && user) {
      parallelChecks.push(
        Promise.all([
          admin
            .from('form_submissions')
            .select('id')
            .eq('form_id', formId)
            .eq('participant_id', user.id)
            .maybeSingle(),
          admin
            .from('form_answers')
            .select('question_id, choice_ids, text_answer, submission_id')
            .eq('form_id', formId)
            .eq('participant_id', user.id)
            .order('answered_at', { ascending: false })
            .then(({ data: answers }) => {
              // submission_id로 그룹화하여 가장 최근 제출의 답안만 가져오기
              if (answers && answers.length > 0) {
                // submission_id별로 그룹화 (같은 submission_id의 답안들)
                const submissionIds = [...new Set(answers.map((a: any) => a.submission_id))]
                // 가장 최근 submission_id 찾기 (answered_at 기준으로 정렬되어 있으므로 첫 번째 그룹)
                const latestSubmissionId = submissionIds[0]
                return answers.filter((a: any) => a.submission_id === latestSubmissionId)
              }
              return []
            })
        ]).then(([submissionResult, answersResult]) => ({
          type: 'survey_submission',
          submission: submissionResult.data,
          answers: answersResult
        }))
      )
    } else if (form.kind === 'quiz' && user) {
      // 퀴즈인 경우 제출 정보와 답안 조회
      parallelChecks.push(
        Promise.all([
          admin
            .from('form_submissions')
            .select('id')
            .eq('form_id', formId)
            .eq('participant_id', user.id)
            .order('submitted_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          admin
            .from('quiz_attempts')
            .select('id, total_score, attempt_no')
            .eq('form_id', formId)
            .eq('participant_id', user.id)
            .order('attempt_no', { ascending: false })
            .limit(1)
            .maybeSingle()
        ]).then(([submissionResult, attemptResult]) => ({
          type: 'quiz_submission',
          submission: submissionResult.data,
          attempt: attemptResult.data
        }))
      )
    } else {
      parallelChecks.push(Promise.resolve({ type: 'submission', data: null }))
    }
    
    // 퀴즈인 경우 권한 확인 (프로필 + 클라이언트 멤버십 병렬)
    if (form.kind === 'quiz' && form.status !== 'closed' && user) {
      parallelChecks.push(
        Promise.all([
          supabase
            .from('profiles')
            .select('is_super_admin')
            .eq('id', user.id)
            .maybeSingle(),
          supabase
            .from('client_members')
            .select('role')
            .eq('client_id', form.client_id)
            .eq('user_id', user.id)
            .maybeSingle()
        ]).then(([profileResult, clientMemberResult]) => ({
          type: 'quiz_permission',
          profile: profileResult.data,
          clientMember: clientMemberResult.data
        }))
      )
    } else {
      parallelChecks.push(Promise.resolve({ type: 'quiz_permission', profile: null, clientMember: null }))
    }
    
    // 병렬로 실행
    const checkResults = await Promise.all(parallelChecks)
    
    // 결과 처리
    let surveyAnswers: any[] = []
    for (const result of checkResults) {
      if (result.type === 'submission' && 'data' in result && result.data) {
        isSubmitted = true
      } else if (result.type === 'survey_submission' && 'submission' in result && 'answers' in result) {
        if (result.submission) {
          isSubmitted = true
          surveyAnswers = result.answers || []
        }
      } else if (result.type === 'quiz_submission' && 'submission' in result && 'attempt' in result) {
        if (result.submission) {
          isSubmitted = true
          submissionData = {
            submissionId: result.submission.id,
            attempt: result.attempt,
          }
        }
      } else if (result.type === 'quiz_permission' && 'profile' in result) {
        if (result.profile?.is_super_admin) {
          canViewAnswers = true
        } else if (result.clientMember && ['owner', 'admin', 'operator'].includes(result.clientMember.role)) {
          canViewAnswers = true
        }
      }
    }
    
    // 이미 제출한 설문인 경우 답안 정보 구성
    let surveyUserAnswers: Record<string, any> = {}
    if (form.kind === 'survey' && isSubmitted && surveyAnswers.length > 0) {
      surveyAnswers.forEach((answer: any) => {
        const question = questions?.find((q: any) => q.id === answer.question_id)
        if (question) {
          if (answer.choice_ids && Array.isArray(answer.choice_ids)) {
            // 단일/다중 선택
            if (question.type === 'single') {
              surveyUserAnswers[answer.question_id] = answer.choice_ids[0]
            } else {
              surveyUserAnswers[answer.question_id] = answer.choice_ids
            }
          } else if (answer.text_answer) {
            // 텍스트 답변
            surveyUserAnswers[answer.question_id] = answer.text_answer
          }
        }
      })
    }
    
    // 이미 제출한 퀴즈인 경우 정답 정보 조회
    let userAnswers: any[] = []
    let questionResults: any[] = []
    
    if (form.kind === 'quiz' && isSubmitted && submissionData?.submissionId) {
      // 사용자의 답안 조회
      const { data: answers } = await admin
        .from('form_answers')
        .select('question_id, choice_ids, text_answer, is_correct, points_awarded')
        .eq('submission_id', submissionData.submissionId)
      
      userAnswers = answers || []
      
      // 각 문항별 정답 정보 구성
      for (const q of questions || []) {
        const userAnswer = userAnswers.find((a: any) => a.question_id === q.id)
        questionResults.push({
          questionId: q.id,
          isCorrect: userAnswer?.is_correct ?? null,
          pointsAwarded: userAnswer?.points_awarded ?? 0,
          correctAnswer: q.answer_key, // 정답 키
          userAnswer: userAnswer ? {
            choiceIds: userAnswer.choice_ids,
            textAnswer: userAnswer.text_answer,
          } : null,
        })
      }
    }
    
    // 정답키 제거 (권한이 없고 아직 제출하지 않은 경우)
    if (form.kind === 'quiz' && form.status !== 'closed' && !canViewAnswers && !isSubmitted) {
      questions?.forEach((q: any) => {
        delete q.answer_key
      })
    }
    
    return NextResponse.json({
      success: true,
      form: {
        ...form,
        questions: questions || [],
        isSubmitted, // 제출 여부 포함
      },
      // 퀴즈이고 이미 제출한 경우 정답 정보 포함
      ...(form.kind === 'quiz' && isSubmitted && submissionData ? {
        submissionResult: {
          totalScore: submissionData.attempt?.total_score || 0,
          attemptNo: submissionData.attempt?.attempt_no || 1,
          questionResults,
        }
      } : {}),
      // 설문이고 이미 제출한 경우 답안 정보 포함
      ...(form.kind === 'survey' && isSubmitted ? {
        userAnswers: surveyUserAnswers,
      } : {}),
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// 폼 수정
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ webinarId: string; formId: string }> }
) {
  try {
    const { webinarId, formId } = await params
    const { title, description, timeLimitSec, maxAttempts, questions } = await req.json()
    
    const { user } = await requireAuth()
    const supabase = await createServerSupabase()
    const admin = createAdminSupabase()
    
    // 폼 조회
    const { data: form, error: formError } = await admin
      .from('forms')
      .select('*')
      .eq('id', formId)
      .eq('webinar_id', webinarId)
      .single()
    
    if (formError || !form) {
      return NextResponse.json(
        { error: 'Form not found' },
        { status: 404 }
      )
    }
    
    // 권한 확인
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single()
    
    let hasPermission = false
    
    if (profile?.is_super_admin) {
      hasPermission = true
    } else {
      const { data: clientMember } = await supabase
        .from('client_members')
        .select('role')
        .eq('client_id', form.client_id)
        .eq('user_id', user.id)
        .maybeSingle()
      
      if (clientMember && ['owner', 'admin', 'operator'].includes(clientMember.role)) {
        hasPermission = true
      }
    }
    
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }
    
    // 폼 수정
    const updateData: any = {}
    if (title !== undefined) updateData.title = title.trim()
    if (description !== undefined) updateData.description = description?.trim() || null
    if (timeLimitSec !== undefined) updateData.time_limit_sec = timeLimitSec || null
    if (maxAttempts !== undefined) updateData.max_attempts = maxAttempts || null
    
    const { data: updatedForm, error: updateError } = await admin
      .from('forms')
      .update(updateData)
      .eq('id', formId)
      .select()
      .single()
    
    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }
    
    // 문항 수정 (있는 경우)
    if (questions && Array.isArray(questions)) {
      // 기존 문항 삭제
      await admin.from('form_questions').delete().eq('form_id', formId)
      
      // 새 문항 생성
      const questionRows = questions.map((q: any, index: number) => ({
        form_id: formId,
        order_no: index + 1,
        type: q.type,
        body: q.body.trim(),
        options: q.options || null,
        points: q.points || 0,
        answer_key: q.answerKey || null,
      }))
      
      const { data: createdQuestions, error: questionsError } = await admin
        .from('form_questions')
        .insert(questionRows)
        .select()
      
      if (questionsError) {
        return NextResponse.json(
          { error: questionsError.message },
          { status: 500 }
        )
      }
      
      updatedForm.questions = createdQuestions
    }
    
    // 감사 로그
    await admin
      .from('audit_logs')
      .insert({
        actor_user_id: user.id,
        agency_id: form.agency_id,
        client_id: form.client_id,
        webinar_id: webinarId,
        action: 'FORM_UPDATE',
        payload: { form_id: formId },
      })
    
    return NextResponse.json({ success: true, form: updatedForm })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// 폼 삭제
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ webinarId: string; formId: string }> }
) {
  try {
    const { webinarId, formId } = await params
    
    const { user } = await requireAuth()
    const supabase = await createServerSupabase()
    const admin = createAdminSupabase()
    
    // 폼 조회
    const { data: form, error: formError } = await admin
      .from('forms')
      .select('*')
      .eq('id', formId)
      .eq('webinar_id', webinarId)
      .single()
    
    if (formError || !form) {
      return NextResponse.json(
        { error: 'Form not found' },
        { status: 404 }
      )
    }
    
    // 권한 확인 (클라이언트 operator 이상 또는 에이전시 owner/admin)
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single()
    
    let hasPermission = false
    
    if (profile?.is_super_admin) {
      hasPermission = true
    } else {
      // 클라이언트 멤버십 확인
      const { data: clientMember } = await supabase
        .from('client_members')
        .select('role')
        .eq('client_id', form.client_id)
        .eq('user_id', user.id)
        .maybeSingle()
      
      if (clientMember && ['owner', 'admin', 'operator'].includes(clientMember.role)) {
        hasPermission = true
      } else {
        // 에이전시 멤버십 확인 (owner/admin만 삭제 가능)
        if (form.agency_id) {
          const { data: agencyMember } = await supabase
            .from('agency_members')
            .select('role')
            .eq('agency_id', form.agency_id)
            .eq('user_id', user.id)
            .maybeSingle()
          
          if (agencyMember && ['owner', 'admin'].includes(agencyMember.role)) {
            hasPermission = true
          }
        }
      }
    }
    
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }
    
    // 폼 삭제 (CASCADE로 관련 데이터도 삭제됨)
    const { error: deleteError } = await admin
      .from('forms')
      .delete()
      .eq('id', formId)
    
    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      )
    }
    
    // 감사 로그
    await admin
      .from('audit_logs')
      .insert({
        actor_user_id: user.id,
        agency_id: form.agency_id,
        client_id: form.client_id,
        webinar_id: webinarId,
        action: 'FORM_DELETE',
        payload: { form_id: formId },
      })
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

