"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronLeft, CheckCircle2, Box, Truck } from "lucide-react"
import { Button } from "@/components/ui/button"

type OrderStep = "selecting" | "packaging" | "sending" | "completed"

export default function OrderPage() {
  const [currentStep, setCurrentStep] = useState<OrderStep>("selecting")
  const [progress, setProgress] = useState(0)

  const steps = [
    {
      id: "selecting" as const,
      title: "Selecting your items",
      description: "We're carefully picking your items from our warehouse",
      icon: CheckCircle2,
      duration: 5000,
    },
    {
      id: "packaging" as const,
      title: "Packaging your items",
      description: "Preparing your package for shipment",
      icon: Box,
      duration: 5000,
    },
    {
      id: "sending" as const,
      title: "Sending your package",
      description: "Your order is on its way to you",
      icon: Truck,
      duration: 5000,
    },
  ]

  useEffect(() => {
    const timers: NodeJS.Timeout[] = []

    // Step 1: Selecting (0-5s)
    timers.push(
      setTimeout(() => {
        setCurrentStep("packaging")
      }, 5000),
    )

    // Step 2: Packaging (5-10s)
    timers.push(
      setTimeout(() => {
        setCurrentStep("sending")
      }, 10000),
    )

    // Step 3: Sending (10-15s)
    timers.push(
      setTimeout(() => {
        setCurrentStep("completed")
      }, 15000),
    )

    // Progress animation
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval)
          return 100
        }
        return prev + 100 / 150 // 15 seconds total
      })
    }, 100)

    return () => {
      timers.forEach((timer) => clearTimeout(timer))
      clearInterval(progressInterval)
    }
  }, [])

  const getStepStatus = (stepId: OrderStep) => {
    const stepOrder = ["selecting", "packaging", "sending"]
    const currentIndex = stepOrder.indexOf(currentStep)
    const stepIndex = stepOrder.indexOf(stepId)

    if (stepIndex < currentIndex) return "completed"
    if (stepIndex === currentIndex) return "active"
    return "pending"
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/">
            <Button variant="ghost" className="gap-2">
              <ChevronLeft className="w-5 h-5" />
              Back to Store
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-2">Processing Your Order</h1>
          <p className="text-muted-foreground">Your order is being prepared and will be shipped soon</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-12">
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all duration-300 ease-out" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-center text-sm text-muted-foreground mt-2">{Math.round(progress)}%</p>
        </div>

        {/* Steps */}
        <div className="space-y-6 mb-12">
          {steps.map((step, index) => {
            const status = getStepStatus(step.id)
            const Icon = step.icon

            return (
              <div key={step.id}>
                <div
                  className={`p-6 rounded-lg border-2 transition-all duration-500 ${
                    status === "completed"
                      ? "bg-green-50 border-green-300 dark:bg-green-950 dark:border-green-700"
                      : status === "active"
                        ? "bg-blue-50 border-blue-300 dark:bg-blue-950 dark:border-blue-700 scale-105"
                        : "bg-muted border-border opacity-50"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex-shrink-0 transition-all duration-500 ${
                        status === "completed"
                          ? "text-green-600 dark:text-green-400 scale-110"
                          : status === "active"
                            ? "text-blue-600 dark:text-blue-400 animate-pulse"
                            : "text-muted-foreground"
                      }`}
                    >
                      <Icon className="w-8 h-8" />
                    </div>
                    <div className="flex-1">
                      <h3
                        className={`text-lg font-semibold mb-1 transition-colors duration-300 ${
                          status === "completed"
                            ? "text-green-700 dark:text-green-300"
                            : status === "active"
                              ? "text-blue-700 dark:text-blue-300"
                              : "text-muted-foreground"
                        }`}
                      >
                        {step.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">{step.description}</p>
                    </div>
                    <div className="flex-shrink-0">
                      {status === "completed" && (
                        <div className="text-sm font-semibold text-green-600 dark:text-green-400 animate-in fade-in duration-300">
                          Done
                        </div>
                      )}
                      {status === "active" && (
                        <div className="text-sm font-semibold text-blue-600 dark:text-blue-400 animate-pulse">
                          Processing...
                        </div>
                      )}
                      {status === "pending" && (
                        <div className="text-sm font-semibold text-muted-foreground">Step {index + 1}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Completion Message */}
        {currentStep === "completed" && (
          <div className="p-8 bg-green-50 border-2 border-green-300 rounded-lg text-center dark:bg-green-950 dark:border-green-700 animate-in fade-in duration-500">
            <CheckCircle2 className="w-12 h-12 text-green-600 dark:text-green-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-green-700 dark:text-green-300 mb-2">Order Complete!</h2>
            <p className="text-green-600 dark:text-green-400 mb-6">
              Your order has been dispatched and is on its way to you.
            </p>
            <Link href="/">
              <Button size="lg">Continue Shopping</Button>
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
