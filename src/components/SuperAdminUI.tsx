import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Building, DollarSign, TrendingUp, BarChart3, MessageSquare, Settings, LogOut, RefreshCw, Search, Filter, Eye, MoreVertical, Crown, AlertCircle, CheckCircle, Clock, Star, ArrowRight, Send, X, Loader2, Plus, FileText, Download, Upload, Paperclip, Image, File, User, Shield, Zap, Target, Gift, Calendar, Phone, Mail, CreditCard as Edit3, Trash2, UserPlus, Key, Lock, EyeOff, Package } from 'lucide-react';
import { SupportService, SupportTicket, SupportMessage } from '../services/supportService';
import { SubscriptionService } from '../services/subscriptionService';
import { ChatService, SupportAgent } from '../services/chatService';
import StarterPackOrdersAdmin from './StarterPackOrdersAdmin';

const SuperAdminUI: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'agents' | 'subscriptions' | 'analytics' | 'starter-packs'>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Stats state
  const [systemStats, setSystemStats] = useState<any>(null);
  const [subscriptionStats, setSubscriptionStats] = useState<any>(null);

  // Support agents state
  const [supportAgents, setSupportAgents] = useState<SupportAgent[]>([]);
  const [showCreateAgentModal, setShowCreateAgentModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<SupportAgent | null>(null);
  const [agentFormData, setAgentFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [agentFormLoading, setAgentFormLoading] = useState(false);
  const [agentFormError, setAgentFormError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    // Check if user is authenticated as super admin
    const isAuthenticated = localStorage.getItem('super_admin_authenticated');
    const loginTime = localStorage.getItem('super_admin_login_time');
    
    if (!isAuthenticated || !loginTime) {
      navigate('/super-admin-login');
      return;
    }

    // Check if session is still valid (24 hours)
    const loginDate = new Date(loginTime);
    const now = new Date();
    const hoursSinceLogin = (now.getTime() - loginDate.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceLogin > 24) {
      localStorage.removeItem('super_admin_authenticated');
      localStorage.removeItem('super_admin_login_time');
      navigate('/super-admin-login');
      return;
    }

    loadDashboardData();
  }, [navigate]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      console.log('📊 Loading super admin dashboard data...');

      const [systemData, subscriptionData, agentsData] = await Promise.all([
        SubscriptionService.getSystemWideStats(),
        SubscriptionService.getSubscriptionStats(),
        ChatService.getSupportAgents()
      ]);

      setSystemStats(systemData);
      setSubscriptionStats(subscriptionData);
      setSupportAgents(agentsData);
      
      console.log('✅ Dashboard data loaded:', {
        systemStats: systemData,
        subscriptionStats: subscriptionData,
        supportAgents: agentsData.length
      });
    } catch (err: any) {
      console.error('❌ Error loading dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAgent = async () => {
    try {
      setAgentFormLoading(true);
      setAgentFormError('');

      // Validation
      if (!agentFormData.name.trim()) {
        setAgentFormError('Name is required');
        return;
      }

      if (!agentFormData.email.trim()) {
        setAgentFormError('Email is required');
        return;
      }

      if (!/\S+@\S+\.\S+/.test(agentFormData.email)) {
        setAgentFormError('Please enter a valid email address');
        return;
      }

      if (!agentFormData.password) {
        setAgentFormError('Password is required');
        return;
      }

      if (agentFormData.password.length < 8) {
        setAgentFormError('Password must be at least 8 characters');
        return;
      }

      if (agentFormData.password !== agentFormData.confirmPassword) {
        setAgentFormError('Passwords do not match');
        return;
      }

      // Check if email already exists
      const existingAgent = supportAgents.find(agent => agent.email === agentFormData.email);
      if (existingAgent) {
        setAgentFormError('An agent with this email already exists');
        return;
      }

      console.log('🔐 Creating support agent via Supabase Auth:', agentFormData.email);
      
      const newAgent = await ChatService.createSupportAgent({
        name: agentFormData.name,
        email: agentFormData.email,
        password: agentFormData.password
      });
      
      console.log('✅ Support agent created via Supabase Auth:', newAgent);

      // Refresh agents list
      const refreshAgents = async () => {
        const updatedAgents = await ChatService.getSupportAgents();
        setSupportAgents(updatedAgents);
        console.log('✅ Agents list refreshed, total agents:', updatedAgents.length);
      };
      
      // Immediate refresh
      await refreshAgents();
      
      // Also refresh after a delay to ensure all triggers have fired
      setTimeout(refreshAgents, 2000);

      // Reset form
      setAgentFormData({
        name: '',
        email: '',
        password: '',
        confirmPassword: ''
      });
      setShowCreateAgentModal(false);
      setShowPassword(false);
      setShowConfirmPassword(false);

    } catch (err: any) {
      console.error('Error creating support agent:', err);
      setAgentFormError(err.message || 'Failed to create support agent');
    } finally {
      setAgentFormLoading(false);
    }
  };

  const handleUpdateAgent = async (agentId: string, updates: any) => {
    try {
      console.log('🔄 Updating support agent:', agentId, updates);
      await ChatService.updateSupportAgent(agentId, updates);
      
      // Refresh agents list
      setTimeout(async () => {
        const updatedAgents = await ChatService.getSupportAgents();
        setSupportAgents(updatedAgents);
      }, 500);
    } catch (err: any) {
      console.error('Error updating support agent:', err);
      alert(err.message || 'Failed to update support agent');
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    if (!confirm('Are you sure you want to delete this support agent? This action cannot be undone.')) {
      return;
    }

    try {
      console.log('🗑️ Deleting support agent:', agentId);
      await ChatService.deleteSupportAgent(agentId);
      
      // Refresh agents list
      setTimeout(async () => {
        const updatedAgents = await ChatService.getSupportAgents();
        setSupportAgents(updatedAgents);
      }, 500);
    } catch (err: any) {
      console.error('Error deleting support agent:', err);
      alert(err.message || 'Failed to delete support agent');
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('super_admin_authenticated');
    localStorage.removeItem('super_admin_login_time');
    navigate('/super-admin-login');
  };

  const resetAgentForm = () => {
    setAgentFormData({
      name: '',
      email: '',
      password: '',
      confirmPassword: ''
    });
    setAgentFormError('');
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Super Admin Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-700 rounded-xl flex items-center justify-center">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Super Admin Dashboard</h1>
              <p className="text-sm text-gray-600">System-wide oversight and control</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={loadDashboardData}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw className="h-5 w-5" />
            </button>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <nav className="w-64 bg-white border-r border-gray-200 min-h-screen">
          <div className="p-4 space-y-2">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'agents', label: 'Support Agents', icon: Users },
              { id: 'subscriptions', label: 'Subscriptions', icon: Crown },
              { id: 'starter-packs', label: 'Starter Packs', icon: Package },
              { id: 'analytics', label: 'Analytics', icon: TrendingUp },
              { id: 'support', label: 'Support Portal', icon: MessageSquare, external: true }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (tab.external) {
                      window.open('/support-portal', '_blank');
                    } else {
                      setActiveTab(tab.id as any);
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    activeTab === tab.id && !tab.external
                      ? 'bg-red-100 text-red-700 font-medium'
                      : tab.external
                      ? 'text-blue-600 hover:bg-blue-50'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {tab.label}
                  {tab.external && (
                    <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                      External
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 flex items-center gap-3">
              <AlertCircle className="h-5 w-5" />
              {error}
            </div>
          )}

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">System Overview</h2>
              
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-2xl p-6 border border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Building className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Restaurants</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {systemStats?.totalRestaurants || 0}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                      <Users className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Customers</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {systemStats?.totalCustomers || 0}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                      <DollarSign className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Revenue</p>
                      <p className="text-2xl font-bold text-gray-900">
                        ${(systemStats?.totalRevenue || 0).toFixed(0)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                      <MessageSquare className="h-6 w-6 text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Support Agents</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {supportAgents.filter(a => a.is_active).length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Subscription Stats */}
              {subscriptionStats && (
                <div className="bg-white rounded-2xl p-6 border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Subscription Overview</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-xl">
                      <p className="text-2xl font-bold text-blue-600">{subscriptionStats.active}</p>
                      <p className="text-sm text-blue-700">Active Subscriptions</p>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-xl">
                      <p className="text-2xl font-bold text-green-600">{subscriptionStats.trial}</p>
                      <p className="text-sm text-green-700">Trial Users</p>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-xl">
                      <p className="text-2xl font-bold text-purple-600">{subscriptionStats.paid}</p>
                      <p className="text-sm text-purple-700">Paid Subscriptions</p>
                    </div>
                    <div className="text-center p-4 bg-yellow-50 rounded-xl">
                      <p className="text-2xl font-bold text-yellow-600">${subscriptionStats.revenue.toFixed(0)}</p>
                      <p className="text-sm text-yellow-700">Monthly Revenue</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Support Agents Tab */}
          {activeTab === 'agents' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Support Agents</h2>
                  <p className="text-gray-600">Manage support agents who can access the support portal</p>
                </div>
                <button
                  onClick={() => setShowCreateAgentModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <UserPlus className="h-4 w-4" />
                  Create Agent
                </button>
              </div>

              {/* Agents List */}
              {supportAgents.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 border border-gray-200 text-center">
                  <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Support Agents</h3>
                  <p className="text-gray-500 mb-6">Create your first support agent to start handling customer support</p>
                  <button
                    onClick={() => setShowCreateAgentModal(true)}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Create First Agent
                  </button>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Agent</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Email</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-700">Last Login</th>
                          <th className="text-right py-3 px-4 font-medium text-gray-700">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {supportAgents.map((agent) => (
                          <tr key={agent.id} className="hover:bg-gray-50">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                  <User className="h-4 w-4 text-blue-600" />
                                </div>
                                <span className="font-medium text-gray-900">{agent.name}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-gray-600">{agent.email}</td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                agent.is_active 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {agent.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-gray-600 text-sm">
                              {agent.last_login_at 
                                ? new Date(agent.last_login_at).toLocaleDateString()
                                : 'Never'
                              }
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center gap-2 justify-end">
                                <button
                                  onClick={() => handleUpdateAgent(agent.id, { is_active: !agent.is_active })}
                                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                                    agent.is_active
                                      ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                                  }`}
                                >
                                  {agent.is_active ? 'Deactivate' : 'Activate'}
                                </button>
                                <button
                                  onClick={() => handleDeleteAgent(agent.id)}
                                  className="p-2 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Subscriptions Tab */}
          {activeTab === 'subscriptions' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Subscription Management</h2>
              <div className="bg-white rounded-2xl p-6 border border-gray-200">
                <p className="text-gray-600">Subscription management features coming soon...</p>
              </div>
            </div>
          )}

          {/* Starter Packs Tab */}
          {activeTab === 'starter-packs' && (
            <StarterPackOrdersAdmin />
          )}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">System Analytics</h2>
              <div className="bg-white rounded-2xl p-6 border border-gray-200">
                <p className="text-gray-600">Advanced analytics features coming soon...</p>
              </div>
            </div>
          )}

          {/* Support Portal Link */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900">Support Portal</h3>
                <p className="text-blue-700 text-sm">Access the dedicated support chat system</p>
              </div>
              <button
                onClick={() => window.open('/support-portal', '_blank')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <MessageSquare className="h-4 w-4" />
                Open Portal
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* Create Agent Modal */}
      {showCreateAgentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900">Create Support Agent</h3>
              <button
                onClick={() => {
                  setShowCreateAgentModal(false);
                  resetAgentForm();
                }}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {agentFormError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-4">
                {agentFormError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={agentFormData.name}
                  onChange={(e) => setAgentFormData({ ...agentFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Sarah Johnson"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={agentFormData.email}
                  onChange={(e) => setAgentFormData({ ...agentFormData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="sarah@voya.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={agentFormData.password}
                    onChange={(e) => setAgentFormData({ ...agentFormData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                    placeholder="Create a secure password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password *
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={agentFormData.confirmPassword}
                    onChange={(e) => setAgentFormData({ ...agentFormData, confirmPassword: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                    placeholder="Confirm your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateAgentModal(false);
                  resetAgentForm();
                }}
                className="flex-1 py-3 px-4 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateAgent}
                disabled={agentFormLoading}
                className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {agentFormLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Create Agent
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminUI;