import { useState } from 'react';
import { Bell, BellOff, Info, AlertTriangle, TrendingUp } from 'lucide-react';
import { useUserStore } from '../store/userStore';

const MOCK_NOTIFICATIONS = [
  { id: 1, type: 'alert', text: 'Fall Armyworm alert! Neem oil spray recommended for nearby maize farms.', date: 'Today' },
  { id: 2, type: 'price', text: 'Mandi rate surge: Rice/Paddy modal price touched ₹2,350/quintal in Salem.', date: 'Yesterday' },
  { id: 3, type: 'weather', text: 'Rain alert: Low pressure building up. Postpone immediate fertilizer sprays.', date: '2 days ago' }
];

export default function AlertBell() {
  const [open, setOpen] = useState(false);
  const profile = useUserStore((state) => state.profile);
  const updateProfile = useUserStore((state) => state.updateProfile);
  const alertsEnabled = profile?.alerts_enabled ?? true;

  const handleToggleAlerts = async () => {
    await updateProfile({ alerts_enabled: !alertsEnabled });
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2.5 rounded-full border border-[#eaeae0] bg-white hover:border-[#1A4731] transition-all cursor-pointer focus:outline-none"
        aria-label="Toggle notifications"
      >
        {alertsEnabled ? (
          <>
            <Bell className="h-5 w-5 text-[#1A4731]" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 animate-ping"></span>
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500"></span>
          </>
        ) : (
          <BellOff className="h-5 w-5 text-[#8b9b8b]" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-[#eaeae0] rounded-2xl shadow-xl z-50 p-4 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between border-b border-[#eaeae0] pb-2">
            <h3 className="font-extrabold text-[#1A4731] text-sm">Farm Notifications</h3>
            <button
              onClick={handleToggleAlerts}
              className="text-[10px] bg-[#eef7f2] text-[#1A4731] py-1 px-2.5 rounded-lg font-bold hover:bg-[#1A4731] hover:text-white transition-colors cursor-pointer"
            >
              {alertsEnabled ? 'Mute Alerts' : 'Unmute Alerts'}
            </button>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-0.5 custom-scrollbar">
            {alertsEnabled ? (
              MOCK_NOTIFICATIONS.map((notif) => (
                <div key={notif.id} className="p-3 rounded-xl bg-[#fafaf7] border border-[#eaeae0] text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-[#1A4731]">
                    {notif.type === 'alert' && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                    {notif.type === 'price' && <TrendingUp className="h-3.5 w-3.5 text-[#F5A623]" />}
                    {notif.type === 'weather' && <Info className="h-3.5 w-3.5 text-[#4A90D9]" />}
                    <span className="capitalize">{notif.type}</span>
                  </div>
                  <p className="text-[#5a6e5a] leading-relaxed font-semibold">{notif.text}</p>
                  <span className="block text-[9px] text-[#8b9b8b] text-right font-medium">{notif.date}</span>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-xs text-[#8b9b8b] font-medium">
                Alerts are muted. Turn on alerts to receive live farm updates.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
