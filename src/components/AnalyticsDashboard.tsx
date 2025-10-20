import React, { useState, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, Users, Gift, DollarSign, Target,
  ArrowUpRight, ArrowDownRight, RefreshCw, AlertCircle, BarChart3, Minus
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import LoadingBar from './LoadingBar';

interface MonthlyMetrics {
  month: string;
  year: number;
  customerCount: number;
  newCustomers: number;
  returningCustomers: number;
  revenue: number;
  pointsIssued: number;
  pointsRedeemed: number;
  rewardsRedeemed: number;
  averageOrderValue: number;
  retentionRate: number;
}

interface YearlyMetrics {
  year: number;
  customerCount: number;
  revenue: number;
  pointsIssued: number;
  pointsRedeemed: number;
  rewardsRedeemed: number;
  averageOrderValue: number;
  retentionRate: number;
}

interface ComparisonMetrics {
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'neutral';
}

const AnalyticsDashboard: React.FC = () => {
  const { restaurant } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyMetrics[]>([]);
  const [yearlyData, setYearlyData] = useState<YearlyMetrics[]>([]);
  const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly');
  const [timeRange, setTimeRange] = useState<'6m' | '12m' | 'all'>('12m');

  useEffect(() => {
    if (restaurant) {
      if (viewMode === 'monthly') {
        fetchMonthlyAnalytics();
      } else {
        fetchYearlyAnalytics();
      }
    }
  }, [restaurant, timeRange, viewMode]);

  const fetchMonthlyAnalytics = async () => {
    if (!restaurant) return;

    try {
      setLoading(true);
      setError(null);

      const monthsToFetch = timeRange === '6m' ? 6 : timeRange === '12m' ? 12 : 24;

      const monthPromises = [];
      for (let i = monthsToFetch - 1; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);

        monthPromises.push(
          getMonthMetrics(restaurant.id, monthStart, monthEnd).then(metrics => ({
            month: date.toLocaleDateString('en-US', { month: 'short' }),
            year: date.getFullYear(),
            customerCount: metrics.customers,
            newCustomers: metrics.newCustomers,
            returningCustomers: metrics.returningCustomers,
            revenue: metrics.revenue,
            pointsIssued: metrics.pointsIssued,
            pointsRedeemed: metrics.pointsRedeemed,
            rewardsRedeemed: metrics.rewardsRedeemed,
            averageOrderValue: metrics.averageOrderValue,
            retentionRate: metrics.retentionRate
          }))
        );
      }

      const months = await Promise.all(monthPromises);
      setMonthlyData(months);
    } catch (err: any) {
      console.error('Error fetching monthly analytics:', err);
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const fetchYearlyAnalytics = async () => {
    if (!restaurant) return;

    try {
      setLoading(true);
      setError(null);

      const currentYear = new Date().getFullYear();
      const yearsToFetch = 5;

      const yearPromises = [];
      for (let i = 0; i < yearsToFetch; i++) {
        const year = currentYear - i;
        const yearStart = new Date(year, 0, 1);
        const yearEnd = new Date(year, 11, 31, 23, 59, 59);

        yearPromises.push(
          getMonthMetrics(restaurant.id, yearStart, yearEnd).then(metrics => ({
            year,
            customerCount: metrics.customers,
            revenue: metrics.revenue,
            pointsIssued: metrics.pointsIssued,
            pointsRedeemed: metrics.pointsRedeemed,
            rewardsRedeemed: metrics.rewardsRedeemed,
            averageOrderValue: metrics.averageOrderValue,
            retentionRate: metrics.retentionRate
          }))
        );
      }

      const years = await Promise.all(yearPromises);
      setYearlyData(years.reverse());
    } catch (err: any) {
      console.error('Error fetching yearly analytics:', err);
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const getMonthMetrics = async (restaurantId: string, start: Date, end: Date) => {
    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select('created_at, total_spent, visit_count')
      .eq('restaurant_id', restaurantId)
      .lte('created_at', end.toISOString());

    if (customersError) throw customersError;

    const monthCustomers = customers.filter(c => new Date(c.created_at) >= start && new Date(c.created_at) <= end);
    const allActiveCustomers = customers.filter(c => new Date(c.created_at) <= end);

    const { data: transactions, error: transError } = await supabase
      .from('transactions')
      .select('type, points, created_at')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    if (transError) throw transError;

    const { data: redemptions, error: redError } = await supabase
      .from('reward_redemptions')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .gte('redeemed_at', start.toISOString())
      .lte('redeemed_at', end.toISOString());

    if (redError) throw redError;

    const revenue = allActiveCustomers.reduce((sum, c) => sum + c.total_spent, 0);
    const pointsIssued = transactions.filter(t => (t.type === 'purchase' || t.type === 'signup' || t.type === 'bonus' || t.type === 'referral') && t.points > 0).reduce((sum, t) => sum + t.points, 0);
    const pointsRedeemed = transactions.filter(t => t.type === 'redemption').reduce((sum, t) => sum + Math.abs(t.points), 0);
    const totalOrders = allActiveCustomers.reduce((sum, c) => sum + c.visit_count, 0);
    const returningCustomers = allActiveCustomers.filter(c => c.visit_count > 1).length;

    return {
      customers: allActiveCustomers.length,
      newCustomers: monthCustomers.length,
      returningCustomers,
      revenue,
      pointsIssued,
      pointsRedeemed,
      rewardsRedeemed: redemptions.length,
      averageOrderValue: totalOrders > 0 ? revenue / totalOrders : 0,
      retentionRate: allActiveCustomers.length > 0 ? (returningCustomers / allActiveCustomers.length) * 100 : 0
    };
  };

  const getComparison = (
    data: MonthlyMetrics[] | YearlyMetrics[],
    key: string
  ): ComparisonMetrics => {
    if (data.length < 2) {
      return { current: 0, previous: 0, change: 0, changePercent: 0, trend: 'neutral' };
    }

    const current = Number(data[data.length - 1][key as keyof typeof data[0]]);
    const previous = Number(data[data.length - 2][key as keyof typeof data[0]]);
    const change = current - previous;
    const changePercent = previous !== 0 ? (change / previous) * 100 : 0;
    const trend = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';

    return { current, previous, change, changePercent, trend };
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(Math.round(value));
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  const MetricCard: React.FC<{
    title: string;
    icon: React.ElementType;
    comparison: ComparisonMetrics;
    format: 'currency' | 'number' | 'percent';
    iconColor: string;
  }> = ({ title, icon: Icon, comparison, format, iconColor }) => {
    const formattedCurrent =
      format === 'currency' ? formatCurrency(comparison.current) :
      format === 'percent' ? `${comparison.current.toFixed(1)}%` :
      formatNumber(comparison.current);

    const TrendIcon = comparison.trend === 'up' ? ArrowUpRight : comparison.trend === 'down' ? ArrowDownRight : Minus;
    const trendColor = comparison.trend === 'up' ? 'text-emerald-600' : comparison.trend === 'down' ? 'text-red-600' : 'text-gray-500';
    const bgColor = comparison.trend === 'up' ? 'bg-emerald-50' : comparison.trend === 'down' ? 'bg-red-50' : 'bg-gray-50';

    return (
      <div className="bg-white rounded-xl p-5 border border-gray-100 hover:border-gray-200 transition-all">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-10 h-10 ${iconColor} rounded-lg flex items-center justify-center shadow-sm`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${trendColor} ${bgColor}`}>
            <TrendIcon className="h-3 w-3" />
            {formatPercent(comparison.changePercent)}
          </div>
        </div>
        <h3 className="text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">{title}</h3>
        <p className="text-2xl font-bold text-gray-900 mb-1">{formattedCurrent}</p>
        <p className="text-xs text-gray-400">
          Previous {viewMode === 'monthly' ? 'month' : 'year'}: {format === 'currency' ? formatCurrency(comparison.previous) : formatNumber(comparison.previous)}
        </p>
      </div>
    );
  };

  if (loading) {
    return (
      <>
        <LoadingBar isLoading={loading} />
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-64"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="h-36 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load Analytics</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => viewMode === 'monthly' ? fetchMonthlyAnalytics() : fetchYearlyAnalytics()}
            className="px-6 py-3 bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] text-white rounded-lg hover:shadow-lg transition-all flex items-center gap-2 mx-auto"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const currentData = viewMode === 'monthly' ? monthlyData : yearlyData;
  const customerComparison = getComparison(currentData, 'customerCount');
  const revenueComparison = getComparison(currentData, 'revenue');
  const pointsIssuedComparison = getComparison(currentData, 'pointsIssued');
  const pointsRedeemedComparison = getComparison(currentData, 'pointsRedeemed');
  const rewardsComparison = getComparison(currentData, 'rewardsRedeemed');
  const aovComparison = getComparison(currentData, 'averageOrderValue');
  const retentionComparison = getComparison(currentData, 'retentionRate');

  return (
    <>
      <LoadingBar isLoading={loading} />
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
            <p className="text-sm text-gray-500 mt-1">Performance metrics and growth insights</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('monthly')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                  viewMode === 'monthly'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setViewMode('yearly')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                  viewMode === 'yearly'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Yearly
              </button>
            </div>
            {viewMode === 'monthly' && (
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as any)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#E85A9B] focus:border-transparent"
              >
                <option value="6m">6 Months</option>
                <option value="12m">12 Months</option>
                <option value="all">All Time</option>
              </select>
            )}
            <button
              onClick={() => viewMode === 'monthly' ? fetchMonthlyAnalytics() : fetchYearlyAnalytics()}
              className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Customers"
            icon={Users}
            comparison={customerComparison}
            format="number"
            iconColor="bg-gradient-to-br from-blue-500 to-blue-600"
          />
          <MetricCard
            title="Revenue"
            icon={DollarSign}
            comparison={revenueComparison}
            format="currency"
            iconColor="bg-gradient-to-br from-emerald-500 to-emerald-600"
          />
          <MetricCard
            title="Points Issued"
            icon={TrendingUp}
            comparison={pointsIssuedComparison}
            format="number"
            iconColor="bg-gradient-to-br from-[#E6A85C] to-[#E85A9B]"
          />
          <MetricCard
            title="Rewards Redeemed"
            icon={Gift}
            comparison={rewardsComparison}
            format="number"
            iconColor="bg-gradient-to-br from-[#E85A9B] to-[#D946EF]"
          />
          <MetricCard
            title="Points Redeemed"
            icon={Target}
            comparison={pointsRedeemedComparison}
            format="number"
            iconColor="bg-gradient-to-br from-amber-500 to-orange-600"
          />
          <MetricCard
            title="Avg Order Value"
            icon={BarChart3}
            comparison={aovComparison}
            format="currency"
            iconColor="bg-gradient-to-br from-teal-500 to-cyan-600"
          />
          <MetricCard
            title="Retention Rate"
            icon={Users}
            comparison={retentionComparison}
            format="percent"
            iconColor="bg-gradient-to-br from-violet-500 to-purple-600"
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-5 border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Customer Growth</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={currentData}>
                  <defs>
                    <linearGradient id="colorCustomers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis
                    dataKey={viewMode === 'monthly' ? 'month' : 'year'}
                    tick={{ fontSize: 11, fill: '#9CA3AF' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="customerCount"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorCustomers)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Revenue Trend</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={currentData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis
                    dataKey={viewMode === 'monthly' ? 'month' : 'year'}
                    tick={{ fontSize: 11, fill: '#9CA3AF' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#9CA3AF' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                    formatter={(value: any) => formatCurrency(value)}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10B981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Points Activity</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={currentData} barGap={8}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis
                  dataKey={viewMode === 'monthly' ? 'month' : 'year'}
                  tick={{ fontSize: 11, fill: '#9CA3AF' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Bar dataKey="pointsIssued" fill="#E6A85C" name="Issued" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pointsRedeemed" fill="#E85A9B" name="Redeemed" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {viewMode === 'monthly' && (
          <div className="bg-white rounded-xl p-5 border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">New vs Returning Customers</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} barGap={8}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: '#9CA3AF' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                  />
                  <Bar dataKey="newCustomers" fill="#3B82F6" name="New" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="returningCustomers" fill="#8B5CF6" name="Returning" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default AnalyticsDashboard;
