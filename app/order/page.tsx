"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import Link from "next/link"
import { ChevronLeft, CheckCircle2, Box, Truck, RefreshCw, FileClock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { database } from "@/lib/firebase"
import { ref, onValue, update, remove, set } from "firebase/database"

type DBStatus = "Todo" | "OnProgress" | "Done"

interface OrderData {
  id: string
  items: any[]
  status: 'queued' | 'processing'
  createdAt: string
  totalAmount: number
}

interface LiveItem {
  id: string
  quantity: number
  name: string
}

interface TrackingData {
  itemPicking: DBStatus
  packaging: DBStatus
  sending: DBStatus
}

export default function OrderPage() {
  const [orders, setOrders] = useState<OrderData[]>([])
  const [liveItems, setLiveItems] = useState<LiveItem[]>([])
  const [tracking, setTracking] = useState<TrackingData>({
    itemPicking: "Todo",
    packaging: "Todo",
    sending: "Todo"
  })
  
  // Timer visual progress (hanya untuk UX)
  const [progress, setProgress] = useState(0)

  // Ambil order aktif (yang sedang diproses atau antrian terdepan)
  const activeOrder = useMemo(() => {
    return orders.find(o => o.status === 'processing') || orders.find(o => o.status === 'queued')
  }, [orders])

  // --- 1. FETCH DATA (REALTIME) ---
  useEffect(() => {
    // Fetch Orders
    const ordersRef = ref(database, 'orders')
    const unsubOrders = onValue(ordersRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val()
        const list = Object.keys(data).map(key => ({ id: key, ...data[key] }))
        // Urutkan FIFO
        const queue = list.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        setOrders(queue)
      } else {
        setOrders([])
      }
    })

    // Fetch Live Order (Status Handshake)
    const liveRef = ref(database, 'live_order/items')
    const unsubLive = onValue(liveRef, (snapshot) => {
      if (snapshot.exists()) setLiveItems(snapshot.val())
    })

    // Fetch Tracking (Status Proses)
    const trackRef = ref(database, 'tracking')
    const unsubTrack = onValue(trackRef, (snapshot) => {
      if (snapshot.exists()) {
        setTracking(snapshot.val())
      } else {
        // Init jika kosong
        setTracking({ itemPicking: "Todo", packaging: "Todo", sending: "Todo" })
      }
    })

    return () => {
      unsubOrders()
      unsubLive()
      unsubTrack()
    }
  }, [])

  // --- 2. LOGIKA CONTROLLER (MANAGER) ---
  useEffect(() => {
    if (!activeOrder || liveItems.length === 0) return

    // Cek apakah mesin "kosong" (siap menerima data baru)
    // Mesin dianggap kosong jika quantity di live_order 0 semua DAN tracking semua Todo
    const isMachineSlotEmpty = liveItems.every(item => item.quantity === 0)
    const isTrackingIdle = tracking.itemPicking === "Todo" && tracking.packaging === "Todo" && tracking.sending === "Todo"

    // A. KIRIM ORDER KE MESIN
    if (isMachineSlotEmpty && isTrackingIdle && activeOrder.status === 'queued') {
      console.log(`[SYSTEM] Sending Order ${activeOrder.id} to Hardware...`)
      
      const updates: any = {}
      updates[`orders/${activeOrder.id}/status`] = 'processing'

      // Masukkan quantity ke live_order
      activeOrder.items.forEach((orderItem: any) => {
        const targetIndex = liveItems.findIndex(li => li.id === orderItem.id)
        if (targetIndex !== -1) {
            updates[`live_order/items/${targetIndex}/quantity`] = orderItem.quantity
        }
      })

      update(ref(database), updates)
    }

    // B. PINDAHKAN KE HISTORY (JIKA SUDAH SELESAI)
    // Syarat Selesai: Status Sending = Done
    if (tracking.sending === "Done" && activeOrder.status === 'processing') {
      console.log(`[SYSTEM] Order ${activeOrder.id} Finished! Moving to History...`)
      
      const finalizeOrder = async () => {
        // 1. Simpan ke folder 'order_history'
        await set(ref(database, `order_history/${activeOrder.id}`), {
            ...activeOrder,
            status: 'completed',
            completedAt: new Date().toISOString()
        })

        // 2. Hapus dari folder 'orders' (antrian)
        await remove(ref(database, `orders/${activeOrder.id}`))

        // 3. Reset Tracking untuk order berikutnya
        await update(ref(database, 'tracking'), {
            itemPicking: "Todo",
            packaging: "Todo",
            sending: "Todo"
        })
      }

      finalizeOrder()
    }

  }, [activeOrder, liveItems, tracking])


  // --- 3. LOGIKA VISUAL PROGRESS BAR ---
  useEffect(() => {
    if (!activeOrder) {
        setProgress(0)
        return
    }

    // Tentukan target persentase berdasarkan status tracking
    let target = 0
    if (tracking.itemPicking === "In Progress") target = 33
    if (tracking.itemPicking === "Done") target = 33
    if (tracking.packaging === "In Progress") target = 66
    if (tracking.packaging === "Done") target = 66
    if (tracking.sending === "In Progress") target = 90
    if (tracking.sending === "Done") target = 100

    // Animasi smooth
    const interval = setInterval(() => {
        setProgress(prev => {
            if (prev < target) return prev + 1
            if (prev > target) return target // Langsung lompat jika mundur (reset)
            return prev
        })
    }, 50) // Kecepatan animasi

    return () => clearInterval(interval)
  }, [tracking, activeOrder])


  // --- Helper Status Visual ---
  const getStepStatus = (stepName: keyof TrackingData) => {
    const status = tracking[stepName]
    if (status === "Done") return "completed"
    if (status === "In Progress") return "active"
    return "pending"
  }

  // Jika tidak ada order
  if (!activeOrder) {
    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
            <CheckCircle2 className="w-20 h-20 text-green-500 mb-4 animate-bounce" />
            <h1 className="text-2xl font-bold">System Idle</h1>
            <p className="text-muted-foreground mb-6">Waiting for new orders...</p>
            <div className="flex gap-4">
                <Link href="/"><Button variant="outline">Store</Button></Link>
                <Link href="/history"><Button>View History Log</Button></Link>
            </div>
        </div>
    )
  }

  // Cek apakah hardware sudah menerima data (Quantity di live_order jadi 0 lagi)
  // Jika live_order masih ada isinya, berarti hardware BELUM menerima (masih di buffer)
  const isDataReceivedByHardware = liveItems.every(item => item.quantity === 0) && activeOrder.status === 'processing'

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
            <Link href="/"><Button variant="ghost"><ChevronLeft className="w-4 h-4 mr-2"/>Dashboard</Button></Link>
            <Link href="/history">
                <Button variant="outline" size="sm" className="gap-2">
                    <FileClock className="w-4 h-4" /> Log History
                </Button>
            </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
            <div className="inline-block mb-2 px-3 py-1 bg-muted rounded-full text-xs font-mono">
                Order ID: {activeOrder.id}
            </div>
            
            <h1 className="text-4xl font-bold mb-4 transition-all">
                {!isDataReceivedByHardware && activeOrder.status === 'processing' 
                    ? "Sending Data to Hardware..." 
                    : "Hardware Processing..."}
            </h1>

            {/* Progress Bar Global */}
            <div className="w-full h-4 bg-muted rounded-full overflow-hidden mt-6 mb-2 relative">
                <div 
                    className="h-full bg-primary transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }} 
                />
            </div>
            <p className="text-xs text-muted-foreground">{Math.round(progress)}% Complete</p>
        </div>

        {/* Steps Visualization */}
        <div className="grid gap-4 mb-12">
            {/* Step 1: Picking */}
            <StepCard 
                title="1. Item Picking" 
                desc="Robot arm picking items from inventory"
                icon={CheckCircle2}
                status={getStepStatus("itemPicking")}
            />
            {/* Step 2: Packaging */}
            <StepCard 
                title="2. Packaging" 
                desc="Conveyor belt moving to packaging area"
                icon={Box}
                status={getStepStatus("packaging")}
            />
            {/* Step 3: Sending */}
            <StepCard 
                title="3. Sending" 
                desc="Final dispatch process"
                icon={Truck}
                status={getStepStatus("sending")}
            />
        </div>

        {/* Live Data Monitor (Optional: Untuk Debugging User) */}
        <div className="bg-slate-50 dark:bg-slate-900 border rounded-xl p-6">
            <h3 className="font-semibold mb-4 text-sm uppercase text-muted-foreground flex items-center gap-2">
                <RefreshCw className={`w-3 h-3 ${!isDataReceivedByHardware && activeOrder.status === 'processing' ? 'animate-spin' : ''}`}/>
                Live Hardware Buffer
            </h3>
            <div className="grid grid-cols-4 gap-4">
                {liveItems.map((item) => (
                    <div key={item.id} className={`text-center p-3 rounded border ${item.quantity > 0 ? 'bg-blue-100 border-blue-300 text-blue-800' : 'bg-background opacity-50'}`}>
                        <div className="text-xl font-bold">{item.quantity}</div>
                        <div className="text-[10px] truncate">{item.name}</div>
                    </div>
                ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 text-center">
                *Jika angka 0, hardware belum mengambil data. Jika 0, hardware sedang memproses.
            </p>
        </div>
      </main>
    </div>
  )
}

// Komponen Kecil untuk Step UI
function StepCard({ title, desc, icon: Icon, status }: { title: string, desc: string, icon: any, status: string }) {
    const isActive = status === 'active'
    const isDone = status === 'completed'
    
    return (
        <div className={`p-4 rounded-lg border flex items-center gap-4 transition-all duration-300 
            ${isActive ? 'border-blue-500 bg-blue-50/50 shadow-md scale-[1.02]' : ''}
            ${isDone ? 'border-green-500 bg-green-50/50 opacity-80' : 'bg-card'}
        `}>
            <div className={`p-3 rounded-full ${isActive ? 'bg-blue-100 text-blue-600 animate-pulse' : isDone ? 'bg-green-100 text-green-600' : 'bg-muted text-muted-foreground'}`}>
                <Icon className="w-6 h-6" />
            </div>
            <div className="flex-1">
                <h3 className={`font-bold ${isActive ? 'text-blue-700' : isDone ? 'text-green-700' : ''}`}>{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
            {isActive && <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded-full animate-pulse">WORKING</span>}
            {isDone && <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded-full">DONE</span>}
        </div>
    )
}