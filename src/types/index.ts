export interface Address {
  id: string
  label: string
  fullName: string
  phone: string
  email: string
  address: string
  city: string
  state: string
  zip: string
  latitude: number | null
  longitude: number | null
  notes: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface Category {
  id: string
  slug: string
  name: string
  image: string
  sortOrder: number
}

export interface Product {
  id: string
  name: string
  description: string
  price: number
  originalPrice: number
  image: string
  category: string
  unit: string
  stock: number
  isOrganic: boolean
  rating: number
  reviewCount: number
  discount: number
  createdAt: string
}

export interface DeliveryPartner {
  id: string
  name: string
  email: string
  phone: string
  avatar: string
  vehicleType: "bike" | "scooter" | "car"
  isActive: boolean
  createdAt: string
}
