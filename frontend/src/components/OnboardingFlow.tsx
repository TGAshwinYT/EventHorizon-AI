import { useState } from 'react';
import { useUserStore } from '../store/userStore';
import LanguagePicker from './LanguagePicker';
import { Sprout, MapPin, User, Bell, CheckCircle } from 'lucide-react';

const STATES_DISTRICTS: Record<string, string[]> = {
  'Tamil Nadu': ['Ariyalur', 'Chennai', 'Coimbatore', 'Cuddalore', 'Dharmapuri', 'Dindigul', 'Erode', 'Kanchipuram', 'Madurai', 'Nagapattinam', 'Salem', 'Thanjavur', 'Trichy', 'Tirunelveli', 'Vellore'],
  'Andhra Pradesh': ['Anantapur', 'Chittoor', 'East Godavari', 'Guntur', 'Krishna', 'Kurnool', 'Nellore', 'Prakasam', 'Srikakulam', 'Visakhapatnam', 'West Godavari'],
  'Karnataka': ['Bangalore Rural', 'Bangalore Urban', 'Belgaum', 'Bellary', 'Bidar', 'Chikmagalur', 'Dharwad', 'Gulbarga', 'Hassan', 'Mysore', 'Shimoga', 'Tumkur', 'Udupi'],
  'Punjab': ['Amritsar', 'Bathinda', 'Firozpur', 'Gurdaspur', 'Jalandhar', 'Ludhiana', 'Mansa', 'Patiala', 'Sangrur'],
  'Maharashtra': ['Ahmednagar', 'Akola', 'Aurangabad', 'Beed', 'Kolhapur', 'Nagpur', 'Nashik', 'Pune', 'Sangli', 'Satara', 'Solapur', 'Thane']
};

const CROPS = [
  { id: 'paddy', name: 'Paddy / நெல்', icon: '🌾' },
  { id: 'cotton', name: 'Cotton / பருத்தி', icon: '☁️' },
  { id: 'wheat', name: 'Wheat / கோதுமை', icon: '🌾' },
  { id: 'sugarcane', name: 'Sugarcane / கரும்பு', icon: '🎋' },
  { id: 'maize', name: 'Maize / சோளம்', icon: '🌽' },
  { id: 'chilli', name: 'Chilli / மிளகாய்', icon: '🌶️' },
  { id: 'turmeric', name: 'Turmeric / மஞ்சள்', icon: '🍠' },
  { id: 'vegetables', name: 'Vegetables / காய்கறி', icon: '🥦' }
];

export default function OnboardingFlow({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedCrops, setSelectedCrops] = useState<string[]>([]);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateProfile = useUserStore((state) => state.updateProfile);

  const handleNext = () => setStep((prev) => prev + 1);
  const handleBack = () => setStep((prev) => prev - 1);

  const handleCropToggle = (cropId: string) => {
    setSelectedCrops((prev) =>
      prev.includes(cropId) ? prev.filter((id) => id !== cropId) : [...prev, cropId]
    );
  };

  const handleFinish = async () => {
    setIsSubmitting(true);
    try {
      const success = await updateProfile({
        display_name: name,
        state: selectedState,
        district: selectedDistrict,
        crops: selectedCrops,
        alerts_enabled: alertsEnabled,
        onboarding_completed: true
      });
      if (success) {
        onComplete();
      } else {
        alert('Failed to update profile. Proceeding anyway...');
        onComplete();
      }
    } catch (e) {
      console.error(e);
      onComplete();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF7] flex flex-col justify-center items-center px-4 py-8">
      {/* Onboarding Wizard Card */}
      <div className="w-full max-w-xl bg-white rounded-3xl border border-[#eaeae0] shadow-xl overflow-hidden transition-all duration-300">
        
        {/* Top Header Indicators */}
        <div className="bg-[#1A4731] px-8 py-5 flex items-center justify-between text-white">
          <div>
            <span className="text-[#F5A623] font-bold text-xs uppercase tracking-widest">
              Event Horizon AI
            </span>
            <h1 className="text-xl font-bold mt-0.5">உங்களது விவரங்கள்</h1>
          </div>
          <div className="bg-[#0D1F16] text-[#F5A623] font-mono text-sm px-3 py-1 rounded-full border border-[#1A4731]">
            Step {step} of 5
          </div>
        </div>

        {/* Dynamic step view */}
        <div className="p-8">
          
          {/* Step 1: Language Picker */}
          {step === 1 && (
            <LanguagePicker onNext={handleNext} />
          )}

          {/* Step 2: Name */}
          {step === 2 && (
            <div className="animate-fade-in space-y-6">
              <div className="flex justify-center mb-2">
                <div className="p-4 rounded-full bg-[#eef7f2]">
                  <User className="h-10 w-10 text-[#1A4731]" />
                </div>
              </div>
              
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-extrabold text-[#1A4731]">
                  வணக்கம்! உங்க பெயர் என்ன?
                </h2>
                <p className="text-sm font-medium text-[#5a6e5a]">
                  Please enter your name so Horizon can address you warmly
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#1A4731] uppercase tracking-wide">
                  Your Name / உங்கள் பெயர்
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="உதாரணம்: முருகன்"
                  className="w-full px-5 py-4 rounded-2xl border-2 border-[#eaeae0] focus:border-[#1A4731] focus:ring-1 focus:ring-[#1A4731] outline-none transition-colors duration-200 text-lg font-semibold text-[#1A4731]"
                />
              </div>

              <div className="pt-4 flex justify-between gap-4">
                <button
                  onClick={handleBack}
                  className="w-1/2 py-4 rounded-2xl border-2 border-[#eaeae0] text-[#1A4731] font-bold text-base hover:bg-[#fafaf7] transition-all"
                >
                  Back
                </button>
                <button
                  onClick={handleNext}
                  disabled={!name.trim()}
                  className="w-1/2 py-4 rounded-2xl bg-[#1A4731] text-white font-bold text-base hover:bg-[#123323] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Location */}
          {step === 3 && (
            <div className="animate-fade-in space-y-6">
              <div className="flex justify-center mb-2">
                <div className="p-4 rounded-full bg-[#eef7f2]">
                  <MapPin className="h-10 w-10 text-[#1A4731]" />
                </div>
              </div>

              <div className="text-center space-y-2">
                <h2 className="text-2xl font-extrabold text-[#1A4731]">
                  உங்க ஊர் எது?
                </h2>
                <p className="text-sm font-medium text-[#5a6e5a]">
                  Select your state and district to get real-time crop insights and mandi rates
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#1A4731] uppercase tracking-wide">
                    State / மாநிலம்
                  </label>
                  <select
                    value={selectedState}
                    onChange={(e) => {
                      setSelectedState(e.target.value);
                      setSelectedDistrict('');
                    }}
                    className="w-full px-5 py-4 rounded-2xl border-2 border-[#eaeae0] focus:border-[#1A4731] outline-none transition-colors duration-200 text-base font-semibold text-[#1A4731]"
                  >
                    <option value="">Select State</option>
                    {Object.keys(STATES_DISTRICTS).map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#1A4731] uppercase tracking-wide">
                    District / மாவட்டம்
                  </label>
                  <select
                    value={selectedDistrict}
                    onChange={(e) => setSelectedDistrict(e.target.value)}
                    disabled={!selectedState}
                    className="w-full px-5 py-4 rounded-2xl border-2 border-[#eaeae0] focus:border-[#1A4731] outline-none transition-colors duration-200 text-base font-semibold text-[#1A4731] disabled:opacity-50"
                  >
                    <option value="">Select District</option>
                    {selectedState &&
                      STATES_DISTRICTS[selectedState].map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="pt-4 flex justify-between gap-4">
                <button
                  onClick={handleBack}
                  className="w-1/2 py-4 rounded-2xl border-2 border-[#eaeae0] text-[#1A4731] font-bold text-base hover:bg-[#fafaf7] transition-all"
                >
                  Back
                </button>
                <button
                  onClick={handleNext}
                  disabled={!selectedState || !selectedDistrict}
                  className="w-1/2 py-4 rounded-2xl bg-[#1A4731] text-white font-bold text-base hover:bg-[#123323] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Crops Selection */}
          {step === 4 && (
            <div className="animate-fade-in space-y-6">
              <div className="flex justify-center mb-2">
                <div className="p-4 rounded-full bg-[#eef7f2]">
                  <Sprout className="h-10 w-10 text-[#1A4731]" />
                </div>
              </div>

              <div className="text-center space-y-2">
                <h2 className="text-2xl font-extrabold text-[#1A4731]">
                  என்னென்ன பயிர்கள் செய்கிறீர்கள்?
                </h2>
                <p className="text-sm font-medium text-[#5a6e5a]">
                  Select the crops you grow (Choose multiple if applicable)
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                {CROPS.map((crop) => {
                  const isChecked = selectedCrops.includes(crop.id);
                  return (
                    <button
                      key={crop.id}
                      onClick={() => handleCropToggle(crop.id)}
                      className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left ${
                        isChecked
                          ? 'border-[#1A4731] bg-[#eef7f2]'
                          : 'border-[#eaeae0] bg-white hover:border-[#F5A623]'
                      }`}
                    >
                      <span className="text-2xl">{crop.icon}</span>
                      <span className="font-bold text-sm text-[#1A4731]">{crop.name}</span>
                    </button>
                  );
                })}
              </div>

              <div className="pt-4 flex justify-between gap-4">
                <button
                  onClick={handleBack}
                  className="w-1/2 py-4 rounded-2xl border-2 border-[#eaeae0] text-[#1A4731] font-bold text-base hover:bg-[#fafaf7] transition-all"
                >
                  Back
                </button>
                <button
                  onClick={handleNext}
                  disabled={selectedCrops.length === 0}
                  className="w-1/2 py-4 rounded-2xl bg-[#1A4731] text-white font-bold text-base hover:bg-[#123323] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Alerts & Final Confirmation */}
          {step === 5 && (
            <div className="animate-fade-in space-y-6">
              <div className="flex justify-center mb-2">
                <div className="p-4 rounded-full bg-[#eef7f2]">
                  <Bell className="h-10 w-10 text-[#1A4731]" />
                </div>
              </div>

              <div className="text-center space-y-2">
                <h2 className="text-2xl font-extrabold text-[#1A4731]">
                  அபாய எச்சரிக்கைகளை இயக்கவா?
                </h2>
                <p className="text-sm font-medium text-[#5a6e5a]">
                  Enable pest warnings, weather alerts, and schemes notifications
                </p>
              </div>

              {/* Toggle switch alert config */}
              <div className="bg-[#fafaf7] p-5 rounded-2xl border border-[#eaeae0] flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-[#1A4731] text-base">எச்சரிக்கைகள் (Alerts)</h3>
                  <p className="text-xs text-[#8b9b8b] mt-0.5">Receive dynamic pest & rain warnings</p>
                </div>
                <button
                  onClick={() => setAlertsEnabled(!alertsEnabled)}
                  className={`w-14 h-8 flex items-center rounded-full p-1 transition-all duration-300 ${
                    alertsEnabled ? 'bg-[#1A4731] justify-end' : 'bg-[#d0d0c0] justify-start'
                  }`}
                >
                  <span className="w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-300"></span>
                </button>
              </div>

              {/* Ready message */}
              <div className="p-4 rounded-xl bg-[#eef7f2] border border-[#d2edd7] text-center text-xs font-semibold text-[#1A4731] flex items-center justify-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Horizon is fully prepped to help you move further! 🚀
              </div>

              <div className="pt-4 flex justify-between gap-4">
                <button
                  onClick={handleBack}
                  className="w-1/2 py-4 rounded-2xl border-2 border-[#eaeae0] text-[#1A4731] font-bold text-base hover:bg-[#fafaf7] transition-all"
                >
                  Back
                </button>
                <button
                  onClick={handleFinish}
                  disabled={isSubmitting}
                  className="w-1/2 py-4 rounded-2xl bg-[#1A4731] text-white font-bold text-base hover:bg-[#123323] transition-all shadow-md flex items-center justify-center gap-2"
                >
                  {isSubmitting ? 'Saving...' : 'Activate Horizon'}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
