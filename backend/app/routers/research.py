import os
import requests
from fastapi import APIRouter, HTTPException
from app.models.schemas import ResearchRequest
from app.services.gemini_service import gemini_service, build_system_prompt
from app.services.search_service import search_service

router = APIRouter()

SERPER_API_KEY = os.getenv("SERPER_API_KEY")

@router.post('/research')
def assistant_research(data: ResearchRequest):
    """
    POST /api/assistant/research
    Perform live search and compile research advice for tractors, crops, products or schemes.
    """
    try:
        # Step 1: Formulate search query using Gemini (optimized for Google Search)
        search_query_prompt = (
            f"Extract a highly optimized Google Search query in English from this message: '{data.message}'. "
            "Focus on agricultural terms, products, schemes or vehicles. "
            "Reply with ONLY the clean query string, no quotes, no markdown, no punctuation and no explanation."
        )
        
        optimized_query = gemini_service.generate_response(
            message=search_query_prompt,
            context="general",
            detected_language="en"
        )
        
        optimized_query = optimized_query.strip().replace('"', '').replace("'", "")
        if not optimized_query or len(optimized_query) < 3:
            optimized_query = data.message

        print(f"[RESEARCH] Formulated search query: '{optimized_query}' (Original: '{data.message}')")

        # Step 2: Fetch organic results from Google via Serper
        context_data = ""
        sources = []

        if SERPER_API_KEY:
            try:
                url = "https://google.serper.dev/search"
                headers = {
                    "X-API-KEY": SERPER_API_KEY.strip(),
                    "Content-Type": "application/json"
                }
                payload = {
                    "q": optimized_query,
                    "num": 4
                }
                
                response = requests.post(url, headers=headers, json=payload, timeout=10)
                if response.status_code == 200:
                    results = response.json()
                    organic = results.get("organic", [])
                    
                    lines = []
                    for idx, item in enumerate(organic):
                        title = item.get("title", "Reference")
                        link = item.get("link", "")
                        snippet = item.get("snippet", "")
                        
                        lines.append(f"Result {idx+1}: Title: {title} | Snippet: {snippet}")
                        if link:
                            sources.append({"title": title, "link": link})
                            
                    context_data = "\n".join(lines)
            except Exception as e:
                print(f"[RESEARCH WARNING] Direct Serper request failed: {e}")
                
        # Fallback to search_service if direct fetch failed
        if not context_data:
            context_data = search_service.search_google(optimized_query, num_results=3)

        # Step 3: Inject Google search context and compile Horizon's warm explanation
        system_prompt = build_system_prompt(context="general", detected_language=data.language)
        
        research_prompt = f"""Here is live real-time Google search data related to the user's query. 
Use this exact context to answer the user's question with accurate, fresh details:

---
GOOGLE SEARCH RESULTS CONTEXT:
{context_data}
---

USER'S QUESTION:
{data.message}

CRITICAL RULES:
1. Explain the results simply like a warm, casual village-friend ('Horizon') sitting under a tree.
2. Use the target language: {data.language}.
3. Summarize the best option or tractor, giving practical, direct Indian advice.
4. Keep the text concise (max 3-4 sentences), highly conversational and friendly.
5. No markdown list formatting or bullet points - flow naturally.
"""
        
        # Call Gemini response generator
        response_text = gemini_service.generate_response(
            message=research_prompt,
            context="general",
            detected_language=data.language,
            history=data.history
        )
        
        return {
            "response": response_text,
            "sources": sources
        }
        
    except Exception as e:
        print(f"[ASSISTANT RESEARCH ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))
