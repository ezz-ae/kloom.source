"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Check, X, ArrowRight, Sparkles, Rocket, Users, GraduationCap, Mic, Gift } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { useWallet } from "@solana/wallet-adapter-react"

// Onboarding step types
type OnboardingStep = {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  cta: string
}

// Feature highlights
const FEATURE_HIGHLIGHTS = [
  {
    id: "multi-ai",
    title: "Multi-AI Conversations",
    description: "Chat with Claude, Gemini, GPT, and Mistral simultaneously in one room",
    icon: <Users size={24} className="text-purple-400" />,
    cta: "Try Multi-AI Room",
  },
  {
    id: "experts",
    title: "100+ AI Experts",
    description: "Access specialists in business, coding, wellness, and more",
    icon: <GraduationCap size={24} className="text-cyan-400" />,
    cta: "Browse Experts",
  },
  {
    id: "voice",
    title: "Live Voice Chat",
    description: "Real-time voice conversations with AI models",
    icon: <Mic size={24} className="text-emerald-400" />,
    cta: "Start Voice Chat",
  },
  {
    id: "free",
    title: "Free to Start",
    description: "Text chat is completely free. Pay only for voice calls",
    icon: <Gift size={24} className="text-amber-400" />,
    cta: "Get Started Free",
  },
]

// Quick start guide steps
const QUICK_START_STEPS = [
  {
    step: 1,
    title: "Connect Your Wallet",
    description: "Your Solana wallet is your account. No email, no password needed.",
    action: "Connect Wallet",
  },
  {
    step: 2,
    title: "Pick a Room or Expert",
    description: "Choose from multi-AI rooms or specialized experts.",
    action: "Browse Options",
  },
  {
    step: 3,
    title: "Start Chatting",
    description: "Begin your conversation with AI. Text is free, voice is pay-as-you-go.",
    action: "Start Now",
  },
]

export function OnboardingModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const { publicKey } = useWallet()
  const [currentStep, setCurrentStep] = useState(0)
  const [completed, setCompleted] = useState(false)

  // Auto-close if user connects wallet or completes onboarding
  useEffect(() => {
    if (publicKey) {
      onClose()
    }
  }, [publicKey, onClose])

  const handleNext = () => {
    if (currentStep < QUICK_START_STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      setCompleted(true)
      setTimeout(onClose, 1500)
    }
  }

  const handleSkip = () => {
    onClose()
  }

  const handleFeatureClick = (featureId: string) => {
    onClose()
    switch (featureId) {
      case "multi-ai":
        router.push("/app/rooms")
        break
      case "experts":
        router.push("/app/experts")
        break
      case "voice":
        router.push("/app/voice")
        break
      case "free":
        router.push("/app/discover")
        break
    }
  }

  if (completed) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md bg-stone-950 border-stone-800">
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center mb-6">
              <Rocket size={40} className="text-white" />
            </div>
            <h3 className="text-2xl font-black text-white mb-2">You're All Set!</h3>
            <p className="text-white/60 text-center mb-6">
              Start exploring KLOOM and discover the power of multi-AI conversations.
            </p>
            <Button
              onClick={() => {
                onClose()
                router.push("/app/discover")
              }}
              className="bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600"
            >
              Explore KLOOM
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl bg-stone-950 border-stone-800">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black">
            Welcome to <span className="bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">KLOOM</span>
          </DialogTitle>
          <DialogDescription className="text-white/60">
            The future of AI conversations is here. Let's get you started.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Progress */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {QUICK_START_STEPS.map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index === currentStep
                      ? "bg-purple-400 w-4"
                      : index < currentStep
                      ? "bg-cyan-400"
                      : "bg-stone-700"
                  }`}
                />
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={handleSkip} className="text-white/40 hover:text-white">
              Skip
            </Button>
          </div>

          {/* Current Step */}
          <div className="text-center">
            <div className="text-5xl font-black text-white/10 mb-4">
              {QUICK_START_STEPS[currentStep].step}
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              {QUICK_START_STEPS[currentStep].title}
            </h3>
            <p className="text-white/60 mb-6">
              {QUICK_START_STEPS[currentStep].description}
            </p>

            {/* Step-specific content */}
            {currentStep === 0 && (
              <div className="bg-stone-900/50 border border-stone-800 rounded-xl p-6 mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
                    <Sparkles size={24} className="text-white" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-bold text-white">Wallet Connection</h4>
                    <p className="text-sm text-white/60">
                      Connect your Solana wallet to access all KLOOM features.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 1 && (
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-stone-900/50 border border-purple-500/20 rounded-xl p-4 text-center">
                  <Users size={20} className="text-purple-400 mx-auto mb-2" />
                  <div className="text-sm font-medium text-white">Rooms</div>
                  <div className="text-xs text-white/40">Multi-AI</div>
                </div>
                <div className="bg-stone-900/50 border border-cyan-500/20 rounded-xl p-4 text-center">
                  <GraduationCap size={20} className="text-cyan-400 mx-auto mb-2" />
                  <div className="text-sm font-medium text-white">Experts</div>
                  <div className="text-xs text-white/40">100+</div>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="bg-stone-900/50 border border-emerald-500/20 rounded-xl p-6 mb-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Check size={16} className="text-emerald-400" />
                    <span className="text-sm text-white">Text chat is free</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check size={16} className="text-emerald-400" />
                    <span className="text-sm text-white">Voice calls from $1</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check size={16} className="text-emerald-400" />
                    <span className="text-sm text-white">First 5 minutes free</span>
                  </div>
                </div>
              </div>
            )}

            <Button
              onClick={handleNext}
              className="w-full bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600"
            >
              {currentStep < QUICK_START_STEPS.length - 1 ? (
                <>Next: {QUICK_START_STEPS[currentStep + 1].title}</>
              ) : (
                <>Get Started <ArrowRight size={16} className="ml-2" /></>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Feature Tour component
export function FeatureTour() {
  const [currentFeature, setCurrentFeature] = useState(0)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    // Show tour on first visit (can be controlled by localStorage)
    const hasSeenTour = localStorage.getItem("kloom_feature_tour_seen")
    if (!hasSeenTour) {
      setTimeout(() => setIsOpen(true), 2000)
    }
  }, [])

  const handleClose = () => {
    setIsOpen(false)
    localStorage.setItem("kloom_feature_tour_seen", "true")
  }

  return (
    <OnboardingModal
      isOpen={isOpen}
      onClose={handleClose}
    />
  )
}

// Quick Start Guide component
export function QuickStartGuide() {
  const router = useRouter()

  const handleFeatureSelect = (featureId: string) => {
    switch (featureId) {
      case "multi-ai":
        router.push("/app/rooms")
        break
      case "experts":
        router.push("/app/experts")
        break
      case "voice":
        router.push("/app/voice")
        break
      case "free":
        router.push("/app/discover")
        break
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {FEATURE_HIGHLIGHTS.map((feature) => (
        <button
          key={feature.id}
          onClick={() => handleFeatureSelect(feature.id)}
          className="group bg-stone-900/50 border border-stone-800 rounded-2xl p-6 hover:border-purple-500/30 transition-all text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-stone-800 flex items-center justify-center mb-4 group-hover:bg-purple-500/10 transition-colors">
            {feature.icon}
          </div>
          <h3 className="font-bold text-white mb-1 group-hover:text-purple-400 transition-colors">
            {feature.title}
          </h3>
          <p className="text-sm text-white/60 mb-3">{feature.description}</p>
          <span className="inline-flex items-center text-xs font-medium text-cyan-400 group-hover:text-cyan-300 transition-colors">
            {feature.cta} <ArrowRight size={12} className="ml-1" />
          </span>
        </button>
      ))}
    </div>
  )
}

// Onboarding Tooltip component
export function OnboardingTooltip({
  title,
  description,
  position = "bottom",
  children,
}: {
  title: string
  description: string
  position?: "top" | "bottom" | "left" | "right"
  children: React.ReactNode
}) {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <div className="relative inline-block">
      {children}
      {isVisible && (
        <div className="absolute z-50 mt-2 w-64 p-4 bg-stone-900 border border-stone-800 rounded-xl shadow-lg">
          <h4 className="font-bold text-white mb-1">{title}</h4>
          <p className="text-sm text-white/60">{description}</p>
        </div>
      )}
    </div>
  )
}
