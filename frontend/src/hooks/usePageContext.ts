import { useEffect, useState } from 'react';
import { useUserStore } from '../store/userStore';

export function usePageContext() {
  const [pageTitle, setPageTitle] = useState(document.title);
  const [pageUrl, setPageUrl] = useState(window.location.href);
  const analyzePage = useUserStore((state) => state.analyzePage);
  const summary = useUserStore((state) => state.pageSummary);
  const loading = useUserStore((state) => state.isAnalyzingPage);
  const suggestedQuestions = useUserStore((state) => state.pageSuggestedQuestions);

  useEffect(() => {
    const handleLocationChange = () => {
      setPageTitle(document.title);
      setPageUrl(window.location.href);
    };

    // Watch resize, popstate and click events to update dynamically in SPA
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('click', handleLocationChange);
    
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('click', handleLocationChange);
    };
  }, []);

  const triggerPageAnalysis = async () => {
    try {
      const bodyClone = document.body.cloneNode(true) as HTMLElement;
      
      // Remove noise elements and the entire AI assistant interface
      const noiseSelectors = 'script, style, nav, footer, header, svg, button, iframe, noscript, #assistant-drawer-container, #floating-assistant-orb';
      bodyClone.querySelectorAll(noiseSelectors).forEach(el => el.remove());
      
      const pageText = bodyClone.innerText || bodyClone.textContent || '';
      // Limit to 4000 characters to keep payload light
      const sanitizedText = pageText.replace(/\s+/g, ' ').trim().slice(0, 4000);
      
      await analyzePage(document.title, window.location.href, sanitizedText);
    } catch (error) {
      console.error('[PAGE CONTEXT ERROR] Failed to clean DOM', error);
    }
  };

  return {
    pageTitle,
    pageUrl,
    summary,
    loading,
    suggestedQuestions,
    triggerPageAnalysis
  };
}
