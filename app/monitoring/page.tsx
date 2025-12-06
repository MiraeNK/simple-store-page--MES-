"use client"

import { useEffect, useState, useRef } from "react"
import Link from "next/link"
import { ChevronLeft, Activity, Power, Settings, AlertTriangle, Clock, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { database } from "@/lib/firebase"
import { ref, onValue, update, get } from "firebase/database"
import { RobotArmVisual, ConveyorVisual } from "@/components/machine-visuals"

// Interface Data Mesin
interface MachineData {
  id: string
  name: string
  status: "ON" | "OFF"
  totalAccumulatedTime: number // dalam milidetik
  lastStartTime: number // timestamp
}

// Interface Order Log
interface OrderLog {
  id: string
  status: string
  items: any[]
}

// Helper Format Waktu (Jam:Menit:Detik)
const formatUptime = (ms: number) => {
  const seconds = Math.floor((ms / 1000) % 60)
  const minutes = Math.floor((ms / (1000 * 60)) % 60)
  const hours = Math.floor((ms / (1000 * 60 * 60)))
  
  return `${hours}h ${minutes}m ${seconds}s`
}

export default function MonitoringPage() {
  // State Mesin
  const [robot, setRobot] = useState<MachineData | null>(null)
  const [conveyor, setConveyor] = useState<MachineData | null>(null)
  
  // State Realtime Display Timer (agar angka detiknya jalan di layar)
  const [robotDisplayTime, setRobotDisplayTime] = useState(0)
  const [conveyorDisplayTime, setConveyorDisplayTime] = useState(0)

  // State Orders
  const [activeOrders, setActiveOrders] = useState<OrderLog[]>([])
  const [completedOrders, setCompletedOrders] = useState<OrderLog[]>([])

  // 1. Fetch Data Mesin
  useEffect(() => {
    const machineRef = ref(database, 'status_mesin')
    const unsubscribe = onValue(machineRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val()
        setRobot(data.robot_arm)
        setConveyor(data.conveyor)
      }
    })
    return () => unsubscribe()
  }, [])

  // 2. Fetch Data Order Log
  useEffect(() => {
    const ordersRef = ref(database, 'orders')
    const unsubscribe = onValue(ordersRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val()
        const list = Object.keys(data).map(key => ({ id: key, ...data[key] }))
        
        setActiveOrders(list.filter((o: any) => o.status !== 'completed'))
        setCompletedOrders(list.filter((o: any) => o.status === 'completed'))
      }
    })
    return () => unsubscribe()
  }, [])

  // 3. Interval untuk update tampilan timer setiap detik (tanpa write ke DB)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()

      if (robot) {
        if (robot.status === "ON") {
          setRobotDisplayTime(robot.totalAccumulatedTime + (now - robot.lastStartTime))
        } else {
          setRobotDisplayTime(robot.totalAccumulatedTime)
        }
      }

      if (conveyor) {
        if (conveyor.status === "ON") {
          setConveyorDisplayTime(conveyor.totalAccumulatedTime + (now - conveyor.lastStartTime))
        } else {
          setConveyorDisplayTime(conveyor.totalAccumulatedTime)
        }
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [robot, conveyor])


  // --- SIMULASI HARDWARE (Button Actions) ---
  const toggleMachine = async (machineKey: string, currentData: MachineData) => {
    const now = Date.now()
    const isTurningOn = currentData.status === "OFF"
    const updates: any = {}

    if (isTurningOn) {
      // Nyalakan: Set status ON dan catat waktu mulai
      updates[`status_mesin/${machineKey}/status`] = "ON"
      updates[`status_mesin/${machineKey}/lastStartTime`] = now
    } else {
      // Matikan: Set status OFF, hitung durasi sesi ini, tambahkan ke total
      const sessionDuration = now - currentData.lastStartTime
      const newTotal = currentData.totalAccumulatedTime + sessionDuration
      
      updates[`status_mesin/${machineKey}/status`] = "OFF"
      updates[`status_mesin/${machineKey}/totalAccumulatedTime`] = newTotal
      updates[`status_mesin/${machineKey}/lastStartTime`] = 0 // Reset sesi
    }

    try {
      await update(ref(database), updates)
    } catch (e) {
      console.error("Gagal toggle mesin", e)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Header Industrial Style */}
      <header className="sticky top-0 z-50 bg-slate-900 text-white border-b border-slate-700 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-slate-800">
                <ChevronLeft className="w-5 h-5 mr-1" /> Back
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Activity className="w-6 h-6 text-green-400 animate-pulse" />
              <h1 className="text-xl font-mono font-bold tracking-wider">MES MONITORING SYSTEM</h1>
            </div>
          </div>
          <div className="px-3 py-1 bg-slate-800 rounded border border-slate-600 text-xs font-mono text-green-400">
            SYSTEM ONLINE
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* KOLOM KIRI & TENGAH: STATUS MESIN */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="w-6 h-6" /> Machine Status (Digital Twin)
          </h2>

          {/* Kartu Robot Arm */}
          {robot && (
            <Card className="p-6 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden relative">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Settings className="w-32 h-32" />
              </div>
              
              <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                {/* Visual */}
                <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700">
                  <RobotArmVisual isOn={robot.status === "ON"} />
                </div>

                {/* Info & Controls */}
                <div className="flex-1 space-y-4 w-full">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-bold font-mono">{robot.name}</h3>
                      <p className="text-sm text-slate-500">ID: {robot.id}</p>
                    </div>
                    <div className={`px-4 py-1 rounded font-bold text-sm ${robot.status === 'ON' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {robot.status}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded border">
                      <p className="text-xs text-slate-500 mb-1">Total Running Hours</p>
                      <p className="text-lg font-mono font-bold flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {formatUptime(robotDisplayTime)}
                      </p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded border">
                      <p className="text-xs text-slate-500 mb-1">Maintenance Status</p>
                      <p className="text-sm font-semibold text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Healthy
                      </p>
                    </div>
                  </div>

                  {/* Manual Toggle (Simulation) */}
                  <Button 
                    onClick={() => toggleMachine('robot_arm', robot)}
                    variant={robot.status === "ON" ? "destructive" : "default"}
                    className="w-full"
                  >
                    <Power className="w-4 h-4 mr-2" />
                    {robot.status === "ON" ? "EMERGENCY STOP (SIMULATION)" : "START MACHINE (SIMULATION)"}
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Kartu Conveyor */}
          {conveyor && (
            <Card className="p-6 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden relative">
               <div className="absolute top-0 right-0 p-4 opacity-10">
                <Activity className="w-32 h-32" />
              </div>

              <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                {/* Visual */}
                <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 flex items-center justify-center min-w-[200px]">
                  <ConveyorVisual isOn={conveyor.status === "ON"} />
                </div>

                {/* Info & Controls */}
                <div className="flex-1 space-y-4 w-full">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-bold font-mono">{conveyor.name}</h3>
                      <p className="text-sm text-slate-500">ID: {conveyor.id}</p>
                    </div>
                    <div className={`px-4 py-1 rounded font-bold text-sm ${conveyor.status === 'ON' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {conveyor.status}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded border">
                      <p className="text-xs text-slate-500 mb-1">Total Running Hours</p>
                      <p className="text-lg font-mono font-bold flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {formatUptime(conveyorDisplayTime)}
                      </p>
                    </div>
                     <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded border">
                      <p className="text-xs text-slate-500 mb-1">Load Status</p>
                      <p className="text-sm font-semibold text-blue-600">
                        {activeOrders.length > 0 ? "Under Load" : "Idle"}
                      </p>
                    </div>
                  </div>

                   {/* Manual Toggle (Simulation) */}
                   <Button 
                    onClick={() => toggleMachine('conveyor', conveyor)}
                    variant={conveyor.status === "ON" ? "destructive" : "default"}
                    className="w-full"
                  >
                    <Power className="w-4 h-4 mr-2" />
                    {conveyor.status === "ON" ? "STOP CONVEYOR (SIMULATION)" : "START CONVEYOR (SIMULATION)"}
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* KOLOM KANAN: LOG PESANAN */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6" /> Production Logs
          </h2>

          {/* Active Log */}
          <Card className="bg-slate-900 text-slate-100 p-4 border-l-4 border-l-blue-500">
            <h3 className="font-bold mb-3 flex justify-between">
              <span>Processing Queue</span>
              <span className="bg-blue-600 text-xs px-2 py-0.5 rounded-full">{activeOrders.length}</span>
            </h3>
            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
              {activeOrders.length === 0 ? (
                <p className="text-slate-500 text-sm italic">No active orders.</p>
              ) : (
                activeOrders.map(order => (
                  <div key={order.id} className="text-sm p-2 bg-slate-800 rounded border border-slate-700 flex justify-between items-center">
                    <span>{order.id.replace('_', ' #')}</span>
                    <span className="text-blue-400 text-xs animate-pulse">Running...</span>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Completed Log */}
          <Card className="bg-white dark:bg-slate-900 p-4 border-l-4 border-l-green-500">
            <h3 className="font-bold mb-3 flex justify-between">
              <span>Completed Log</span>
              <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">{completedOrders.length}</span>
            </h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin">
              {completedOrders.map(order => (
                <div key={order.id} className="text-sm p-2 border-b border-slate-100 dark:border-slate-800 last:border-0 flex justify-between items-center">
                  <span className="font-mono text-slate-600 dark:text-slate-400">{order.id.replace('_', ' #')}</span>
                  <div className="flex items-center gap-1 text-green-600 text-xs">
                    <CheckCircle2 className="w-3 h-3" /> Done
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Maintenance Notice Box */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <h4 className="font-bold text-amber-800 text-sm">Maintenance Notice</h4>
              <p className="text-xs text-amber-700 mt-1">
                Conveyor belt check scheduled in 48 hours of run-time. Current wear level: Normal.
              </p>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}