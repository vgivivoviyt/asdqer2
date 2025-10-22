import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, ArrowRight, Check, Users, MessageSquare, Gift,
  Calendar, Eye, Send, AlertCircle, Mail, Smartphone, Bell,
  Target, Tag, Clock, Filter, Percent, DollarSign, Save, X, Copy
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { CampaignService } from '../services/campaignService';
import { CustomerService } from '../services/customerService';
import { RewardService } from '../services/rewardService';

type Step = 'basic' | 'audience' | 'message' | 'offer' | 'schedule' | 'preview';

interface CampaignFormData {
  name: string;
  description: string;
  type: 'one_time' | 'scheduled' | 'recurring';
  status: 'draft' | 'scheduled' | 'sending';
  primary_channel: 'whatsapp' | 'email' | 'sms' | 'push';
  fallback_channel?: 'whatsapp' | 'email' | 'sms' | 'push';
  audience_type: 'all' | 'tagged' | 'last_order_date' | 'wallet_status';
  audience_filter: any;
  estimated_audience_size: number;
  message_subject?: string;
  message_template: string;
  message_variables: Record<string, any>;
  promo_code?: string;
  promo_discount_type?: 'percentage' | 'fixed_amount';
  promo_discount_value?: number;
  promo_min_spend?: number;
  promo_max_uses?: number;
  promo_valid_days?: number;
  scheduled_at?: string;
  recurring_config?: any;
}

const STORAGE_KEY = 'campaign_wizard_draft';

const CampaignWizard: React.FC = () => {
  const { campaignId } = useParams();
  const navigate = useNavigate();
  const { restaurant } = useAuth();
  const [currentStep, setCurrentStep] = useState<Step>('basic');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [estimatedAudience, setEstimatedAudience] = useState(0);
  const [availableTags, setAvailableTags] = useState<any[]>([]);
  const [includePromo, setIncludePromo] = useState(false);

  const [formData, setFormData] = useState<CampaignFormData>(() => {
    // Try to restore from localStorage
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && !campaignId) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved campaign:', e);
      }
    }
    return {
      name: '',
      description: '',
      type: 'one_time',
      status: 'draft',
      primary_channel: 'whatsapp',
      audience_type: 'all',
      audience_filter: {},
      estimated_audience_size: 0,
      message_template: '',
      message_variables: {},
    };
  });

  const steps: { id: Step; label: string; icon: any }[] = [
    { id: 'basic', label: 'Basic Info', icon: Target },
    { id: 'audience', label: 'Audience', icon: Users },
    { id: 'message', label: 'Message', icon: MessageSquare },
    { id: 'offer', label: 'Offer', icon: Gift },
    { id: 'schedule', label: 'Schedule', icon: Calendar },
    { id: 'preview', label: 'Preview', icon: Eye },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  // Save to localStorage on every form change
  useEffect(() => {
    if (!campaignId) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
    }
  }, [formData, campaignId]);

  useEffect(() => {
    if (restaurant) {
      loadData();
    }
  }, [restaurant]);

  useEffect(() => {
    if (formData.audience_type || formData.audience_filter) {
      calculateAudience();
    }
  }, [formData.audience_type, formData.audience_filter]);

  const loadData = async () => {
    if (!restaurant) return;

    try {
      const tags = await CampaignService.getAllTags(restaurant.id);
      setAvailableTags(tags);
    } catch (error: any) {
      console.error('Error loading data:', error);
    }
  };

  const calculateAudience = async () => {
    if (!restaurant) return;

    try {
      const size = await CampaignService.calculateAudienceSize(
        restaurant.id,
        formData.audience_type,
        formData.audience_filter
      );
      setEstimatedAudience(size);
      setFormData(prev => ({ ...prev, estimated_audience_size: size }));
    } catch (error: any) {
      console.error('Error calculating audience:', error);
      setEstimatedAudience(0);
    }
  };

  const validateStep = (): boolean => {
    setError('');

    switch (currentStep) {
      case 'basic':
        if (!formData.name.trim()) {
          setError('Campaign name is required');
          return false;
        }
        break;
      case 'audience':
        if (estimatedAudience === 0) {
          setError('No customers match the selected criteria. Please adjust your filters or add customers first.');
          return false;
        }
        break;
      case 'message':
        if (!formData.message_template.trim()) {
          setError('Message template is required');
          return false;
        }
        if (formData.primary_channel === 'email' && !formData.message_subject) {
          setError('Email subject is required');
          return false;
        }
        break;
      case 'schedule':
        if (formData.type === 'scheduled' && !formData.scheduled_at) {
          setError('Schedule date and time is required');
          return false;
        }
        break;
    }

    return true;
  };

  const handleNext = () => {
    if (!validateStep()) return;

    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex].id);
    }
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex].id);
    }
  };

  const handleSaveDraft = async () => {
    if (!restaurant) return;

    try {
      setLoading(true);
      setError('');

      const campaignData = {
        ...formData,
        status: 'draft' as const,
      };

      if (campaignId) {
        await CampaignService.updateCampaign(restaurant.id, campaignId, campaignData);
      } else {
        await CampaignService.createCampaign(restaurant.id, campaignData);
      }

      localStorage.removeItem(STORAGE_KEY);
      navigate('/dashboard/campaigns');
    } catch (error: any) {
      setError(error.message || 'Failed to save campaign');
    } finally {
      setLoading(false);
    }
  };

  const handleSchedule = async () => {
    if (!validateStep()) return;
    if (!restaurant) return;

    try {
      setLoading(true);
      setError('');

      const campaignData = {
        ...formData,
        status: formData.type === 'one_time' ? 'sending' as const : 'scheduled' as const,
      };

      const campaign = campaignId
        ? await CampaignService.updateCampaign(restaurant.id, campaignId, campaignData)
        : await CampaignService.createCampaign(restaurant.id, campaignData);

      if (includePromo && formData.promo_code) {
        await CampaignService.createPromoCode({
          campaign_id: campaign.id,
          restaurant_id: restaurant.id,
          code: formData.promo_code,
          discount_type: formData.promo_discount_type || 'percentage',
          discount_value: formData.promo_discount_value || 0,
          min_spend: formData.promo_min_spend || 0,
          max_uses: formData.promo_max_uses,
          max_uses_per_customer: 1,
          order_type: 'all',
          valid_from: new Date().toISOString(),
          valid_until: new Date(Date.now() + (formData.promo_valid_days || 30) * 24 * 60 * 60 * 1000).toISOString(),
        });
      }

      localStorage.removeItem(STORAGE_KEY);
      navigate('/dashboard/campaigns');
    } catch (error: any) {
      setError(error.message || 'Failed to schedule campaign');
    } finally {
      setLoading(false);
    }
  };

  const insertVariable = (variable: string) => {
    const template = formData.message_template;
    setFormData({ ...formData, message_template: template + `{{${variable}}}` });
  };

  const renderBasicInfo = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Campaign Name *
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent"
          placeholder="e.g., Weekend Special Promotion"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Description
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent"
          placeholder="Brief description of your campaign"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Campaign Type
          </label>
          <select
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent"
          >
            <option value="one_time">Send Now</option>
            <option value="scheduled">Schedule for Later</option>
            <option value="recurring">Recurring</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Primary Channel
          </label>
          <select
            value={formData.primary_channel}
            onChange={(e) => setFormData({ ...formData, primary_channel: e.target.value as any })}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent"
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
            <option value="sms">SMS</option>
            <option value="push">Push Notification</option>
          </select>
        </div>
      </div>
    </div>
  );

  const renderAudienceSelection = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Select Audience
        </label>
        <div className="space-y-3">
          <label className="flex items-start p-4 border-2 border-gray-200 rounded-xl cursor-pointer hover:border-[#E6A85C] transition-colors">
            <input
              type="radio"
              name="audience"
              checked={formData.audience_type === 'all'}
              onChange={() => setFormData({ ...formData, audience_type: 'all', audience_filter: {} })}
              className="mt-1 mr-3"
            />
            <div>
              <p className="font-medium text-gray-900">All Customers</p>
              <p className="text-sm text-gray-500">Send to everyone in your customer base</p>
            </div>
          </label>

          <label className="flex items-start p-4 border-2 border-gray-200 rounded-xl cursor-pointer hover:border-[#E6A85C] transition-colors">
            <input
              type="radio"
              name="audience"
              checked={formData.audience_type === 'last_order_date'}
              onChange={() => setFormData({ ...formData, audience_type: 'last_order_date', audience_filter: { days_since_last_order: 30 } })}
              className="mt-1 mr-3"
            />
            <div className="flex-1">
              <p className="font-medium text-gray-900">Inactive Customers</p>
              <p className="text-sm text-gray-500">Customers who haven't ordered recently</p>
              {formData.audience_type === 'last_order_date' && (
                <div className="mt-3">
                  <input
                    type="number"
                    value={formData.audience_filter.days_since_last_order || 30}
                    onChange={(e) => setFormData({
                      ...formData,
                      audience_filter: { days_since_last_order: parseInt(e.target.value) }
                    })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                    placeholder="Days since last order"
                    min="1"
                  />
                </div>
              )}
            </div>
          </label>

          <label className="flex items-start p-4 border-2 border-gray-200 rounded-xl cursor-pointer hover:border-[#E6A85C] transition-colors">
            <input
              type="radio"
              name="audience"
              checked={formData.audience_type === 'wallet_status'}
              onChange={() => setFormData({ ...formData, audience_type: 'wallet_status', audience_filter: { min_points: 0 } })}
              className="mt-1 mr-3"
            />
            <div className="flex-1">
              <p className="font-medium text-gray-900">By Wallet Balance</p>
              <p className="text-sm text-gray-500">Target based on loyalty points</p>
              {formData.audience_type === 'wallet_status' && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    value={formData.audience_filter.min_points || 0}
                    onChange={(e) => setFormData({
                      ...formData,
                      audience_filter: { ...formData.audience_filter, min_points: parseInt(e.target.value) }
                    })}
                    className="px-3 py-2 border border-gray-200 rounded-lg"
                    placeholder="Min points"
                    min="0"
                  />
                  <input
                    type="number"
                    value={formData.audience_filter.max_points || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      audience_filter: { ...formData.audience_filter, max_points: e.target.value ? parseInt(e.target.value) : undefined }
                    })}
                    className="px-3 py-2 border border-gray-200 rounded-lg"
                    placeholder="Max points (optional)"
                    min="0"
                  />
                </div>
              )}
            </div>
          </label>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-blue-600" />
          <div>
            <p className="text-sm font-medium text-blue-900">Estimated Audience</p>
            <p className="text-2xl font-bold text-blue-600">{estimatedAudience.toLocaleString()} customers</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderMessageComposer = () => (
    <div className="space-y-6">
      {formData.primary_channel === 'email' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email Subject *
          </label>
          <input
            type="text"
            value={formData.message_subject || ''}
            onChange={(e) => setFormData({ ...formData, message_subject: e.target.value })}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent"
            placeholder="e.g., Special Offer Just for You!"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Message Template *
        </label>
        <textarea
          value={formData.message_template}
          onChange={(e) => setFormData({ ...formData, message_template: e.target.value })}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent font-mono text-sm"
          placeholder="Write your message here..."
          rows={8}
        />
        <div className="mt-2">
          <p className="text-xs text-gray-600 mb-2">Insert variables:</p>
          <div className="flex flex-wrap gap-2">
            {['name', 'points', 'restaurant_name', 'promo_code'].map(variable => (
              <button
                key={variable}
                type="button"
                onClick={() => insertVariable(variable)}
                className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg border border-gray-300 flex items-center gap-1"
              >
                <Copy className="h-3 w-3" />
                {variable}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <h4 className="font-medium text-gray-900 mb-3">Preview</h4>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          {formData.primary_channel === 'email' && formData.message_subject && (
            <p className="font-semibold text-gray-900 mb-2">{formData.message_subject}</p>
          )}
          <p className="text-gray-700 whitespace-pre-wrap">
            {formData.message_template
              .replace(/\{\{name\}\}/g, 'John Doe')
              .replace(/\{\{points\}\}/g, '250')
              .replace(/\{\{restaurant_name\}\}/g, restaurant?.name || 'Your Restaurant')
              .replace(/\{\{promo_code\}\}/g, formData.promo_code || 'SAVE20')
            }
          </p>
        </div>
      </div>
    </div>
  );

  const renderOfferConfiguration = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
        <input
          type="checkbox"
          id="include_promo"
          checked={includePromo}
          onChange={(e) => setIncludePromo(e.target.checked)}
          className="w-5 h-5 text-[#E6A85C] border-gray-300 rounded focus:ring-[#E6A85C]"
        />
        <label htmlFor="include_promo" className="text-sm font-medium text-gray-700 cursor-pointer">
          Include a promo code with this campaign
        </label>
      </div>

      {includePromo ? (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Promo Code *
            </label>
            <input
              type="text"
              value={formData.promo_code || ''}
              onChange={(e) => setFormData({ ...formData, promo_code: e.target.value.toUpperCase() })}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent uppercase"
              placeholder="SAVE20"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Discount Type
              </label>
              <select
                value={formData.promo_discount_type || 'percentage'}
                onChange={(e) => setFormData({ ...formData, promo_discount_type: e.target.value as any })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent"
              >
                <option value="percentage">Percentage</option>
                <option value="fixed_amount">Fixed Amount</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Discount Value
              </label>
              <input
                type="number"
                value={formData.promo_discount_value || 10}
                onChange={(e) => setFormData({ ...formData, promo_discount_value: parseFloat(e.target.value) })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent"
                min="0"
                step={formData.promo_discount_type === 'percentage' ? '1' : '0.01'}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minimum Spend (AED)
              </label>
              <input
                type="number"
                value={formData.promo_min_spend || 0}
                onChange={(e) => setFormData({ ...formData, promo_min_spend: parseFloat(e.target.value) })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent"
                min="0"
                step="0.01"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Valid for (Days)
              </label>
              <input
                type="number"
                value={formData.promo_valid_days || 30}
                onChange={(e) => setFormData({ ...formData, promo_valid_days: parseInt(e.target.value) })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent"
                min="1"
              />
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
          <Gift className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No promo code for this campaign</p>
          <p className="text-sm text-gray-500 mt-1">Check the box above to add one</p>
        </div>
      )}
    </div>
  );

  const renderScheduleConfiguration = () => (
    <div className="space-y-6">
      {formData.type === 'one_time' ? (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
          <Send className="h-12 w-12 text-blue-600 mx-auto mb-3" />
          <h3 className="font-semibold text-blue-900 mb-2">Send Immediately</h3>
          <p className="text-sm text-blue-700">
            This campaign will be queued for sending as soon as you confirm in the next step
          </p>
        </div>
      ) : formData.type === 'scheduled' ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Schedule Date & Time *
          </label>
          <input
            type="datetime-local"
            value={formData.scheduled_at || ''}
            onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent"
            min={new Date().toISOString().slice(0, 16)}
          />
          <p className="text-xs text-gray-500 mt-2">
            Campaign will be sent at the specified date and time
          </p>
        </div>
      ) : null}

      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-900">Channel Configuration Required</p>
            <p className="text-sm text-yellow-700 mt-1">
              Make sure you've configured your {formData.primary_channel} provider settings in Channel Settings before sending.
              Campaigns will only be sent to customers who have consented to receive messages.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPreview = () => (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Campaign Summary</h3>

        <div className="space-y-3">
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-600">Name:</span>
            <span className="font-medium text-gray-900">{formData.name}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-600">Type:</span>
            <span className="font-medium text-gray-900 capitalize">{formData.type.replace('_', ' ')}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-600">Channel:</span>
            <span className="font-medium text-gray-900 capitalize">{formData.primary_channel}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-600">Audience:</span>
            <span className="font-medium text-gray-900">{estimatedAudience} customers</span>
          </div>
          {includePromo && formData.promo_code && (
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Promo Code:</span>
              <span className="font-medium text-gray-900">{formData.promo_code}</span>
            </div>
          )}
          {formData.scheduled_at && (
            <div className="flex justify-between py-2">
              <span className="text-gray-600">Scheduled:</span>
              <span className="font-medium text-gray-900">
                {new Date(formData.scheduled_at).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Message Preview</h3>
        {formData.message_subject && (
          <p className="font-medium text-gray-900 mb-2">{formData.message_subject}</p>
        )}
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-gray-700 whitespace-pre-wrap">
            {formData.message_template
              .replace(/\{\{name\}\}/g, 'John Doe')
              .replace(/\{\{points\}\}/g, '250')
              .replace(/\{\{restaurant_name\}\}/g, restaurant?.name || 'Your Restaurant')
              .replace(/\{\{promo_code\}\}/g, formData.promo_code || 'SAVE20')
            }
          </p>
        </div>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-green-900">Ready to Send</p>
            <p className="text-sm text-green-700 mt-1">
              Your campaign is configured and ready. Click "Schedule Campaign" to proceed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-6">
          <button
            onClick={() => {
              if (confirm('Are you sure? Any unsaved changes will be lost.')) {
                localStorage.removeItem(STORAGE_KEY);
                navigate('/dashboard/campaigns');
              }
            }}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Campaigns
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-8">
            {steps.map((step, index) => {
              const StepIcon = step.icon;
              const isCompleted = index < currentStepIndex;
              const isCurrent = index === currentStepIndex;

              return (
                <React.Fragment key={step.id}>
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-all ${
                        isCompleted
                          ? 'bg-green-500 text-white'
                          : isCurrent
                          ? 'bg-gradient-to-r from-[#E6A85C] to-[#E85A9B] text-white'
                          : 'bg-gray-200 text-gray-400'
                      }`}
                    >
                      {isCompleted ? <Check className="h-6 w-6" /> : <StepIcon className="h-6 w-6" />}
                    </div>
                    <span className={`text-xs font-medium ${isCurrent ? 'text-gray-900' : 'text-gray-500'}`}>
                      {step.label}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`flex-1 h-1 mx-2 transition-all ${
                        isCompleted ? 'bg-green-500' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="mb-8">
            {currentStep === 'basic' && renderBasicInfo()}
            {currentStep === 'audience' && renderAudienceSelection()}
            {currentStep === 'message' && renderMessageComposer()}
            {currentStep === 'offer' && renderOfferConfiguration()}
            {currentStep === 'schedule' && renderScheduleConfiguration()}
            {currentStep === 'preview' && renderPreview()}
          </div>

          <div className="flex items-center justify-between pt-6 border-t border-gray-200">
            <button
              onClick={handleSaveDraft}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              Save Draft
            </button>

            <div className="flex items-center gap-3">
              {currentStepIndex > 0 && (
                <button
                  onClick={handleBack}
                  className="flex items-center gap-2 px-6 py-3 text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
              )}

              {currentStepIndex < steps.length - 1 ? (
                <button
                  onClick={handleNext}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] text-white rounded-xl hover:shadow-lg transition-all duration-200"
                >
                  Next
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={handleSchedule}
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] text-white rounded-xl hover:shadow-lg transition-all duration-200 disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      {formData.type === 'one_time' ? 'Send Campaign' : 'Schedule Campaign'}
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CampaignWizard;
