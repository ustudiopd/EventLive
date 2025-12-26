'use client'

import { useState } from 'react'
import SurveyForm from './SurveyForm'

interface SurveyPageProps {
  campaign: any
  baseUrl: string
}

export default function SurveyPage({ campaign, baseUrl }: SurveyPageProps) {
  const [submitted, setSubmitted] = useState(false)
  const [result, setResult] = useState<{ survey_no: number; code6: string } | null>(null)
  
  const handleSubmitted = (submissionResult: { survey_no: number; code6: string }) => {
    setResult(submissionResult)
    setSubmitted(true)
  }
  
  if (submitted && result) {
    // 완료 페이지로 리다이렉트
    window.location.href = `${baseUrl}/event${campaign.public_path}/done?survey_no=${result.survey_no}&code6=${result.code6}`
    return null
  }
  
  return (
    <SurveyForm
      campaignId={campaign.id}
      formId={campaign.form_id}
      onSubmitted={handleSubmitted}
    />
  )
}

