"use client"

import { Component, ErrorInfo, ReactNode } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "./ui/button"

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  resetKeys?: any[]
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorInfo: null,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ error, errorInfo })
    this.props.onError?.(error, errorInfo)
    console.error("ErrorBoundary caught an error:", error, errorInfo)
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }
      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] p-6">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-rose-500" />
          </div>
          <h3 className="font-semibold text-white mb-2">Something went wrong</h3>
          <p className="text-sm text-stone-400 mb-4">
            {this.state.error?.message || "An unexpected error occurred"}
          </p>
          <Button variant="outline" onClick={this.handleReset} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Try again
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}

export class ChatErrorBoundary extends Component<{
  children: ReactNode
  onReset?: () => void
}, ErrorBoundaryState> {
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null }
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ error, errorInfo })
    console.error("Chat error:", error, errorInfo)
  }
  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    this.props.onReset?.()
  }
  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center mb-3">
            <AlertTriangle className="w-6 h-6 text-rose-500" />
          </div>
          <p className="text-sm text-stone-400 mb-3">Chat encountered an error</p>
          <Button variant="ghost" size="sm" onClick={this.handleReset} className="gap-1">
            <RefreshCw className="w-3 h-3" />
            Retry
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}

export class ModelErrorBoundary extends Component<{
  children: ReactNode
  model?: string
  onFallback?: () => void
}, ErrorBoundaryState> {
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null }
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ error, errorInfo })
    console.error(`Model ${this.props.model} error:`, error, errorInfo)
  }
  handleFallback = (): void => this.props.onFallback?.()
  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-6">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mb-3">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
          </div>
          <p className="text-sm text-stone-400 mb-3">
            {this.props.model ? `${this.props.model} model unavailable` : "Model unavailable"}
          </p>
          <Button variant="outline" size="sm" onClick={this.handleFallback}>
            Use fallback model
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}

export class VoiceErrorBoundary extends Component<{
  children: ReactNode
  onReset?: () => void
}, ErrorBoundaryState> {
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null }
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ error, errorInfo })
    console.error("Voice error:", error, errorInfo)
  }
  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    this.props.onReset?.()
  }
  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-4">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center mb-2">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
          </div>
          <p className="text-xs text-stone-400 mb-2">Voice connection error</p>
          <Button variant="ghost" size="xs" onClick={this.handleReset}>
            Reconnect
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}

export class NetworkErrorBoundary extends Component<{
  children: ReactNode
  onRetry?: () => void
}, ErrorBoundaryState> {
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null }
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ error, errorInfo })
    console.error("Network error:", error, errorInfo)
  }
  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    this.props.onRetry?.()
  }
  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[300px]">
          <div className="w-20 h-20 rounded-2xl bg-stone-800/50 flex items-center justify-center mb-4">
            <AlertTriangle className="w-10 h-10 text-stone-500" />
          </div>
          <h3 className="font-semibold text-white mb-2">Connection lost</h3>
          <p className="text-sm text-stone-400 mb-4 text-center max-w-md">
            {this.state.error?.message?.includes("network") ? "Please check your internet connection" : "Unable to connect. Please try again."}
          </p>
          <Button onClick={this.handleRetry} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Try again
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}

export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  if (error && typeof error === "object" && "message" in error) return String((error as { message: string }).message)
  return "An unexpected error occurred"
}

export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) return error.message.includes("network") || error.message.includes("fetch") || error.message.includes("online") || error.message.includes("connection") || error.message.includes("ETIMEDOUT") || error.message.includes("ENOTFOUND") || (error.name === "TypeError" && error.message.includes("failed"))
  return false
}

export function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) return error.message.includes("rate limit") || error.message.includes("429") || error.message.includes("quota") || error.message.includes("limit")
  return false
}

export function isAuthError(error: unknown): boolean {
  if (error instanceof Error) return error.message.includes("401") || error.message.includes("403") || error.message.includes("unauthorized") || error.message.includes("forbidden") || error.message.includes("authentication") || error.message.includes("token")
  return false
}

export function getUserFriendlyError(error: unknown): { message: string; type: string; action?: string } {
  const msg = formatErrorMessage(error)
  if (isNetworkError(error)) return { message: "Connection lost. Please check your internet and try again.", type: "network", action: "Check connection" }
  if (isAuthError(error)) return { message: "Authentication failed. Please log in again.", type: "auth", action: "Re-authenticate" }
  if (isRateLimitError(error)) return { message: "Rate limit exceeded. Please try again in a moment.", type: "rate_limit", action: "Wait and retry" }
  if (msg.includes("validation") || msg.includes("invalid")) return { message: "Invalid input. Please check your data and try again.", type: "validation", action: "Check input" }
  return { message: msg || "An unexpected error occurred", type: "unknown", action: "Try again" }
}

export function ErrorDisplay({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const { message, type, action } = getUserFriendlyError(error)
  return (
    <div className={`flex flex-col items-center justify-center p-4 text-center ${className}`}>
      <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3">
        {type === "network" && <AlertTriangle className="w-6 h-6 text-amber-500" />}
        {type === "auth" && <AlertTriangle className="w-6 h-6 text-rose-500" />}
        {type === "rate_limit" && <AlertTriangle className="w-6 h-6 text-orange-500" />}
        {type === "validation" && <AlertTriangle className="w-6 h-6 text-cyan-500" />}
        {type === "unknown" && <AlertTriangle className="w-6 h-6 text-stone-500" />}
      </div>
      <p className="text-sm text-stone-400 mb-3">{message}</p>
      {onRetry && action && <Button variant="outline" size="sm" onClick={onRetry}>{action}</Button>}
    </div>
  )
}