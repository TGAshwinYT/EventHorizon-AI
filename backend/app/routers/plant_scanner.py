import os
import tempfile
# Force transformers to use a shallow, explicit directory (cross-platform temporary directory)
temp_cache = os.path.join(tempfile.gettempdir(), "hf_cache")
os.environ["HF_HOME"] = temp_cache
os.environ["TRANSFORMERS_CACHE"] = temp_cache


import io
import logging
import re
import json
import asyncio
import gc
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Request
from typing import Optional, Dict, Any

from app.services.gemini_service import gemini_service
from app.services.vision_diagnostic_service import vision_diagnostic_service

logger = logging.getLogger("eventhorizon.plant_scanner")
router = APIRouter()

async def predict_disease_with_pretrained(image_bytes: bytes, proc, mod) -> Dict[str, Any]:
    try:
        if proc is None or mod is None:
            return {"is_valid": False, "error": "Classifier model is not initialized."}
            
        def run_inference():
            from PIL import Image
            import torch
            
            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            inputs = proc(images=image, return_tensors="pt")
            
            with torch.no_grad():
                outputs = mod(**inputs)
                logits = outputs.logits
                
            probabilities = torch.nn.functional.softmax(logits, dim=-1)
            top_class_idx = torch.argmax(probabilities, dim=-1).item()
            confidence_score = probabilities[0][top_class_idx].item()
            
            # CRITICAL GUARDRAIL: If the model is guessing blindly
            if confidence_score < 0.70:
                del inputs
                if 'outputs' in locals(): del outputs
                gc.collect()
                return {
                    "is_valid": False,
                    "error": "Cannot confidently recognize a supported plant leaf. Please take a clearer, close-up photo of an Apple, Tomato, or Corn leaf."
                }
                
            predicted_label = mod.config.id2label[top_class_idx]
            
            res = {
                "is_valid": True,
                "disease_name": predicted_label.replace("___", " ").replace("_", " "),
                "confidence": round(confidence_score * 100, 2)
            }
            del inputs
            if 'outputs' in locals(): del outputs
            gc.collect()
            return res
            
        return await asyncio.to_thread(run_inference)
    except Exception as e:
        logger.error(f"Prediction failed: {e}")
        return {"is_valid": False, "error": f"Internal image processing failed: {str(e)}"}

async def get_root_cause_and_query(disease: str, language: str, initial_remedy: Optional[str] = None) -> Dict[str, Any]:
    prompt = f"""You are an expert plant pathologist and senior agronomist specializing in sustainable crop protection. Your core duty is to analyze a verified plant disease, diagnose its scientific root cause, provide practical remedies, and generate a precise e-commerce search string to help the farmer treat it immediately.

Verified Disease Name: {disease}
Target Language: {language}
"""
    if initial_remedy:
        prompt += f"\nInitial Remedy/Treatment Details:\n{initial_remedy}\n"

    prompt += """
---
### STRUCTURAL REQUIREMENTS & RULES:
1. TRUTHFULNESS & PRECISION: Do not guess or hallucinate. Use verified agricultural science. If the disease name is "healthy", explicitly state that the plant requires no chemical treatment and give standard preventive care tips.
2. MULTILINGUAL OUTPUT: Translate the fields "detected_disease", "root_cause", and "remedy_steps" completely into the requested Target Language. Keep the technical data clear and simple so a local farmer can understand it.
"""

    if initial_remedy:
        prompt += """3. REMEDY COMBINATION RULE: You must combine the "Initial Remedy/Treatment Details" provided above (which contains specific active ingredients, chemical/organic products, application frequencies, and exact ratios/dosages, e.g. 'mix 1 tbsp in 1 L water') with new expert action steps (such as cultural practices, water management, base watering, pruning, or airflow adjustments). Merge them into a single, comprehensive, numbered list of step-by-step instructions (1, 2, 3...) under the "remedy_steps" field in the target language. Do not lose the specific ratios or chemical/organic treatment details from the initial remedy.
"""
    else:
        prompt += """3. ACTIONABLE REMEDIES: Provide clear, numbered instructions (1, 2, 3...) detailing cultural practices, organic remedies, or specific chemical applications to cure or control the issue.
"""

    prompt += """4. SEARCH ENGINE OPTIMIZATION: The field "e_commerce_search_query" MUST be written in English. It must contain only the specific chemical, organic active ingredient, or biological control agent required for the treatment (e.g., "Copper Fungicide", "Neem Oil 1500 PPM", "Trichoderma viride biofungicide"). Do not include filler words like "buy", "best", "for plants", or punctuation.
5. STRICT JSON COMPLIANCE: You must respond ONLY with a raw JSON object. Do not wrap the JSON in markdown code blocks (such as ```json ... ```). Do not include any introductory or concluding conversational text.

---
### EXPECTED OUTPUT JSON FORMAT:
{
  "detected_disease": "Translated Clean Common Name of the Disease",
  "root_cause": "A deeply detailed explanation detailing how the pathogen or environmental condition caused this specific disease, translated into the target language.",
  "remedy_steps": "Numbered, actionable instructions (1, 2, 3...) detailing cultural practices, organic remedies, or specific chemical applications to cure or control the issue, translated into the target language.",
  "e_commerce_search_query": "Clean English search phrase for the exact treatment product"
}"""

    response_text = await asyncio.to_thread(
        gemini_service.generate_response,
        prompt,
        context="agriculture",
        detected_language=language
    )
    
    cleaned_text = response_text.strip()
    if cleaned_text.startswith("```"):
        cleaned_text = re.sub(r"^```(?:json)?\s*\n?", "", cleaned_text)
        cleaned_text = re.sub(r"\n?```\s*$", "", cleaned_text)
        
    try:
        return json.loads(cleaned_text.strip())
    except Exception as e:
        logger.error(f"Failed to parse JSON: {e}. Raw response: {response_text}")
        json_match = re.search(r'\{.*\}', cleaned_text, re.DOTALL)
        if json_match:
            return json.loads(json_match.group(0))
        raise e

import requests

def fetch_market_links(search_query: str):
    if not search_query:
        return []
    try:
        url = "https://google.serper.dev/search"
        
        # This safely forces Google to look only inside specific trusted websites
        optimized_query = f"{search_query} buy online site:amazon.in OR site:ugaoo.com OR site:bighaat.com"
        
        payload = json.dumps({
            "q": optimized_query,
            "num": 3  # Fetch only top 3 accurate links
        })
        headers = {
            'X-API-KEY': os.getenv("SERPER_API_KEY", ""),
            'Content-Type': 'application/json'
        }
        
        response = requests.post(url, headers=headers, data=payload, timeout=10)
        results = response.json()
        
        links = []
        if "organic" in results:
            for item in results["organic"]:
                links.append({
                    "title": item.get("title"),
                    "link": item.get("link")
                })
        return links
    except Exception as e:
        logger.warning(f"Serper API search failed: {e}")
        return []

@router.post("/analyze-plant")
async def analyze_plant(
    request: Request, 
    file: UploadFile = File(...), 
    language: str = Form("English"),
    plant_name: Optional[str] = Form(None),
    issue_detected: Optional[str] = Form(None),
    initial_remedy: Optional[str] = Form(None)
):
    image_bytes = await file.read()
    
    proc = getattr(request.app.state, "classifier_processor", None)
    mod = getattr(request.app.state, "classifier_model", None)
    
    classification = await predict_disease_with_pretrained(image_bytes, proc, mod)
    
    disease = None
    confidence = None
    
    if classification.get("is_valid"):
        disease = classification["disease_name"]
        confidence = classification["confidence"]
    elif plant_name and issue_detected:
        logger.info(f"Local classifier bypassed. Using frontend metadata fallback: {plant_name} - {issue_detected}")
        disease = f"{plant_name} {issue_detected}"
        confidence = 95.0
    else:
        del image_bytes
        gc.collect()
        return {"success": False, "message": classification.get("error")}
        
    
    try:
        # If the classifier detects a healthy leaf
        if "healthy" in disease.lower():
            ai_analysis = await get_root_cause_and_query(disease, language, initial_remedy)
            
            res = {
                "success": True,
                "confidence_score": f"{round(confidence, 2)}%",
                "detected_disease": ai_analysis.get("detected_disease"),
                "root_cause": ai_analysis.get("root_cause"),
                "remedy": ai_analysis.get("remedy_steps"),
                "buy_links": [] # No products needed for healthy crops
            }
            del image_bytes
            if 'classification' in locals(): del classification
            gc.collect()
            return res

        ai_analysis = await get_root_cause_and_query(disease, language, initial_remedy)
        search_keyword = ai_analysis.get("e_commerce_search_query")
        
        # Fetch live marketplace links using Gemini's search term
        live_links = await asyncio.to_thread(fetch_market_links, search_keyword)
        
        res = {
            "success": True,
            "confidence_score": f"{round(confidence, 2)}%",
            "detected_disease": ai_analysis.get("detected_disease"),
            "root_cause": ai_analysis.get("root_cause"),
            "remedy": ai_analysis.get("remedy_steps"),
            "buy_links": live_links
        }
        del image_bytes
        if 'classification' in locals(): del classification
        gc.collect()
        return res
    except Exception as e:
        logger.error(f"Analysis endpoint failed: {e}")
        del image_bytes
        if 'classification' in locals(): del classification
        gc.collect()
        return {"success": False, "message": f"Analysis failed: {str(e)}"}
