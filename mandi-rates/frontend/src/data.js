// ============================================================
//  data.js  –  All crops, states and districts
//  Import this into your component:
//    import { CROPS, STATES } from "./data";
// ============================================================

export const CROPS = [
  // Vegetables
  "Tomato", "Onion", "Potato", "Cabbage", "Cauliflower",
  "Brinjal", "Lady Finger (Bhindi)", "Bitter Gourd", "Bottle Gourd",
  "Capsicum", "Carrot", "Radish", "Spinach", "Coriander",
  "Green Chilli", "Garlic", "Ginger", "Peas", "Beans", "Drumstick",
  // Fruits
  "Banana", "Papaya", "Mango", "Grapes", "Watermelon", "Pomegranate",
  "Guava", "Sapota (Chikoo)",
  // Grains & Pulses
  "Wheat", "Rice (Paddy)", "Maize", "Soybean", "Groundnut",
  "Jowar", "Bajra", "Ragi", "Moong Dal", "Toor Dal", "Chana",
  // Cash Crops
  "Cotton", "Sugarcane", "Turmeric", "Red Chilli", "Cumin",
  "Coriander Seeds", "Mustard", "Sesame",
];

// Each state → array of districts (last entry is always "All Districts")
export const STATES = {
  "Andhra Pradesh": [
    "Visakhapatnam","Vijayawada","Guntur","Nellore","Kurnool",
    "Tirupati","Anantapur","Kadapa","Rajahmundry","Eluru",
    "Ongole","Srikakulam","Vizianagaram","West Godavari","East Godavari",
    "All Districts",
  ],
  "Tamil Nadu": [
    "Chennai","Coimbatore","Madurai","Salem","Trichy",
    "Tirunelveli","Erode","Vellore","Thanjavur","Dindigul",
    "Kancheepuram","Tiruppur","Krishnagiri","Dharmapuri","Namakkal",
    "All Districts",
  ],
  "Karnataka": [
    "Bengaluru","Mysuru","Hubli","Mangaluru","Belagavi",
    "Kalaburagi","Tumakuru","Shivamogga","Davangere","Udupi",
    "Vijayapura","Dharwad","Hassan","Chikkamagaluru","Raichur",
    "All Districts",
  ],
  "Maharashtra": [
    "Mumbai","Pune","Nagpur","Nashik","Aurangabad",
    "Solapur","Kolhapur","Amravati","Sangli","Jalgaon",
    "Satara","Ahmednagar","Latur","Osmanabad","Wardha",
    "All Districts",
  ],
  "Gujarat": [
    "Ahmedabad","Surat","Vadodara","Rajkot","Bhavnagar",
    "Jamnagar","Junagadh","Gandhinagar","Anand","Mehsana",
    "Surendranagar","Patan","Banaskantha","Sabarkantha","Kheda",
    "All Districts",
  ],
  "Rajasthan": [
    "Jaipur","Jodhpur","Udaipur","Kota","Ajmer",
    "Bikaner","Alwar","Bharatpur","Sikar","Pali",
    "Barmer","Nagaur","Chittorgarh","Tonk","Sawai Madhopur",
    "All Districts",
  ],
  "Uttar Pradesh": [
    "Lucknow","Kanpur","Agra","Varanasi","Meerut",
    "Allahabad","Gorakhpur","Ghaziabad","Mathura","Bareilly",
    "Moradabad","Aligarh","Saharanpur","Muzaffarnagar","Etawah",
    "All Districts",
  ],
  "Madhya Pradesh": [
    "Bhopal","Indore","Jabalpur","Gwalior","Ujjain",
    "Sagar","Rewa","Satna","Ratlam","Dewas",
    "Hoshangabad","Vidisha","Sehore","Raisen","Chhindwara",
    "All Districts",
  ],
  "Punjab": [
    "Ludhiana","Amritsar","Jalandhar","Patiala","Bathinda",
    "Moga","Gurdaspur","Hoshiarpur","Ferozepur","Faridkot",
    "Sangrur","Barnala","Mansa","Fatehgarh Sahib","Rupnagar",
    "All Districts",
  ],
  "Haryana": [
    "Gurugram","Faridabad","Hisar","Rohtak","Ambala",
    "Karnal","Panipat","Yamunanagar","Sonipat","Bhiwani",
    "Sirsa","Fatehabad","Jind","Kaithal","Kurukshetra",
    "All Districts",
  ],
  "West Bengal": [
    "Kolkata","Howrah","Asansol","Siliguri","Durgapur",
    "Bardhaman","Malda","Murshidabad","Nadia","North 24 Parganas",
    "South 24 Parganas","Hooghly","Bankura","Purulia","Birbhum",
    "All Districts",
  ],
  "Odisha": [
    "Bhubaneswar","Cuttack","Rourkela","Sambalpur","Berhampur",
    "Balasore","Baripada","Puri","Koraput","Rayagada",
    "Kendrapara","Jajpur","Dhenkanal","Keonjhar","Mayurbhanj",
    "All Districts",
  ],
  "Telangana": [
    "Hyderabad","Warangal","Nizamabad","Karimnagar","Khammam",
    "Nalgonda","Mahbubnagar","Rangareddy","Medak","Adilabad",
    "Suryapet","Yadadri","Siddipet","Kamareddy","Mancherial",
    "All Districts",
  ],
  "Kerala": [
    "Thiruvananthapuram","Kochi","Kozhikode","Thrissur","Kannur",
    "Kollam","Palakkad","Malappuram","Alappuzha","Kottayam",
    "Idukki","Wayanad","Kasaragod","Pathanamthitta","Ernakulam",
    "All Districts",
  ],
  "Bihar": [
    "Patna","Gaya","Muzaffarpur","Bhagalpur","Darbhanga",
    "Purnia","Arrah","Begusarai","Katihar","Munger",
    "Samastipur","Sitamarhi","Madhubani","Supaul","Kishanganj",
    "All Districts",
  ],
  "Chhattisgarh": [
    "Raipur","Bilaspur","Durg","Bhilai","Korba",
    "Rajnandgaon","Raigarh","Jagdalpur","Ambikapur","Dhamtari",
    "All Districts",
  ],
  "Jharkhand": [
    "Ranchi","Jamshedpur","Dhanbad","Bokaro","Deoghar",
    "Hazaribagh","Giridih","Ramgarh","Dumka","Pakur",
    "All Districts",
  ],
  "Himachal Pradesh": [
    "Shimla","Kullu","Mandi","Kangra","Solan",
    "Una","Hamirpur","Chamba","Bilaspur","Kinnaur",
    "All Districts",
  ],
  "Uttarakhand": [
    "Dehradun","Haridwar","Roorkee","Haldwani","Nainital",
    "Almora","Rudrapur","Mussoorie","Rishikesh","Pithoragarh",
    "All Districts",
  ],
  "Assam": [
    "Guwahati","Dibrugarh","Jorhat","Silchar","Tezpur",
    "Nagaon","Tinsukia","Sivasagar","Dhubri","Bongaigaon",
    "All Districts",
  ],
};
