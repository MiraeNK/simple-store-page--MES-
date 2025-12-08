"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useCart } from "@/lib/cart-context"
import { Minus, Plus, Trash2, Loader2 } from "lucide-react"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ref, push, set, update, get } from "firebase/database"
import { database } from "@/lib/firebase"

export default function CartSummary() {
  const { items, updateQuantity, removeItem, total, clearCart } = useCart()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  const handlePlaceOrder = async () => {
    if (items.length === 0) return;
    setIsSubmitting(true);

    try {
      // 1. Cek dulu apakah mesin sedang sibuk? (Optional safety)
      // Kalau mesin sibuk, idealnya kita tolak atau tetap masuk antrian saja.
      // Tapi sesuai permintaan "langsung masukkan", kita hajar update live_order.

      // A. Simpan data lengkap ke 'orders' (Log/History Antrian)
      const ordersRef = ref(database, "orders");
      const newOrderRef = push(ordersRef);
      
      const orderPayload = {
        id: newOrderRef.key, 
        items: items.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity
        })),
        totalAmount: total,
        status: 'processing', // Langsung set processing karena langsung dikirim ke mesin
        createdAt: new Date().toISOString()
      };

      // Simpan Log Order
      await set(newOrderRef, orderPayload);

      // B. UPDATE LIVE ORDER (LANGSUNG ISI KUANTITAS KE MEMORI MESIN)
      // Kita perlu membaca struktur live_order dulu untuk tau index array-nya (0,1,2,3)
      // Asumsi: items di live_order urut index 0=id1, 1=id2, 2=id3, 3=id4
      
      const updates: any = {};
      
      // Reset dulu live_order biar bersih (atau ambil data lama + baru jika mau akumulasi)
      // Disini kita timpa sesuai order baru
      
      items.forEach(item => {
          // Mapping ID produk ke Index Array Live Order
          // ID "1" -> Index 0
          // ID "2" -> Index 1
          const itemIndex = parseInt(item.id) - 1; 
          
          if (itemIndex >= 0 && itemIndex <= 3) {
              updates[`live_order/items/${itemIndex}/quantity`] = item.quantity;
          }
      });

      // Kirim perintah ke mesin!
      await update(ref(database), updates);

      // 3. Bersihkan Cart & Redirect
      clearCart();
      router.push("/order"); 

    } catch (error) {
      console.error("Error placing order:", error);
      alert("Failed to place order.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="lg:col-span-3">
      {/* ... (BAGIAN UI KARTU BARANG TETAP SAMA) ... */}
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
                  <Button size="sm" variant="ghost" className="ml-auto text-destructive" onClick={() => removeItem(item.id)}>
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
        <Button 
          onClick={handlePlaceOrder} 
          disabled={items.length === 0 || isSubmitting} 
          className="w-full" size="lg"
        >
          {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Sending to Machine...</> : "Place Order"}
        </Button>
      </Card>
    </div>
  )
}