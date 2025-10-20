import React, { useState, useEffect } from 'react';
import {
  Users, Search, Filter, Download, Mail, Phone, Calendar,
  TrendingUp, Gift, DollarSign, Eye, MoreVertical, RefreshCw,
  AlertCircle, Award, Star, ArrowUpRight, ArrowDownRight, X
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import LoadingBar from './LoadingBar';

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  total_points: number;
  lifetime_points: number;
  current_tier: 'bronze' | 'silver' | 'gold';
  visit_count: number;
  total_spent: number;
  last_visit: string | null;
  created_at: string;
}

interface CustomerStats {
  totalCustomers: number;
  newThisMonth: number;
  activeCustomers: number;
  totalRevenue: number;
  avgLifetimeValue: number;
  avgOrderValue: number;
}

const CustomersPage: React.FC = () => {
  const { restaurant } = useAuth();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTier, setSelectedTier] = useState<'all' | 'bronze' | 'silver' | 'gold'>('all');
  const [selectedSegment, setSelectedSegment] = useState<'all' | 'new' | 'active' | 'vip'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'points' | 'spent' | 'visits'>('recent');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (restaurant) {
      fetchCustomers();
    }
  }, [restaurant]);

  useEffect(() => {
    filterAndSortCustomers();
  }, [customers, searchQuery, selectedTier, selectedSegment, sortBy]);

  const fetchCustomers = async () => {
    if (!restaurant) return;

    try {
      setLoading(true);

      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .order('created_at', { ascending: false });

      if (customersError) throw customersError;

      setCustomers(customersData || []);

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const newThisMonth = (customersData || []).filter(
        c => new Date(c.created_at) >= monthStart
      ).length;

      const activeCustomers = (customersData || []).filter(
        c => c.last_visit && new Date(c.last_visit) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      ).length;

      const totalRevenue = (customersData || []).reduce((sum, c) => sum + c.total_spent, 0);
      const totalCustomers = (customersData || []).length;

      setStats({
        totalCustomers,
        newThisMonth,
        activeCustomers,
        totalRevenue,
        avgLifetimeValue: totalCustomers > 0 ? totalRevenue / totalCustomers : 0,
        avgOrderValue: totalCustomers > 0 ? totalRevenue / (customersData || []).reduce((sum, c) => sum + c.visit_count, 0) : 0
      });
    } catch (err: any) {
      console.error('Error fetching customers:', err);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortCustomers = () => {
    let filtered = [...customers];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        c =>
          c.first_name.toLowerCase().includes(query) ||
          c.last_name.toLowerCase().includes(query) ||
          c.email.toLowerCase().includes(query) ||
          (c.phone && c.phone.includes(query))
      );
    }

    if (selectedTier !== 'all') {
      filtered = filtered.filter(c => c.current_tier === selectedTier);
    }

    if (selectedSegment !== 'all') {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      switch (selectedSegment) {
        case 'new':
          filtered = filtered.filter(c => new Date(c.created_at) >= monthStart);
          break;
        case 'active':
          filtered = filtered.filter(c => c.last_visit && new Date(c.last_visit) >= thirtyDaysAgo);
          break;
        case 'vip':
          filtered = filtered.filter(c => c.current_tier === 'gold' || c.total_spent > 1000);
          break;
      }
    }
filtered.sort((a, b) => {
  switch (sortBy) {
    case 'points':
      return b.total_points - a.total_points;
    case 'spent':
      return b.total_spent - a.total_spent;
    case 'visits':
      return b.visit_count - a.visit_count;
    case 'recent':
    default:
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  }
});


    setFilteredCustomers(filtered);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'gold':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'silver':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      default:
        return 'bg-orange-100 text-orange-700 border-orange-200';
    }
  };

  const getTierIcon = (tier: string) => {
    return tier === 'gold' ? Award : tier === 'silver' ? Star : Gift;
  };

  if (loading) {
    return (
      <>
        <LoadingBar isLoading={loading} />
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-64"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
          <div className="h-96 bg-gray-200 rounded-xl"></div>
        </div>
      </>
    );
  }

  return (
    <>
      <LoadingBar isLoading={loading} />
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
            <p className="text-sm text-gray-500 mt-1">Manage and analyze your customer base</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchCustomers}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-5 border border-gray-100">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <Users className="h-5 w-5 text-white" />
                </div>
                <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-md font-medium">
                  +{stats.newThisMonth} this month
                </span>
              </div>
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Total Customers</h3>
              <p className="text-2xl font-bold text-gray-900">{stats.totalCustomers}</p>
            </div>

            <div className="bg-white rounded-xl p-5 border border-gray-100">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
              </div>
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Active (30d)</h3>
              <p className="text-2xl font-bold text-gray-900">{stats.activeCustomers}</p>
              <p className="text-xs text-gray-400 mt-1">
                {stats.totalCustomers > 0 ? ((stats.activeCustomers / stats.totalCustomers) * 100).toFixed(1) : 0}% of total
              </p>
            </div>

            <div className="bg-white rounded-xl p-5 border border-gray-100">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-[#E6A85C] to-[#E85A9B] rounded-lg flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-white" />
                </div>
              </div>
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Total Revenue</h3>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalRevenue)}</p>
            </div>

            <div className="bg-white rounded-xl p-5 border border-gray-100">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <Award className="h-5 w-5 text-white" />
                </div>
              </div>
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Avg Lifetime Value</h3>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.avgLifetimeValue)}</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-100">
          <div className="p-5 border-b border-gray-100">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search customers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#E85A9B] focus:border-transparent"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedSegment}
                  onChange={(e) => setSelectedSegment(e.target.value as any)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#E85A9B] focus:border-transparent"
                >
                  <option value="all">All Customers</option>
                  <option value="new">New (This Month)</option>
                  <option value="active">Active (30 Days)</option>
                  <option value="vip">VIP Customers</option>
                </select>

                <select
                  value={selectedTier}
                  onChange={(e) => setSelectedTier(e.target.value as any)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#E85A9B] focus:border-transparent"
                >
                  <option value="all">All Tiers</option>
                  <option value="bronze">Bronze</option>
                  <option value="silver">Silver</option>
                  <option value="gold">Gold</option>
                </select>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#E85A9B] focus:border-transparent"
                >
                  <option value="recent">Recent First</option>
                  <option value="points">Most Points</option>
                  <option value="spent">Highest Spend</option>
                  <option value="visits">Most Visits</option>
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            {filteredCustomers.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No customers found</h3>
                <p className="text-gray-500">Try adjusting your filters or search query</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Customer
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Tier
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Points
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Visits
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Total Spent
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Last Visit
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredCustomers.map((customer) => {
                    const TierIcon = getTierIcon(customer.current_tier);
                    return (
                      <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-[#E6A85C] via-[#E85A9B] to-[#D946EF] rounded-full flex items-center justify-center text-white font-medium text-sm">
                              {customer.first_name[0]}{customer.last_name[0]}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {customer.first_name} {customer.last_name}
                              </p>
                              <p className="text-xs text-gray-500">{customer.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${getTierColor(customer.current_tier)}`}>
                            <TierIcon className="h-3 w-3" />
                            {customer.current_tier.charAt(0).toUpperCase() + customer.current_tier.slice(1)}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-sm font-medium text-gray-900">{customer.total_points.toLocaleString()}</p>
                          <p className="text-xs text-gray-500">{customer.lifetime_points.toLocaleString()} lifetime</p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-sm text-gray-900">{customer.visit_count}</p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-sm font-medium text-gray-900">{formatCurrency(customer.total_spent)}</p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-sm text-gray-600">{formatDate(customer.last_visit)}</p>
                        </td>
                        <td className="px-5 py-4">
                          <button
                            onClick={() => {
                              setSelectedCustomer(customer);
                              setShowDetails(true);
                            }}
                            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {filteredCustomers.length > 0 && (
            <div className="px-5 py-4 border-t border-gray-100 bg-gray-50">
              <p className="text-sm text-gray-600">
                Showing {filteredCustomers.length} of {customers.length} customers
              </p>
            </div>
          )}
        </div>
      </div>

      {showDetails && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-[#E6A85C] via-[#E85A9B] to-[#D946EF] rounded-full flex items-center justify-center text-white font-bold text-xl">
                    {selectedCustomer.first_name[0]}{selectedCustomer.last_name[0]}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {selectedCustomer.first_name} {selectedCustomer.last_name}
                    </h2>
                    <p className="text-sm text-gray-500">{selectedCustomer.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDetails(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Current Tier</p>
                  <p className="text-lg font-bold text-gray-900 capitalize">{selectedCustomer.current_tier}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Points</p>
                  <p className="text-lg font-bold text-gray-900">{selectedCustomer.total_points.toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Lifetime Points</p>
                  <p className="text-lg font-bold text-gray-900">{selectedCustomer.lifetime_points.toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Visit Count</p>
                  <p className="text-lg font-bold text-gray-900">{selectedCustomer.visit_count}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Spent</p>
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(selectedCustomer.total_spent)}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Avg Order Value</p>
                  <p className="text-lg font-bold text-gray-900">
                    {formatCurrency(selectedCustomer.visit_count > 0 ? selectedCustomer.total_spent / selectedCustomer.visit_count : 0)}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Contact Information</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-900">{selectedCustomer.email}</span>
                  </div>
                  {selectedCustomer.phone && (
                    <div className="flex items-center gap-3 text-sm">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-900">{selectedCustomer.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">
                      Member since {formatDate(selectedCustomer.created_at)}
                    </span>
                  </div>
                  {selectedCustomer.last_visit && (
                    <div className="flex items-center gap-3 text-sm">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-600">
                        Last visit {formatDate(selectedCustomer.last_visit)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CustomersPage;
