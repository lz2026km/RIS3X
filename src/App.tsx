/**
 * G005 放射RIS系统 v3.0.1 - App 根组件
 * v3.0.11: 重构 - LoginPage/ForbiddenPage 在 AppLayout 外渲染
 * v3.0.6.8-23c (A3): 挂载 <Provider> 以激活 <AntdApp> context (message/notification/modal)
 * v3.0.6.8-107: 在 Provider 之前挂载 <ConfigBootstrapper> 以加载 clinicalConfig
 */
import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './styles/design-system.css'
import { Provider, initTheme } from './components/Provider'
import { NProgressBar } from './components/NProgressBar'
import { UndoToastProvider } from './components/UndoToast'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AppLayout } from './layouts/AppLayout'
import LoginPage from './pages/LoginPage'
import ForbiddenPage from './pages/ForbiddenPage'
import { useAuth } from './hooks/useAuth'
import { ConfigBootstrapper } from './components/config/ConfigBootstrapper'

export default function App() {
  useEffect(() => {
    initTheme()
  }, [])

  const basename = import.meta.env.BASE_URL?.replace(/\/+$/, '') || '';

  return React.createElement(
    ConfigBootstrapper,
    null,
    React.createElement(
      Provider,
      null,
      React.createElement(
        BrowserRouter,
        { basename },
        React.createElement(
          ErrorBoundary,
          { showErrorDetails: true, children: React.createElement(NProgressBar, null,
            React.createElement(UndoToastProvider, null,
              React.createElement(AuthGate, null)
            )
          ) }
        )
      )
    )
  )
}

/**
 * AuthGate - 检查认证状态
 * - 未登录用户: 仅显示 LoginPage 和 ForbiddenPage
 * - 已登录用户: 显示完整的 AppLayout (含 sidebar + Routes)
 */
function AuthGate() {
  const { isAuthenticated } = useAuth()

  // 未登录: 直接渲染 LoginPage (不在 AppLayout 内,避免循环)
  if (!isAuthenticated) {
    return React.createElement(Routes, null,
      React.createElement(Route, { key: 'login', path: '/login', element: React.createElement(LoginPage) }),
      React.createElement(Route, { key: 'forbidden', path: '/forbidden', element: React.createElement(ForbiddenPage) }),
      React.createElement(Route, { key: 'catch-all', path: '*', element: React.createElement(Navigate, { to: '/login', replace: true }) })
    )
  }

  // 已登录: 完整 AppLayout
  return React.createElement(AppLayout, null)
}