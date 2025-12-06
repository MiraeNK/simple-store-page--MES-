"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronLeft, Clock, CheckCircle2, Package, Search } from "lucide-react"
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
}

export default function HistoryPage() {
  const [orders, setOrders] = useState<OrderData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const ordersRef = ref(database, 'orders')
    const unsubscribe = onValue(ordersRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val()
        const formattedList = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        })).sort((a, b) => {
           // Sort descending (terbaru diatas) berdasarkan nomor order
           const numA = parseInt(a.id.split('_')[1] || "0")
           const numB = parseInt(b.id.split('_')[1] || "0")
           return numB - numA 
        })
        setOrders(formattedList)
      }
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const activeOrders = orders.filter(o => o.status !== 'completed')
  const historyOrders = orders.filter(o => o.status === 'completed')

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/order">
              <Button variant="ghost" size="icon">
                <ChevronLeft className="w-5 h-5" />
              </Button>
            </Link>
            <h1 className="text-xl font-bold">Dashboard Log</h1>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        
        {/* Section: On-Going Orders */}
        <div>
          <div className="flex items-center gap-2 mb-4 text-blue-600 dark:text-blue-400">
            <Clock className="w-5 h-5" />
            <h2 className="text-lg font-bold">Active Queue ({activeOrders.length})</h2>
          </div>
          
          {activeOrders.length === 0 ? (
            <div className="p-8 text-center border-2 border-dashed rounded-xl text-muted-foreground">
              No active orders at the moment.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {activeOrders.map((order) => (
                <Card key={order.id} className="p-5 border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-lg">{order.id.replace('_', ' #')}</h3>
                      <p className="text-xs text-muted-foreground">
                        {order.createdAt ? new Date(order.createdAt).toLocaleString() : 'Just now'}
                      </p>
                    </div>
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full animate-pulse">
                      Processing
                    </span>
                  </div>
                  <div className="space-y-1">
                    {order.items?.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{item.quantity}x {item.name}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Section: Completed History */}
        <div>
          <div className="flex items-center gap-2 mb-4 text-green-600 dark:text-green-400">
            <CheckCircle2 className="w-5 h-5" />
            <h2 className="text-lg font-bold">Completed History ({historyOrders.length})</h2>
          </div>

          <div className="space-y-3">
            {historyOrders.map((order) => (
              <Card key={order.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 opacity-75 hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-green-100 dark:bg-green-900 rounded-full">
                    <Package className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{order.id.replace('_', ' #')}</h3>
                    <p className="text-xs text-muted-foreground">
                      Total: ${order.totalAmount?.toFixed(2)} • {order.items?.length} Items
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                   <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs font-medium rounded-full">
                      Completed
                   </span>
                   {order.createdAt && (
                     <span className="text-xs text-muted-foreground">
                       {new Date(order.createdAt).toLocaleTimeString()}
                     </span>
                   )}
                </div>
              </Card>
            ))}
            
            {historyOrders.length === 0 && (
               <div className="text-center py-4 text-muted-foreground text-sm">
                 History is empty.
               </div>
            )}
          </div>
        </div>

      </main>
    </div>
  )
}