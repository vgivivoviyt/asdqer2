import React, { useState } from 'react';
import { X, MapPin, Phone, Building2, CheckCircle } from 'lucide-react';

interface AddressData {
  addressLine1: string;
  addressLine2: string;
  city: string;
  emirate: string;
  contactNumber: string;
}

interface AddressCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (address: AddressData) => void;
}

const UAE_EMIRATES = [
  'Abu Dhabi',
  'Dubai',
  'Sharjah',
  'Ajman',
  'Umm Al Quwain',
  'Ras Al Khaimah',
  'Fujairah'
];

export default function AddressCollectionModal({
  isOpen,
  onClose,
  onSubmit
}: AddressCollectionModalProps) {
  const [step, setStep] = useState(1);
  const [address, setAddress] = useState<AddressData>({
    addressLine1: '',
    addressLine2: '',
    city: '',
    emirate: '',
    contactNumber: ''
  });
  const [errors, setErrors] = useState<Partial<AddressData>>({});

  if (!isOpen) return null;

  const validateStep = (currentStep: number): boolean => {
    const newErrors: Partial<AddressData> = {};

    switch (currentStep) {
      case 1:
        if (!address.addressLine1.trim()) {
          newErrors.addressLine1 = 'Address is required';
        }
        break;
      case 2:
        if (!address.city.trim()) {
          newErrors.city = 'City is required';
        }
        break;
      case 3:
        if (!address.emirate) {
          newErrors.emirate = 'Emirate is required';
        }
        break;
      case 4:
        if (!address.contactNumber.trim()) {
          newErrors.contactNumber = 'Contact number is required';
        } else if (!/^(\+971|00971|0)?[0-9]{9}$/.test(address.contactNumber.replace(/\s/g, ''))) {
          newErrors.contactNumber = 'Please enter a valid UAE phone number';
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      if (step < 4) {
        setStep(step + 1);
      } else {
        onSubmit(address);
      }
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
      setErrors({});
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNext();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#E6A85C] to-[#E85A9B] rounded-xl flex items-center justify-center">
              <MapPin className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Delivery Address</h2>
              <p className="text-sm text-gray-600">Step {step} of 4</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="p-6">
          <div className="flex gap-2 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`h-2 flex-1 rounded-full transition-all ${
                  i <= step ? 'bg-gradient-to-r from-[#E6A85C] to-[#E85A9B]' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>

          <div className="space-y-6">
            {step === 1 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <Building2 className="w-5 h-5 text-gray-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Street Address</h3>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address Line 1
                  </label>
                  <input
                    type="text"
                    value={address.addressLine1}
                    onChange={(e) =>
                      setAddress({ ...address, addressLine1: e.target.value })
                    }
                    onKeyPress={handleKeyPress}
                    placeholder="Building name, street"
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                      errors.addressLine1 ? 'border-red-500' : 'border-gray-300'
                    }`}
                    autoFocus
                  />
                  {errors.addressLine1 && (
                    <p className="mt-1 text-sm text-red-600">{errors.addressLine1}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address Line 2 (Optional)
                  </label>
                  <input
                    type="text"
                    value={address.addressLine2}
                    onChange={(e) =>
                      setAddress({ ...address, addressLine2: e.target.value })
                    }
                    onKeyPress={handleKeyPress}
                    placeholder="Apartment, unit, floor"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <MapPin className="w-5 h-5 text-gray-600" />
                  <h3 className="text-lg font-semibold text-gray-900">City</h3>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    City
                  </label>
                  <input
                    type="text"
                    value={address.city}
                    onChange={(e) => setAddress({ ...address, city: e.target.value })}
                    onKeyPress={handleKeyPress}
                    placeholder="Enter your city"
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                      errors.city ? 'border-red-500' : 'border-gray-300'
                    }`}
                    autoFocus
                  />
                  {errors.city && (
                    <p className="mt-1 text-sm text-red-600">{errors.city}</p>
                  )}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <MapPin className="w-5 h-5 text-gray-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Emirate</h3>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Emirate
                  </label>
                  <div className="grid grid-cols-1 gap-3">
                    {UAE_EMIRATES.map((emirate) => (
                      <button
                        key={emirate}
                        onClick={() => setAddress({ ...address, emirate })}
                        className={`px-4 py-3 border-2 rounded-xl text-left transition-all ${
                          address.emirate === emirate
                            ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{emirate}</span>
                          {address.emirate === emirate && (
                            <CheckCircle className="w-5 h-5 text-blue-500" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                  {errors.emirate && (
                    <p className="mt-2 text-sm text-red-600">{errors.emirate}</p>
                  )}
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <Phone className="w-5 h-5 text-gray-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Contact Number</h3>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={address.contactNumber}
                    onChange={(e) =>
                      setAddress({ ...address, contactNumber: e.target.value })
                    }
                    onKeyPress={handleKeyPress}
                    placeholder="+971 50 123 4567"
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                      errors.contactNumber ? 'border-red-500' : 'border-gray-300'
                    }`}
                    autoFocus
                  />
                  {errors.contactNumber && (
                    <p className="mt-1 text-sm text-red-600">{errors.contactNumber}</p>
                  )}
                  <p className="mt-2 text-xs text-gray-500">
                    We'll use this number to coordinate delivery
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 p-6 border-t border-gray-200">
          {step > 1 && (
            <button
              onClick={handleBack}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
          )}
          <button
            onClick={handleNext}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-[#E6A85C] to-[#E85A9B] text-white font-medium rounded-xl hover:shadow-lg transition-all"
          >
            {step === 4 ? 'Confirm & Continue' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
