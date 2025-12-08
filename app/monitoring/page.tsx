"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronLeft, Activity, Power, Settings, AlertTriangle, Clock, CheckCircle2, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { database } from "@/lib/firebase"
import { ref, onValue, update } from "firebase/database"
import { RobotArmVisual, ConveyorVisual } from "@/components/machine-visuals"

// --- KONFIGURASI MAINTENANCE ---
// Contoh: Maintenance setiap 50 Jam
const MAINTENANCE_INTERVAL_HOURS = 50 
const MS_PER_HOUR = 3600000

interface MachineData {
  id: string
  name: string
  status: "ON" | "OFF"
  totalAccumulatedTime: number
  lastStartTime: number
}

interface OrderLog {
  id: string
  status: string
  items: any[]
}

const formatUptime = (ms: number) => {
  const seconds = Math.floor((ms / 1000) % 60)
  const minutes = Math.floor((ms / (1000 * 60)) % 60)
  const hours = Math.floor((ms / (1000 * 60 * 60)))
  return `${hours}h ${minutes}m ${seconds}s`
}

export default function MonitoringPage() {
  const [robot, setRobot] = useState<MachineData | null>(null)
  const [conveyor, setConveyor] = useState<MachineData | null>(null)
  
  const [robotDisplayTime, setRobotDisplayTime] = useState(0)
  const [conveyorDisplayTime, setConveyorDisplayTime] = useState(0)

  const [activeOrders, setActiveOrders] = useState<OrderLog[]>([])
  const [completedOrders, setCompletedOrders] = useState<OrderLog[]>([])

  // 1. Data Mesin
  useEffect(() => {
    const machineRef = ref(database, 'status_mesin')
    return onValue(machineRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val()
        setRobot(data.robot_arm)
        setConveyor(data.conveyor)
      }
    })
  }, [])

  // 2. Data Order (Active & Completed)
  useEffect(() => {
    // Active Queue
    const ordersRef = ref(database, 'orders')
    const unsubOrders = onValue(ordersRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val()
        const list = Object.keys(data).map(key => ({ id: key, ...data[key] }))
        setActiveOrders(list)
      } else { setActiveOrders([]) }
    })

    // Completed History
    const historyRef = ref(database, 'order_history')
    const unsubHistory = onValue(historyRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val()
        const list = Object.keys(data).map(key => ({ id: key, ...data[key] }))
        setCompletedOrders(list.reverse()) 
      } else { setCompletedOrders([]) }
    })

    return () => { unsubOrders(); unsubHistory(); }
  }, [])

  // 3. Timer Visual Realtime
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      if (robot) setRobotDisplayTime(robot.status === "ON" ? robot.totalAccumulatedTime + (now - robot.lastStartTime) : robot.totalAccumulatedTime)
      if (conveyor) setConveyorDisplayTime(conveyor.status === "ON" ? conveyor.totalAccumulatedTime + (now - conveyor.lastStartTime) : conveyor.totalAccumulatedTime)
    }, 1000)
    return () => clearInterval(interval)
  }, [robot, conveyor])

  const toggleMachine = async (machineKey: string, currentData: MachineData) => {
    const now = Date.now()
    const isTurningOn = currentData.status === "OFF"
    const updates: any = {}
    if (isTurningOn) {
      updates[`status_mesin/${machineKey}/status`] = "ON"
      updates[`status_mesin/${machineKey}/lastStartTime`] = now
    } else {
      updates[`status_mesin/${machineKey}/status`] = "OFF"
      updates[`status_mesin/${machineKey}/totalAccumulatedTime`] = currentData.totalAccumulatedTime + (now - currentData.lastStartTime)
      updates[`status_mesin/${machineKey}/lastStartTime`] = 0
    }
    await update(ref(database), updates)
  }

  // --- LOGIKA MAINTENANCE ---
  const getMaintenanceStatus = (currentMs: number, machineName: string) => {
    const currentHours = currentMs / MS_PER_HOUR
    // Sisa jam menuju kelipatan 50 jam berikutnya
    const hoursUntilMaintenance = MAINTENANCE_INTERVAL_HOURS - (currentHours % MAINTENANCE_INTERVAL_HOURS)
    
    // Status Logic
    if (hoursUntilMaintenance <= 5) {
        return {
            color: "text-red-600 bg-red-50 border-red-200",
            icon: AlertTriangle,
            message: `CRITICAL: ${machineName} maintenance due in ${hoursUntilMaintenance.toFixed(1)} hours!`
        }
    } else if (hoursUntilMaintenance <= 20) {
        return {
            color: "text-amber-600 bg-amber-50 border-amber-200",
            icon: Wrench,
            message: `WARNING: Schedule check for ${machineName} in ${hoursUntilMaintenance.toFixed(1)} hours.`
        }
    }
    return null // Tidak ada notifikasi jika masih jauh
  }

  // Cek status maintenance untuk kedua mesin
  const robotMaintenance = getMaintenanceStatus(robotDisplayTime, "Robot Arm")
  const conveyorMaintenance = getMaintenanceStatus(conveyorDisplayTime, "Conveyor")

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <header className="sticky top-0 z-50 bg-slate-900 text-white border-b border-slate-700 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/"><Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-slate-800"><ChevronLeft className="w-5 h-5 mr-1"/> Back</Button></Link>
            <div className="flex items-center gap-2"><Activity className="w-6 h-6 text-green-400 animate-pulse"/><h1 className="text-xl font-mono font-bold tracking-wider">MES MONITORING</h1></div>
          </div>
          <div className="px-3 py-1 bg-slate-800 rounded border border-slate-600 text-xs font-mono text-green-400">SYSTEM ONLINE</div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* KOLOM KIRI & TENGAH: STATUS MESIN (DIGITAL TWIN) */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2"><Settings className="w-6 h-6"/> Machine Status (Digital Twin)</h2>
          
          {/* ROBOT CARD */}
          {robot && (
            <Card className="p-6 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden relative">
              <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-xl border flex items-center justify-center min-w-[200px] min-h-[200px]">
                    <RobotArmVisual isOn={robot.status === "ON"} />
                </div>
                <div className="flex-1 space-y-4 w-full">
                  <div className="flex justify-between items-start">
                    <div><h3 className="text-xl font-bold font-mono">{robot.name}</h3><p className="text-sm text-slate-500">ID: {robot.id}</p></div>
                    <span className={`px-3 py-1 rounded font-bold text-xs ${robot.status === 'ON' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{robot.status}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded border"><p className="text-xs text-slate-500">Total Uptime</p><p className="text-lg font-mono font-bold flex items-center gap-2"><Clock className="w-4 h-4"/> {formatUptime(robotDisplayTime)}</p></div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded border"><p className="text-xs text-slate-500">Health</p><p className="text-sm font-semibold text-green-600 flex items-center gap-1"><CheckCircle2 className="w-4 h-4"/> Optimal</p></div>
                  </div>
                  <Button onClick={() => toggleMachine('robot_arm', robot)} variant={robot.status === "ON" ? "destructive" : "default"} className="w-full"><Power className="w-4 h-4 mr-2"/> {robot.status === "ON" ? "EMERGENCY STOP (SIM)" : "START MACHINE (SIM)"}</Button>
                </div>
              </div>
            </Card>
          )}

          {/* CONVEYOR CARD */}
          {conveyor && (
            <Card className="p-6 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden relative">
              <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-xl border flex items-center justify-center min-w-[200px] min-h-[200px]">
                    <ConveyorVisual isOn={conveyor.status === "ON"} />
                </div>
                <div className="flex-1 space-y-4 w-full">
                  <div className="flex justify-between items-start">
                    <div><h3 className="text-xl font-bold font-mono">{conveyor.name}</h3><p className="text-sm text-slate-500">ID: {conveyor.id}</p></div>
                    <span className={`px-3 py-1 rounded font-bold text-xs ${conveyor.status === 'ON' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{conveyor.status}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded border"><p className="text-xs text-slate-500">Total Uptime</p><p className="text-lg font-mono font-bold flex items-center gap-2"><Clock className="w-4 h-4"/> {formatUptime(conveyorDisplayTime)}</p></div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded border"><p className="text-xs text-slate-500">Load</p><p className="text-sm font-semibold text-blue-600">{activeOrders.length > 0 ? "Active" : "Idle"}</p></div>
                  </div>
                  <Button onClick={() => toggleMachine('conveyor', conveyor)} variant={conveyor.status === "ON" ? "destructive" : "default"} className="w-full"><Power className="w-4 h-4 mr-2"/> {conveyor.status === "ON" ? "STOP CONVEYOR (SIM)" : "START CONVEYOR (SIM)"}</Button>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* KOLOM KANAN: LOG & MAINTENANCE */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-2"><Activity className="w-6 h-6"/> System Logs</h2>
          
          {/* Active Queue Log */}
          <Card className="bg-slate-900 text-slate-100 p-4 border-l-4 border-l-blue-500">
            <h3 className="font-bold mb-3 flex justify-between"><span>Active Queue</span><span className="bg-blue-600 text-xs px-2 py-0.5 rounded-full">{activeOrders.length}</span></h3>
            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
              {activeOrders.map(order => (<div key={order.id} className="text-sm p-2 bg-slate-800 rounded border border-slate-700 flex justify-between"><span>{order.id.slice(0,10)}...</span><span className="text-blue-400 text-xs animate-pulse">Running</span></div>))}
              {activeOrders.length === 0 && <p className="text-xs text-slate-500 italic">No active orders.</p>}
            </div>
          </Card>

          {/* Completed Log */}
          <Card className="bg-white dark:bg-slate-900 p-4 border-l-4 border-l-green-500">
            <h3 className="font-bold mb-3 flex justify-between"><span>Completed</span><span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">{completedOrders.length}</span></h3>
            <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
              {completedOrders.map(order => (<div key={order.id} className="text-sm p-2 border-b flex justify-between items-center"><span className="font-mono">{order.id.slice(0,10)}...</span><div className="flex items-center gap-1 text-green-600 text-xs"><CheckCircle2 className="w-3 h-3"/> Done</div></div>))}
            </div>
          </Card>

          {/* DYNAMIC MAINTENANCE NOTICE */}
          {(robotMaintenance || conveyorMaintenance) ? (
             <div className="space-y-2">
                {robotMaintenance && (
                    <div className={`p-4 rounded-lg border flex items-start gap-3 ${robotMaintenance.color}`}>
                        <robotMaintenance.icon className="w-5 h-5 mt-0.5" />
                        <div><h4 className="font-bold text-sm">Robot Arm Notice</h4><p className="text-xs mt-1">{robotMaintenance.message}</p></div>
                    </div>
                )}
                {conveyorMaintenance && (
                    <div className={`p-4 rounded-lg border flex items-start gap-3 ${conveyorMaintenance.color}`}>
                        <conveyorMaintenance.icon className="w-5 h-5 mt-0.5" />
                        <div><h4 className="font-bold text-sm">Conveyor Notice</h4><p className="text-xs mt-1">{conveyorMaintenance.message}</p></div>
                    </div>
                )}
             </div>
          ) : (
             <div className="p-4 bg-slate-100 border border-slate-200 rounded-lg flex items-center gap-3 text-slate-500">
                <CheckCircle2 className="w-5 h-5" />
                <p className="text-xs">All systems healthy. No maintenance required.</p>
             </div>
          )}

        </div>
      </main>
    </div>
  )
}