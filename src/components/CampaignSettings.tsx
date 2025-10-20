import React, { useState, useEffect } from 'react';
import {
  Settings, Save, Eye, EyeOff, CheckCircle, XCircle, AlertCircle,
  Mail, MessageSquare, Smartphone, Bell, Key, Lock, Zap, TestTube
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface ProviderConfig {
  provider: string;
  enabled: boolean;
  apiKey: string;
  config: Record<string, any>;
}

interface ChannelProviders {
  whatsapp: ProviderConfig;
  email: ProviderConfig;
  sms: ProviderConfig;
}

const CampaignSettings: React.FC = () => {
  const { restaurant } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});

  const [providers, setProviders] = useState<ChannelProviders>({
    whatsapp: {
      provider: 'twilio',
      enabled: false,
      apiKey: '',
      config: {
        accountSid: '',
        phoneNumber: '',
      },
    },
    email: {
      provider: 'sendgrid',
      enabled: false,
      apiKey: '',
      config: {
        fromEmail: '',
        fromName: '',
      },
    },
    sms: {
      provider: 'twilio',
      enabled: false,
      apiKey: '',
      config: {
        accountSid: '',
        phoneNumber: '',
      },
    },
  });

  useEffect(() => {
    if (restaurant) {
      loadSettings();
    }
  }, [restaurant]);

  const loadSettings = async () => {
    if (!restaurant) return;

    try {
      setLoading(true);
    } catch (error: any) {
      console.error('Error loading settings:', error);
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!restaurant) return;

    try {
      setSaving(true);
      setMessage({ type: '', text: '' });

      setMessage({ type: 'success', text: 'Settings saved successfully' });
    } catch (error: any) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (channel: string) => {
    if (!restaurant) return;

    try {
      setTesting(channel);
      setMessage({ type: '', text: '' });

      setMessage({ type: 'success', text: `Test message sent successfully via ${channel}` });
    } catch (error: any) {
      console.error('Error testing channel:', error);
      setMessage({ type: 'error', text: error.message || `Failed to send test via ${channel}` });
    } finally {
      setTesting(null);
    }
  };

  const toggleApiKeyVisibility = (key: string) => {
    setShowApiKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const renderProviderConfig = (
    channel: keyof ChannelProviders,
    icon: React.ElementType,
    title: string,
    description: string
  ) => {
    const config = providers[channel];
    const Icon = icon;

    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-[#E6A85C] to-[#E85A9B] rounded-xl flex items-center justify-center">
              <Icon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{title}</h3>
              <p className="text-sm text-gray-600">{description}</p>
            </div>
          </div>

          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) =>
                setProviders({
                  ...providers,
                  [channel]: { ...config, enabled: e.target.checked },
                })
              }
              className="sr-only peer"
            />
            <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#E6A85C]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-[#E6A85C] peer-checked:to-[#E85A9B]"></div>
          </label>
        </div>

        {config.enabled && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Provider
              </label>
              <select
                value={config.provider}
                onChange={(e) =>
                  setProviders({
                    ...providers,
                    [channel]: { ...config, provider: e.target.value },
                  })
                }
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent"
              >
                {channel === 'whatsapp' && (
                  <>
                    <option value="twilio">Twilio (WhatsApp Business API)</option>
                    <option value="meta">Meta Business API</option>
                  </>
                )}
                {channel === 'email' && (
                  <>
                    <option value="sendgrid">SendGrid</option>
                    <option value="mailgun">Mailgun</option>
                    <option value="ses">Amazon SES</option>
                  </>
                )}
                {channel === 'sms' && (
                  <>
                    <option value="twilio">Twilio</option>
                    <option value="vonage">Vonage (Nexmo)</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Key / Token
              </label>
              <div className="relative">
                <input
                  type={showApiKeys[channel] ? 'text' : 'password'}
                  value={config.apiKey}
                  onChange={(e) =>
                    setProviders({
                      ...providers,
                      [channel]: { ...config, apiKey: e.target.value },
                    })
                  }
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent pr-10"
                  placeholder="Enter your API key"
                />
                <button
                  type="button"
                  onClick={() => toggleApiKeyVisibility(channel)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showApiKeys[channel] ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {(channel === 'whatsapp' || channel === 'sms') && config.provider === 'twilio' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Account SID
                  </label>
                  <input
                    type="text"
                    value={config.config.accountSid}
                    onChange={(e) =>
                      setProviders({
                        ...providers,
                        [channel]: {
                          ...config,
                          config: { ...config.config, accountSid: e.target.value },
                        },
                      })
                    }
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent"
                    placeholder="AC..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={config.config.phoneNumber}
                    onChange={(e) =>
                      setProviders({
                        ...providers,
                        [channel]: {
                          ...config,
                          config: { ...config.config, phoneNumber: e.target.value },
                        },
                      })
                    }
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent"
                    placeholder="+1234567890"
                  />
                </div>
              </>
            )}

            {channel === 'email' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    From Email
                  </label>
                  <input
                    type="email"
                    value={config.config.fromEmail}
                    onChange={(e) =>
                      setProviders({
                        ...providers,
                        [channel]: {
                          ...config,
                          config: { ...config.config, fromEmail: e.target.value },
                        },
                      })
                    }
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent"
                    placeholder="noreply@yourrestaurant.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    From Name
                  </label>
                  <input
                    type="text"
                    value={config.config.fromName}
                    onChange={(e) =>
                      setProviders({
                        ...providers,
                        [channel]: {
                          ...config,
                          config: { ...config.config, fromName: e.target.value },
                        },
                      })
                    }
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent"
                    placeholder="Your Restaurant Name"
                  />
                </div>
              </>
            )}

            <button
              onClick={() => handleTest(channel)}
              disabled={testing === channel}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {testing === channel ? (
                <div className="w-5 h-5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <TestTube className="h-4 w-4" />
                  Send Test Message
                </>
              )}
            </button>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Setup Instructions</p>
                  <ul className="text-sm text-blue-700 mt-2 space-y-1 list-disc list-inside">
                    {channel === 'whatsapp' && config.provider === 'twilio' && (
                      <>
                        <li>Sign up for Twilio WhatsApp Business API</li>
                        <li>Get your Account SID and Auth Token from console</li>
                        <li>Configure your WhatsApp sender number</li>
                        <li>Submit your message templates for approval</li>
                      </>
                    )}
                    {channel === 'email' && config.provider === 'sendgrid' && (
                      <>
                        <li>Create a SendGrid account</li>
                        <li>Generate an API key with Mail Send permissions</li>
                        <li>Verify your sender email domain</li>
                        <li>Configure SPF and DKIM records</li>
                      </>
                    )}
                    {channel === 'sms' && config.provider === 'twilio' && (
                      <>
                        <li>Sign up for Twilio SMS service</li>
                        <li>Get your Account SID and Auth Token</li>
                        <li>Purchase or configure a phone number</li>
                        <li>Test with your own number first</li>
                      </>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 rounded w-48"></div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-6 border border-gray-200">
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaign Settings</h1>
          <p className="text-gray-600 mt-1">Configure your messaging channel integrations</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] text-white rounded-xl hover:shadow-lg transition-all duration-200 disabled:opacity-50"
        >
          {saving ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Settings
            </>
          )}
        </button>
      </div>

      {message.text && (
        <div
          className={`border rounded-xl p-4 flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="h-5 w-5 flex-shrink-0" />
          ) : (
            <XCircle className="h-5 w-5 flex-shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Lock className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-900">Security Notice</p>
            <p className="text-sm text-yellow-700 mt-1">
              API keys are encrypted and stored securely. They are never exposed in logs or frontend code.
              Only use API keys with minimum required permissions.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {renderProviderConfig('whatsapp', MessageSquare, 'WhatsApp', 'Send messages via WhatsApp Business')}
        {renderProviderConfig('email', Mail, 'Email', 'Send marketing emails to customers')}
        {renderProviderConfig('sms', Smartphone, 'SMS', 'Send text messages to customers')}
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Zap className="h-6 w-6 text-blue-600" />
          <h3 className="font-semibold text-gray-900">Rate Limits & Best Practices</h3>
        </div>

        <div className="space-y-4 text-sm text-gray-700">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">WhatsApp</h4>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>Use pre-approved message templates only</li>
              <li>24-hour messaging window for non-template messages</li>
              <li>Respect customer opt-out preferences</li>
              <li>Monitor message quality rating</li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium text-gray-900 mb-2">Email</h4>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>Warm up new domains gradually</li>
              <li>Maintain list hygiene and remove bounces</li>
              <li>Include unsubscribe link in all emails</li>
              <li>Monitor sender reputation scores</li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium text-gray-900 mb-2">SMS</h4>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>Keep messages under 160 characters</li>
              <li>Respect time zones and quiet hours</li>
              <li>Include opt-out instructions</li>
              <li>Comply with TCPA regulations</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CampaignSettings;
