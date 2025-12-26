'use client'

interface ParticipantsTabProps {
  campaignId: string
  entries: any[]
}

export default function ParticipantsTab({ campaignId, entries }: ParticipantsTabProps) {
  return (
    <div>
      {entries && entries.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">완료번호</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">확인코드</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">이름</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">회사명</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">전화번호</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">완료일시</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">스캔일시</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">경품</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {entries.map((entry: any) => (
                <tr key={entry.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {entry.survey_no}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {entry.code6}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {entry.name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {entry.company || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {entry.phone_norm || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {entry.completed_at ? new Date(entry.completed_at).toLocaleString('ko-KR') : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {entry.verified_at ? new Date(entry.verified_at).toLocaleString('ko-KR') : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {entry.prize_label || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center text-gray-500 py-12">
          <div className="text-5xl mb-4">📝</div>
          <p className="text-lg">아직 참여자가 없습니다</p>
        </div>
      )}
    </div>
  )
}

