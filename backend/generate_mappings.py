import json

with open("ceda_commodities.json", "r") as f:
    comm_data = json.load(f)["output"]["data"]

with open("ceda_geographies.json", "r") as f:
    geo_data = json.load(f)["output"]["data"]

comm_name_to_id = {}
comm_id_to_name = {}
for c in comm_data:
    comm_name_to_id[c["commodity_name"]] = c["commodity_id"]
    comm_id_to_name[c["commodity_id"]] = c["commodity_name"]

state_name_to_id = {}
state_id_to_name = {}
dist_id_to_name = {}
for g in geo_data:
    state_name_to_id[g["census_state_name"]] = g["census_state_id"]
    state_id_to_name[g["census_state_id"]] = g["census_state_name"]
    dist_id_to_name[g["census_district_id"]] = g["census_district_name"]

code = f"""
# --- CEDA Mappings ---
COMMODITY_NAME_TO_ID = {comm_name_to_id}
COMMODITY_ID_TO_NAME = {comm_id_to_name}
STATE_NAME_TO_ID = {state_name_to_id}
STATE_ID_TO_NAME = {state_id_to_name}
DISTRICT_ID_TO_NAME = {dist_id_to_name}
"""

with open("ceda_mappings.py", "w") as f:
    f.write(code)

print("Created ceda_mappings.py")
