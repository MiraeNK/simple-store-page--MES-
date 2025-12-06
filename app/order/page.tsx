"use client"

import { useEffect, useState, useRef, useMemo } from "react"
import Link from "next/link"
import { ChevronLeft, CheckCircle2, Box, Truck, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { database } from "@/lib/firebase"
import { ref, onValue, update, child } from "firebase/database" // Import update

type OrderStep = "idle" | "selecting" | "packaging" | "sending" | "completed"
type DBStatus = "Todo" | "In Progress" | "Done"

interface OrderData {
  id: string
  items: any[]
  status?: string // Tambahan status
  // properti lain
}

export default function OrderPage() {
  // --- STATE ---
  const [orders, setOrders] = useState<OrderData[]>([])
  // Kita selalu memproses order pertama di antrian (FIFO)
  const activeOrder = useMemo(() => orders[0], [orders])
  
  // Tracking Status (Global dari node 'tracking')
  const [pickingStatus, setPickingStatus] = useState<DBStatus>("Todo")
  const [packagingStatus, setPackagingStatus] = useState<DBStatus>("Todo")

  // Visual Progress
  const [currentStep, setCurrentStep] = useState<OrderStep>("idle")
  const [progress, setProgress] = useState(0)

  // Timer Refs
  const progressInterval = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number | null>(null)

  // 1. FETCH & FILTER ORDER (REALTIME)
  useEffect(() => {
    const ordersRef = ref(database, 'orders')
    
    // Gunakan onValue agar realtime update saat ada order baru masuk atau order lama selesai
    const unsubscribe = onValue(ordersRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val()
        const formattedOrders = Object.keys(data)
          .map(key => ({
            id: key,
            ...data[key]
          }))
          // FILTER PENTING: Hanya ambil yang BELUM 'completed'
          .filter((order: OrderData) => order.status !== 'completed')
          .sort((a, b) => {
             // Urutkan berdasarkan angka di ID (order_1, order_2)
             const numA = parseInt(a.id.split('_')[1] || "0")
             const numB = parseInt(b.id.split('_')[1] || "0")
             return numA - numB
          })
        setOrders(formattedOrders)
      } else {
        setOrders([])
      }
    })

    return () => unsubscribe()
  }, [])

  // 2. LISTENER GLOBAL TRACKING
  useEffect(() => {
    const trackingRef = ref(database, 'tracking')
    
    const unsubscribe = onValue(trackingRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val()
        setPickingStatus(data.itemPicking || "Todo")
        setPackagingStatus(data.packaging || "Todo")
      }
    })

    return () => unsubscribe()
  }, [])

  // 3. RESET VISUAL SAAT GANTI ORDER
  // Setiap kali activeOrder berubah (misal order 1 selesai, order 2 naik jadi activeOrder), reset semua
  useEffect(() => {
    if (activeOrder) {
      setCurrentStep("idle")
      setProgress(0)
      if (progressInterval.current) clearInterval(progressInterval.current)
      progressInterval.current = null
    }
  }, [activeOrder?.id]) // Jalankan hanya jika ID order berubah

  // 4. LOGIKA VISUAL TIMER & PERPINDAHAN STEP
  useEffect(() => {
    const clearTimer = () => {
      if (progressInterval.current) clearInterval(progressInterval.current)
      progressInterval.current = null
      startTimeRef.current = null
    }

    // Jika tidak ada order aktif, jangan jalankan logika
    if (!activeOrder) return;

    // --- FASE 0: IDLE ---
    if (pickingStatus === "Todo" && packagingStatus === "Todo") {
        setCurrentStep("selecting") 
        setProgress(0)
        clearTimer()
    }

    // --- FASE 1: PICKING ---
    else if (pickingStatus === "In Progress") {
        setCurrentStep("selecting")
        if (!progressInterval.current) {
            startTimeRef.current = Date.now()
            progressInterval.current = setInterval(() => {
                const elapsed = Date.now() - (startTimeRef.current || 0)
                let percent = (elapsed / 60000) * 100 // 60 Detik
                if (percent >= 99) percent = 99
                setProgress(percent)
            }, 100)
        }
    }
    else if (pickingStatus === "Done" && packagingStatus === "Todo") {
        clearTimer()
        setCurrentStep("selecting")
        setProgress(100)
        setTimeout(() => setProgress(0), 900) 
    }

    // --- FASE 2: PACKAGING ---
    else if (packagingStatus === "In Progress") {
        setCurrentStep("packaging")
        if (!progressInterval.current) {
            startTimeRef.current = Date.now()
            progressInterval.current = setInterval(() => {
                const elapsed = Date.now() - (startTimeRef.current || 0)
                let percent = (elapsed / 30000) * 100 // 30 Detik
                if (percent >= 99) percent = 99
                setProgress(percent)
            }, 100)
        }
    }
    else if (packagingStatus === "Done") {
        clearTimer()
        setCurrentStep("packaging")
        setProgress(100)
        
        // Trigger pengiriman setelah packaging selesai
        setTimeout(() => {
            setCurrentStep("sending")
            setProgress(0)
        }, 1000)
    }

    return () => clearTimer()
  }, [pickingStatus, packagingStatus, activeOrder])


  // 5. LOGIKA PENGIRIMAN & PENYELESAIAN ORDER (UPDATE DATABASE)
  useEffect(() => {
    if (currentStep === "sending") {
        let localProgress = 0
        const interval = setInterval(() => {
            localProgress += (100 / 50) // 5 Detik
            
            if (localProgress >= 100) {
                localProgress = 100
                clearInterval(interval)
                setCurrentStep("completed")
                
                // --- UPDATE DATABASE DISINI ---
                setTimeout(async () => {
                    if (activeOrder) {
                        try {
                            // 1. Tandai order ini sebagai selesai (akan hilang dari list karena filter)
                            await update(ref(database, `orders/${activeOrder.id}`), {
                                status: 'completed'
                            })
                            
                            // 2. PENTING: Reset tracking hardware ke 'Todo' agar robot tau order ini selesai 
                            // dan siap mengambil order berikutnya (jika ada)
                            await update(ref(database, 'tracking'), {
                                itemPicking: 'Todo',
                                packaging: 'Todo'
                            })
                            
                            console.log(`Order ${activeOrder.id} completed & tracking reset.`)
                        } catch (e) {
                            console.error("Error updating db", e)
                        }
                    }
                }, 3000) // Delay 3 detik agar user lihat pesan "Order Complete"
            }
            setProgress(localProgress)
        }, 100)
        return () => clearInterval(interval)
    }
  }, [currentStep, activeOrder])


  // --- Helper UI ---
  const getStepStatus = (stepId: OrderStep) => {
    const stepOrder = ["selecting", "packaging", "sending"]
    const currentIndex = stepOrder.indexOf(currentStep)
    const stepIndex = stepOrder.indexOf(stepId)

    if (currentStep === "completed") return "completed"
    if (currentStep === "idle") return "pending"

    if (stepIndex < currentIndex) return "completed"
    if (stepIndex === currentIndex) return "active"
    return "pending"
  }

  const steps = [
    {
      id: "selecting" as const,
      title: "Item Picking",
      description: pickingStatus === "In Progress" ? "Robot is picking items..." : "Waiting for robot...",
      icon: CheckCircle2,
      dbStatus: pickingStatus
    },
    {
      id: "packaging" as const,
      title: "Packaging",
      description: packagingStatus === "In Progress" ? "Packing items..." : "Waiting for items...",
      icon: Box,
      dbStatus: packagingStatus
    },
    {
      id: "sending" as const,
      title: "Sending",
      description: "On the way to customer",
      icon: Truck,
      dbStatus: currentStep === "sending" || currentStep === "completed" ? "In Progress" : "Todo"
    },
  ]

  // Tampilan jika semua order selesai
  if (!activeOrder) {
    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
            <div className="text-center space-y-4">
                <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto animate-pulse" />
                <h1 className="text-3xl font-bold text-foreground">All Orders Completed!</h1>
                <p className="text-muted-foreground">Waiting for new orders from store...</p>
                <Link href="/">
                    <Button variant="outline" className="mt-4">Back to Store</Button>
                </Link>
            </div>
        </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/">
            <Button variant="ghost" className="gap-2">
              <ChevronLeft className="w-5 h-5" />
              Store Dashboard
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center px-4 py-1.5 mb-4 rounded-full bg-primary/10 text-primary text-sm font-medium animate-in fade-in slide-in-from-top-4">
                Queue: {orders.length} Remaining
            </div>
            
          <h1 className="text-4xl font-bold text-foreground mb-2">
             Processing {activeOrder.id.replace('_', ' #')}
          </h1>
          <p className="text-muted-foreground">
            Real-time Manufacturing Execution System
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-12">
          <div className="w-full h-4 bg-muted rounded-full overflow-hidden relative">
            <div 
                className={`h-full transition-all duration-300 ease-out ${
                    (pickingStatus === "In Progress" || packagingStatus === "In Progress") && progress >= 99 
                    ? "bg-yellow-500" 
                    : "bg-primary"
                }`}
                style={{ width: `${progress}%` }} 
            />
          </div>
          <div className="flex justify-between mt-2">
             <p className="text-sm font-mono font-bold">{Math.round(progress)}%</p>
             <p className="text-sm font-medium text-primary animate-pulse">
                {currentStep === 'selecting' && pickingStatus === "In Progress" && progress < 99 && "Robot Moving..."}
                {currentStep === 'selecting' && pickingStatus === "In Progress" && progress >= 99 && "Waiting for Picking DONE..."}
                {currentStep === 'packaging' && packagingStatus === "In Progress" && progress < 99 && "Packing in progress..."}
                {currentStep === 'packaging' && packagingStatus === "In Progress" && progress >= 99 && "Waiting for Packaging DONE..."}
                {currentStep === 'sending' && "Dispatching..."}
             </p>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-6 mb-12">
          {steps.map((step) => {
            const status = getStepStatus(step.id)
            const Icon = step.icon

            return (
              <div key={step.id}>
                <div
                  className={`p-6 rounded-lg border-2 transition-all duration-500 ${
                    status === "completed"
                      ? "bg-green-50 border-green-300 dark:bg-green-950 dark:border-green-700"
                      : status === "active"
                        ? "bg-blue-50 border-blue-300 dark:bg-blue-950 dark:border-blue-700 scale-105 shadow-lg"
                        : "bg-muted border-border opacity-50"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex-shrink-0 transition-all duration-500 ${
                        status === "completed"
                          ? "text-green-600 dark:text-green-400 scale-110"
                          : status === "active"
                            ? "text-blue-600 dark:text-blue-400 animate-bounce"
                            : "text-muted-foreground"
                      }`}
                    >
                      <Icon className="w-8 h-8" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold mb-1">
                        {step.title}
                        {status === "active" && step.dbStatus === "In Progress" && (
                            <span className="ml-2 text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full">In Progress</span>
                        )}
                      </h3>
                      <p className="text-sm text-muted-foreground">{step.description}</p>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Completion Message */}
        {currentStep === "completed" && (
          <div className="p-8 bg-green-50 border-2 border-green-300 rounded-lg text-center dark:bg-green-950 dark:border-green-700 animate-in zoom-in duration-300">
            <CheckCircle2 className="w-16 h-16 text-green-600 dark:text-green-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-green-700 dark:text-green-300 mb-2">
                Order Completed!
            </h2>
            <p className="text-green-600 dark:text-green-400 mb-6">
              System is resetting for the next order...
            </p>
          </div>
        )}
      </main>
    </div>
  )
}