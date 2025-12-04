"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useCart } from "@/lib/cart-context"
import { ShoppingCart } from "lucide-react"

// HANYA 4 PRODUK UNTUK SIMPLIFIKASI
const PRODUCTS = [
  { 
    id: "1", 
    name: "Premium Wireless Headphones", 
    price: 129.99, 
    image: "/wireless-headphones.png" 
  },
  { 
    id: "2", 
    name: "Smart Watch Pro", 
    price: 299.99, 
    image: "/modern-smartwatch.png" 
  },
  { 
    id: "3", 
    name: "Wireless Charger Pad", 
    price: 49.99, 
    image: "/wireless-charger.png" 
  },
  { 
    id: "4", 
    name: "Bluetooth Speaker", 
    price: 79.99, 
    image: "/bluetooth-speaker.jpg" 
  },
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