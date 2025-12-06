"use client"

import Link from "next/link"
import { ShoppingCart, Activity } from "lucide-react"
import { Button } from "@/components/ui/button"
import ProductGrid from "@/components/product-grid"
import { CartProvider, useCart } from "@/lib/cart-context"

function StoreContent() {
  const { items } = useCart()
  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Store</h1>
          <nav className="flex items-center gap-4">
            <Link href="/monitoring">
              <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
                <Activity className="w-5 h-5 mr-2" />
                Monitor
              </Button>
            </Link>
            <Link href="/cart">
              <Button variant="outline" className="relative bg-transparent">
                <ShoppingCart className="w-5 h-5 mr-2" />
                Cart
                {cartCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </Button>
            </Link>
          </nav>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-2">Welcome to Our Store</h2>
          <p className="text-muted-foreground">Browse our collection of premium products</p>
        </div>
        <ProductGrid />
      </main>
    </div>
  )
}

export default function StorePage() {
  return (
    <CartProvider>
      <StoreContent />
    </CartProvider>
  )
}