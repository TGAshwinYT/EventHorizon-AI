"""Generate india_locations.py with all states and major districts."""
import json, pathlib

INDIA_LOCATIONS = {
    "Andhra Pradesh": {
        "Anantapur": [14.68, 77.60], "Chittoor": [13.22, 79.10], "East Godavari": [17.00, 81.80],
        "Guntur": [16.30, 80.44], "Krishna": [16.57, 80.86], "Kurnool": [15.83, 78.04],
        "Nellore": [14.45, 79.99], "Prakasam": [15.50, 79.50], "Srikakulam": [18.30, 83.90],
        "Visakhapatnam": [17.69, 83.22], "Vijayawada": [16.51, 80.65], "West Godavari": [16.90, 81.30],
        "YSR Kadapa": [14.47, 78.82],
    },
    "Arunachal Pradesh": {
        "Itanagar": [27.08, 93.61], "Tawang": [27.59, 91.86], "Pasighat": [28.07, 95.33],
    },
    "Assam": {
        "Guwahati": [26.14, 91.74], "Dibrugarh": [27.47, 94.91], "Jorhat": [26.76, 94.22],
        "Nagaon": [26.35, 92.68], "Silchar": [24.83, 92.78], "Tezpur": [26.63, 92.80],
        "Tinsukia": [27.49, 95.36],
    },
    "Bihar": {
        "Araria": [26.15, 87.46], "Aurangabad": [24.75, 84.37], "Begusarai": [25.42, 86.13],
        "Bhagalpur": [25.24, 86.97], "Darbhanga": [26.17, 85.90], "Gaya": [24.80, 85.01],
        "Gopalganj": [26.47, 84.44], "Muzaffarpur": [26.12, 85.39], "Nalanda": [25.13, 85.44],
        "Patna": [25.61, 85.14], "Purnia": [25.78, 87.47], "Samastipur": [25.86, 85.78],
        "Saran": [25.87, 84.75], "Vaishali": [25.99, 85.22],
    },
    "Chhattisgarh": {
        "Bilaspur": [22.09, 82.15], "Durg": [21.19, 81.28], "Korba": [22.35, 82.68],
        "Raipur": [21.25, 81.63], "Rajnandgaon": [21.10, 81.03],
    },
    "Goa": {
        "North Goa": [15.53, 73.96], "South Goa": [15.28, 74.08],
    },
    "Gujarat": {
        "Ahmedabad": [23.02, 72.57], "Amreli": [21.60, 71.22], "Anand": [22.56, 72.95],
        "Banaskantha": [24.17, 72.43], "Bharuch": [21.70, 72.99], "Bhavnagar": [21.77, 72.15],
        "Gandhinagar": [23.22, 72.64], "Jamnagar": [22.47, 70.07], "Junagadh": [21.52, 70.46],
        "Kutch": [23.73, 69.86], "Mehsana": [23.59, 72.38], "Panchmahal": [22.75, 73.60],
        "Rajkot": [22.30, 70.80], "Surat": [21.17, 72.83], "Vadodara": [22.31, 73.18],
    },
    "Haryana": {
        "Ambala": [30.38, 76.78], "Faridabad": [28.41, 77.31], "Gurugram": [28.46, 77.03],
        "Hisar": [29.15, 75.72], "Karnal": [29.69, 76.98], "Kurukshetra": [29.97, 76.84],
        "Panipat": [29.39, 76.97], "Rohtak": [28.89, 76.57], "Sirsa": [29.53, 75.03],
        "Sonipat": [28.99, 77.02],
    },
    "Himachal Pradesh": {
        "Dharamshala": [32.22, 76.32], "Kullu": [31.96, 77.11], "Mandi": [31.71, 76.93],
        "Shimla": [31.10, 77.17], "Solan": [30.91, 77.10],
    },
    "Jharkhand": {
        "Bokaro": [23.67, 86.15], "Dhanbad": [23.80, 86.43], "Dumka": [24.27, 87.25],
        "Hazaribagh": [23.99, 85.36], "Jamshedpur": [22.80, 86.18], "Ranchi": [23.34, 85.31],
    },
    "Karnataka": {
        "Bagalkot": [16.18, 75.70], "Belagavi": [15.85, 74.50], "Bengaluru Rural": [13.23, 77.71],
        "Bengaluru Urban": [12.97, 77.59], "Bidar": [17.91, 77.52], "Chamrajnagar": [11.92, 76.94],
        "Chikkaballapur": [13.44, 77.73], "Chikkamagaluru": [13.32, 75.77],
        "Chitradurga": [14.23, 76.40], "Dakshina Kannada": [12.87, 74.88],
        "Davanagere": [14.47, 75.92], "Dharwad": [15.46, 75.01], "Gadag": [15.43, 75.63],
        "Hassan": [13.00, 76.10], "Haveri": [14.79, 75.40], "Hubballi": [15.36, 75.12],
        "Kalaburagi": [17.33, 76.83], "Kodagu": [12.42, 75.74], "Kolar": [13.14, 78.13],
        "Koppal": [15.35, 76.15], "Mandya": [12.52, 76.90], "Mangaluru": [12.87, 74.84],
        "Mysuru": [12.30, 76.66], "Raichur": [16.21, 77.36], "Ramanagara": [12.72, 77.28],
        "Shimoga": [13.93, 75.57], "Tumkur": [13.34, 77.10], "Udupi": [13.34, 74.75],
        "Uttara Kannada": [14.52, 74.59], "Vijayapura": [16.83, 75.72], "Yadgir": [16.77, 77.14],
    },
    "Kerala": {
        "Alappuzha": [9.49, 76.34], "Ernakulam": [10.00, 76.30], "Idukki": [9.85, 76.97],
        "Kannur": [11.87, 75.37], "Kasaragod": [12.50, 74.99], "Kochi": [9.93, 76.26],
        "Kollam": [8.89, 76.60], "Kottayam": [9.59, 76.52], "Kozhikode": [11.25, 75.77],
        "Malappuram": [11.04, 76.08], "Palakkad": [10.78, 76.65],
        "Pathanamthitta": [9.27, 76.79], "Thiruvananthapuram": [8.52, 76.94],
        "Thrissur": [10.53, 76.21], "Wayanad": [11.69, 76.13],
    },
    "Madhya Pradesh": {
        "Bhopal": [23.26, 77.41], "Gwalior": [26.22, 78.18], "Indore": [22.72, 75.86],
        "Jabalpur": [23.18, 79.95], "Rewa": [24.53, 81.30], "Sagar": [23.84, 78.74],
        "Satna": [24.58, 80.83], "Ujjain": [23.18, 75.77],
    },
    "Maharashtra": {
        "Ahmednagar": [19.09, 74.74], "Akola": [20.71, 77.00], "Amravati": [20.93, 77.75],
        "Aurangabad": [19.88, 75.32], "Beed": [18.99, 75.76], "Bhandara": [21.17, 79.65],
        "Buldhana": [20.53, 76.18], "Chandrapur": [19.97, 79.30], "Dhule": [20.90, 74.78],
        "Jalgaon": [21.01, 75.56], "Jalna": [19.84, 75.88], "Kolhapur": [16.70, 74.24],
        "Latur": [18.40, 76.57], "Mumbai": [19.08, 72.88], "Nagpur": [21.15, 79.09],
        "Nanded": [19.16, 77.30], "Nashik": [20.00, 73.79], "Osmanabad": [18.18, 76.04],
        "Palghar": [19.69, 72.77], "Parbhani": [19.27, 76.77], "Pune": [18.52, 73.86],
        "Raigad": [18.52, 73.18], "Ratnagiri": [16.99, 73.30], "Sangli": [16.85, 74.56],
        "Satara": [17.68, 74.00], "Sindhudurg": [16.35, 73.65], "Solapur": [17.66, 75.91],
        "Thane": [19.22, 72.98], "Wardha": [20.74, 78.60], "Washim": [20.10, 77.13],
        "Yavatmal": [20.39, 78.12],
    },
    "Manipur": {
        "Imphal": [24.81, 93.94], "Thoubal": [24.63, 94.01], "Bishnupur": [24.63, 93.78],
    },
    "Meghalaya": {
        "Shillong": [25.57, 91.88], "Tura": [25.51, 90.22], "Jowai": [25.45, 92.20],
    },
    "Mizoram": {
        "Aizawl": [23.73, 92.72], "Lunglei": [22.88, 92.73],
    },
    "Nagaland": {
        "Dimapur": [25.87, 93.73], "Kohima": [25.67, 94.12],
    },
    "Odisha": {
        "Angul": [20.84, 85.10], "Balasore": [21.49, 86.93], "Bhubaneswar": [20.30, 85.82],
        "Cuttack": [20.46, 85.88], "Ganjam": [19.59, 84.68], "Kalahandi": [19.91, 83.17],
        "Kendrapara": [20.50, 86.42], "Khordha": [20.18, 85.62], "Koraput": [18.81, 82.71],
        "Mayurbhanj": [21.94, 86.73], "Puri": [19.81, 85.83], "Sambalpur": [21.47, 83.97],
        "Sundargarh": [22.12, 84.04],
    },
    "Punjab": {
        "Amritsar": [31.63, 74.87], "Bathinda": [30.21, 74.95], "Faridkot": [30.68, 74.76],
        "Firozpur": [30.93, 74.61], "Gurdaspur": [32.04, 75.40], "Hoshiarpur": [31.53, 75.91],
        "Jalandhar": [31.33, 75.58], "Ludhiana": [30.90, 75.86], "Moga": [30.82, 75.17],
        "Muktsar": [30.47, 74.51], "Patiala": [30.34, 76.39], "Sangrur": [30.25, 75.84],
    },
    "Rajasthan": {
        "Ajmer": [26.45, 74.64], "Alwar": [27.55, 76.63], "Barmer": [25.75, 71.39],
        "Bharatpur": [27.22, 77.49], "Bikaner": [28.02, 73.31], "Chittorgarh": [24.88, 74.63],
        "Churu": [28.30, 74.97], "Jaipur": [26.91, 75.79], "Jaisalmer": [26.92, 70.91],
        "Jodhpur": [26.29, 73.02], "Kota": [25.18, 75.83], "Nagaur": [27.20, 73.74],
        "Pali": [25.77, 73.33], "Sikar": [27.61, 75.14], "Udaipur": [24.59, 73.71],
    },
    "Sikkim": {
        "Gangtok": [27.34, 88.61], "Namchi": [27.17, 88.36],
    },
    "Tamil Nadu": {
        "Chennai": [13.08, 80.27], "Coimbatore": [11.00, 76.96], "Cuddalore": [11.75, 79.77],
        "Dharmapuri": [12.13, 78.16], "Dindigul": [10.37, 77.97], "Erode": [11.34, 77.73],
        "Kancheepuram": [12.83, 79.70], "Kanniyakumari": [8.09, 77.57],
        "Karur": [10.96, 78.08], "Krishnagiri": [12.52, 78.21], "Madurai": [9.93, 78.12],
        "Nagapattinam": [10.77, 79.84], "Namakkal": [11.22, 78.17],
        "Nilgiris": [11.41, 76.69], "Perambalur": [11.23, 78.88],
        "Pudukkottai": [10.38, 78.82], "Ramanathapuram": [9.37, 78.83],
        "Salem": [11.65, 78.16], "Sivaganga": [10.44, 78.48],
        "Thanjavur": [10.79, 79.14], "Theni": [10.01, 77.48],
        "Tiruchirappalli": [10.79, 78.69], "Tirunelveli": [8.73, 77.70],
        "Tiruppur": [11.11, 77.35], "Tiruvallur": [13.14, 79.91],
        "Tiruvannamalai": [12.23, 79.07], "Tiruvarur": [10.77, 79.64],
        "Thoothukudi": [8.76, 78.13], "Vellore": [12.92, 79.13],
        "Viluppuram": [11.94, 79.49], "Virudhunagar": [9.59, 77.96],
    },
    "Telangana": {
        "Adilabad": [19.67, 78.53], "Hyderabad": [17.38, 78.49], "Karimnagar": [18.44, 79.13],
        "Khammam": [17.25, 80.15], "Mahabubnagar": [16.74, 78.00],
        "Medak": [18.05, 78.26], "Nalgonda": [17.05, 79.27], "Nizamabad": [18.67, 78.09],
        "Rangareddy": [17.32, 78.40], "Warangal": [17.98, 79.60],
    },
    "Tripura": {
        "Agartala": [23.83, 91.28], "Udaipur": [23.53, 91.48],
    },
    "Uttar Pradesh": {
        "Agra": [27.18, 78.02], "Aligarh": [27.88, 78.08], "Allahabad": [25.43, 81.85],
        "Azamgarh": [26.07, 83.19], "Bareilly": [28.37, 79.42], "Bijnor": [29.37, 78.14],
        "Budaun": [28.04, 79.12], "Bulandshahr": [28.41, 77.85], "Deoria": [26.50, 83.79],
        "Etawah": [26.79, 79.02], "Faizabad": [26.77, 82.14], "Farrukhabad": [27.39, 79.58],
        "Fatehpur": [25.93, 80.81], "Firozabad": [27.15, 78.39], "Ghaziabad": [28.67, 77.42],
        "Ghazipur": [25.58, 83.58], "Gorakhpur": [26.76, 83.37], "Hardoi": [27.39, 80.13],
        "Jaunpur": [25.75, 82.69], "Jhansi": [25.45, 78.57], "Kanpur": [26.45, 80.35],
        "Lakhimpur Kheri": [27.95, 80.78], "Lucknow": [26.85, 80.95],
        "Mathura": [27.49, 77.67], "Meerut": [28.98, 77.71], "Mirzapur": [25.15, 82.57],
        "Moradabad": [28.83, 78.78], "Muzaffarnagar": [29.47, 77.70],
        "Noida": [28.57, 77.32], "Prayagraj": [25.43, 81.85], "Rae Bareli": [26.23, 81.23],
        "Saharanpur": [29.96, 77.55], "Shahjahanpur": [27.88, 79.91],
        "Sitapur": [27.57, 80.68], "Sultanpur": [26.26, 82.07], "Unnao": [26.55, 80.49],
        "Varanasi": [25.32, 83.01],
    },
    "Uttarakhand": {
        "Dehradun": [30.32, 78.03], "Haridwar": [29.95, 78.16], "Nainital": [29.38, 79.45],
        "Rudraprayag": [30.28, 78.98], "Udham Singh Nagar": [28.98, 79.41],
    },
    "West Bengal": {
        "Asansol": [23.68, 86.95], "Bankura": [23.23, 87.07], "Bardhaman": [23.23, 87.86],
        "Birbhum": [23.86, 87.62], "Cooch Behar": [26.32, 89.44], "Darjeeling": [27.04, 88.26],
        "Hooghly": [22.91, 88.39], "Howrah": [22.59, 88.26], "Jalpaiguri": [26.52, 88.73],
        "Kolkata": [22.57, 88.36], "Malda": [25.01, 88.14], "Medinipur": [22.42, 87.32],
        "Murshidabad": [24.18, 88.27], "Nadia": [23.47, 88.56], "North 24 Parganas": [22.62, 88.44],
        "Purulia": [23.33, 86.37], "Siliguri": [26.71, 88.43], "South 24 Parganas": [22.16, 88.43],
    },
    "Delhi": {
        "New Delhi": [28.61, 77.21], "North Delhi": [28.71, 77.20], "South Delhi": [28.53, 77.23],
        "East Delhi": [28.63, 77.29], "West Delhi": [28.65, 77.10],
    },
    "Jammu and Kashmir": {
        "Anantnag": [33.73, 75.15], "Baramulla": [34.20, 74.34], "Jammu": [32.73, 74.87],
        "Kathua": [32.39, 75.52], "Srinagar": [34.08, 74.80], "Udhampur": [32.92, 75.14],
    },
    "Ladakh": {
        "Leh": [34.16, 77.58], "Kargil": [34.55, 76.13],
    },
    "Chandigarh": {
        "Chandigarh": [30.73, 76.78],
    },
    "Puducherry": {
        "Puducherry": [11.93, 79.83], "Karaikal": [10.92, 79.84],
    },
}

# Write out as Python module
out = pathlib.Path(__file__).parent / "india_locations.py"
lines = ['"""', 'Complete India Locations Database', 'All states/UTs -> districts with lat/lon coordinates.', 'Auto-generated — do not edit manually.', '"""', '', 'INDIA_LOCATIONS = {']

for state, districts in sorted(INDIA_LOCATIONS.items()):
    lines.append(f'    "{state}": {{')
    for dist, (lat, lon) in sorted(districts.items()):
        lines.append(f'        "{dist}": {{"lat": {lat}, "lon": {lon}}},')
    lines.append('    },')
lines.append('}')
lines.append('')

# Helper to get flat state list
lines.append('def get_states():')
lines.append('    """Return sorted list of all states/UTs."""')
lines.append('    return sorted(INDIA_LOCATIONS.keys())')
lines.append('')

lines.append('def get_districts(state):')
lines.append('    """Return sorted list of districts for a state."""')
lines.append('    s = INDIA_LOCATIONS.get(state, {})')
lines.append('    return sorted(s.keys())')
lines.append('')

lines.append('def get_coords_for_district(state, district):')
lines.append('    """Return (lat, lon) for a state+district, or None."""')
lines.append('    s = INDIA_LOCATIONS.get(state, {})')
lines.append('    d = s.get(district)')
lines.append('    if d:')
lines.append('        return d["lat"], d["lon"]')
lines.append('    return None, None')
lines.append('')

lines.append('def get_location_tree():')
lines.append('    """Return {state: [district, ...]} for frontend dropdown."""')
lines.append('    return {state: sorted(districts.keys()) for state, districts in sorted(INDIA_LOCATIONS.items())}')
lines.append('')

lines.append('def find_nearest_district(lat, lon):')
lines.append('    """Find the nearest district to given GPS coordinates."""')
lines.append('    best = None')
lines.append('    best_dist = float("inf")')
lines.append('    for state, districts in INDIA_LOCATIONS.items():')
lines.append('        for district, coords in districts.items():')
lines.append('            d = (coords["lat"] - lat) ** 2 + (coords["lon"] - lon) ** 2')
lines.append('            if d < best_dist:')
lines.append('                best_dist = d')
lines.append('                best = {"state": state, "district": district, "lat": coords["lat"], "lon": coords["lon"]}')
lines.append('    return best')
lines.append('')

out.write_text('\n'.join(lines), encoding='utf-8')
print(f"Generated {out} with {sum(len(d) for d in INDIA_LOCATIONS.values())} districts across {len(INDIA_LOCATIONS)} states/UTs")
