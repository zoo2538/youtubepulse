import React from 'react'

export default function SystemDashboard() {
  return (
    <div className="min-h-screen p-6">
      <h1 className="text-2xl font-bold">시스템 대시보드</h1>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">앱 버전</div>
          <div className="mt-1 text-xl">0.0.0</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Vite 서버</div>
          <div className="mt-1 text-xl">http://localhost:8080</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">상태</div>
          <div className="mt-1 text-xl">정상</div>
        </div>
      </div>
    </div>
  )
}


