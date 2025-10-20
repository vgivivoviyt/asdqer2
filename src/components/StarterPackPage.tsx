import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { SubscriptionService } from '../services/subscriptionService';
import { StarterPackService, StarterPackOrder, DeliveryAddress } from '../services/starterPackService';
import AddressCollectionModal from './AddressCollectionModal';
import { supabase } from '../lib/supabase';

import {
  Package,
  Tablet,
  CheckCircle,
  Clock,
  AlertCircle,
  Truck,
  Wrench,
  MapPin,
  Phone,
  Image as ImageIcon,
  X,
  ChevronRight
} from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '16px',
      color: '#424770',
      '::placeholder': {
        color: '#aab7c4',
      },
    },
    invalid: {
      color: '#9e2146',
    },
  },
};

export default function StarterPackPage() {
  return (
    <Elements stripe={stripePromise}>
      <StarterPackContent />
    </Elements>
  );
}

function StarterPackContent() {
  const { user } = useAuth();
  const stripe = useStripe();
  const elements = useElements();

  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [includesTablet, setIncludesTablet] = useState(false);
  const [orders, setOrders] = useState<StarterPackOrder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedHistoryOrder, setSelectedHistoryOrder] = useState<StarterPackOrder | null>(null);
  const [pendingAddress, setPendingAddress] = useState<DeliveryAddress | null>(null);
  const [totalCost, setTotalCost] = useState(0);
  const [isFirstOrder, setIsFirstOrder] = useState(false);
  const [basePackCost, setBasePackCost] = useState(0);

  useEffect(() => {
    if (user) {
      checkAccess();
      loadOrders();
      checkFirstOrder();
      const interval = setInterval(loadOrders, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      calculateCost();
    }
  }, [includesTablet, isFirstOrder, hasAccess, user]);

  const checkAccess = async () => {
    try {
      const accessData = await SubscriptionService.checkSubscriptionAccess(user!.id);
      const isPaidPlan = accessData.subscription?.plan_type !== 'trial' && accessData.hasAccess;
      setHasAccess(isPaidPlan);
    } catch (error) {
      console.error('Error checking access:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkFirstOrder = async () => {
    try {
      const firstOrder = await StarterPackService.isFirstOrder(user!.id);
      setIsFirstOrder(firstOrder);
    } catch (error) {
      console.error('Error checking first order:', error);
    }
  };

  const calculateCost = async () => {
    try {
      const cost = await StarterPackService.calculateTotalCost(user!.id, includesTablet);
      setTotalCost(cost);
      const firstOrder = await StarterPackService.isFirstOrder(user!.id);
      const hasPaidSub = await StarterPackService.hasActivePaidSubscription(user!.id);
      const baseCost = StarterPackService.calculateTotalCostSync(firstOrder, hasPaidSub, false);
      setBasePackCost(baseCost);
    } catch (error) {
      console.error('Error calculating cost:', error);
    }
  };

  const loadOrders = async () => {
    try {
      const userOrders = await StarterPackService.getUserOrders(user!.id);
      setOrders(userOrders);
    } catch (error) {
      console.error('Error loading orders:', error);
    }
  };

  const handlePlaceOrder = () => {
    setShowAddressModal(true);
    setError(null);
  };

  const handleAddressSubmit = async (address: DeliveryAddress) => {
    if (totalCost > 0) {
      setPendingAddress(address);
      setShowAddressModal(false);
    } else {
      await processOrder(address);
    }
  };

  const processOrder = async (address: DeliveryAddress) => {
    setIsProcessing(true);
    setError(null);

    try {
      const order = await StarterPackService.createOrder(user!.id, includesTablet, address);

      if (order.total_cost > 0) {
        if (!stripe || !elements) {
          throw new Error('Stripe not initialized');
        }

        const { data: { session } } = await supabase.auth.getSession();

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-starterpack-payment`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({
              amount: order.total_cost,
              metadata: { orderId: order.id, orderType: "starter_pack" },
            })
          }
        );

        if (!response.ok) {
          throw new Error('Payment initialization failed');
        }

        const { clientSecret } = await response.json();
        const cardElement = elements.getElement(CardElement);

        if (!cardElement) {
          throw new Error('Card element not found');
        }

        const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
          payment_method: { card: cardElement }
        });

        if (stripeError) {
          throw new Error(stripeError.message);
        }

        await StarterPackService.updateOrderPaymentStatus(order.id, paymentIntent!.id, 'completed');
      }

      await loadOrders();
      setIncludesTablet(false);
      setPendingAddress(null);
      setShowAddressModal(false);
    } catch (err: any) {
      console.error('Error creating order:', err);
      setError(err.message || 'Failed to create order');
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-gray-300 border-t-[#E6A85C] rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-8 text-center">
          <AlertCircle className="w-16 h-16 text-yellow-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Paid Plan Required</h2>
          <p className="text-gray-600 mb-6">
            This feature is available for paid plans only. Upgrade your plan to order your Starter Pack.
          </p>
          <a
            href="/upgrade"
            className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-[#E6A85C] to-[#E85A9B] text-white font-medium rounded-xl hover:shadow-lg transition-all"
          >
            Upgrade Now
          </a>
        </div>
      </div>
    );
  }

  const activeOrder = orders.find(
    (order) => order.payment_status === 'completed' && order.order_status !== 'delivered'
  );

  if (selectedHistoryOrder) {
    return <OrderDetailsView order={selectedHistoryOrder} onBack={() => setSelectedHistoryOrder(null)} />;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <AddressCollectionModal
        isOpen={showAddressModal}
        onClose={() => !isProcessing && setShowAddressModal(false)}
        onSubmit={handleAddressSubmit}
      />

      {pendingAddress && totalCost > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Payment Required</h2>
            <button
              onClick={() => {
                setPendingAddress(null);
                setIncludesTablet(false);
              }}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div> 

          <div className="space-y-6">
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Order Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Starter Pack</span>
                  <span className="font-medium">{basePackCost} AED</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tablet</span>
                  <span className="font-medium">499 AED</span>
                </div>
                <div className="border-t border-gray-300 pt-2 mt-2 flex justify-between">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="font-bold text-gray-900">{totalCost} AED</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Details</h3>
              <div className="bg-white p-4 rounded-lg border border-gray-300">
                <CardElement options={CARD_ELEMENT_OPTIONS} />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-red-800">{error}</p>
              </div>
            )}

            <button
              onClick={() => processOrder(pendingAddress)}
              disabled={isProcessing || !stripe}
              className="w-full bg-gradient-to-r from-[#E6A85C] to-[#E85A9B] text-white font-semibold py-4 rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? 'Processing Payment...' : `Pay ${totalCost} AED`}
            </button>
          </div>
        </div>
      )}

      {!pendingAddress && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 bg-gradient-to-br from-[#E6A85C] to-[#E85A9B] rounded-xl flex items-center justify-center">
              <Package className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Starter Pack</h1>
              <p className="text-gray-600">Get your business started with our essential package</p>
            </div>
          </div>

          {activeOrder ? (
            <OrderTracking order={activeOrder} onUpdate={loadOrders} />
          ) : (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">What's Included</h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-[#E6A85C] mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">QR code stands or stickers for customer engagement</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-[#E6A85C] mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">Promotional materials and setup guide</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-[#E6A85C] mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">Quick start documentation</span>
                  </li>
                </ul>
              </div>

              <div className="border-2 border-gray-200 rounded-xl p-6 hover:border-[#E6A85C] transition-colors">
                <label className="flex items-start gap-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includesTablet}
                    onChange={(e) => setIncludesTablet(e.target.checked)}
                    className="mt-1 w-5 h-5 text-[#E6A85C] rounded focus:ring-2 focus:ring-[#E6A85C]"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Tablet className="w-6 h-6 text-gray-700" />
                      <span className="font-semibold text-gray-900">Add Tablet</span>
                      <span className="ml-auto text-lg font-bold text-gray-900">499 AED</span>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4 space-y-2">
                      <p className="font-medium text-gray-900">Recommended: Samsung A9 or similar</p>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• 4GB RAM minimum</li>
                        <li>• Quad-core processor</li>
                        <li>• 10.1" display</li>
                        <li>• Android 11 or higher</li>
                      </ul>
                    </div>
                  </div>
                </label>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-red-800">{error}</p>
                </div>
              )}

              <div className="bg-gray-50 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-lg font-medium text-gray-900">Total Cost</span>
                  <span className="text-3xl font-bold text-gray-900">{totalCost} AED</span>
                </div>
                {!isFirstOrder && !includesTablet && hasAccess && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                    <p className="text-sm text-blue-800">
                      Your first starter pack was complimentary. Additional orders are 50 AED (tablet excluded).
                    </p>
                  </div>
                )}
                {isFirstOrder && hasAccess && !includesTablet && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                    <p className="text-sm text-green-800">
                      Your first starter pack is complimentary as a paid subscriber!
                    </p>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                  <Clock className="w-4 h-4" />
                  <span>Delivered during business hours (Mon-Fri, 9 AM - 5 PM)</span>
                </div>
                <button
                  onClick={handlePlaceOrder}
                  disabled={isProcessing}
                  className="w-full bg-gradient-to-r from-[#E6A85C] to-[#E85A9B] text-white font-semibold py-4 rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? 'Processing...' : 'Place Order'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {orders.filter(o => o.order_status === 'delivered').length > 0 && !activeOrder && !pendingAddress && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Order History</h2>
          <div className="space-y-4">
            {orders.filter(o => o.order_status === 'delivered').map((order) => (
              <button
                key={order.id}
                onClick={() => setSelectedHistoryOrder(order)}
                className="w-full border border-gray-200 rounded-xl p-6 hover:border-[#E6A85C] hover:shadow-md transition-all text-left"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="font-semibold text-gray-900">Order #{order.id.slice(0, 8)}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(order.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full text-sm font-medium bg-gradient-to-r from-[#E6A85C] to-[#E85A9B] text-white">
                      Delivered
                    </span>
                    {order.delivered_at && (
                      <span className="text-sm text-gray-600">
                        {new Date(order.delivered_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                    )}
                  </div>
                  <p className="font-bold text-gray-900">{order.total_cost} AED</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OrderTracking({ order, onUpdate }: { order: StarterPackOrder; onUpdate: () => void }) {
  useEffect(() => {
    const interval = setInterval(onUpdate, 60000);
    return () => clearInterval(interval);
  }, []);

  const stages = [
    { key: 'received', label: 'Order Received', icon: CheckCircle },
    { key: 'preparing', label: 'Preparing', icon: Package },
    { key: 'configuring', label: 'Configuring', icon: Wrench },
    { key: 'out_for_delivery', label: 'Out for Delivery', icon: Truck },
    { key: 'delivered', label: 'Delivered', icon: CheckCircle }
  ];

  const currentIndex = StarterPackService.getStatusIndex(order.order_status);
  const estimatedDelivery = order.estimated_delivery
    ? new Date(order.estimated_delivery)
    : StarterPackService.calculateEstimatedDelivery(order.created_at);

  const isDelayed = StarterPackService.isDelayed(
    order.created_at,
    order.order_status,
    estimatedDelivery.toISOString()
  );

  const deliveryAddress = order.delivery_address_line1 ? {
    line1: order.delivery_address_line1,
    line2: order.delivery_address_line2,
    city: order.delivery_city,
    emirate: order.delivery_emirate,
    phone: order.delivery_contact_number
  } : null;

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-br from-[#FFF5EB] to-[#FFE8F3] rounded-xl p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Tracking Your Order</h3>
        <p className="text-gray-700 mb-4">Order #{order.id.slice(0, 8)}</p>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <Clock className="w-4 h-4" />
            <span>
              Estimated delivery: {estimatedDelivery.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
          {isDelayed && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-yellow-800">
                {StarterPackService.getDelayMessage(estimatedDelivery.toISOString())}
              </p>
            </div>
          )}
        </div>
      </div>

      {deliveryAddress && (
        <div className="bg-gray-50 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <MapPin className="w-5 h-5 text-gray-600" />
            <h4 className="font-semibold text-gray-900">Delivery Address</h4>
          </div>
          <div className="text-gray-700 space-y-1">
            <p>{deliveryAddress.line1}</p>
            {deliveryAddress.line2 && <p>{deliveryAddress.line2}</p>}
            <p>{deliveryAddress.city}, {deliveryAddress.emirate}</p>
            {deliveryAddress.phone && (
              <p className="flex items-center gap-2 mt-2">
                <Phone className="w-4 h-4" />
                {deliveryAddress.phone}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="relative">
        <style>{`
          @keyframes pulse-line {
            0%, 100% { opacity: 0.4; }
            50% { opacity: 1; }
          }
          .pulse-animate {
            animation: pulse-line 1.5s ease-in-out infinite;
          }
        `}</style>
        {stages.map((stage, index) => {
          const Icon = stage.icon;
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isActive = index <= currentIndex;
          const statusTimestamp = order.status_timestamps?.[stage.key];

          return (
            <div key={stage.key} className="relative flex items-center gap-4 pb-8 last:pb-0">
              {index < stages.length - 1 && (
                <div className="absolute left-6 top-12 w-1 h-full bg-gray-200 rounded-full">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isCompleted
                        ? 'bg-gradient-to-b from-[#E6A85C] to-[#E85A9B] w-full'
                        : isCurrent
                        ? 'bg-gradient-to-b from-[#E6A85C] to-[#E85A9B] w-full pulse-animate'
                        : 'w-0'
                    }`}
                  />
                </div>
              )}
              <div
                className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isActive
                    ? 'bg-gradient-to-br from-[#E6A85C] to-[#E85A9B] text-white shadow-lg scale-110'
                    : 'bg-gray-200 text-gray-400'
                } ${isCurrent ? 'ring-4 ring-[#E6A85C] ring-opacity-30' : ''}`}
              >
                <Icon className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <p className={`font-semibold ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                  {stage.label}
                </p>
                {isCurrent && (
                  <p className="text-sm text-[#E85A9B] font-medium">In Progress</p>
                )}
                {statusTimestamp && (
                  <p className="text-xs text-gray-500 mt-1">
                    Completed: {new Date(statusTimestamp).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OrderDetailsView({ order, onBack }: { order: StarterPackOrder; onBack: () => void }) {
  const deliveryAddress = order.delivery_address_line1 ? {
    line1: order.delivery_address_line1,
    line2: order.delivery_address_line2,
    city: order.delivery_city,
    emirate: order.delivery_emirate,
    phone: order.delivery_contact_number
  } : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
      >
        <ChevronRight className="w-5 h-5 rotate-180" />
        Back to Orders
      </button>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="bg-gradient-to-br from-[#E6A85C] to-[#E85A9B] rounded-xl p-8 text-white text-center mb-6">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-[#E6A85C]" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Order Delivered!</h2>
          <p className="mb-4">Your Starter Pack has been successfully delivered</p>
          {order.delivered_at && (
            <p className="text-sm opacity-90">
              Delivered on {new Date(order.delivered_at).toLocaleString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div className="bg-gray-50 rounded-xl p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Order Details</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Order ID:</span>
                <span className="font-medium text-gray-900">{order.id.slice(0, 8)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Cost:</span>
                <span className="font-medium text-gray-900">{order.total_cost} AED</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Includes Tablet:</span>
                <span className="font-medium text-gray-900">{order.includes_tablet ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Order Date:</span>
                <span className="font-medium text-gray-900">
                  {new Date(order.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </span>
              </div>
            </div>
          </div>

          {deliveryAddress && (
            <div className="bg-gray-50 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <MapPin className="w-5 h-5 text-gray-600" />
                <h3 className="font-semibold text-gray-900">Delivery Address</h3>
              </div>
              <div className="text-sm text-gray-700 space-y-1">
                <p>{deliveryAddress.line1}</p>
                {deliveryAddress.line2 && <p>{deliveryAddress.line2}</p>}
                <p>{deliveryAddress.city}, {deliveryAddress.emirate}</p>
                {deliveryAddress.phone && (
                  <p className="flex items-center gap-2 mt-2">
                    <Phone className="w-4 h-4" />
                    {deliveryAddress.phone}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {order.proof_of_delivery_url && (
          <div className="bg-gray-50 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <ImageIcon className="w-5 h-5 text-gray-600" />
              <h3 className="font-semibold text-gray-900">Proof of Delivery</h3>
            </div>
            <img
              src={order.proof_of_delivery_url}
              alt="Proof of delivery"
              className="w-full max-w-2xl rounded-lg border border-gray-200 mx-auto"
            />
          </div>
        )}
      </div>
    </div>
  );
}
