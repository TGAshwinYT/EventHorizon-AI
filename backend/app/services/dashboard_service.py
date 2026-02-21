from typing import Dict, Any
from app.database import AuthSessionLocal, MandiSessionLocal
from app.models import User, MandiRate

def get_user_dashboard(user_id: int) -> Dict[str, Any]:
    """
    Fetches the user's preferred state from the User DB,
    then fetches the latest commodity prices for that state from the Mandi DB.
    
    Returns a combined dictionary.
    """
    dashboard_data = {
        "user_id": user_id,
        "preferred_state": None,
        "mandi_prices": [],
        "error": None
    }

    # 1. Open a session to the User database
    with AuthSessionLocal() as user_session:
        try:
            # Fetch the User Profile
            user = user_session.query(User).filter(User.id == user_id).first()
            
            if not user:
                dashboard_data["error"] = "User not found"
                return dashboard_data
                
            # For this demo, let's assume we derive the preferred state from user input
            # since there's no `preferred_state` natively stored yet unless we updated the schema.
            # Assuming the user model HAS preferred_state or we fall back to a default "Maharashtra"
            dashboard_data["preferred_state"] = getattr(user, 'preferred_state', 'Maharashtra')
            
        except Exception as e:
            dashboard_data["error"] = f"Error fetching user: {str(e)}"
            return dashboard_data

    if not dashboard_data["preferred_state"]:
        return dashboard_data

    # 2. Open an independent session to the Mandi database
    with MandiSessionLocal() as mandi_session:
        try:
            # Query the MandiRate table for all prices matching that preferred_state
            prices = mandi_session.query(MandiRate).filter(
                MandiRate.state == dashboard_data["preferred_state"]
            ).all()
            
            # Format the data into a usable dictionary structure
            dashboard_data["mandi_prices"] = [
                {
                    "district": p.district,
                    "market": p.market,
                    "commodity": p.commodity,
                    "modal_price": p.modal_price,
                    "arrival_date": p.arrival_date
                }
                for p in prices
            ]
            
        except Exception as e:
            dashboard_data["error"] = f"Error fetching mandi prices: {str(e)}"

    return dashboard_data
