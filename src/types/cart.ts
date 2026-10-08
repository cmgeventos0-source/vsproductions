export interface CartItem {
  functionId: string;
  eventId: string;
  zoneId: string;
  quantity: number;
  price: number;
  seatIds?: string[];
  eventName: string;
  zoneName: string;
  functionDateTime: string;
}

export interface ShoppingCart {
  id: string;
  userId?: string;
  sessionId?: string;
  items: CartItem[];
  subtotal: number;
  discountAmount: number;
  promoCodeId?: string;
  promoCode?: string;
  total: number;
  createdAt: string;
  updatedAt: string;
}

export interface PromoCode {
  id: string;
  code: string;
  description?: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minPurchase?: number;
  maxUses?: number;
  currentUses: number;
  categoryId?: string;
  eventId?: string;
  validFrom: string;
  validUntil: string;
  active: boolean;
}

export interface PromoCodeResponse {
  success: boolean;
  discount?: number;
  finalTotal?: number;
  message?: string;
}

export interface Favorite {
  id: string;
  userId: string;
  eventId: string;
  createdAt: string;
}

export interface ReferralCode {
  id: string;
  userId: string;
  code: string;
  discountPercentage: number;
  totalReferrals: number;
  totalEarned: number;
  active: boolean;
  createdAt: string;
}
