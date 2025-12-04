"use client"

import { useEffect, useState, useRef, useMemo } from "react"
import Link from "next/link"
import { ChevronLeft, CheckCircle2, Box, Truck, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { database } from "@/lib/firebase"
import { ref, onValue, get, child } from "firebase/database"

type OrderStep = "idle" | "selecting" | "packaging" | "sending" | "completed"
type DBStatus = "Todo" | "In Progress" | "Done"

interface OrderData {
  id: string
  items: any[]
  // properti lain jika ada
}

export default function OrderPage() {
  // --- STATE ---
  const [orders, setOrders] = useState<OrderData[]>([])
  const [activeOrderIndex, setActiveOrderIndex] = useState(0)
  
  // Tracking Status (Global dari node 'tracking')
  const [pickingStatus, setPickingStatus] = useState<DBStatus>("Todo")
  const [packagingStatus, setPackagingStatus] = useState<DBStatus>("Todo")

  // Visual Progress
  const [currentStep, setCurrentStep] = useState<OrderStep>("idle")
  const [progress, setProgress] = useState(0)

  // Timer Refs
  const progressInterval = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number | null>(null)

  // Computed: Order yang sedang aktif diproses
  const activeOrder = useMemo(() => orders[activeOrderIndex], [orders, activeOrderIndex])

  // 1. FETCH SEMUA ORDER (SEKALI SAJA DI AWAL)
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const snapshot = await get(child(ref(database), "orders"))
        if (snapshot.exists()) {
          const data = snapshot.val()
          // Ubah object ke array dan urutkan berdasarkan key (order_1, order_2, dst)
          const formattedOrders = Object.keys(data)
            .sort((a, b) => {
               // Ekstrak angka dari "order_1", "order_10" agar urutannya benar
               const numA = parseInt(a.split('_')[1] || "0")
               const numB = parseInt(b.split('_')[1] || "0")
               return numA - numB
            })
            .map(key => ({
              id: key,
              ...data[key]
            }))
          setOrders(formattedOrders)
        }
      } catch (error) {
        console.error("Error fetching orders:", error)
      }
    }
    fetchOrders()
  }, [])

  // 2. LISTENER GLOBAL TRACKING & LOGIKA ANTRIAN
  useEffect(() => {
    const trackingRef = ref(database, 'tracking')
    
    const unsubscribe = onValue(trackingRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val()
        const newPicking = data.itemPicking || "Todo"
        const newPackaging = data.packaging || "Todo"

        setPickingStatus(newPicking)
        setPackagingStatus(newPackaging)

        // LOGIKA PINDAH ANTRIAN (AUTO SWITCH ORDER)
        // Jika status Packaging berubah jadi DONE, anggap order ini selesai
        // Dan jika Picking kembali ke TODO, berarti sistem siap untuk order berikutnya
        if (newPackaging === "Done") {
            // Kita tahan sebentar visualnya 'Done', lalu logic effect dibawah akan memindahkan index
        }
      }
    })

    return () => unsubscribe()
  }, [])

  // 3. LOGIKA VISUAL TIMER & PERPINDAHAN STEP
  useEffect(() => {
    const clearTimer = () => {
      if (progressInterval.current) clearInterval(progressInterval.current)
      progressInterval.current = null
      startTimeRef.current = null
    }

    // --- FASE 0: IDLE / PERSIAPAN ---
    // Jika semua Todo, reset progress
    if (pickingStatus === "Todo" && packagingStatus === "Todo") {
        setCurrentStep("selecting") // Siap-siap di step 1
        setProgress(0)
        clearTimer()
        
        // Cek apakah order sebelumnya baru saja selesai? Jika ya, dan status sudah reset ke Todo,
        // kita bisa pastikan UI menampilkan order berikutnya.
        // (Logika perpindahan index ada di effect terpisah agar lebih aman)
    }

    // --- FASE 1: PICKING (SELECTING) ---
    else if (pickingStatus === "In Progress" && packagingStatus === "Todo") {
        setCurrentStep("selecting")
        if (!progressInterval.current) {
            startTimeRef.current = Date.now()
            progressInterval.current = setInterval(() => {
                const elapsed = Date.now() - (startTimeRef.current || 0)
                // Timer 60 Detik
                let percent = (elapsed / 60000) * 100 
                if (percent >= 99) percent = 99 // Stuck logic
                setProgress(percent)
            }, 100)
        }
    }
    else if (pickingStatus === "Done" && packagingStatus === "Todo") {
        clearTimer()
        setCurrentStep("selecting")
        setProgress(100) // Penuhkan bar
        // Otomatis visual pindah ke packaging siap-siap
        setTimeout(() => setProgress(0), 900) 
    }

    // --- FASE 2: PACKAGING ---
    else if (packagingStatus === "In Progress") {
        setCurrentStep("packaging")
        if (!progressInterval.current) {
            startTimeRef.current = Date.now()
            progressInterval.current = setInterval(() => {
                const elapsed = Date.now() - (startTimeRef.current || 0)
                // Timer 30 Detik
                let percent = (elapsed / 30000) * 100
                if (percent >= 99) percent = 99 // Stuck logic
                setProgress(percent)
            }, 100)
        }
    }
    else if (packagingStatus === "Done") {
        clearTimer()
        setCurrentStep("packaging")
        setProgress(100)
        
        // --- LOGIKA TRIGGER SENDING & NEXT ORDER ---
        // Karena "Sending" tidak ada di DB (sesuai request), kita jalankan animasi sending 
        // setelah packaging Done, lalu pindah antrian.
        setTimeout(() => {
            setCurrentStep("sending")
            setProgress(0)
        }, 1000)
    }

    return () => clearTimer()
  }, [pickingStatus, packagingStatus])


  // 4. LOGIKA PENGIRIMAN (SENDING) & SELESAI
  // Ini berjalan murni di frontend setelah Packaging = Done
  useEffect(() => {
    if (currentStep === "sending") {
        let localProgress = 0
        const interval = setInterval(() => {
            // 5 Detik durasi sending
            localProgress += (100 / 50) 
            
            if (localProgress >= 100) {
                localProgress = 100
                clearInterval(interval)
                setCurrentStep("completed")
                
                // --- KUNCI: PINDAH KE ORDER BERIKUTNYA ---
                // Setelah animasi sending selesai, kita cek antrian.
                // Kita tambahkan delay agar user sempat melihat "Order Complete"
                setTimeout(() => {
                    if (activeOrderIndex < orders.length - 1) {
                        // Pindah ke order berikutnya
                        setActiveOrderIndex(prev => prev + 1)
                        // Reset visual
                        setCurrentStep("idle")
                        setProgress(0)
                    }
                    // Jika order habis, dia akan diam di completed pada order terakhir
                }, 3000)
            }
            setProgress(localProgress)
        }, 100)
        return () => clearInterval(interval)
    }
  }, [currentStep, activeOrderIndex, orders.length])


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
      description: pickingStatus === "In Progress" ? "Robot is picking items (60s limit)..." : "Waiting for robot...",
      icon: CheckCircle2,
      dbStatus: pickingStatus
    },
    {
      id: "packaging" as const,
      title: "Packaging",
      description: packagingStatus === "In Progress" ? "Packing items (30s limit)..." : "Waiting for items...",
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

  // Jika tidak ada order sama sekali
  if (orders.length === 0) {
    return (
        <div className="min-h-screen bg-background flex items-center justify-center">
            <div className="text-center">
                <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-primary" />
                <p>Loading Orders...</p>
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
            <div className="inline-flex items-center justify-center px-4 py-1.5 mb-4 rounded-full bg-primary/10 text-primary text-sm font-medium">
                Queue Position: {activeOrderIndex + 1} of {orders.length}
            </div>
            
          <h1 className="text-4xl font-bold text-foreground mb-2">
             {activeOrder ? `Processing ${activeOrder.id.replace('_', ' #')}` : "All Orders Completed"}
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
                    // Ubah warna bar jika stuck (99% dan belum done)
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
                {/* Status Message Logic */}
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
                         {status === "active" && step.dbStatus === "Done" && (
                            <span className="ml-2 text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded-full">Done</span>
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
                {activeOrder ? `${activeOrder.id} Completed!` : "Order Completed!"}
            </h2>
            <p className="text-green-600 dark:text-green-400 mb-6">
              Preparing next order in queue...
            </p>
          </div>
        )}
      </main>
    </div>
  )
}