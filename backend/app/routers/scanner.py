"""
Scanner Router - EventHorizon AI
Endpoint for Visual Diagnostic Scanner. Accepts compressed Base64 JPEG
and runs the crop diagnosis pipeline.
"""

import logging
from typing import Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Header, Request

from app.services.vision_diagnostic_service import vision_diagnostic_service
from app.auth import decode_access_token
from app.database import AsyncAuthSessionLocal
from app.models import User
from sqlalchemy import select

logger = logging.getLogger("eventhorizon.scanner")
router = APIRouter()


class DiagnoseRequest(BaseModel):
    image_base64: str = Field(..., description="Base64 JPEG (<50KB)")
    language: str = Field(default="en")
    query: Optional[str] = Field(default=None)


@router.post("/diagnose")
async def diagnose_crop(
    data: DiagnoseRequest,
    request: Request,
    authorization: Optional[str] = Header(None),
):
    """Diagnose crop disease from compressed image."""
    user_id = None
    location = None
    if authorization and authorization.startswith("Bearer "):
        try:
            token = authorization.split(" ")[1]
            payload = decode_access_token(token)
            if payload:
                username = payload.get("sub")
                async with AsyncAuthSessionLocal() as db:
                    result = await db.execute(select(User).filter(User.username == username))
                    user = result.scalars().first()
                    if user:
                        user_id = user.id
                        # Build location string for search localization
                        loc_parts = []
                        if user.mandal:
                            loc_parts.append(user.mandal)
                        if user.district:
                            loc_parts.append(user.district)
                        if user.state:
                            loc_parts.append(user.state)
                        if loc_parts:
                            location = ", ".join(loc_parts)
        except Exception as e:
            logger.warning(f"[Scanner] Auth error: {e}")

    if not data.image_base64:
        raise HTTPException(status_code=400, detail="No image provided")

    image_size_kb = len(data.image_base64) * 3 / 4 / 1024
    try:
        result = await vision_diagnostic_service.diagnose(
            image_base64=data.image_base64,
            language=data.language,
            user_query=data.query,
            speak_result=True,
            location=location,
        )
        logger.info(f"[Scanner] Done: {result.get('issue_detected')}")
        return result
    except Exception as e:
        logger.error(f"[Scanner] Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
