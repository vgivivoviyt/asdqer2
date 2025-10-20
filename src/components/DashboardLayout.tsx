import React, { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { SubscriptionService } from '../services/subscriptionService';
import { useAuth } from '../contexts/AuthContext';
import {
  Home, Users, Gift, Settings, LogOut, Menu, X, ChefHat, MapPin,
  Headphones as HeadphonesIcon, Wallet, BarChart3, Crown, Clock,
  ArrowRight, CreditCard, ChevronLeft, ChevronRight, TrendingUp, Package, Target
} from 'lucide-react';

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [lastSubscriptionCheck, setLastSubscriptionCheck] = useState<number>(0);
  const [showUpgradeSuccess, setShowUpgradeSuccess] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();

  React.useEffect(() => {
    if (user) {
      checkSubscription();
    }
  }, [user]);

  // Listen for subscription updates from payments
  React.useEffect(() => {
    const handleSubscriptionUpdate = () => {
      console.log('🔄 Subscription update event received, refreshing...');
      checkSubscription(true);
      setShowUpgradeSuccess(true);
      setTimeout(() => setShowUpgradeSuccess(false), 5000);
    };

    window.addEventListener('subscription-updated', handleSubscriptionUpdate);
    return () => window.removeEventListener('subscription-updated', handleSubscriptionUpdate);
  }, []);

  // Check for payment success in URL and refresh subscription
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('payment') === 'success') {
      console.log('🎉 Payment success detected, refreshing subscription...');
      
      // Clean up URL immediately to prevent re-triggering
      window.history.replaceState({}, '', window.location.pathname);
      
      // Trigger immediate subscription refresh and set up polling
      checkSubscription(true);
      
      // Set up polling to check for subscription updates
      let pollCount = 0;
      const maxPolls = 20; // Poll for up to 2 minutes
      const pollInterval = setInterval(() => {
        pollCount++;
        console.log(`🔄 Polling for subscription update (${pollCount}/${maxPolls})`);
        checkSubscription(true);
        
        if (pollCount >= maxPolls) {
          clearInterval(pollInterval);
          console.log('⏰ Stopped polling for subscription updates');
        }
      }, 6000); // Poll every 6 seconds

      // Also trigger the subscription update event
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('subscription-updated'));
      }, 1000);

      // Clean up polling when component unmounts
      return () => {
        if (pollInterval) {
          clearInterval(pollInterval);
        }
      };
    }
  }, []);

  const checkSubscription = async (forceRefresh: boolean = false) => {
    if (!user) return;

    // Check if we should use cached subscription data (15 minute cache)
    const now = Date.now();
    const SUBSCRIPTION_CACHE_DURATION = 5 * 1000; // Reduced to 5 seconds for immediate payment updates

    if (!forceRefresh && subscriptionData && (now - lastSubscriptionCheck) < SUBSCRIPTION_CACHE_DURATION) {
      console.log('📊 Using cached subscription data');
      return;
    }

    try {
      setSubscriptionLoading(true);
      console.log('🔄 Fetching fresh subscription data...', forceRefresh ? '(forced)' : '(cache expired)');
      
      const data = await SubscriptionService.checkSubscriptionAccess(user.id);
      console.log('📊 Subscription data loaded:', {
        hasAccess: data.hasAccess,
        planType: data.subscription?.plan_type,
        status: data.subscription?.status,
        daysRemaining: data.daysRemaining,
        billingPeriodText: data.billingPeriodText,
        billingPeriodAccurate: data.billingPeriodAccurate
      });
      
      setSubscriptionData(data);
      setLastSubscriptionCheck(now);
    } catch (error) {
      console.error('Error checking subscription:', error);
    } finally {
      setSubscriptionLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Menu Items', href: '/dashboard/menu-items', icon: ChefHat },
    { name: 'Rewards', href: '/dashboard/rewards', icon: Gift },
    { name: 'Campaigns', href: '/dashboard/campaigns', icon: Target },
    { name: 'Customers', href: '/customers', icon: Users },
    { name: 'Branches', href: '/dashboard/branches', icon: MapPin },
    { name: 'Loyalty Config', href: '/dashboard/loyalty-config', icon: Settings },
    { name: 'Starter Pack', href: '/dashboard/starter-pack', icon: Package },
    { name: 'Billing', href: '/dashboard/billing', icon: CreditCard },
    { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
    { name: 'ROI Analysis', href: '/dashboard/roi', icon: TrendingUp },
    { name: 'Support', href: '/dashboard/support', icon: HeadphonesIcon },
  ];

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    return location.pathname === href;
  };

  // Add debug info for subscription status
  React.useEffect(() => {
    if (subscriptionData) {
      console.log('🔍 Current subscription status in layout:', {
        planType: subscriptionData.subscription?.plan_type,
        status: subscriptionData.subscription?.status,
        hasAccess: subscriptionData.hasAccess,
        isExpired: subscriptionData.isExpired,
        daysRemaining: subscriptionData.daysRemaining
      });
    }
  }, [subscriptionData]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-white shadow-xl rounded-r-3xl">
          <div className="flex h-16 items-center justify-between px-4 border-b border-gray-200 rounded-tr-3xl">
            <div className="flex items-center space-x-3">
              <img src="/leyls-svg.svg" alt="Leyls" className="h-8 w-auto object-contain" />
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-xl transition-colors"
            > 
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <nav className="flex-1 px-4 py-4 space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.name}
                  onClick={() => {
                    navigate(item.href);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-colors ${
                    isActive(item.href)
                      ? 'bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] text-white shadow-lg'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-6 h-6 mr-3" />
                  {item.name}
                </button>
              );
            })}
          </nav>
          
          <div className="p-4 border-t border-gray-200 rounded-br-3xl">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors"
            >
              <LogOut className="w-6 h-6 mr-3" />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className={`hidden lg:fixed lg:inset-y-0 lg:flex lg:flex-col transition-all duration-300 ${
        sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'
      }`}>
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200 shadow-sm rounded-r-3xl m-2 mr-0">
          <div
  className={`flex items-center border-b border-gray-100 rounded-tr-3xl relative ${
    sidebarCollapsed ? 'justify-center px-2' : 'justify-between px-4'
  }`}
>
  {sidebarCollapsed ? (
    <div className="flex flex-1 items-center justify-center">
      <img
        src="/SwooshLogo.svg"
        alt="Swoosh Logo"
        className="h-32 w-32 object-contain"
      />
    </div>
            ) : (
              <>
                <div className="flex items-center space-x-3">
                  <img src="/leyls-svg.svg" alt="Leyls" className="h-10 w-auto object-contain" />
                </div>
                {/* Collapse button positioned at the right when expanded */}
                <button
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors ml-auto"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              </>
            )} 
            
            {/* Collapse button positioned below logo when collapsed */}
            {sidebarCollapsed && (
              <div className="absolute -right-3 top-1/2 transform -translate-y-1/2">
                <button
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="p-2 bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 rounded-full shadow-sm transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
          
          <nav className="flex-1 px-4 py-4 space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.name} className="relative group">
                  <button
                    onClick={() => navigate(item.href)}
                    className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-3 py-4' : 'px-4 py-3'} text-sm font-medium rounded-xl transition-all duration-200 ${
                      isActive(item.href)
                        ? 'bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] text-white shadow-lg'
                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <Icon className={`${sidebarCollapsed ? 'w-7 h-7' : 'w-6 h-6 mr-3'}`} />
                    {!sidebarCollapsed && item.name}
                  </button>
                  
                  {/* Tooltip for collapsed state */}
                  {sidebarCollapsed && (
                    <div className="absolute left-full ml-3 top-1/2 transform -translate-y-1/2 bg-gray-900 text-white px-3 py-2 rounded-xl text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 shadow-lg">
                      {item.name}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
          
          <div className="p-4 border-t border-gray-200 rounded-br-3xl space-y-4">
            {/* Subscription Status */}
            {subscriptionData && !sidebarCollapsed && (
              <div>
                {subscriptionData.subscription?.plan_type === 'trial' && 
                 subscriptionData.daysRemaining !== undefined && 
                 subscriptionData.daysRemaining <= 7 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4 text-yellow-600" />
                      <span className="text-sm font-medium text-yellow-900">
                        Trial expires in {subscriptionData.daysRemaining} days
                      </span>
                    </div>
                    <button
                      onClick={() => navigate('/upgrade')}
                      className="w-full bg-gradient-to-r from-[#E6A85C] to-[#E85A9B] text-white px-3 py-2 rounded-xl text-sm font-medium hover:shadow-md transition-all duration-200 flex items-center justify-center gap-2"
                    >
                      <Crown className="h-4 w-4" />
                      Upgrade Now
                    </button>
                  </div>
                )}

                <div className="bg-gray-50 rounded-2xl p-3">
                  {/* Current Plan */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">Current Plan</span>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      subscriptionData.subscription?.plan_type === 'trial'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {subscriptionData.subscription?.plan_type || 'Trial'}
                    </span>
                  </div>

                  {/* Status */}
                  {subscriptionData.subscription?.status && (
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-600">Status</span>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        subscriptionData.subscription.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : subscriptionData.subscription.status === 'past_due'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {subscriptionData.subscription.status}
                      </span>
                    </div>
                  )}

                  {/* Billing Period */}
                  {subscriptionData.billingPeriodText && (
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-600">Billing Period</span>
                      <span className="text-xs font-medium text-gray-900">
                        {subscriptionData.billingPeriodText}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* User Profile Section */}
            <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'space-x-3'}`}>
              {sidebarCollapsed ? (
                <div className="relative group">
                  <div className="w-12 h-12 bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] rounded-full flex items-center justify-center">
                    <span className="text-white text-lg font-medium">
                      {user?.email?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="absolute left-full ml-3 top-1/2 transform -translate-y-1/2 bg-gray-900 text-white px-3 py-2 rounded-xl text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 shadow-lg">
                    {user?.email}
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-10 h-10 bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">
                      {user?.email?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {user?.email}
                    </p>
                    <p className="text-xs text-gray-500">Restaurant Owner</p>
                  </div>
                </>
              )}
            </div>

            {/* Action Buttons */}
            {sidebarCollapsed ? (
              <div className="space-y-3">
                <div className="relative group">
                  <button
                    onClick={() => navigate('/wallet')}
                    className="w-full flex items-center justify-center px-3 py-3 text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                  >
                    <Wallet className="w-7 h-7" />
                  </button>
                  <div className="absolute left-full ml-3 top-1/2 transform -translate-y-1/2 bg-gray-900 text-white px-3 py-2 rounded-xl text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 shadow-lg">
                    Customer Wallet
                  </div>
                </div>
                
                {subscriptionData?.subscription?.plan_type === 'trial' && (
                  <div className="relative group">
                    <button
                      onClick={() => navigate('/upgrade')}
                      className="w-full flex items-center justify-center px-3 py-3 text-white bg-gradient-to-r from-[#E6A85C] to-[#E85A9B] rounded-xl transition-colors hover:shadow-md"
                    >
                      <Crown className="w-7 h-7" />
                    </button>
                    <div className="absolute left-full ml-3 top-1/2 transform -translate-y-1/2 bg-gray-900 text-white px-3 py-2 rounded-xl text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 shadow-lg">
                      Upgrade Plan
                    </div>
                  </div>
                )}
                
                <div className="relative group">
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center justify-center px-3 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                  >
                    <LogOut className="w-7 h-7" />
                  </button>
                  <div className="absolute left-full ml-3 top-1/2 transform -translate-y-1/2 bg-gray-900 text-white px-3 py-2 rounded-xl text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 shadow-lg">
                    Sign Out
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={() => navigate('/wallet')}
                  className="w-full flex items-center px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <Wallet className="w-6 h-6 mr-3" />
                  Customer Wallet
                </button>

                {subscriptionData?.subscription?.plan_type === 'trial' && (
                  <button
                    onClick={() => navigate('/upgrade')}
                    className="w-full flex items-center px-4 py-3 text-sm font-medium text-white bg-gradient-to-r from-[#E6A85C] to-[#E85A9B] rounded-xl transition-colors hover:shadow-md"
                  >
                    <Crown className="w-6 h-6 mr-3" />
                    Upgrade Plan
                  </button>
                )}
                
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                >
                  <LogOut className="w-6 h-6 mr-3" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-24' : 'lg:pl-64'}`}>
        {/* Top bar */}
 {/* Top bar */}
<div className="sticky top-0 z-40 flex h-16 items-center gap-x-4 
  border-b border-gray-300 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8 
  rounded-b-3xl">
  
  <button
    type="button"
    className="-m-2.5 p-2.5 text-gray-700 lg:hidden hover:bg-gray-100 rounded-xl transition-colors"
    onClick={() => setSidebarOpen(true)}
  >
    <Menu className="h-6 w-6" />
  </button>

  <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
    <div className="flex flex-1"></div>
    <div className="flex items-center gap-x-4 lg:gap-x-6">
      {/* Subscription indicator for mobile */}
      {subscriptionData?.subscription?.plan_type === 'trial' && 
       subscriptionData?.daysRemaining !== undefined && 
       subscriptionData?.daysRemaining <= 7 && (
        <button
          onClick={() => navigate('/upgrade')}
          className="lg:hidden bg-yellow-100 text-yellow-800 px-3 py-2 rounded-full text-xs font-medium flex items-center gap-1 hover:bg-yellow-200 transition-colors"
        >
          <Clock className="h-4 w-4" />
          {subscriptionData.daysRemaining}d left
        </button>
      )}

      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] rounded-full flex items-center justify-center">
          <span className="text-white text-sm font-medium">
            {user?.email?.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="hidden md:block">
          <p className="text-sm font-medium text-gray-900">
            {user?.email}
          </p>
          <p className="text-xs text-gray-500">Restaurant Owner</p>
        </div>
      </div>
    </div>
  </div>
</div>


        {/* Page content */}
        <main className="py-6">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
              <Outlet />
            </div> 
          </div>
        </main>
      </div>
    </div>
  );
}   
