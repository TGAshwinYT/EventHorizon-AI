import { useUserStore } from '../store/userStore';

export function useMemory() {
  const profile = useUserStore((state) => state.profile);
  const saveMemory = useUserStore((state) => state.saveMemory);

  /**
   * Save agricultural crop preferences to user memory
   */
  const persistCropPreferences = async (crops: string[]) => {
    await saveMemory('preferred_crops', JSON.stringify(crops));
  };

  /**
   * Save user selected language preferences to user memory
   */
  const persistLanguagePreference = async (lang: string) => {
    await saveMemory('preferred_language', lang);
  };

  return {
    profile,
    persistCropPreferences,
    persistLanguagePreference
  };
}
