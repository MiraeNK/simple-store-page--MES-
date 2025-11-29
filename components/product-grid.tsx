"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useCart } from "@/lib/cart-context"
import { ShoppingCart } from "lucide-react"

const PRODUCTS = [
  { id: "1", name: "Premium Wireless Headphones", price: 129.99, image: "/wireless-headphones.png" },
  { id: "2", name: "Smart Watch Pro", price: 299.99, image: "/modern-smartwatch.png" },
  { id: "3", name: "USB-C Cable 3-Pack", price: 19.99, image: "/usb-cables.jpg" },
  { id: "4", name: "Wireless Charger Pad", price: 49.99, image: "/wireless-charger.png" },
  { id: "5", name: "Phone Stand Adjustable", price: 24.99, image: "/phone-stand.jpg" },
  { id: "6", name: "Portable Power Bank 20000mAh", price: 39.99, image: "/portable-power-bank.png" },
  { id: "7", name: "Screen Protector 2-Pack", price: 12.99, image: "/screen-protector.png" },
  { id: "8", name: "Phone Case Premium", price: 29.99, image: "/colorful-phone-case-display.png" },
  { id: "9", name: "Bluetooth Speaker", price: 79.99, image: "/bluetooth-speaker.jpg" },
  { id: "10", name: "Desk Lamp LED", price: 44.99, image: "/modern-desk-lamp.png" },
  { id: "11", name: "Keyboard Mechanical RGB", price: 149.99, image: "/mechanical-keyboard.png" },
  { id: "12", name: "Mouse Wireless Ergonomic", price: 59.99, image: "/ergonomic-mouse.png" },
  { id: "13", name: "USB Hub 7-Port", price: 34.99, image: "/usb-hub.png" },
  { id: "14", name: "Screen Stand Monitor Raiser", price: 39.99, image: "/monitor-stand.jpg" },
  { id: "15", name: "Webcam 1080p HD", price: 69.99, image: "/classic-webcam.png" },
  { id: "16", name: "Microphone Condenser Studio", price: 199.99, image: "/studio-microphone.jpg" },
]

export default function ProductGrid() {
  const { addItem } = useCart()

  const handleAddToCart = (product: (typeof PRODUCTS)[0]) => {
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
    })
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {PRODUCTS.map((product) => (
        <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow">
          <div className="aspect-square overflow-hidden bg-muted">
            <img src={product.image || "/placeholder.svg"} alt={product.name} className="w-full h-full object-cover" />
          </div>
          <div className="p-4">
            <h3 className="font-semibold text-foreground line-clamp-2 mb-2">{product.name}</h3>
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-primary">${product.price.toFixed(2)}</span>
              <Button size="sm" onClick={() => handleAddToCart(product)} className="gap-1">
                <ShoppingCart className="w-4 h-4" />
                Add
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
