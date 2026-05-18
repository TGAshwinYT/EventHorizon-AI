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
      // High-performance live DOM Depth-First Search (DFS) traversal
      const textPieces: string[] = [];
      const noiseTags = new Set(['SCRIPT', 'STYLE', 'NAV', 'FOOTER', 'HEADER', 'SVG', 'BUTTON', 'IFRAME', 'NOSCRIPT']);
      const noiseIds = new Set(['assistant-drawer-container', 'floating-assistant-orb']);
      
      const traverse = (node: Node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          // Prune noise elements immediately to avoid traversing their subtrees
          if (noiseTags.has(el.tagName) || (el.id && noiseIds.has(el.id))) {
            return;
          }
          // DFS recursion over active children
          const children = el.childNodes;
          for (let i = 0; i < children.length; i++) {
            traverse(children[i]);
          }
        } else if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent;
          if (text) {
            textPieces.push(text);
          }
        }
      };
      
      traverse(document.body);
      
      const pageText = textPieces.join(' ');
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
