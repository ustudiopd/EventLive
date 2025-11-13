'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function SignupPage() {
  const router = useRouter()
  
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="w-full max-w-2xl p-8 bg-white rounded-2xl shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            회원가입
          </h1>
          <p className="text-gray-600">가입하실 역할을 선택해주세요</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => router.push('/signup/agency')}
            className="group p-6 border-2 border-blue-200 rounded-xl hover:border-blue-500 hover:bg-gradient-to-br hover:from-blue-50 hover:to-purple-50 transition-all duration-200 text-left shadow-md hover:shadow-xl"
          >
            <div className="text-3xl mb-3">🏢</div>
            <div className="font-semibold text-lg mb-2 text-gray-800 group-hover:text-blue-600 transition-colors">에이전시</div>
            <div className="text-sm text-gray-600">
              여러 클라이언트를 관리하고 웨비나 서비스를 제공합니다
            </div>
          </button>
          
          <button
            onClick={() => router.push('/signup/client')}
            className="group p-6 border-2 border-green-200 rounded-xl hover:border-green-500 hover:bg-gradient-to-br hover:from-green-50 hover:to-emerald-50 transition-all duration-200 text-left shadow-md hover:shadow-xl"
          >
            <div className="text-3xl mb-3">👥</div>
            <div className="font-semibold text-lg mb-2 text-gray-800 group-hover:text-green-600 transition-colors">클라이언트</div>
            <div className="text-sm text-gray-600">
              웨비나를 생성하고 운영합니다 (에이전시 초대 필요)
            </div>
          </button>
        </div>
        
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-800 text-center">
            💡 참여자(개인회원)는 웨비나 페이지에서 가입할 수 있습니다
          </p>
        </div>
        
        <div className="mt-6 text-center">
          <Link href="/login" className="text-sm text-blue-600 hover:text-blue-700 hover:underline transition-colors">
            이미 계정이 있으신가요? 로그인
          </Link>
        </div>
      </div>
    </div>
  )
}

