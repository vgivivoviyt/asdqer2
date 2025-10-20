import React, { useState, useEffect } from 'react';
import { Gift, Percent, Clock, Copy, CheckCircle, Tag } from 'lucide-react';
import { CampaignService, PromoCode } from '../services/campaignService';

interface ActivePromosCardProps {
  restaurantId: string;
  customerId: string;
}

const ActivePromosCard: React.FC<ActivePromosCardProps> = ({ restaurantId, customerId }) => {
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    loadPromos();
  }, [restaurantId, customerId]);

  const loadPromos = async () => {
    try {
      setLoading(true);
      const data = await CampaignService.getActivePromosForCustomer(restaurantId, customerId);
      setPromos(data);
    } catch (error) {
      console.error('Error loading promos:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const getDaysRemaining = (validUntil: string) => {
    const days = Math.ceil((new Date(validUntil).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-gray-200 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
        <div className="h-20 bg-gray-200 rounded"></div>
      </div>
    );
  }

  if (promos.length === 0) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] rounded-2xl p-6 shadow-lg">
      <div className="flex items-center gap-2 mb-4">
        <Gift className="h-5 w-5 text-white" />
        <h3 className="text-lg font-bold text-white">Active Offers</h3>
      </div>

      <div className="space-y-3">
        {promos.map((promo) => {
          const daysRemaining = getDaysRemaining(promo.valid_until);
          const isCopied = copiedCode === promo.code;

          return (
            <div
              key={promo.id}
              className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Tag className="h-4 w-4 text-white" />
                    <span className="font-bold text-xl text-white">{promo.code}</span>
                  </div>
                  <p className="text-sm text-white/90">
                    {promo.discount_type === 'percentage' ? (
                      <span className="flex items-center gap-1">
                        <Percent className="h-3 w-3" />
                        {promo.discount_value}% OFF
                      </span>
                    ) : (
                      <span>AED {promo.discount_value} OFF</span>
                    )}
                    {promo.min_spend > 0 && (
                      <span className="ml-2 text-xs text-white/70">
                        (Min spend: AED {promo.min_spend})
                      </span>
                    )}
                  </p>
                </div>

                <button
                  onClick={() => copyCode(promo.code)}
                  className="px-3 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors flex items-center gap-2"
                >
                  {isCopied ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-white" />
                      <span className="text-xs font-medium text-white">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 text-white" />
                      <span className="text-xs font-medium text-white">Copy</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between text-xs text-white/80">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>
                    {daysRemaining > 1
                      ? `${daysRemaining} days left`
                      : daysRemaining === 1
                      ? 'Expires tomorrow'
                      : 'Expires today'
                    }
                  </span>
                </div>

                {promo.max_uses && (
                  <span>
                    {promo.max_uses - promo.total_uses} uses remaining
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-white/70 mt-4 text-center">
        Apply these codes at checkout to redeem your offers
      </p>
    </div>
  );
};

export default ActivePromosCard;
