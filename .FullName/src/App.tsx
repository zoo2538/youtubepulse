import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import SystemDashboard from './pages/SystemDashboard'

function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div>
        <h1 className="text-2xl font-bold">YouTube Pulse</h1>
        <p className="text-muted-foreground mt-2">개발 서버가 정상 동작 중입니다.</p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/system" element={<SystemDashboard />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}


