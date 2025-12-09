"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import Link from "next/link"
import { ChevronLeft, CheckCircle2, Box, Truck, RefreshCw, FileClock, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { database } from "@/lib/firebase"
import { ref, onValue, update, remove, set } from "firebase/database"

// --- KONFIGURASI KECEPATAN SIMULASI ---
const SECONDS_PER_ITEM_PICKING = 1.5 
const SECONDS_PER_ITEM_PACKING = 1.0 
const SENDING_DURATION_SEC = 3       

type DBStatus = "Todo" | "In Progress" | "Done"

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
  processed_item: number
}

export default function OrderPage() {
  const [orders, setOrders] = useState<OrderData[]>([])
  const [liveItems, setLiveItems] = useState<LiveItem[]>([])
  const [tracking, setTracking] = useState<TrackingData>({
    itemPicking: "Todo",
    packaging: "Todo",
    sending: "Todo",
    processed_item: 0
  })
  
  const [isSimulating, setIsSimulating] = useState(false)
  const [progress, setProgress] = useState(0)

  const activeOrder = useMemo(() => {
    return orders.find(o => o.status === 'processing') || 
           orders.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                 .find(o => o.status === 'queued')
  }, [orders])

  // --- 1. FETCH DATA ---
  useEffect(() => {
    const ordersRef = ref(database, 'orders')
    const unsubOrders = onValue(ordersRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val()
        const list = Object.keys(data).map(key => ({ id: key, ...data[key] }))
        setOrders(list)
      } else { setOrders([]) }
    })

    const liveRef = ref(database, 'live_order/items')
    const unsubLive = onValue(liveRef, (snapshot) => {
      if (snapshot.exists()) setLiveItems(snapshot.val())
    })

    const trackRef = ref(database, 'tracking')
    const unsubTrack = onValue(trackRef, (snapshot) => {
      if (snapshot.exists()) setTracking(snapshot.val())
    })

    return () => { unsubOrders(); unsubLive(); unsubTrack(); }
  }, [])

  // --- 2. LOGIKA TRIGGER SIMULASI ---
  useEffect(() => {
    if (!activeOrder || liveItems.length === 0) return

    // Cek apakah ada barang di live_order (Quantity > 0)
    const hasLiveItems = liveItems.some(item => item.quantity > 0)
    
    // TRIGGER SIMULASI:
    // Hanya jalan jika status 'processing', ada barang di mesin, tracking belum mulai, dan tidak sedang simulasi
    if (activeOrder.status === 'processing' && hasLiveItems && tracking.itemPicking === 'Todo' && !isSimulating) {
        startSimulationSequence()
    }

    // HANDSHAKE AWAL (PENGIRIMAN DATA):
    // Jika ada antrian tapi mesin kosong (quantity 0 semua), kirim data baru
    if (activeOrder.status === 'queued' && !hasLiveItems && !isSimulating) {
        const updates: any = {}
        updates[`orders/${activeOrder.id}/status`] = 'processing'
        activeOrder.items.forEach((orderItem: any) => {
            const targetIndex = liveItems.findIndex(li => li.id === orderItem.id)
            if (targetIndex !== -1) {
                updates[`live_order/items/${targetIndex}/quantity`] = orderItem.quantity
            }
        })
        update(ref(database), updates)
    }

  }, [activeOrder, liveItems, tracking, isSimulating])


  // --- FUNGSI SIMULASI UTAMA ---
  const startSimulationSequence = async () => {
    setIsSimulating(true)
    console.log("🚀 STARTING SIMULATION SEQUENCE...")

    const totalItemsToProcess = liveItems.reduce((sum, item) => sum + item.quantity, 0)
    const pickingDuration = totalItemsToProcess * SECONDS_PER_ITEM_PICKING * 1000
    const packagingDuration = totalItemsToProcess * SECONDS_PER_ITEM_PACKING * 1000
    const sendingDuration = SENDING_DURATION_SEC * 1000

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

    try {
        // 1. ROBOT ON
        await update(ref(database), {
            'status_mesin/robot_arm/status': 'ON',
            'status_mesin/robot_arm/lastStartTime': Date.now()
        })

        // 2. PICKING
        await update(ref(database, 'tracking'), { itemPicking: 'In Progress' })
        await delay(pickingDuration)
        await update(ref(database, 'tracking'), { itemPicking: 'Done' })

        // 3. SWITCH MESIN
        await update(ref(database), {
            'status_mesin/robot_arm/status': 'OFF',
            'status_mesin/conveyor/status': 'ON',
            'status_mesin/conveyor/lastStartTime': Date.now()
        })

        // 4. PACKAGING
        await update(ref(database, 'tracking'), { packaging: 'In Progress' })
        await delay(packagingDuration)
        await update(ref(database, 'tracking'), { packaging: 'Done' })

        // 5. SENDING
        await update(ref(database, 'tracking'), { sending: 'In Progress' })
        await delay(sendingDuration)
        await update(ref(database, 'tracking'), { sending: 'Done' })

        // 6. SELESAI (CLEANUP)
        console.log("✅ ORDER PROCESSED LOGICALLY.")
        
        // Matikan Mesin
        await update(ref(database), {
            'status_mesin/robot_arm/status': 'OFF',
            'status_mesin/conveyor/status': 'OFF'
        })

        // Pindah ke History
        await set(ref(database, `order_history/${activeOrder!.id}`), {
            ...activeOrder,
            status: 'completed',
            completedAt: new Date().toISOString()
        })

        // Hapus dari Antrian
        await remove(ref(database, `orders/${activeOrder!.id}`))

        // Reset Tracking
        await update(ref(database, 'tracking'), {
            itemPicking: "Todo",
            packaging: "Todo",
            sending: "Todo",
            processed_item: 0
        })

        // CATATAN: KITA TIDAK MERESET live_order DI SINI.
        // Mesin fisik yang harus meresetnya menjadi 0.
        // Sistem tidak akan mengambil order baru selama live_order masih > 0 (cek logika useEffect di atas).

    } catch (error) {
        console.error("Simulation Error:", error)
    } finally {
        setIsSimulating(false)
    }
  }


  // --- UI PROGRESS ---
  useEffect(() => {
    if (!activeOrder) { setProgress(0); return; }
    
    let target = 0
    if (tracking.itemPicking === "In Progress") target = 33
    if (tracking.itemPicking === "Done") target = 33
    if (tracking.packaging === "In Progress") target = 66
    if (tracking.packaging === "Done") target = 66
    if (tracking.sending === "In Progress") target = 90
    if (tracking.sending === "Done") target = 100

    const interval = setInterval(() => {
        setProgress(prev => prev < target ? prev + 1 : prev > target ? target : prev)
    }, 50)
    return () => clearInterval(interval)
  }, [tracking, activeOrder])

  const getStepStatus = (stepName: keyof TrackingData) => {
    const status = tracking[stepName]
    if (status === "Done") return "completed"
    if (status === "In Progress") return "active"
    return "pending"
  }

  // --- RENDER ---
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

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
            <Link href="/"><Button variant="ghost"><ChevronLeft className="w-4 h-4 mr-2"/>Dashboard</Button></Link>
            <Link href="/history"><Button variant="outline" size="sm" className="gap-2"><FileClock className="w-4 h-4"/> Log</Button></Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 mb-2 px-3 py-1 bg-muted rounded-full text-xs font-mono">
                {isSimulating && <Zap className="w-3 h-3 text-yellow-500 fill-yellow-500 animate-pulse" />}
                <span>Order ID: {activeOrder.id.replace('_', ' #')}</span>
            </div>
            
            <h1 className="text-4xl font-bold mb-4 transition-all">
                {isSimulating ? "System Processing..." : "Initializing Hardware..."}
            </h1>
            
            <div className="w-full h-4 bg-muted rounded-full overflow-hidden mt-6 relative">
                <div className="h-full bg-primary transition-all duration-300 ease-out" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
                {isSimulating ? "Automated Logic Running" : "Waiting for machine buffer..."}
            </p>
        </div>

        <div className="grid gap-4 mb-12">
            <StepCard title="1. Item Picking" desc="Robot picking items" icon={CheckCircle2} status={getStepStatus("itemPicking")} />
            <StepCard title="2. Packaging" desc="Conveyor packaging" icon={Box} status={getStepStatus("packaging")} />
            <StepCard title="3. Sending" desc="Final dispatch" icon={Truck} status={getStepStatus("sending")} />
        </div>

        <div className="bg-slate-50 dark:bg-slate-900 border rounded-xl p-6">
            <h3 className="font-semibold mb-4 text-sm uppercase text-muted-foreground flex items-center gap-2">
                <RefreshCw className={`w-3 h-3 ${isSimulating ? 'animate-spin' : ''}`}/> 
                Live Hardware Buffer (Controlled by Machine)
            </h3>
            <div className="grid grid-cols-4 gap-4">
                {liveItems.map((item) => (
                    <div key={item.id} className={`text-center p-3 rounded border ${item.quantity > 0 ? 'bg-blue-100 text-blue-800' : 'bg-background opacity-50'}`}>
                        <div className="text-xl font-bold">{item.quantity}</div>
                        <div className="text-[10px] truncate">{item.name}</div>
                    </div>
                ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 text-center">
                *Order berikutnya hanya akan masuk jika buffer ini sudah 0 (dikosongkan oleh mesin).
            </p>
        </div>
      </main>
    </div>
  )
}

function StepCard({ title, desc, icon: Icon, status }: { title: string, desc: string, icon: any, status: string }) {
    const isActive = status === 'active'; const isDone = status === 'completed'
    return (
        <div className={`p-4 rounded-lg border flex items-center gap-4 transition-all ${isActive ? 'border-blue-500 bg-blue-50/50 shadow-md' : ''} ${isDone ? 'border-green-500 bg-green-50/50' : 'bg-card'}`}>
            <div className={`p-3 rounded-full ${isActive ? 'bg-blue-100 text-blue-600 animate-pulse' : isDone ? 'bg-green-100 text-green-600' : 'bg-muted'}`}><Icon className="w-6 h-6"/></div>
            <div className="flex-1"><h3 className="font-bold">{title}</h3><p className="text-sm text-muted-foreground">{desc}</p></div>
            {isActive && <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded-full animate-pulse">WORKING</span>}
            {isDone && <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded-full">DONE</span>}
        </div>
    )
}