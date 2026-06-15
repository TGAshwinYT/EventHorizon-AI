import { useState, useEffect } from 'react';
import { useUserStore } from '../store/userStore';
import LanguagePicker from './LanguagePicker';
import { Sprout, MapPin, User, Bell, CheckCircle } from 'lucide-react';

const STATES_DISTRICTS: Record<string, string[]> = {
  'Tamil Nadu': ['Ariyalur', 'Chennai', 'Coimbatore', 'Cuddalore', 'Dharmapuri', 'Dindigul', 'Erode', 'Kanchipuram', 'Madurai', 'Nagapattinam', 'Salem', 'Thanjavur', 'Trichy', 'Tirunelveli', 'Vellore'],
  'Andhra Pradesh': ['Anantapur', 'Chittoor', 'East Godavari', 'Guntur', 'Krishna', 'Kurnool', 'Nellore', 'Prakasam', 'Srikakulam', 'Visakhapatnam', 'West Godavari'],
  'Karnataka': ['Bangalore Rural', 'Bangalore Urban', 'Belgaum', 'Bellary', 'Bidar', 'Chikmagalur', 'Dharwad', 'Gulbarga', 'Hassan', 'Mysore', 'Shimoga', 'Tumkur', 'Udupi'],
  'Punjab': ['Amritsar', 'Bathinda', 'Firozpur', 'Gurdaspur', 'Jalandhar', 'Ludhiana', 'Mansa', 'Patiala', 'Sangrur'],
  'Maharashtra': ['Ahmednagar', 'Akola', 'Aurangabad', 'Beed', 'Kolhapur', 'Nagpur', 'Nashik', 'Pune', 'Sangli', 'Satara', 'Solapur', 'Thane']
};

const DISTRICT_PLACES: Record<string, string[]> = {
  // Tamil Nadu
  'Krishnagiri': ['Hosur', 'Krishnagiri', 'Denkanikottai', 'Pochampalli', 'Uthangarai', 'Shoolagiri', 'Bargur', 'Anchetty'],
  'Salem': ['Salem', 'Attur', 'Mettur', 'Omalur', 'Edappadi', 'Sankari', 'Yercaud', 'Gangavalli'],
  'Chennai': ['Adyar', 'Anna Nagar', 'Guindy', 'Mylapore', 'T. Nagar', 'Velachery', 'Tambaram', 'Chromepet', 'Nungambakkam'],
  'Coimbatore': ['Coimbatore', 'Pollachi', 'Mettupalayam', 'Valparai', 'Sulur', 'Annur', 'Kinathukadavu'],
  'Dharmapuri': ['Dharmapuri', 'Harur', 'Pennagaram', 'Palacode', 'Pappireddipatti'],
  'Madurai': ['Madurai', 'Melur', 'Thirumangalam', 'Usilampatti', 'Vadipatti', 'Tirupparankundram'],
  'Trichy': ['Trichy', 'Lalgudi', 'Manapparai', 'Musiri', 'Thuraiyur', 'Srirangam'],
  'Erode': ['Erode', 'Gobichettipalayam', 'Bhavani', 'Perundurai', 'Sathyamangalam'],
  'Vellore': ['Vellore', 'Katpadi', 'Gudiyatham', 'Pernambut', 'Anaicut'],
  'Thanjavur': ['Thanjavur', 'Kumbakonam', 'Pattukkottai', 'Orathanadu', 'Thiruvaiyaru'],
  'Tirunelveli': ['Tirunelveli', 'Ambasamudram', 'Nanguneri', 'Radhapuram', 'Palayamkottai'],
  'Cuddalore': ['Cuddalore', 'Chidambaram', 'Vriddhachalam', 'Panruti', 'Neyveli'],
  'Kanchipuram': ['Kanchipuram', 'Sriperumbudur', 'Uthiramerur', 'Walajabad'],
  'Nagapattinam': ['Nagapattinam', 'Velankanni', 'Vedaranyam', 'Thirukkuvalai'],
  
  // Karnataka
  'Bangalore Urban': ['Bangalore', 'Yelahanka', 'Kengeri', 'Whitefield', 'Electronic City'],
  'Bangalore Rural': ['Doddaballapur', 'Devanahalli', 'Hosakote', 'Nelamangala'],
  'Mysore': ['Mysore', 'Nanjangud', 'Hunsur', 'T Narasipura', 'K R Nagar'],
  
  // Andhra Pradesh
  'Anantapur': ['Anantapur', 'Dharmavaram', 'Guntakal', 'Hindupur', 'Kadiri', 'Tadipatri'],
  'Chittoor': ['Chittoor', 'Madanapalle', 'Punganur', 'Palamaner'],
  
  // Maharashtra
  'Pune': ['Pune City', 'Pimpri-Chinchwad', 'Baramati', 'Lonavala', 'Junjnar', 'Maval'],
  'Nashik': ['Nashik', 'Malegaon', 'Sinnar', 'Niphad', 'Yeola'],
  
  // Punjab
  'Ludhiana': ['Ludhiana', 'Khanna', 'Jagraon', 'Samrala', 'Payal', 'Mullanpur']
};

const PLACE_TRANSLATIONS: Record<string, any> = {
  en: {
    locPlaceLabel: "Place / Mandal / Taluk",
    locPlacePlaceholder: "Select Place",
    locPlaceCustomPlaceholder: "Type custom place name",
    locPlaceSelectDistrictFirst: "Select a district first",
    locPlaceOtherOption: "Other (Type custom place...)",
    locUseCurrentLocation: "Use Current Location",
    locDetecting: "Detecting location...",
    locDetectFailed: "Failed to detect location. Please select manually."
  },
  ta: {
    locPlaceLabel: "இடம் / மண்டலம் / தாலுகா",
    locPlacePlaceholder: "இடத்தை தேர்வு செய்யவும்",
    locPlaceCustomPlaceholder: "இடத்தின் பெயரை உள்ளிடவும்",
    locPlaceSelectDistrictFirst: "முதலில் மாவட்டத்தை தேர்வு செய்யவும்",
    locPlaceOtherOption: "மற்றவை (சுயமாக உள்ளிடவும்)",
    locUseCurrentLocation: "தற்போதைய இருப்பிடத்தைப் பயன்படுத்தவும்",
    locDetecting: "இருப்பிடத்தைக் கண்டறிகிறது...",
    locDetectFailed: "இருப்பிடத்தைக் கண்டறிய முடியவில்லை. தயவுசெய்து சுயமாக தேர்ந்தெடுக்கவும்."
  },
  hi: {
    locPlaceLabel: "स्थान / मंडल / तालुका",
    locPlacePlaceholder: "स्थान चुनें",
    locPlaceCustomPlaceholder: "स्थान का नाम दर्ज करें",
    locPlaceSelectDistrictFirst: "पहले जिला चुनें",
    locPlaceOtherOption: "अन्य (स्वयं दर्ज करें)",
    locUseCurrentLocation: "वर्तमान स्थान का उपयोग करें",
    locDetecting: "स्थान का पता लगाया जा रहा है...",
    locDetectFailed: "स्थान का पता नहीं लगाया जा सका। कृपया मैन्युअल रूप से चुनें।"
  },
  te: {
    locPlaceLabel: "ప్రాంతం / మండలం / తాలూకా",
    locPlacePlaceholder: "ప్రాంతాన్ని ఎంచుకోండి",
    locPlaceCustomPlaceholder: "ప్రాంతం పేరును నమోదు చేయండి",
    locPlaceSelectDistrictFirst: "ముందుగా జిల్లాను ఎంచుకోండి",
    locPlaceOtherOption: "ఇతర (స్వంతంగా నమోదు చేయండి)",
    locUseCurrentLocation: "ప్రస్తుత స్థానాన్ని ఉపయోగించండి",
    locDetecting: "స్థానాన్ని గుర్తిస్తోంది...",
    locDetectFailed: "స్థానాన్ని గుర్తించలేకపోయాము. దయచేసి స్వయంగా ఎంచుకోండి."
  },
  kn: {
    locPlaceLabel: "ಸ್ಥಳ / ಹೋಬಳಿ / ತಾಲೂಕು",
    locPlacePlaceholder: "ಸ್ಥಳ ಆಯ್ಕೆಮಾಡಿ",
    locPlaceCustomPlaceholder: "ಸ್ಥಳದ ಹೆಸರನ್ನು ನಮೂದಿಸಿ",
    locPlaceSelectDistrictFirst: "ಮೊದಲು ಜಿಲ್ಲೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ",
    locPlaceOtherOption: "ಇತರೆ (ಬರೆಯಿರಿ)",
    locUseCurrentLocation: "ಪ್ರಸ್ತುತ ಸ್ಥಳ ಬಳಸಿ",
    locDetecting: "ಸ್ಥಳ ಪತ್ತೆಹಚ್ಚಲಾಗುತ್ತಿದೆ...",
    locDetectFailed: "ಸ್ಥಳ ಪತ್ತೆ ಮಾಡಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಹಸ್ತಚಾಲಿತವಾಗಿ ಆಯ್ಕೆಮಾಡಿ."
  },
  ml: {
    locPlaceLabel: "സ്ഥലം / മണ്ഡലം / താലൂക്ക്",
    locPlacePlaceholder: "സ്ഥലം തിരഞ്ഞെടുക്കുക",
    locPlaceCustomPlaceholder: "സ്ഥലത്തിന്റെ പേര് നൽകുക",
    locPlaceSelectDistrictFirst: "ആദ്യം ജില്ല തിരഞ്ഞെടുക്കുക",
    locPlaceOtherOption: "മറ്റുള്ളവ (ടൈപ്പ് ചെയ്യുക)",
    locUseCurrentLocation: "നിലവിലെ സ്ഥാനം ഉപയോഗിക്കുക",
    locDetecting: "സ്ഥാനം കണ്ടെത്തുന്നു...",
    locDetectFailed: "സ്ഥാനം കണ്ടെത്താൻ കഴിഞ്ഞില്ല. ദയവായി നേരിട്ട് തിരഞ്ഞെടുക്കുക."
  },
  bn: {
    locPlaceLabel: "স্থান / মণ্ডল / তালুক",
    locPlacePlaceholder: "স্থান নির্বাচন করুন",
    locPlaceCustomPlaceholder: "স্থানের নাম লিখুন",
    locPlaceSelectDistrictFirst: "প্রথমে জেলা নির্বাচন করুন",
    locPlaceOtherOption: "অন্যান্য (লিখুন)",
    locUseCurrentLocation: "বর্তমান অবস্থান ব্যবহার করুন",
    locDetecting: "অবস্থান খোঁজা হচ্ছে...",
    locDetectFailed: "অবস্থান সনাক্ত করা যায়নি। অনুগ্রহ করে নিজে নির্বাচন করুন।"
  },
  mr: {
    locPlaceLabel: "ठिकाण / मंडळ / तालुका",
    locPlacePlaceholder: "ठिकाण निवडा",
    locPlaceCustomPlaceholder: "ठिकाणाचे नाव लिहा",
    locPlaceSelectDistrictFirst: "प्रथम जिल्हा निवडा",
    locPlaceOtherOption: "इतर (स्वतः लिहा)",
    locUseCurrentLocation: "सध्याचे स्थान वापरा",
    locDetecting: "स्थान शोधत आहे...",
    locDetectFailed: "स्थान सापडले नाही. कृपया स्वतः निवडा।"
  },
  pa: {
    locPlaceLabel: "ਥਾਂ / ਮੰਡਲ / ਤਹਿਸੀਲ",
    locPlacePlaceholder: "ਥਾਂ ਚੁਣੋ",
    locPlaceCustomPlaceholder: "ਥਾਂ ਦਾ ਨਾਮ ਲਿਖੋ",
    locPlaceSelectDistrictFirst: "ਪਹਿਲਾਂ ਜ਼ਿਲ੍ਹਾ ਚੁਣੋ",
    locPlaceOtherOption: "ਹੋਰ (ਖੁਦ ਲਿੋ)",
    locUseCurrentLocation: "ਮੌਜੂਦਾ ਸਥਾਨ ਦੀ ਵਰਤੋਂ ਕਰੋ",
    locDetecting: "ਸਥਾਨ ਦਾ ਪਤਾ ਲਗਾਇਆ ਜਾ ਰਿਹਾ ਹੈ...",
    locDetectFailed: "ਸਥਾਨ ਦਾ ਪਤਾ ਨਹੀਂ ਲੱਗ ਸਕਿਆ। ਕਿਰਪਾ ਕਰਕੇ ਖੁਦ ਚੁਣੋ।"
  }
};

const CROPS = [

  { id: 'paddy', name: 'Paddy / நெல்', icon: '🌾' },
  { id: 'cotton', name: 'Cotton / பருத்தி', icon: '☁️' },
  { id: 'wheat', name: 'Wheat / கோதுமை', icon: '🌾' },
  { id: 'sugarcane', name: 'Sugarcane / கரும்பு', icon: '🎋' },
  { id: 'maize', name: 'Maize / சோளம்', icon: '🌽' },
  { id: 'chilli', name: 'Chilli / மிளகாய்', icon: '🌶️' },
  { id: 'turmeric', name: 'Turmeric / மஞ்சள்', icon: '🍠' },
  { id: 'vegetables', name: 'Vegetables / காய்கறி', icon: '🥦' }
];

const TRANSLATIONS: Record<string, any> = {
  en: {
    headerTitle: "Your Details",
    stepIndicator: "Step {step} of 5",
    // Step 2: Name
    nameTitle: "Hello! What is your name?",
    nameSub: "Please enter your name so Horizon can address you warmly",
    nameLabel: "Your Name",
    namePlaceholder: "Example: John",
    // Step 3: Location
    locTitle: "Where is your farm located?",
    locSub: "Select your state and district to get real-time crop insights and mandi rates",
    locStateLabel: "State",
    locStatePlaceholder: "Select State",
    locDistrictLabel: "District",
    locDistrictPlaceholder: "Select District",
    locDistrictSelectFirst: "Select a state first",
    // Step 4: Crops
    cropTitle: "Which crops do you grow?",
    cropSub: "Select the crops you grow (Choose multiple if applicable)",
    // Step 5: Alerts
    alertTitle: "Enable advisory alerts?",
    alertSub: "Enable pest warnings, weather alerts, and schemes notifications",
    alertToggleLabel: "Alerts & Notifications",
    alertToggleSub: "Receive dynamic pest & rain warnings",
    alertReadyMsg: "Horizon is fully prepped to help you move further! 🚀",
    // Common buttons
    back: "Back",
    next: "Next",
    finish: "Activate Horizon"
  },
  ta: {
    headerTitle: "உங்களது விவரங்கள்",
    stepIndicator: "படி {step} / 5",
    nameTitle: "வணக்கம்! உங்க பெயர் என்ன?",
    nameSub: "உங்களை அன்போடு அழைக்க உங்கள் பெயரை உள்ளிடவும்",
    nameLabel: "உங்கள் பெயர்",
    namePlaceholder: "உதாரணம்: முருகன்",
    locTitle: "உங்க ஊர் எது?",
    locSub: "விளைச்சல் விவரங்கள் மற்றும் மண்டி விலைகளை அறிய மாநிலம் மற்றும் மாவட்டத்தை தேர்வு செய்யவும்",
    locStateLabel: "மாநிலம்",
    locStatePlaceholder: "மாநிலத்தை தேர்வு செய்யவும்",
    locDistrictLabel: "மாவட்டம்",
    locDistrictPlaceholder: "மாவட்டத்தை தேர்வு செய்யவும்",
    locDistrictSelectFirst: "முதலில் மாநிலத்தை தேர்வு செய்யவும்",
    cropTitle: "என்னென்ன பயிர்கள் செய்கிறீர்கள்?",
    cropSub: "நீங்கள் பயிரிடும் பயிர்களை தேர்வு செய்யவும் (ஒன்றுக்கு மேற்பட்டவற்றை தேர்வு செய்யலாம்)",
    alertTitle: "அபாய எச்சரிக்கைகளை இயக்கவா?",
    alertSub: "பூச்சி எச்சரிக்கைகள், வானிலை எச்சரிக்கைகள் மற்றும் திட்ட அறிவிப்புகளை இயக்கவும்",
    alertToggleLabel: "எச்சரிக்கைகள்",
    alertToggleSub: "பூச்சி மற்றும் மழை அபாய எச்சரிக்கைகளைப் பெறுங்கள்",
    alertReadyMsg: "உங்களுக்கு உதவ ஹொரைசன் தயார் நிலையில் உள்ளது! 🚀",
    back: "முந்தையது",
    next: "அடுத்து",
    finish: "ஹொரைசனைத் தொடங்கு"
  },
  hi: {
    headerTitle: "आपका विवरण",
    stepIndicator: "चरण {step} / 5",
    nameTitle: "नमस्ते! आपका नाम क्या है?",
    nameSub: "कृपया अपना नाम दर्ज करें ताकि होराइजन आपका स्वागत कर सके",
    nameLabel: "आपका नाम",
    namePlaceholder: "उदाहरण: राम",
    locTitle: "आपका खेत कहाँ स्थित है?",
    locSub: "सटीक फसल सलाह और मंडी भाव प्राप्त करने के लिए अपना राज्य और जिला चुनें",
    locStateLabel: "राज्य",
    locStatePlaceholder: "राज्य चुनें",
    locDistrictLabel: "जिला",
    locDistrictPlaceholder: "जिला चुनें",
    locDistrictSelectFirst: "पहले राज्य चुनें",
    cropTitle: "आप कौन सी फसलें उगाते हैं?",
    cropSub: "अपनी फसलें चुनें (यदि लागू हो तो एक से अधिक चुनें)",
    alertTitle: "सलाह अलर्ट सक्षम करें?",
    alertSub: "कीट चेतावनी, मौसम अलर्ट और सरकारी योजनाओं की सूचनाएं सक्षम करें",
    alertToggleLabel: "अलर्ट और सूचनाएं",
    alertToggleSub: "मौसम और कीट चेतावनी प्राप्त करें",
    alertReadyMsg: "होराइजन आपकी मदद के लिए पूरी तरह तैयार है! 🚀",
    back: "पीछे",
    next: "आगे",
    finish: "होराइजन सक्रिय करें"
  },
  te: {
    headerTitle: "మీ వివరాలు",
    stepIndicator: "దశ {step} / 5",
    nameTitle: "నమస్కారం! మీ పేరు ఏమిటి?",
    nameSub: "హోరైజన్ మిమ్మల్ని సంబోధించడానికి దయచేసి మీ పేరును నమోదు చేయండి",
    nameLabel: "మీ పేరు",
    namePlaceholder: "ఉదాహరణ: రాము",
    locTitle: "మీ పొలం ఎక్కడ ఉంది?",
    locSub: "పంట సలహాలు మరియు మండి ధరలను తెలుసుకోవడానికి మీ రాష్ట్రం మరియు జిల్లాను ఎంచుకోండి",
    locStateLabel: "రాష్ట్రం",
    locStatePlaceholder: "రాష్ట్రాన్ని ఎంచుకోండి",
    locDistrictLabel: "జిల్లా",
    locDistrictPlaceholder: "జిల్లాను ఎంచుకోండి",
    locDistrictSelectFirst: "ముందుగా రాష్ట్రాన్ని ఎంచుకోండి",
    cropTitle: "మీరు ఏ పంటలు పండిస్తారు?",
    cropSub: "మీరు పండించే పంటలను ఎంచుకోండి (వర్తిస్తే ఒకటి కంటే ఎక్కువ ఎంచుకోవచ్చు)",
    alertTitle: "అలర్ట్‌లను ప్రారంభించాలా?",
    alertSub: "తెగుళ్ల హెచ్చరికలు, వాతావరణ అలర్ట్‌లు మరియు పథకాల నోటిఫికேషన్‌లను ప్రారంభించండి",
    alertToggleLabel: "అలర్ట్‌లు",
    alertToggleSub: "తెగుళ్లు & వర్షం హెచ్చరికలను పొందండి",
    alertReadyMsg: "హోరైజన్ మీ సేవకు సిద్ధంగా ఉంది! 🚀",
    back: "వెనుకకు",
    next: "తరువాత",
    finish: "హోరైజన్‌ను ప్రారంభించు"
  },
  kn: {
    headerTitle: "ನಿಮ್ಮ ವಿವರಗಳು",
    stepIndicator: "ಹಂತ {step} / 5",
    nameTitle: "ನಮಸ್ಕಾರ! ನಿಮ್ಮ ಹೆಸರೇನು?",
    nameSub: "ಹೊರೈಜನ್ ನಿಮ್ಮನ್ನು ಸಂಬೋಧಿಸಲು ದಯವಿಟ್ಟು ನಿಮ್ಮ ಹೆಸರನ್ನು ನಮೂದಿಸಿ",
    nameLabel: "ನಿಮ್ಮ ಹೆಸರು",
    namePlaceholder: "ಉದಾಹರಣೆ: ರಾಜು",
    locTitle: "ನಿಮ್ಮ ಜಮೀನು ಎಲ್ಲಿದೆ?",
    locSub: "ಬೆಳೆ ಸಲಹೆಗಳು ಮತ್ತು ಮಂಡಿ ದರಗಳನ್ನು ಪಡೆಯಲು ನಿಮ್ಮ ರಾಜ್ಯ ಮತ್ತು ಜಿಲ್ಲೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ",
    locStateLabel: "ರಾಜ್ಯ",
    locStatePlaceholder: "ರಾಜ್ಯವನ್ನು ಆಯ್ಕೆಮಾಡಿ",
    locDistrictLabel: "ಜಿಲ್ಲೆ",
    locDistrictPlaceholder: "ಜಿಲ್ಲೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ",
    locDistrictSelectFirst: "ಮೊದಲು ರಾಜ್ಯವನ್ನು ಆಯ್ಕೆಮಾಡಿ",
    cropTitle: "ನೀವು ಯಾವ ಬೆಳೆಗಳನ್ನು ಬೆಳೆಯುತ್ತೀರಿ?",
    cropSub: "ನೀವು ಬೆಳೆಯುವ ಬೆಳೆಗಳನ್ನು ಆಯ್ಕೆಮಾಡಿ (ಅನ್ವಯಿಸಿದರೆ ಒಂದಕ್ಕಿಂತ ಹೆಚ್ಚು ಆಯ್ಕೆಮಾಡಿ)",
    alertTitle: "ಅಲರ್ಟ್‌ಗಳನ್ನು ಸಕ್ರಿಯಗೊಳಿಸಬೇಕೇ?",
    alertSub: "ಕೀಟ ಬಾಧೆ ಎಚ್ಚರಿಕೆ, ಹವಾಮಾನ அலರ್ಟ್‌ಗಳು ಮತ್ತು ಯೋಜನೆಗಳ ಮಾಹಿತಿಯನ್ನು ಪಡೆಯಿರಿ",
    alertToggleLabel: "ಅಲರ್ಟ್‌ಗಳು",
    alertToggleSub: "ಹವಾಮಾನ ಮತ್ತು ಕೀಟ ಎಚ್ಚರಿಕೆಗಳನ್ನು ಸ್ವೀಕರಿಸಿ",
    alertReadyMsg: "ಹೊರೈಜನ್ ನಿಮಗೆ ಸಹಾಯ ಮಾಡಲು ಸಿದ್ಧವಾಗಿದೆ! 🚀",
    back: "ಹಿಂದಕ್ಕೆ",
    next: "ಮುಂದೆ",
    finish: "ಹೊರೈಜನ್ ಸಕ್ರಿಯಗೊಳಿಸಿ"
  },
  ml: {
    headerTitle: "നിങ്ങളുടെ വിവരങ്ങൾ",
    stepIndicator: "ഘട്ടം {step} / 5",
    nameTitle: "നമസ്കാരം! നിങ്ങളുടെ പേരെന്താണ്?",
    nameSub: "ഹൊറൈസൺ നിങ്ങളെ അഭിസംബോധന ചെയ്യാൻ നിങ്ങളുടെ പേര് നൽകുക",
    nameLabel: "നിങ്ങളുടെ പേര്",
    namePlaceholder: "ഉദാഹരണത്തിന്: ഹരി",
    locTitle: "നിങ്ങളുടെ കൃഷിയിടം എവിടെയാണ്?",
    locSub: "വിള വിവരങ്ങളും മണ്ടി വിലകളും ലഭിക്കുന്നതിന് നിങ്ങളുടെ സംസ്ഥാനവും ജില്ലയും തിരഞ്ഞെടുക്കുക",
    locStateLabel: "സംസ്ഥാനം",
    locStatePlaceholder: "സംസ്ഥാനം തിരഞ്ഞെടുക്കുക",
    locDistrictLabel: "ജില്ല",
    locDistrictPlaceholder: "ജില്ല തിരഞ്ഞെടുക്കുക",
    locDistrictSelectFirst: "ആദ്യം സംസ്ഥാനം തിരഞ്ഞെടുക്കുക",
    cropTitle: "നിങ്ങൾ ഏതൊക്കെ വിളകളാണ് കൃഷി ചെയ്യുന്നത്?",
    cropSub: "നിങ്ങൾ കൃഷി ചെയ്യുന്ന വിളകൾ തിരഞ്ഞെടുക്കുക (ഒന്നിലധികം തിരഞ്ഞെടുക്കാം)",
    alertTitle: "അലേർട്ടുകൾ പ്രവർത്തനക്ഷമമാക്കണോ?",
    alertSub: "കീടബാധ മുന്നറിയിപ്പുകൾ, കാലാവസ്ഥാ അലേർട്ടുകൾ, പദ്ധതി അറിയിപ്പുകൾ എന്നിവ ലഭ്യമാക്കുക",
    alertToggleLabel: "അലേർട്ടുകൾ",
    alertToggleSub: "കാലാവസ്ഥാ, കീടബാധ മുന്നറിയിപ്പുകൾ സ്വീകരിക്കുക",
    alertReadyMsg: "ഹൊറൈസൺ നിങ്ങളുടെ സഹായത്തിന് സജ്ജമാണ്! 🚀",
    back: "പുറകോട്ട്",
    next: "അടുത്തത്",
    finish: "ഹൊറൈസൺ സജീവമാക്കുക"
  },
  bn: {
    headerTitle: "আপনার বিবরণ",
    stepIndicator: "ধাপ {step} / 5",
    nameTitle: "নমস্কার! আপনার নাম কি?",
    nameSub: "হরাইজন যাতে আপনাকে সম্বোধন করতে পারে তার জন্য আপনার নাম লিখুন",
    nameLabel: "আপনার নাম",
    namePlaceholder: "উদাহরণ: রাম",
    locTitle: "আপনার খামার কোথায় অবস্থিত?",
    locSub: "ফসলের পরামর্শ এবং মান্ডির দর পেতে আপনার राज्य এবং জেলা নির্বাচন করুন",
    locStateLabel: "রাজ্য",
    locStatePlaceholder: "রাজ্য নির্বাচন করুন",
    locDistrictLabel: "জেলা",
    locDistrictPlaceholder: "জেলা নির্বাচন করুন",
    locDistrictSelectFirst: "প্রথমে রাজ্য নির্বাচন করুন",
    cropTitle: "আপনি কোন কোন ফসল চাষ করেন?",
    cropSub: "আপনার চাষ করা ফসলগুলি নির্বাচন করুন (প্রয়োজনে একাধিক বাছুন)",
    alertTitle: "অ্যালার্ট সক্রিয় করবেন?",
    alertSub: "পোকামাকড়ের উপদ্রব, আবহাওয়া অ্যালার্ট এবং প্রকল্পের বিজ্ঞপ্তি চালু করুন",
    alertToggleLabel: "অ্যালার্ট",
    alertToggleSub: "আবহাওয়া ও কীটপতঙ্গের সতর্কতা পান",
    alertReadyMsg: "হরাইজন আপনাকে সাহায্য করার জন্য প্রস্তুত! 🚀",
    back: "পিছনে",
    next: "পরবর্তী",
    finish: "হরাইজন সক্রিয় করুন"
  },
  mr: {
    headerTitle: "तुमचा तपशील",
    stepIndicator: "टप्पा {step} / 5",
    nameTitle: "नमस्ते! तुमचे नाव काय आहे?",
    nameSub: "होरायझनला तुमचे स्वागत करता यावे म्हणून तुमचे नाव लिहा",
    nameLabel: "तुमचे नाव",
    namePlaceholder: "उदाहरण: गणेश",
    locTitle: "तुमची शेती कुठे आहे?",
    locSub: "पीक सल्ला आणि मंडी भाव मिळवण्यासाठी तुमचे राज्य आणि जिल्हा निवडा",
    locStateLabel: "राज्य",
    locStatePlaceholder: "राज्य निवडा",
    locDistrictLabel: "जिल्हा",
    locDistrictPlaceholder: "जिल्हा निवडा",
    locDistrictSelectFirst: "प्रथम राज्य निवडा",
    cropTitle: "तुम्ही कोणती पिके घेता?",
    cropSub: "तुम्ही घेत असलेली पिके निवडा (लागू असल्यास एकापेक्षा जास्त निवडा)",
    alertTitle: "अलर्ट सक्षम करायचे?",
    alertSub: "कीड चेतावणी, हवामान अलर्ट आणि योजनांची माहिती मिळवा",
    alertToggleLabel: "अलर्ट",
    alertToggleSub: "हवामान व कीड चेतावणी मिळवा",
    alertReadyMsg: "होरायझन तुमच्या मदतीसाठी पूर्णपणे सज्ज आहे! 🚀",
    back: "मागे",
    next: "पुढे",
    finish: "होरायझन सक्रिय करा"
  },
  pa: {
    headerTitle: "ਤੁਹਾਡਾ ਵੇਰਵਾ",
    stepIndicator: "ਕਦਮ {step} / 5",
    nameTitle: "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! ਤੁਹਾਡਾ ਨਾਮ ਕੀ ਹੈ?",
    nameSub: "ਕਿਰਪา ਕਰਕੇ ਆਪਣਾ ਨਾਮ ਦਰਜ ਕਰੋ ਤਾਂ ਜੋ ਹੋਰਾਈਜ਼ਨ ਤੁਹਾਡਾ ਸੁਆਗਤ ਕਰ ਸਕੇ",
    nameLabel: "ਤੁਹਾਡਾ ਨਾਮ",
    namePlaceholder: "ਉਦਾਹਰਨ: ਅਮਨ",
    locTitle: "ਤੁਹਾਡਾ ਖੇਤ ਕਿੱਥੇ ਹੈ?",
    locSub: "ਫ਼ਸਲ ਸਲਾਹ ਅਤੇ ਮੰਡੀ ਦੇ ਭਾਅ ਪ੍ਰਾਪਤ ਕਰਨ ਲਈ ਆਪਣਾ ਰਾਜ ਅਤੇ ਜ਼ਿਲ੍ਹਾ ਚੁਣੋ",
    locStateLabel: "ਰਾਜ",
    locStatePlaceholder: "ਰਾਜ ਚੁਣੋ",
    locDistrictLabel: "ਜ਼ਿਲ੍ਹਾ",
    locDistrictPlaceholder: "ਜ਼ਿਲ੍ਹਾ ਚੁਣੋ",
    locDistrictSelectFirst: "ਪਹਿਲਾਂ ਰਾਜ ਚੁਣੋ",
    cropTitle: "ਤੁਸੀਂ ਕਿਹੜੀਆਂ ਫ਼ਸਲਾਂ ਉਗਾਉਂਦੇ ਹੋ?",
    cropSub: "ਆਪਣੀਆਂ ਫ਼ਸਲਾਂ ਚੁਣੋ (ਜੇਕਰ ਲਾਗੂ ਹੋਵੇ ਤਾਂ ਇੱਕ ਤੋਂ ਵੱਧ ਚੁਣੋ)",
    alertTitle: "ਅਲਰਟ ਚਾਲੂ ਕਰਨੇ ਹਨ?",
    alertSub: "ਕੀੜੇ-ਮਕੌੜਿਆਂ ਦੀ ਚੇਤਾਵਨੀ, ਮੌਸਮ ਅਲਰਟ ਅਤੇ ਯੋਜਨਾਵਾਂ ਦੇ ਨੋਟੀਫਿਕੇਸ਼ਨ ਚਾਲੂ ਕਰੋ",
    alertToggleLabel: "ਅਲਰਟ",
    alertToggleSub: "ਮੌਸਮ ਅਤੇ ਕੀੜਿਆਂ ਦੀ ਚੇਤਾਵਨੀ ਪ੍ਰਾਪਤ ਕਰੋ",
    alertReadyMsg: "ਹੋਰਾਈਜ਼ਨ ਤੁਹਾਡੀ ਮਦਦ ਲਈ ਪੂਰੀ ਤਰ੍ਹਾਂ ਤਿਆਰ ਹੈ! 🚀",
    back: "ਪਿੱਛੇ",
    next: "ਅੱਗੇ",
    finish: "ਹੋਰਾਈਜ਼ਨ ਚਾਲੂ ਕਰੋ"
  }
};

export default function OnboardingFlow({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedCrops, setSelectedCrops] = useState<string[]>([]);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dynamic locations and places states
  const [locationTree, setLocationTree] = useState<Record<string, string[]>>({});
  const [selectedMandal, setSelectedMandal] = useState('');
  const [isCustomMandal, setIsCustomMandal] = useState(false);
  const [customMandalText, setCustomMandalText] = useState('');
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [detectLocationError, setDetectLocationError] = useState('');

  const activeLanguage = useUserStore((state) => state.activeLanguage);
  const setActiveLanguage = useUserStore((state) => state.setActiveLanguage);
  const updateProfile = useUserStore((state) => state.updateProfile);

  // Fetch dynamic location tree
  useEffect(() => {
    fetch('/api/harvestiq/locations')
      .then((r) => (r.ok ? r.json() : {}))
      .then((tree) => setLocationTree(tree))
      .catch((err) => console.error('Error fetching locations:', err));
  }, []);

  // Default to English when entering the page
  useEffect(() => {
    setActiveLanguage('en');
  }, [setActiveLanguage]);

  // Reset district/mandal when state changes
  useEffect(() => {
    setSelectedDistrict('');
    setSelectedMandal('');
    setIsCustomMandal(false);
    setCustomMandalText('');
  }, [selectedState]);

  // Reset mandal when district changes
  useEffect(() => {
    setSelectedMandal('');
    setIsCustomMandal(false);
    setCustomMandalText('');
  }, [selectedDistrict]);

  const baseT = TRANSLATIONS[activeLanguage] || TRANSLATIONS.en;
  const placeT = PLACE_TRANSLATIONS[activeLanguage] || PLACE_TRANSLATIONS.en;
  const t = { ...baseT, ...placeT };

  const handleNext = () => setStep((prev) => prev + 1);
  const handleBack = () => setStep((prev) => prev - 1);

  const handleCropToggle = (cropId: string) => {
    setSelectedCrops((prev) =>
      prev.includes(cropId) ? prev.filter((id) => id !== cropId) : [...prev, cropId]
    );
  };

  const fallbackToIpDetection = async () => {
    try {
      const res = await fetch('/api/harvestiq/detect-location');
      if (res.ok) {
        const data = await res.json();
        if (data.state && data.district) {
          setSelectedState(data.state);
          setSelectedDistrict(data.district);
          setSelectedMandal('');
          setIsCustomMandal(false);
          setCustomMandalText('');
          setIsDetectingLocation(false);
          return;
        }
      }
      throw new Error('IP detection returned empty or failed');
    } catch (err) {
      console.error('IP location detection error:', err);
      setDetectLocationError(t.locDetectFailed);
      setIsDetectingLocation(false);
    }
  };

  const handleDetectLocation = () => {
    setIsDetectingLocation(true);
    setDetectLocationError('');
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const res = await fetch(`/api/harvestiq/resolve-gps?lat=${latitude}&lon=${longitude}`);
            if (res.ok) {
              const data = await res.json();
              if (data.state && data.district) {
                setSelectedState(data.state);
                setSelectedDistrict(data.district);
                setSelectedMandal('');
                setIsCustomMandal(false);
                setCustomMandalText('');
                setIsDetectingLocation(false);
                return;
              }
            }
            await fallbackToIpDetection();
          } catch (err) {
            console.error('GPS resolution error, falling back to IP:', err);
            await fallbackToIpDetection();
          }
        },
        async (error) => {
          console.warn('Geolocation blocked/failed, falling back to IP:', error);
          await fallbackToIpDetection();
        },
        { timeout: 5000 }
      );
    } else {
      fallbackToIpDetection();
    }
  };

  const handleFinish = async () => {
    setIsSubmitting(true);
    const finalMandal = isCustomMandal ? customMandalText : selectedMandal;
    try {
      const success = await updateProfile({
        display_name: name,
        state: selectedState,
        district: selectedDistrict,
        mandal: finalMandal || undefined,
        crops: selectedCrops,
        alerts_enabled: alertsEnabled,
        onboarding_completed: true,
        language: activeLanguage
      });
      if (success) {
        onComplete();
      } else {
        alert('Failed to update profile. Proceeding anyway...');
        onComplete();
      }
    } catch (e) {
      console.error(e);
      onComplete();
    } finally {
      setIsSubmitting(false);
    }
  };

  const states = Object.keys(locationTree).length > 0
    ? Object.keys(locationTree).sort()
    : Object.keys(STATES_DISTRICTS).sort();
  const availableDistricts = selectedState
    ? (locationTree[selectedState] || STATES_DISTRICTS[selectedState] || [])
    : [];
  const availablePlaces = selectedDistrict ? (DISTRICT_PLACES[selectedDistrict] || []) : [];


  return (
    <div className="min-h-screen bg-[#FAFAF7] flex flex-col justify-start md:justify-center items-center px-4 py-6 md:py-12 overflow-y-auto">
      {/* Onboarding Wizard Card */}
      <div className={`w-full ${step === 1 ? 'max-w-4xl' : 'max-w-xl'} bg-white rounded-3xl border border-[#eaeae0] shadow-xl overflow-hidden transition-all duration-300 my-4 md:my-8`}>
        
        {/* Top Header Indicators */}
        <div className="bg-[#1A4731] px-8 py-5 flex items-center justify-between text-white">
          <div>
            <span className="text-[#F5A623] font-bold text-xs uppercase tracking-widest">
              Event Horizon AI
            </span>
            <h1 className="text-xl font-bold mt-0.5">{t.headerTitle}</h1>
          </div>
          <div className="bg-[#0D1F16] text-[#F5A623] font-mono text-sm px-3 py-1 rounded-full border border-[#1A4731]">
            {t.stepIndicator.replace('{step}', String(step))}
          </div>
        </div>

        {/* Dynamic step view */}
        <div className="p-6 md:p-8">
          
          {/* Step 1: Language Picker */}
          {step === 1 && (
            <LanguagePicker onNext={handleNext} />
          )}

          {/* Step 2: Name */}
          {step === 2 && (
            <div className="animate-fade-in space-y-6">
              <div className="flex justify-center mb-2">
                <div className="p-4 rounded-full bg-[#eef7f2]">
                  <User className="h-10 w-10 text-[#1A4731]" />
                </div>
              </div>
              
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-extrabold text-[#1A4731]">
                  {t.nameTitle}
                </h2>
                <p className="text-sm font-medium text-[#5a6e5a]">
                  {t.nameSub}
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#1A4731] uppercase tracking-wide">
                  {t.nameLabel}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.namePlaceholder}
                  className="w-full px-5 py-4 rounded-2xl border-2 border-[#eaeae0] focus:border-[#1A4731] focus:ring-1 focus:ring-[#1A4731] outline-none transition-colors duration-200 text-lg font-semibold text-gray-800 bg-white"
                />
              </div>

              <div className="pt-4 flex justify-between gap-4">
                <button
                  onClick={handleBack}
                  className="w-1/2 py-4 rounded-2xl border-2 border-[#eaeae0] text-[#1A4731] font-bold text-base hover:bg-[#fafaf7] transition-all"
                >
                  {t.back}
                </button>
                <button
                  onClick={handleNext}
                  disabled={!name.trim()}
                  className="w-1/2 py-4 rounded-2xl bg-[#1A4731] text-white font-bold text-base hover:bg-[#123323] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                >
                  {t.next}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Location */}
          {step === 3 && (
            <div className="animate-fade-in space-y-6">
              <div className="flex justify-center mb-2">
                <div className="p-4 rounded-full bg-[#eef7f2]">
                  <MapPin className="h-10 w-10 text-[#1A4731]" />
                </div>
              </div>

              <div className="text-center space-y-2">
                <h2 className="text-2xl font-extrabold text-[#1A4731]">
                  {t.locTitle}
                </h2>
                <p className="text-sm font-medium text-[#5a6e5a]">
                  {t.locSub}
                </p>
              </div>

              {/* Geolocation Detection */}
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleDetectLocation}
                  disabled={isDetectingLocation}
                  className="w-full flex items-center justify-center gap-2 py-4 px-5 rounded-2xl border-2 border-[#1A4731] text-[#1A4731] font-bold text-base bg-white hover:bg-[#eef7f2] transition-colors disabled:opacity-50 shadow-sm"
                >
                  <MapPin className="h-5 w-5" />
                  {isDetectingLocation ? t.locDetecting : t.locUseCurrentLocation}
                </button>
                {detectLocationError && (
                  <p className="text-xs text-red-500 font-semibold text-center mt-1">
                    {detectLocationError}
                  </p>
                )}
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#1A4731] uppercase tracking-wide">
                    {t.locStateLabel}
                  </label>
                  <select
                    value={selectedState}
                    onChange={(e) => {
                      setSelectedState(e.target.value);
                    }}
                    className="w-full px-5 py-4 rounded-2xl border-2 border-[#eaeae0] focus:border-[#1A4731] outline-none transition-colors duration-200 text-base font-semibold text-gray-800 bg-white"
                  >
                    <option value="" className="bg-white text-gray-800">{t.locStatePlaceholder}</option>
                    {states.map((s) => (
                      <option key={s} value={s} className="bg-white text-gray-800">{s}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#1A4731] uppercase tracking-wide">
                    {t.locDistrictLabel}
                  </label>
                  <select
                    value={selectedDistrict}
                    onChange={(e) => setSelectedDistrict(e.target.value)}
                    disabled={!selectedState}
                    className="w-full px-5 py-4 rounded-2xl border-2 border-[#eaeae0] focus:border-[#1A4731] outline-none transition-colors duration-200 text-base font-semibold text-gray-800 disabled:opacity-50 bg-white"
                  >
                    <option value="" className="bg-white text-gray-800">{selectedState ? t.locDistrictPlaceholder : t.locDistrictSelectFirst}</option>
                    {selectedState &&
                      availableDistricts.map((d) => (
                        <option key={d} value={d} className="bg-white text-gray-800">{d}</option>
                      ))}
                  </select>
                </div>

                {/* Place / Mandal Selection */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#1A4731] uppercase tracking-wide">
                    {t.locPlaceLabel}
                  </label>
                  {!isCustomMandal && availablePlaces.length > 0 ? (
                    <select
                      value={selectedMandal}
                      onChange={(e) => {
                        if (e.target.value === '__custom__') {
                          setIsCustomMandal(true);
                          setSelectedMandal('');
                        } else {
                          setSelectedMandal(e.target.value);
                        }
                      }}
                      disabled={!selectedDistrict}
                      className="w-full px-5 py-4 rounded-2xl border-2 border-[#eaeae0] focus:border-[#1A4731] outline-none transition-colors duration-200 text-base font-semibold text-gray-800 disabled:opacity-50 bg-white"
                    >
                      <option value="" className="bg-white text-gray-800">
                        {selectedDistrict ? t.locPlacePlaceholder : t.locPlaceSelectDistrictFirst}
                      </option>
                      {availablePlaces.map((p) => (
                        <option key={p} value={p} className="bg-white text-gray-800">{p}</option>
                      ))}
                      <option value="__custom__" className="bg-white text-gray-800 font-bold">
                        {t.locPlaceOtherOption}
                      </option>
                    </select>
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        value={isCustomMandal ? customMandalText : selectedMandal}
                        onChange={(e) => {
                          if (isCustomMandal) {
                            setCustomMandalText(e.target.value);
                          } else {
                            setSelectedMandal(e.target.value);
                          }
                        }}
                        disabled={!selectedDistrict}
                        placeholder={t.locPlaceCustomPlaceholder}
                        className="w-full px-5 py-4 pr-24 rounded-2xl border-2 border-[#eaeae0] focus:border-[#1A4731] focus:ring-1 focus:ring-[#1A4731] outline-none transition-colors duration-200 text-base font-semibold text-gray-800 disabled:opacity-50 bg-white"
                      />
                      {isCustomMandal && availablePlaces.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsCustomMandal(false);
                            setCustomMandalText('');
                            setSelectedMandal('');
                          }}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-extrabold text-[#1A4731] hover:underline"
                        >
                          Show List
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 flex justify-between gap-4">
                <button
                  onClick={handleBack}
                  className="w-1/2 py-4 rounded-2xl border-2 border-[#eaeae0] text-[#1A4731] font-bold text-base hover:bg-[#fafaf7] transition-all"
                >
                  {t.back}
                </button>
                <button
                  onClick={handleNext}
                  disabled={
                    !selectedState || 
                    !selectedDistrict || 
                    !(isCustomMandal ? customMandalText.trim() : selectedMandal.trim())
                  }
                  className="w-1/2 py-4 rounded-2xl bg-[#1A4731] text-white font-bold text-base hover:bg-[#123323] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                >
                  {t.next}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Crops Selection */}
          {step === 4 && (
            <div className="animate-fade-in space-y-6">
              <div className="flex justify-center mb-2">
                <div className="p-4 rounded-full bg-[#eef7f2]">
                  <Sprout className="h-10 w-10 text-[#1A4731]" />
                </div>
              </div>

              <div className="text-center space-y-2">
                <h2 className="text-2xl font-extrabold text-[#1A4731]">
                  {t.cropTitle}
                </h2>
                <p className="text-sm font-medium text-[#5a6e5a]">
                  {t.cropSub}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                {CROPS.map((crop) => {
                  const isChecked = selectedCrops.includes(crop.id);
                  return (
                    <button
                      key={crop.id}
                      onClick={() => handleCropToggle(crop.id)}
                      className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left ${
                        isChecked
                          ? 'border-[#1A4731] bg-[#eef7f2]'
                          : 'border-[#eaeae0] bg-white hover:border-[#F5A623]'
                      }`}
                    >
                      <span className="text-2xl">{crop.icon}</span>
                      <span className="font-bold text-sm text-[#1A4731]">{crop.name}</span>
                    </button>
                  );
                })}
              </div>

              <div className="pt-4 flex justify-between gap-4">
                <button
                  onClick={handleBack}
                  className="w-1/2 py-4 rounded-2xl border-2 border-[#eaeae0] text-[#1A4731] font-bold text-base hover:bg-[#fafaf7] transition-all"
                >
                  {t.back}
                </button>
                <button
                  onClick={handleNext}
                  disabled={selectedCrops.length === 0}
                  className="w-1/2 py-4 rounded-2xl bg-[#1A4731] text-white font-bold text-base hover:bg-[#123323] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                >
                  {t.next}
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Alerts & Final Confirmation */}
          {step === 5 && (
            <div className="animate-fade-in space-y-6">
              <div className="flex justify-center mb-2">
                <div className="p-4 rounded-full bg-[#eef7f2]">
                  <Bell className="h-10 w-10 text-[#1A4731]" />
                </div>
              </div>

              <div className="text-center space-y-2">
                <h2 className="text-2xl font-extrabold text-[#1A4731]">
                  {t.alertTitle}
                </h2>
                <p className="text-sm font-medium text-[#5a6e5a]">
                  {t.alertSub}
                </p>
              </div>

              {/* Toggle switch alert config */}
              <div className="bg-[#fafaf7] p-5 rounded-2xl border border-[#eaeae0] flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-[#1A4731] text-base">{t.alertToggleLabel}</h3>
                  <p className="text-xs text-[#8b9b8b] mt-0.5">{t.alertToggleSub}</p>
                </div>
                <button
                  onClick={() => setAlertsEnabled(!alertsEnabled)}
                  className={`w-14 h-8 flex items-center rounded-full p-1 transition-all duration-300 ${
                    alertsEnabled ? 'bg-[#1A4731] justify-end' : 'bg-[#d0d0c0] justify-start'
                  }`}
                >
                  <span className="w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-300"></span>
                </button>
              </div>

              {/* Ready message */}
              <div className="p-4 rounded-xl bg-[#eef7f2] border border-[#d2edd7] text-center text-xs font-semibold text-[#1A4731] flex items-center justify-center gap-2">
                <CheckCircle className="h-4 w-4" />
                {t.alertReadyMsg}
              </div>

              <div className="pt-4 flex justify-between gap-4">
                <button
                  onClick={handleBack}
                  className="w-1/2 py-4 rounded-2xl border-2 border-[#eaeae0] text-[#1A4731] font-bold text-base hover:bg-[#fafaf7] transition-all"
                >
                  {t.back}
                </button>
                <button
                  onClick={handleFinish}
                  disabled={isSubmitting}
                  className="w-1/2 py-4 rounded-2xl bg-[#1A4731] text-white font-bold text-base hover:bg-[#123323] transition-all shadow-md flex items-center justify-center gap-2"
                >
                  {isSubmitting ? 'Saving...' : t.finish}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
