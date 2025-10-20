import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Headphones, Shield, User, Mail, Lock, Eye, EyeOff,
  AlertCircle, Loader2, Crown, Star, Building, Users,
  MessageSquare, Coffee, Monitor, Zap, CheckCircle
} from 'lucide-react';
import { useSupportAuth } from '../contexts/SupportAuthContext';


const SupportPortalLogin: React.FC = () => {
  const [credentials, setCredentials] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { signIn, agent } = useSupportAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (agent) {
      navigate('/support-portal');
    }
  }, [agent, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!credentials.email || !credentials.password) {
        setError('Please fill in all fields');
        return;
      }

      const result = await signIn(credentials.email, credentials.password);
      
      if (!result.error) {
        navigate('/support-portal');
      } else {
        setError(result.error);
      }
    } catch (error: any) {
      setError(error.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Professional Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl mb-6 shadow-2xl">
            <Headphones className="h-12 w-12 text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-800 bg-clip-text text-transparent font-['Space_Grotesk'] mb-2">
            VOYA Support Portal
          </h1>
          <p className="text-gray-600 text-lg">
            Professional customer support platform
          </p>
          <div className="flex items-center justify-center gap-6 mt-4 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <MessageSquare className="h-4 w-4" />
              <span>Real-time Chat</span>
            </div>
            <div className="flex items-center gap-1">
              <Building className="h-4 w-4" />
              <span>Multi-Restaurant</span>
            </div>
            <div className="flex items-center gap-1">
              <Shield className="h-4 w-4" />
              <span>Secure</span>
            </div>
          </div>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-8">
          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-3">
                <AlertCircle className="h-5 w-5" />
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  value={credentials.email}
                  onChange={(e) => setCredentials({ ...credentials, email: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                  placeholder="Enter your email address"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={credentials.password}
                  onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                  className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium py-3 px-6 rounded-xl hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Headphones className="h-4 w-4" />
                  Access Support Portal
                </>
              )}
            </button>
          </form>

          {/* Features Preview */}
          <div className="mt-6 grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <MessageSquare className="h-6 w-6 text-gray-600 mx-auto mb-1" />
              <p className="text-xs font-medium text-gray-900">Real-Time</p>
              <p className="text-xs text-gray-600">Messaging</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <Users className="h-6 w-6 text-gray-600 mx-auto mb-1" />
              <p className="text-xs font-medium text-gray-900">Multi-User</p>
              <p className="text-xs text-gray-600">Support</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <Building className="h-6 w-6 text-gray-600 mx-auto mb-1" />
              <p className="text-xs font-medium text-gray-900">All</p>
              <p className="text-xs text-gray-600">Restaurants</p>
            </div>
          </div>

          {/* Contact Super Admin */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="text-center">
              <Shield className="h-6 w-6 text-blue-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-blue-900 mb-1">Need Access?</p>
              <p className="text-xs text-blue-700">
                Contact your super admin to create your support agent account
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-xs text-gray-500">
            © 2025 VOYA Support Portal. Professional customer support platform.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SupportPortalLogin;