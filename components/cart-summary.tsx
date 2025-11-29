"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useCart } from "@/lib/cart-context"
import { Minus, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function CartSummary() {
  const { items, updateQuantity, removeItem, total, clearCart } = useCart()
  const [orderPlaced, setOrderPlaced] = useState(false)
  const router = useRouter()

  const handlePlaceOrder = () => {
    if (items.length > 0) {
      clearCart()
      router.push("/order")
    }
  }

  return (
    <div className="lg:col-span-3">
      {orderPlaced && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
          ✓ Order placed successfully!
        </div>
      )}

      <div className="space-y-4 mb-6">
        {items.map((item) => (
          <Card key={item.id} className="p-4">
            <div className="flex gap-4">
              <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted">
                <img src={item.image || "/placeholder.svg"} alt={item.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">{item.name}</h3>
                <p className="text-muted-foreground">${item.price.toFixed(2)}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Button size="sm" variant="outline" onClick={() => updateQuantity(item.id, item.quantity - 1)}>
                    <Minus className="w-4 h-4" />
                  </Button>
                  <span className="font-semibold text-foreground w-8 text-center">{item.quantity}</span>
                  <Button size="sm" variant="outline" onClick={() => updateQuantity(item.id, item.quantity + 1)}>
                    <Plus className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto text-destructive"
                    onClick={() => removeItem(item.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-foreground">${(item.price * item.quantity).toFixed(2)}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Order Summary */}
      <Card className="p-6 bg-card border border-border">
        <h2 className="text-xl font-bold text-foreground mb-4">Order Summary</h2>
        <div className="space-y-2 mb-6">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>${total.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Shipping</span>
            <span>Free</span>
          </div>
          <div className="border-t border-border pt-2 flex justify-between text-lg font-bold text-foreground">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>
        <Button onClick={handlePlaceOrder} disabled={items.length === 0} className="w-full" size="lg">
          Place Order
        </Button>
        <Link href="/" className="block mt-3">
          <Button variant="outline" className="w-full bg-transparent">
            Continue Shopping
          </Button>
        </Link>
      </Card>
    </div>
  )
}
