"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronLeft, CheckCircle2, Package, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { database } from "@/lib/firebase"
import { ref, onValue } from "firebase/database"

interface OrderData {
  id: string
  items: any[]
  totalAmount: number
  status?: string
  createdAt?: string
  completedAt?: string
}

export default function HistoryPage() {
  const [activeOrders, setActiveOrders] = useState<OrderData[]>([])
  const [historyOrders, setHistoryOrders] = useState<OrderData[]>([])

  useEffect(() => {
    const queueRef = ref(database, 'orders')
    const unsubQueue = onValue(queueRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val()
            const list = Object.keys(data).map(key => ({ id: key, ...data[key] }))
            setActiveOrders(list)
        } else {
            setActiveOrders([])
        }
    })

    const historyRef = ref(database, 'order_history')
    const unsubHistory = onValue(historyRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val()
            const list = Object.keys(data).map(key => ({ id: key, ...data[key] }))
            // Sort completed terbaru di atas
            list.sort((a, b) => new Date(b.completedAt || '').getTime() - new Date(a.completedAt || '').getTime())
            setHistoryOrders(list)
        } else {
            setHistoryOrders([])
        }
    })

    return () => {
        unsubQueue()
        unsubHistory()
    }
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/order">
              <Button variant="ghost" size="icon"><ChevronLeft className="w-5 h-5" /></Button>
            </Link>
            <h1 className="text-xl font-bold">Dashboard Log</h1>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        
        {/* Antrian Aktif */}
        <div>
          <div className="flex items-center gap-2 mb-4 text-blue-600">
            <Clock className="w-5 h-5" />
            <h2 className="text-lg font-bold">Active Queue ({activeOrders.length})</h2>
          </div>
          {activeOrders.length === 0 ? (
            <div className="p-6 border-2 border-dashed rounded-xl text-center text-muted-foreground">Empty Queue</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
                {activeOrders.map(order => (
                    <Card key={order.id} className="p-4 border-l-4 border-l-blue-500">
                        <div className="flex justify-between">
                            <h3 className="font-bold">{order.id.slice(0,10)}...</h3>
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Queued</span>
                        </div>
                        <div className="mt-2 text-sm text-muted-foreground">
                            {order.items?.map((i: any, idx: number) => (
                                <div key={idx}>{i.quantity}x {i.name}</div>
                            ))}
                        </div>
                    </Card>
                ))}
            </div>
          )}
        </div>

        {/* Riwayat Selesai */}
        <div>
          <div className="flex items-center gap-2 mb-4 text-green-600">
            <CheckCircle2 className="w-5 h-5" />
            <h2 className="text-lg font-bold">Completed History ({historyOrders.length})</h2>
          </div>
          <div className="space-y-3">
            {historyOrders.map((order) => (
              <Card key={order.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-green-100 rounded-full text-green-600">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{order.id.slice(0,10)}...</h3>
                    <p className="text-xs text-muted-foreground">
                      Finished: {order.completedAt ? new Date(order.completedAt).toLocaleString() : '-'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                    <p className="font-bold">${order.totalAmount?.toFixed(2)}</p>
                    <span className="text-xs text-green-600 font-medium">Verified Complete</span>
                </div>
              </Card>
            ))}
          </div>
        </div>

      </main>
    </div>
  )
}