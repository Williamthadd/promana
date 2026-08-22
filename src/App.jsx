import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'

const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const OfflineReceiver = lazy(() =>
  import('./features/optical-transfer/receiver/OfflineReceiver'),
)
const ProtectedRoute = lazy(() => import('./components/ProtectedRoute'))

export default function App() {
  return (
    <>
      <BrowserRouter>
        <Suspense
          fallback={
            <div className="grid min-h-dvh place-items-center bg-slate-950 text-sm font-bold text-white">
              Loading ProMana…
            </div>
          }
        >
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/receiver" element={<OfflineReceiver />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<DashboardPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      {window.location.pathname !== '/receiver' ? <Analytics /> : null}
    </>
  )
}
