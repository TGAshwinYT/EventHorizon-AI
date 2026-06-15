import { useState, useRef, useEffect, memo, useCallback, useMemo } from 'react';
import { Search, TrendingUp, ArrowLeft, Loader2, BookOpen, Truck, Landmark, BarChart3, Volume2, StopCircle, Youtube, User, ExternalLink } from 'lucide-react';
import MandiInterface from '../../components/MandiInterface';
import ForecastingInterface from '../../components/ForecastingInterface';
import { assistantApi } from '../../services/api';
import { centralSchemes, schemeLabels } from '../../utils/schemesData';


interface MarketDashboardProps {
    onBack: () => void;
    currentLanguage: string;
    labels: any;
    onMoreDetails?: (query: string) => void;
    initialView?: 'menu' | 'rates' | 'vehicles' | 'vehicle_details' | 'schemes' | 'forecasting' | 'marketing';
}

type View = 'menu' | 'rates' | 'vehicles' | 'vehicle_details' | 'schemes' | 'forecasting' | 'marketing';

interface Story {
    name: string;
    location: string;
    content: string;
    image_prompt?: string;
}



    // Vehicle Translations
    const vehicleTranslations: { [key: string]: any[] } = {
        en: [
            {
                name: 'John Deere 5310',
                type: 'Tractor',
                price: '₹8.5 Lakhs',
                purpose: 'Heavy Duty Plowing',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/8/87/John_Deere_5310_utility_tractor,_rear.jpg',
                official_link: 'https://www.deere.co.in/en/tractors/e-series-tractors/5310e-tractor/',
                specs: {
                    Engine: '55 HP, 3 Cylinders',
                    Gearbox: '9 Forward + 3 Reverse',
                    Brakes: 'Oil Immersed Disc Brakes',
                    Warranty: '5000 Hours / 5 Years'
                },
                description: 'The John Deere 5310 is a powerful Tractor designed for Heavy Duty Plowing. Perfect for Indian farming conditions with low maintenance and high efficiency.'
            },
            {
                name: 'Mahindra JIVO 245 DI 4WD',
                type: 'Mini Tractor',
                price: '₹4.2 Lakhs',
                purpose: 'Orchard Farming',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/5/51/Mahindra_tractor.JPG',
                official_link: 'https://www.mahindratractor.com/tractors/jivo-245-di-4wd',
                specs: {
                    Engine: '24 HP, 2 Cylinders',
                    Gearbox: '8 Forward + 4 Reverse',
                    Brakes: 'Oil Immersed Brakes',
                    'Lift Capacity': '750 kg'
                },
                description: 'The Mahindra JIVO 245 DI 4WD is a powerful Mini Tractor designed for Orchard Farming. Perfect for Indian farming conditions with low maintenance and high efficiency.'
            },
            {
                name: 'Sonalika DI 745',
                type: 'Tractor',
                price: '₹6.8 Lakhs',
                purpose: 'Haulage & Cultivation',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/9/93/Sonalika_DI_tractor.jpg',
                official_link: 'https://www.sonalika.com/tractor/di-745-iii.html',
                specs: {
                    Engine: '50 HP, 3 Cylinders',
                    Gearbox: '8 Forward + 2 Reverse',
                    Clutch: 'Dual Clutch',
                    Steering: 'Power Steering'
                },
                description: 'The Sonalika DI 745 is a powerful Tractor designed for Haulage & Cultivation. Perfect for Indian farming conditions with low maintenance and high efficiency.'
            },
            {
                name: 'Tata Ace Gold',
                type: 'Transport',
                price: '₹5.0 Lakhs',
                purpose: 'Goods Transport',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/f/f3/Tata_Ace_Mini_Truck_(1).JPG',
                official_link: 'https://smalltrucks.tatamotors.com/listing-page?field_product_category_target_id=1',
                specs: {
                    Engine: '700 cc, 2 Cylinders',
                    Payload: '710 kg',
                    Mileage: '22 kmpl',
                    Fuel: 'Diesel / CNG'
                },
                description: 'The Tata Ace Gold is a powerful Transport designed for Goods Transport. Perfect for Indian farming conditions with low maintenance and high efficiency.'
            },
            {
                name: 'Kubota MU4501',
                type: 'Tractor',
                price: '₹7.9 Lakhs',
                purpose: 'Fuel Efficient',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Kubota_tractor_9.jpg',
                official_link: 'https://tractorguru.in/tractor/kubota-mu4501',
                specs: {
                    Engine: '45 HP, 4 Cylinders',
                    Transmission: 'Synchromesh',
                    PTO: 'Dual PTO',
                    Brakes: 'Oil Immersed Disc Brakes'
                },
                description: 'The Kubota MU4501 is a powerful Tractor designed for Fuel Efficient. Perfect for Indian farming conditions with low maintenance and high efficiency.'
            },
        ],
        ta: [
            {
                name: 'ஜான் டியர் 5310',
                type: 'டிராக்டர்',
                price: '₹8.5 லட்சம்',
                purpose: 'கனரக உழவு',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/8/87/John_Deere_5310_utility_tractor,_rear.jpg',
                official_link: 'https://www.deere.co.in/en/tractors/e-series-tractors/5310e-tractor/',
                specs: {
                    'இயந்திரம்': '55 HP, 3 சிலிண்டர்கள்',
                    'கியர்பாக்ஸ்': '9 முன் + 3 பின்',
                    'பிரேக்குகள்': 'ஆயில் இம்மர்ஸ்ட் டிஸ்க் பிரேக்குகள்',
                    'உத்தரவாதம்': '5000 மணிநேரம் / 5 ஆண்டுகள்'
                },
                description: 'ஜான் டியர் 5310 கனரக உழவுக்காக வடிவமைக்கப்பட்ட ஒரு சக்திவாய்ந்த டிராக்டர் ஆகும். குறைந்த பராமரிப்பு மற்றும் அதிக செயல்திறனுடன் இந்திய விவசாய நிலைமைகளுக்கு ஏற்றது.'
            },
            {
                name: 'மஹிந்திரா ஜிவோ 245 DI 4WD',
                type: 'மினி டிராக்டர்',
                price: '₹4.2 லட்சம்',
                purpose: 'தோட்டக்கலை விவசாயம்',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/5/51/Mahindra_tractor.JPG',
                official_link: 'https://www.mahindratractor.com/tractors/jivo-245-di-4wd',
                specs: {
                    'இயந்திரம்': '24 HP, 2 சிலிண்டர்கள்',
                    'கியர்பாக்ஸ்': '8 முன் + 4 பின்',
                    'பிரேக்குகள்': 'ஆயில் இம்மர்ஸ்ட் பிரேக்குகள்',
                    'தூக்கும் திறன்': '750 கிலோ'
                },
                description: 'மஹிந்திரா ஜிவோ 245 DI 4WD என்பது தோட்டக்கலை விவசாயத்திற்காக வடிவமைக்கப்பட்ட ஒரு சக்திவாய்ந்த மினி டிராக்டர் ஆகும். குறைந்த பராமரிப்பு மற்றும் அதிக செயல்திறனுடன் இந்திய விவசாய நிலைமைகளுக்கு ஏற்றது.'
            },
            {
                name: 'சோனாலிகா DI 745',
                type: 'டிராக்டர்',
                price: '₹6.8 லட்சம்',
                purpose: 'சரக்கு மற்றும் உழவு',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/9/93/Sonalika_DI_tractor.jpg',
                official_link: 'https://www.sonalika.com/tractor/di-745-iii.html',
                specs: {
                    'இயந்திரம்': '50 HP, 3 சிலிண்டர்கள்',
                    'கியர்பாக்ஸ்': '8 முன் + 2 பின்',
                    'கிளட்ச்': 'இரட்டை கிளட்ச்',
                    'ஸ்டீயரிங்': 'பவர் ஸ்டீயரிங்'
                },
                description: 'சோனாலிகா DI 745 என்பது சரக்கு மற்றும் உழவுக்காக வடிவமைக்கப்பட்ட ஒரு சக்திவாய்ந்த டிராக்டர் ஆகும். குறைந்த பராமரிப்பு மற்றும் அதிக செயல்திறனுடன் இந்திய விவசாய நிலைமைகளுக்கு ஏற்றது.'
            },
            {
                name: 'டாடா ஏஸ் கோல்ட்',
                type: 'போக்குவரத்து',
                price: '₹5.0 லட்சம்',
                purpose: 'சரக்கு போக்குவரத்து',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/f/f3/Tata_Ace_Mini_Truck_(1).JPG',
                official_link: 'https://smalltrucks.tatamotors.com/listing-page?field_product_category_target_id=1',
                specs: {
                    'இயந்திரம்': '700 சிசி, 2 சிலிண்டர்கள்',
                    'பேலோட்': '710 கிலோ',
                    'மைலேஜ்': '22 கிமீ/லி',
                    'எரிபொருள்': 'டீசல் / சிஎன்ஜி'
                },
                description: 'டாடா ஏஸ் கோல்ட் என்பது சரக்கு போக்குவரத்திற்காக வடிவமைக்கப்பட்ட ஒரு சக்திவாய்ந்த வாகனம் ஆகும். குறைந்த பராமரிப்பு மற்றும் அதிக செயல்திறனுடன் இந்திய விவசாய நிலைமைகளுக்கு ஏற்றது.'
            },
            {
                name: 'குபோடா MU4501',
                type: 'டிராக்டர்',
                price: '₹7.9 லட்சம்',
                purpose: 'எரிபொருள் சிக்கனம்',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Kubota_tractor_9.jpg',
                official_link: 'https://tractorguru.in/tractor/kubota-mu4501',
                specs: {
                    'இயந்திரம்': '45 HP, 4 சிலிண்டர்கள்',
                    'டிரான்ஸ்மிஷன்': 'சின்க்ரோமேஷ்',
                    'PTO': 'இரட்டை PTO',
                    'பிரேக்குகள்': 'ஆயில் இம்மர்ஸ்ட் டிஸ்க் பிரேக்குகள்'
                },
                description: 'குபோடா MU4501 எரிபொருள் சிக்கனத்திற்காக வடிவமைக்கப்பட்ட ஒரு சக்திவாய்ந்த டிராக்டர் ஆகும். குறைந்த பராமரிப்பு மற்றும் அதிக செயல்திறனுடன் இந்திய விவசாய நிலைமைகளுக்கு ஏற்றது.'
            }
        ],
        hi: [
            {
                name: 'जॉन डियर 5310',
                type: 'ट्रैक्टर',
                price: '₹8.5 लाख',
                purpose: 'भारी जुताई',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/8/87/John_Deere_5310_utility_tractor,_rear.jpg',
                official_link: 'https://www.deere.co.in/en/tractors/e-series-tractors/5310e-tractor/',
                specs: {
                    'इंजन': '55 HP, 3 सिलेंडर',
                    'गियरबॉक्स': '9 आगे + 3 पीछे',
                    'ब्रेक': 'तेल में डूबे डिस्क ब्रेक',
                    'वारंटी': '5000 घंटे / 5 साल'
                },
                description: 'जॉन डियर 5310 भारी जुताई के लिए डिज़ाइन किया गया एक शक्तिशाली ट्रैक्टर है। कम रखरखाव और उच्च दक्षता के साथ भारतीय खेती की स्थिति के लिए बिल्कुल सही।'
            },
            {
                name: 'महिंद्रा जिवो 245 DI 4WD',
                type: 'मिनी ट्रैक्टर',
                price: '₹4.2 लाख',
                purpose: 'बागवानी खेती',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/5/51/Mahindra_tractor.JPG',
                official_link: 'https://www.mahindratractor.com/tractors/jivo-245-di-4wd',
                specs: {
                    'इंजन': '24 HP, 2 सिलेंडर',
                    'गियरबॉक्स': '8 आगे + 4 पीछे',
                    'ब्रेक': 'तेल में डूबे ब्रेक',
                    'लिफ्ट क्षमता': '750 किलो'
                },
                description: 'महिंद्रा जिवो 245 DI 4WD बागवानी खेती के लिए डिज़ाइन किया गया एक शक्तिशाली मिनी ट्रैक्टर है। कम रखरखाव और उच्च दक्षता के साथ भारतीय खेती की स्थिति के लिए बिल्कुल सही।'
            },
            {
                name: 'सोनालिका DI 745',
                type: 'ट्रैक्टर',
                price: '₹6.8 लाख',
                purpose: 'ढुलाई और खेती',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/9/93/Sonalika_DI_tractor.jpg',
                official_link: 'https://www.sonalika.com/tractor/di-745-iii.html',
                specs: {
                    'इंजन': '50 HP, 3 सिलेंडर',
                    'गियरबॉक्स': '8 आगे + 2 पीछे',
                    'क्लच': 'डुअल क्लच',
                    'स्टीयरिंग': 'पावर स्टीयरिंग'
                },
                description: 'सोनालिका DI 745 ढुलाई और खेती के लिए डिज़ाइन किया गया एक शक्तिशाली ट्रैक्टर है। कम रखरखाव और उच्च दक्षता के साथ भारतीय खेती की स्थिति के लिए बिल्कुल सही।'
            },
            {
                name: 'टाटा ऐस गोल्ड',
                type: 'परिवहन',
                price: '₹5.0 लाख',
                purpose: 'माल परिवहन',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/f/f3/Tata_Ace_Mini_Truck_(1).JPG',
                official_link: 'https://smalltrucks.tatamotors.com/listing-page?field_product_category_target_id=1',
                specs: {
                    'इंजन': '700 सीसी, 2 सिलेंडर',
                    'पेलोड': '710 किग्रा',
                    'माइलेज': '22 किमी/लीटर',
                    'ईंधन': 'डीजल / सीएनजी'
                },
                description: 'टाटा ऐस गोल्ड माल परिवहन के लिए डिज़ाइन किया गया एक शक्तिशाली वाहन है। कम रखरखाव और उच्च दक्षता के साथ भारतीय खेती की स्थिति के लिए बिल्कुल सही।'
            },
            {
                name: 'कुबोटा MU4501',
                type: 'ट्रैक्टर',
                price: '₹7.9 लाख',
                purpose: 'ईंधन कुशल',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Kubota_tractor_9.jpg',
                official_link: 'https://tractorguru.in/tractor/kubota-mu4501',
                specs: {
                    'इंजन': '45 HP, 4 सिलेंडर',
                    'ट्रांसमिशन': 'सिन्क्रोमेश',
                    'PTO': 'डुअल PTO',
                    'ब्रेक': 'तेल में डूबे डिस्क ब्रेक'
                },
                description: 'कुबोटा MU4501 ईंधन कुशलता के लिए डिज़ाइन किया गया एक शक्तिशाली ट्रैक्टर है। कम रखरखाव और उच्च दक्षता के साथ भारतीय खेती की स्थिति के लिए बिल्कुल सही।'
            }
        ],
        te: [
            {
                name: 'జాన్ డీర్ 5310',
                type: 'ట్రాక్టర్',
                price: '₹8.5 లక్షలు',
                purpose: 'భారీ దున్నకం',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/8/87/John_Deere_5310_utility_tractor,_rear.jpg',
                official_link: 'https://www.deere.co.in/en/tractors/e-series-tractors/5310e-tractor/',
                specs: {
                    'ఇంజిన్': '55 HP, 3 సిలిండర్లు',
                    'గేర్‌బాక్స్': '9 ఫార్వర్డ్ + 3 రివర్స్',
                    'బ్రేకులు': 'ఆయిల్ ఇమ్మర్స్డ్ డిస్క్ బ్రేకులు',
                    'వారంటీ': '5000 గంటలు / 5 సంవత్సరాలు'
                },
                description: 'జాన్ డీర్ 5310 భారీ దున్నకం కోసం రూపొందించిన శక్తివంతమైన ట్రాక్టర్. తక్కువ నిర్వహణ మరియు అధిక సామర్థ్యంతో భారతీయ వ్యవసాయ పరిస్థితులకు సరైనది.'
            },
            {
                name: 'మహీంద్రా జీవో 245 DI 4WD',
                type: 'మినీ ట్రాక్టర్',
                price: '₹4.2 లక్షలు',
                purpose: 'తోటల సాగు',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/5/51/Mahindra_tractor.JPG',
                official_link: 'https://www.mahindratractor.com/tractors/jivo-245-di-4wd',
                specs: {
                    'ఇంజిన్': '24 HP, 2 సిలిండర్లు',
                    'గేర్‌బాక్స్': '8 ఫార్వర్డ్ + 4 రివర్స్',
                    'బ్రేకులు': 'ఆయిల్ ఇమ్మర్స్డ్ బ్రేకులు',
                    'లిఫ్ట్ కెపాసిటీ': '750 కిలోలు'
                },
                description: 'మహీంద్రా జీవో 245 DI 4WD తోటల సాగు కోసం రూపొందించిన శక్తివంతమైన మినీ ట్రాక్టర్. తక్కువ నిర్వహణ మరియు అధిక సామర్థ్యంతో భారతీయ వ్యవసాయ పరిస్థితులకు సరైనది.'
            },
            {
                name: 'సోనాలికా DI 745',
                type: 'ట్రాక్టర్',
                price: '₹6.8 లక్షలు',
                purpose: 'రవాణా & సాగు',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/9/93/Sonalika_DI_tractor.jpg',
                official_link: 'https://www.sonalika.com/tractor/di-745-iii.html',
                specs: {
                    'ఇంజిన్': '50 HP, 3 సిలిండర్లు',
                    'గేర్‌బాక్స్': '8 ఫార్వర్డ్ + 2 రివర్స్',
                    'క్లచ్': 'డ్యుయల్ క్లచ్',
                    'స్టీరింగ్': 'పవర్ స్టీరింగ్'
                },
                description: 'సోనాలికా DI 745 రవాణా మరియు సాగు కోసం రూపొందించిన శక్తివంతమైన ట్రాక్టర్. తక్కువ నిర్వహణ మరియు అధిక సామర్థ్యంతో భారతీయ వ్యవసాయ పరిస్థితులకు సరైనది.'
            },
            {
                name: ' టాటా ఏస్ గోల్డ్',
                type: 'రవాణా',
                price: '₹5.0 లక్షలు',
                purpose: 'సరుకు రవాణా',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/f/f3/Tata_Ace_Mini_Truck_(1).JPG',
                official_link: 'https://smalltrucks.tatamotors.com/listing-page?field_product_category_target_id=1',
                specs: {
                    'ఇంజిన్': '700 cc, 2 సిలిండర్లు',
                    'పేలోడ్': '710 కిలోలు',
                    'మైలేజ్': '22 kmpl',
                    'ఇంధనం': 'డీజిల్ / CNG'
                },
                description: 'టాటా ఏస్ గోల్డ్ సరుకు రవాణా కోసం రూపొందించిన శక్తివంతమైన వాహనం. తక్కువ నిర్వహణ మరియు అధిక సామర్థ్యంతో భారతీయ వ్యవసాయ పరిస్థితులకు సరైనది.'
            },
            {
                name: 'కుబోటా MU4501',
                type: 'ట్రాక్టర్',
                price: '₹7.9 లక్షలు',
                purpose: 'ఇంధన ఆదా',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Kubota_tractor_9.jpg',
                official_link: 'https://tractorguru.in/tractor/kubota-mu4501',
                specs: {
                    'ఇంజిన్': '45 HP, 4 సిలిండర్లు',
                    'ట్రాన్స్మిషన్': 'సింక్రోమెష్',
                    'PTO': 'డ్యుయల్ PTO',
                    'బ్రేకులు': 'ఆయిల్ ఇమ్మర్స్డ్ డిస్క్ బ్రేకులు'
                },
                description: 'కుబోటా MU4501 ఇంధన ఆదా కోసం రూపొందించిన శక్తివంతమైన ట్రాక్టర్. తక్కువ నిర్వహణ మరియు అధిక సామర్థ్యంతో భారతీయ వ్యవసాయ పరిస్థితులకు సరైనది.'
            }
        ],
        kn: [
            {
                name: 'ಜಾನ್ ಡೀರ್ 5310',
                type: 'ಟ್ರ್ಯಾಕ್ಟರ್',
                price: '₹8.5 ಲಕ್ಷ',
                purpose: 'ಭಾರೀ ಉಳುವಿಕೆ',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/8/87/John_Deere_5310_utility_tractor,_rear.jpg',
                official_link: 'https://www.deere.co.in/en/tractors/e-series-tractors/5310e-tractor/',
                specs: {
                    'ಎಂಜಿನ್': '55 HP, 3 ಸಿಲಿಂಡರ್‌ಗಳು',
                    'ಗೇರ್‌ಬಾಕ್ಸ್': '9 ಫಾರ್ವರ್ಡ್ + 3 ರಿವರ್ಸ್',
                    'ಬ್ರೇಕ್‌ಗಳು': 'ಆಯಿಲ್ ಇಮ್ಮರ್ಸ್ಡ್ ಡಿಸ್ಕ್ ಬ್ರೇಕ್‌ಗಳು',
                    'ವಾರೆಂಟಿ': '5000 ಗಂಟೆಗಳು / 5 ವರ್ಷಗಳು'
                },
                description: 'ಜಾನ್ ಡೀರ್ 5310 ಭಾರೀ ಉಳುವಿಕೆಗಾಗಿ ವಿನ್ಯಾಸಗೊಳಿಸಲಾದ ಶಕ್ತಿಯುತ ಟ್ರ್ಯಾಕ್ಟರ್ ಆಗಿದೆ. ಕಡಿಮೆ ನಿರ್ವಹಣೆ ಮತ್ತು ಹೆಚ್ಚಿನ ದಕ್ಷತೆಯೊಂದಿಗೆ ಭಾರತೀಯ ಕೃಷಿ ಪರಿಸ್ಥಿತಿಗಳಿಗೆ ಸೂಕ್ತವಾಗಿದೆ.'
            },
            {
                name: 'ಮಹೀಂದ್ರಾ ಜಿವೋ 245 DI 4WD',
                type: 'ಮಿನಿ ಟ್ರ್ಯಾಕ್ಟರ್',
                price: '₹4.2 ಲಕ್ಷ',
                purpose: 'ತೋಟಗಾರಿಕೆ ಕೃಷಿ',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/5/51/Mahindra_tractor.JPG',
                official_link: 'https://www.mahindratractor.com/tractors/jivo-245-di-4wd',
                specs: {
                    'ಎಂಜಿನ್': '24 HP, 2 ಸಿಲಿಂಡರ್‌ಗಳು',
                    'ಗೇರ್‌ಬಾಕ್ಸ್': '8 ಫಾರ್ವರ್ಡ್ + 4 ರಿವರ್ಸ್',
                    'ಬ್ರೇಕ್‌ಗಳು': 'ಆಯಿಲ್ ಇಮ್ಮರ್ಸ್ಡ್ ಬ್ರೇಕ್‌ಗಳು',
                    'ಲಿಫ್ಟ್ ಸಾಮರ್ಥ್ಯ': '750 ಕೆಜಿ'
                },
                description: 'ಮಹೀಂದ್ರಾ ಜಿವೋ 245 DI 4WD ತೋಟಗಾರಿಕೆ ಕೃಷಿಗಾಗಿ ವಿನ್ಯಾಸಗೊಳಿಸಲಾದ ಶಕ್ತಿಯುತ ಮಿನಿ ಟ್ರ್ಯಾಕ್ಟರ್ ಆಗಿದೆ. ಕಡಿಮೆ ನಿರ್ವಹಣೆ ಮತ್ತು ಹೆಚ್ಚಿನ ದಕ್ಷತೆಯೊಂದಿಗೆ ಭಾರತೀಯ ಕೃಷಿ ಪರಿಸ್ಥಿತಿಗಳಿಗೆ ಸೂಕ್ತವಾಗಿದೆ.'
            },
            {
                name: 'ಸೋನಾಲಿಕಾ DI 745',
                type: 'ಟ್ರ್ಯಾಕ್ಟರ್',
                price: '₹6.8 ಲಕ್ಷ',
                purpose: 'ಸಾಗಣೆ ಮತ್ತು ಕೃಷಿ',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/9/93/Sonalika_DI_tractor.jpg',
                official_link: 'https://www.sonalika.com/tractor/di-745-iii.html',
                specs: {
                    'ಎಂಜಿನ್': '50 HP, 3 ಸಿಲಿಂಡರ್‌ಗಳು',
                    'ಗೇರ್‌ಬಾಕ್ಸ್': '8 ಫಾರ್ವರ್ಡ್ + 2 ರಿವರ್ಸ್',
                    'ಕ್ಲಚ್': 'ಡ್ಯುಯಲ್ ಕ್ಲಚ್',
                    'ಸ್ಟೀರಿಂಗ್': 'ಪವರ್ ಸ್ಟೀರಿಂಗ್'
                },
                description: 'ಸೋನಾಲಿಕಾ DI 745 ಸಾಗಣೆ ಮತ್ತು ಕೃಷಿಗಾಗಿ ವಿನ್ಯಾಸಗೊಳಿಸಲಾದ ಶಕ್ತಿಯುತ ಟ್ರ್ಯಾಕ್ಟರ್ ಆಗಿದೆ. ಕಡಿಮೆ ನಿರ್ವಹಣೆ ಮತ್ತು ಹೆಚ್ಚಿನ ದಕ್ಷತೆಯೊಂದಿಗೆ ಭಾರತೀಯ ಕೃಷಿ ಪರಿಸ್ಥಿತಿಗಳಿಗೆ ಸೂಕ್ತವಾಗಿದೆ.'
            },
            {
                name: 'ಟಾಟಾ ಏಸ್ ಗೋಲ್ಡ್',
                type: 'ಸಾರಿಗೆ',
                price: '₹5.0 ಲಕ್ಷ',
                purpose: 'ಸರಕು ಸಾಗಣೆ',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/f/f3/Tata_Ace_Mini_Truck_(1).JPG',
                official_link: 'https://smalltrucks.tatamotors.com/listing-page?field_product_category_target_id=1',
                specs: {
                    'ಎಂಜಿನ್': '700 ಸಿಸಿ, 2 ಸಿಲಿಂಡರ್‌ಗಳು',
                    'ಪೇಲೋಡ್': '710 ಕೆಜಿ',
                    'ಮೈಲೇಜ್': '22 ಕಿಮೀ/ಲೀ',
                    'ಇಂಧನ': 'ಡೀಸೆಲ್ / ಸಿಎನ್‌ಜಿ'
                },
                description: 'ಟಾಟಾ ಏಸ್ ಗೋಲ್ಡ್ ಸರಕು ಸಾಗಣೆಗಾಗಿ ವಿನ್ಯಾಸಗೊಳಿಸಲಾದ ಶಕ್ತಿಯುತ ವಾಹನವಾಗಿದೆ. ಕಡಿಮೆ ನಿರ್ವಹಣೆ ಮತ್ತು ಹೆಚ್ಚಿನ ದಕ್ಷತೆಯೊಂದಿಗೆ ಭಾರತೀಯ ಕೃಷಿ ಪರಿಸ್ಥಿತಿಗಳಿಗೆ ಸೂಕ್ತವಾಗಿದೆ.'
            },
            {
                name: 'ಕುಬೋಟಾ MU4501',
                type: 'ಟ್ರ್ಯಾಕ್ಟರ್',
                price: '₹7.9 ಲಕ್ಷ',
                purpose: 'ಇಂಧನ ಉಳಿತಾಯ',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Kubota_tractor_9.jpg',
                official_link: 'https://tractorguru.in/tractor/kubota-mu4501',
                specs: {
                    'ಎಂಜಿನ್': '45 HP, 4 ಸಿಲಿಂಡರ್‌ಗಳು',
                    'ಟ್ರಾನ್ಸ್‌ಮಿಷನ್': 'ಸಿಂಕ್ರೋಮೆಶ್',
                    'PTO': 'ಡ್ಯುಯಲ್ PTO',
                    'ಬ್ರೇಕ್‌ಗಳು': 'ಆಯಿಲ್ ಇಮ್ಮರ್ಸ್ಡ್ ಡಿಸ್ಕ್ ಬ್ರೇಕ್‌ಗಳು'
                },
                description: 'ಕುಬೋಟಾ MU4501 ಇಂಧನ ಉಳಿತಾಯಕ್ಕಾಗಿ ವಿನ್ಯಾಸಗೊಳಿಸಲಾದ ಶಕ್ತಿಯುತ ಟ್ರ್ಯಾಕ್ಟರ್ ಆಗಿದೆ. ಕಡಿಮೆ ನಿರ್ವಹಣೆ ಮತ್ತು ಹೆಚ್ಚಿನ ದಕ್ಷತೆಯೊಂದಿಗೆ ಭಾರತೀಯ ಕೃಷಿ ಪರಿಸ್ಥಿತಿಗಳಿಗೆ ಸೂಕ್ತವಾಗಿದೆ.'
            }
        ],
        ml: [
            {
                name: 'ജോൺ ഡീർ 5310',
                type: 'ട്രാക്ടർ',
                price: '₹8.5 ലക്ഷം',
                purpose: 'ഹെവി ഡ്യൂട്ടി ഉഴവ്',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/8/87/John_Deere_5310_utility_tractor,_rear.jpg',
                official_link: 'https://www.deere.co.in/en/tractors/e-series-tractors/5310e-tractor/',
                specs: {
                    'എഞ്ചിൻ': '55 HP, 3 സിലിണ്ടറുകൾ',
                    'ഗിയർബോക്സ്': '9 ഫോർവേഡ് + 3 റിവേഴ്സ്',
                    'ബ്രേക്കുകൾ': 'ഓയിൽ ഇമ്മേഴ്സ്ഡ് ഡിസ്ക് ബ്രേക്കുകൾ',
                    'വാറന്റി': '5000 മണിക്കൂർ / 5 വർഷം'
                },
                description: 'ജോൺ ഡീർ 5310 ഹെവി ഡ്യൂട്ടി ഉഴവിനായി രൂപകൽപ്പന ചെയ്ത ശക്തമായ ട്രാക്ടറാണ്. കുറഞ്ഞ അറ്റകുറ്റപ്പണിയും ഉയർന്ന കാര്യക്ഷമതയും ഉള്ളതിനാൽ ഇന്ത്യൻ കാർഷിക സാഹചര്യങ്ങൾക്ക് അനുയോജ്യമാണ്.'
            },
            {
                name: 'മഹിന്ദ്ര ജിവോ 245 DI 4WD',
                type: 'മിനി ട്രാക്ടർ',
                price: '₹4.2 ലക്ഷം',
                purpose: 'തോട്ടം കൃഷി',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/5/51/Mahindra_tractor.JPG',
                official_link: 'https://www.mahindratractor.com/tractors/jivo-245-di-4wd',
                specs: {
                    'എഞ്ചിൻ': '24 HP, 2 സിലിണ്ടറുകൾ',
                    'ഗിയർബോക്സ്': '8 ഫോർവേഡ് + 4 റിവേഴ്സ്',
                    'ബ്രേക്കുകൾ': 'ഓയിൽ ഇമ്മേഴ്സ്ഡ് ബ്രേക്കുകൾ',
                    'ലിഫ്റ്റ് ശേഷി': '750 കിലോഗ്രാം'
                },
                description: 'മഹിന്ദ്ര ജിവോ 245 DI 4WD തോട്ടം കൃഷിക്കായി രൂപകൽപ്പന ചെയ്ത ശക്തമായ മിനി ട്രാക്ടറാണ്. കുറഞ്ഞ അറ്റകുറ്റപ്പണിയും ഉയർന്ന കാര്യക്ഷമതയും ഉള്ളതിനാൽ ഇന്ത്യൻ കാർഷിക സാഹചര്യങ്ങൾക്ക് അനുയോജ്യമാണ്.'
            },
            {
                name: 'സോണാലിക DI 745',
                type: 'ട്രാക്ടർ',
                price: '₹6.8 ലക്ഷം',
                purpose: 'ഗതാഗതവും കൃഷിയും',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/9/93/Sonalika_DI_tractor.jpg',
                official_link: 'https://www.sonalika.com/tractor/di-745-iii.html',
                specs: {
                    'എഞ്ചിൻ': '50 HP, 3 സിലിണ്ടറുകൾ',
                    'ഗിയർബോക്സ്': '8 ഫോർവേഡ് + 2 റിവേഴ്സ്',
                    'ക്ലച്ച്': 'ഡ്യുവൽ ക്ലച്ച്',
                    'സ്റ്റിയറിംഗ്': 'പവർ സ്റ്റിയറിംഗ്'
                },
                description: 'സോണാലിക DI 745 ഗതാഗതത്തിനും കൃഷിക്കുമായി രൂപകൽപ്പന ചെയ്ത ശക്തമായ ട്രാക്ടറാണ്. കുറഞ്ഞ അറ്റകുറ്റപ്പണിയും ഉയർന്ന കാര്യക്ഷമതയും ഉള്ളതിനാൽ ഇന്ത്യൻ കാർഷിക സാഹചര്യങ്ങൾക്ക് അനുയോജ്യമാണ്.'
            },
            {
                name: 'ടാറ്റ ഏസ് ഗോൾഡ്',
                type: 'ഗതാഗതം',
                price: '₹5.0 ലക്ഷം',
                purpose: 'ചരക്ക് ഗതാഗതം',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/f/f3/Tata_Ace_Mini_Truck_(1).JPG',
                official_link: 'https://smalltrucks.tatamotors.com/listing-page?field_product_category_target_id=1',
                specs: {
                    'എഞ്ചിൻ': '700 സിസി, 2 സിലിണ്ടറുകൾ',
                    'പേലോഡ്': '710 കിലോഗ്രാം',
                    'മൈലേജ്': '22 കി.മീ/ലിറ്റർ',
                    'ഇന്ധനം': 'ഡീസൽ / സിഎൻജി'
                },
                description: 'ടാറ്റ ഏസ് ഗോൾഡ് ചരക്ക് ഗതാഗതത്തിനായി രൂപകൽപ്പന ചെയ്ത ശക്തമായ വാഹനമാണ്. കുറഞ്ഞ അറ്റകുറ്റപ്പണിയും ഉയർന്ന കാര്യക്ഷമതയും ഉള്ളതിനാൽ ഇന്ത്യൻ കാർഷിക സാഹചര്യങ്ങൾക്ക് അനുയോജ്യമാണ്.'
            },
            {
                name: 'കുബോട്ട MU4501',
                type: 'ട്രാക്ടർ',
                price: '₹7.9 ലക്ഷം',
                purpose: 'ഇന്ധന ക്ഷമത',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Kubota_tractor_9.jpg',
                official_link: 'https://tractorguru.in/tractor/kubota-mu4501',
                specs: {
                    'എഞ്ചിൻ': '45 HP, 4 സിലിണ്ടറുകൾ',
                    'ട്രാൻസ്മിഷൻ': 'സിൻക്രോമേഷ്',
                    'PTO': 'ഡ്യുവൽ PTO',
                    'ബ്രേക്കുകൾ': 'ഓയിൽ ഇമ്മേഴ്സ്ഡ് ഡിസ്ക് ബ്രേക്കുകൾ'
                },
                description: 'കുബോട്ട MU4501 ഇന്ധന ക്ഷമതയ്ക്കായി രൂപകൽപ്പന ചെയ്ത ശക്തമായ ട്രാക്ടറാണ്. കുറഞ്ഞ അറ്റകുറ്റപ്പണിയും ഉയർന്ന കാര്യക്ഷമതയും ഉള്ളതിനാൽ ഇന്ത്യൻ കാർഷിക സാഹചര്യങ്ങൾക്ക് അനുയോജ്യമാണ്.'
            }
        ],
        bn: [
            {
                name: 'জন ডিয়ার 5310',
                type: 'ট্র্যাক্টর',
                price: '₹8.5 লাখ',
                purpose: 'ভারী চাষাবাদ',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/8/87/John_Deere_5310_utility_tractor,_rear.jpg',
                official_link: 'https://www.deere.co.in/en/tractors/e-series-tractors/5310e-tractor/',
                specs: {
                    'ইঞ্জিন': '55 HP, 3 সিলিন্ডার',
                    'গিয়ারবক্স': '9 ফরোয়ার্ড + 3 রিভার্স',
                    'ব্রেক': 'অয়েল ইমার্সড ডিস্ক ব্রেক',
                    'ওয়ারেন্টি': '5000 ঘণ্টা / 5 বছর'
                },
                description: 'জন ডিয়ার 5310 ভারী চাষাবাদের জন্য ডিজাইন করা একটি শক্তিশালী ট্রাক্টর। কম রক্ষণাবেক্ষণ এবং উচ্চ দক্ষতার সাথে ভারতীয় কৃষি পরিস্থিতির জন্য উপযুক্ত।'
            },
            {
                name: 'মহিন্দ্রা জিভো 245 DI 4WD',
                type: 'মিনি ট্রাক্টর',
                price: '₹4.2 লাখ',
                purpose: 'বাগানি চাষ',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/5/51/Mahindra_tractor.JPG',
                official_link: 'https://www.mahindratractor.com/tractors/jivo-245-di-4wd',
                specs: {
                    'ইঞ্জিন': '24 HP, 2 সিলিন্ডার',
                    'গিয়ারবক্স': '8 ফরোয়ার্ড + 4 রিভার্স',
                    'ব্রেক': 'অয়েল ইমার্সড ব্রেক',
                    'লিফট ক্ষমতা': '750 কেজি'
                },
                description: 'মহিন্দ্রা জিভো 245 DI 4WD বাগানি চাষের জন্য ডিজাইন করা একটি শক্তিশালী মিনি ট্রাক্টর। কম রক্ষণাবেক্ষণ এবং উচ্চ দক্ষতার সাথে ভারতীয় কৃষি পরিস্থিতির জন্য উপযুক্ত।'
            },
            {
                name: 'সোনালিকা DI 745',
                type: 'ট্র্যাক্টর',
                price: '₹6.8 লাখ',
                purpose: 'পরিবহন ও চাষাবাদ',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/9/93/Sonalika_DI_tractor.jpg',
                official_link: 'https://www.sonalika.com/tractor/di-745-iii.html',
                specs: {
                    'إইঞ্জিন': '50 HP, 3 সিলিন্ডার',
                    'গিয়ারবক্স': '8 ফরোয়ার্ড + 2 রিভার্স',
                    'ক্লাচ': 'ডুয়াল ক্লাচ',
                    'স্টিয়ারিং': 'পাওয়ার স্টিয়ারিং'
                },
                description: 'সোনালিকা DI 745 পরিবহন ও চাষাবাদের জন্য ডিজাইন করা একটি শক্তিশালী ট্রাক্টর। কম রক্ষণাবেক্ষণ এবং উচ্চ দক্ষতার সাথে ভারতীয় কৃষি পরিস্থিতির জন্য উপযুক্ত।'
            },
            {
                name: 'টাটা এস গোল্ড',
                type: 'পরিবহন',
                price: '₹5.0 লাখ',
                purpose: 'পণ্য পরিবহন',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/f/f3/Tata_Ace_Mini_Truck_(1).JPG',
                official_link: 'https://smalltrucks.tatamotors.com/listing-page?field_product_category_target_id=1',
                specs: {
                    'ইঞ্জিন': '700 সিসি, 2 সিলিন্ডার',
                    'পেলোড': '710 কেজি',
                    'মাইলেজ': '22 কিমি/লিটার',
                    'জ্বালানি': 'ডিজেল / সিএনজি'
                },
                description: 'টাটা এস গোল্ড পণ্য পরিবহনের জন্য ডিজাইন করা একটি শক্তিশালী বাহন। কম রক্ষণাবেক্ষণ এবং উচ্চ দক্ষতার সাথে ভারতীয় কৃষি পরিস্থিতির জন্য উপযুক্ত।'
            },
            {
                name: 'কুবোটা MU4501',
                type: 'ট্র্যাক্টর',
                price: '₹7.9 লাখ',
                purpose: 'জ্বালানি সাশ্রয়ী',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Kubota_tractor_9.jpg',
                official_link: 'https://tractorguru.in/tractor/kubota-mu4501',
                specs: {
                    'ইঞ্জিন': '45 HP, 4 সিলিন্ডার',
                    'ট্রান্সমিশন': 'সিনক্রোমেশ',
                    'PTO': 'ডুয়াল PTO',
                    'ব্রেক': 'অয়েল ইমার্সড ডিস্ক ব্রেক'
                },
                description: 'কুবোটা MU4501 জ্বালানি সাশ্রয়ের জন্য ডিজাইন করা একটি শক্তিশালী ট্রাক্টর। কম রক্ষণাবেক্ষণ এবং উচ্চ দক্ষতার সাথে ভারতীয় কৃষি পরিস্থিতির জন্য উপযুক্ত।'
            }
        ],
        mr: [
            {
                name: 'जॉन डिअर 5310',
                type: 'ट्रॅक्टर',
                price: '₹8.5 लाख',
                purpose: 'जड नांगरणी',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/8/87/John_Deere_5310_utility_tractor,_rear.jpg',
                official_link: 'https://www.deere.co.in/en/tractors/e-series-tractors/5310e-tractor/',
                specs: {
                    'इंजिन': '55 HP, 3 सिलेंडर',
                    'गियरबॉक्स': '9 फॉरवर्ड + 3 रिव्हर्स',
                    'ब्रेक्स': 'ऑईल इमर्स्ड डिस्क ब्रेक्स',
                    'वारंटी': '5000 तास / 5 वर्षे'
                },
                description: 'जॉन डिअर 5310 जड नांगरणीसाठी डिझाइन केलेला एक शक्तिशाली ट्रॅक्टर आहे. कमी देखभाल आणि उच्च कार्यक्षमता, भारतीय शेतीसाठी योग्य.'
            },
            {
                name: 'महिंद्रा जीवो 245 DI 4WD',
                type: 'मिनी ट्रॅक्टर',
                price: '₹4.2 लाख',
                purpose: 'बागायती शेती',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/5/51/Mahindra_tractor.JPG',
                official_link: 'https://www.mahindratractor.com/tractors/jivo-245-di-4wd',
                specs: {
                    'इंजिन': '24 HP, 2 सिलेंडर',
                    'गियरबॉक्स': '8 फॉरवर्ड + 4 रिव्हर्स',
                    'ब्रेक्स': 'ऑईल इमर्स्ड ब्रेक्स',
                    'लिफ्ट क्षमता': '750 किलो'
                },
                description: 'महिंद्रा जीवो 245 DI 4WD बागायती शेतीसाठी डिझाइन केलेला एक शक्तिशाली मिनी ट्रॅक्टर आहे. कमी देखभाल आणि उच्च कार्यक्षमता, भारतीय शेतीसाठी योग्य.'
            },
            {
                name: 'सोनालिका DI 745',
                type: 'ट्रॅक्टर',
                price: '₹6.8 लाख',
                purpose: 'वाहतूक आणि मशागत',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/9/93/Sonalika_DI_tractor.jpg',
                official_link: 'https://www.sonalika.com/tractor/di-745-iii.html',
                specs: {
                    'इंजिन': '50 HP, 3 सिलेंडर',
                    'गियरबॉक्स': '8 फॉरवर्ड + 2 रिव्हर्स',
                    'क्लच': 'ड्युअल क्लच',
                    'स्टीअरिंग': 'पॉवर स्टीअरिंग'
                },
                description: 'सोनालिका DI 745 वाहतूक आणि मशागतीसाठी डिझाइन केलेला एक शक्तिशाली ट्रॅक्टर आहे. कमी देखभाल आणि उच्च कार्यक्षमता, भारतीय शेतीसाठी योग्य.'
            },
            {
                name: 'टाटा एस गोल्ड',
                type: 'वाहतूक',
                price: '₹5.0 लाख',
                purpose: 'मालवाहतूक',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/f/f3/Tata_Ace_Mini_Truck_(1).JPG',
                official_link: 'https://smalltrucks.tatamotors.com/listing-page?field_product_category_target_id=1',
                specs: {
                    'इंजिन': '700 सीसी, 2 सिलेंडर',
                    'पेलोड': '710 किलो',
                    'मायलेज': '22 किमी/लि',
                    'इंधन': 'डिझेल / सीएनजी'
                },
                description: 'टाटा एस गोल्ड मालवाहतुकीसाठी डिझाइन केलेले एक शक्तिशाली वाहन आहे. कमी देखभाल आणि उच्च कार्यक्षमता, भारतीय शेतीसाठी योग्य.'
            },
            {
                name: 'कुबोटा MU4501',
                type: 'ट्रॅक्टर',
                price: '₹7.9 लाख',
                purpose: 'इंधन कार्यक्षम',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Kubota_tractor_9.jpg',
                official_link: 'https://tractorguru.in/tractor/kubota-mu4501',
                specs: {
                    'इंजिन': '45 HP, 4 सिलेंडर',
                    'ट्रान्समिशन': 'सिंक्रोमेश',
                    'PTO': 'ड्युअल PTO',
                    'ब्रेक्स': 'ऑईल इमर्स्ड डिस्क ब्रेक्स'
                },
                description: 'कुबोटा MU4501 इंधन कार्यक्षमतेसाठी डिझाइन केलेला एक शक्तिशाली ट्रॅक्टर आहे. कमी देखभाल आणि उच्च कार्यक्षमता, भारतीय शेतीसाठी योग्य.'
            }
        ],
        gu: [
            {
                name: 'જોન ડીઅર 5310',
                type: 'ટ્રેક્ટર',
                price: '₹8.5 લાખ',
                purpose: 'ભારે ખેડાણ',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/8/87/John_Deere_5310_utility_tractor,_rear.jpg',
                official_link: 'https://www.deere.co.in/en/tractors/e-series-tractors/5310e-tractor/',
                specs: {
                    'એન્જિન': '55 HP, 3 સિલિન્ડર',
                    'ગિયરબોક્સ': '9 ફોરવર્ડ + 3 રિવર્સ',
                    'બ્રેક્સ': 'ઓઇલ ઇમર્સ્ડ ડિસ્ક બ્રેક્સ',
                    'વોરંટી': '5000 કલાક / 5 વર્ષ'
                },
                description: 'જોન ડીઅર 5310 ભારે ખેડાણ માટે રચાયેલ શક્તિશાળી ટ્રેક્ટર છે. ઓછી જાળવણી અને ઉચ્ચ કાર્યક્ષમતા સાથે ભારતીય ખેતીની સ્થિતિ માટે યોગ્ય.'
            },
            {
                name: 'મહિન્દ્રા જીવો 245 DI 4WD',
                type: 'મિની ટ્રેક્ટર',
                price: '₹4.2 લાખ',
                purpose: 'બાગાયતી ખેતી',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/5/51/Mahindra_tractor.JPG',
                official_link: 'https://www.mahindratractor.com/tractors/jivo-245-di-4wd',
                specs: {
                    'એન્જિન': '24 HP, 2 સિલિન્ડર',
                    'ગિયરબોક્સ': '8 ફોરવર્ડ + 4 રિવર્સ',
                    'બ્રેક્સ': 'ઓઇલ ઇમર્સ્ડ બ્રેક્સ',
                    'લિફ્ટ ક્ષમતા': '750 કિગ્રા'
                },
                description: 'મહિન્દ્રા જીવો 245 DI 4WD બાગાયતી ખેતી માટે રચાયેલ શક્તિશાળી મિની ટ્રેક્ટર છે. ઓછી જાળવણી અને ઉચ્ચ કાર્યક્ષમતા સાથે ભારતીય ખેતીની સ્થિતિ માટે યોગ્ય.'
            },
            {
                name: 'સોનાલિકા DI 745',
                type: 'ટ્રેક્ટર',
                price: '₹6.8 લાખ',
                purpose: 'વાહનવ્યવહાર અને ખેતી',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/9/93/Sonalika_DI_tractor.jpg',
                official_link: 'https://www.sonalika.com/tractor/di-745-iii.html',
                specs: {
                    'એન્જિન': '50 HP, 3 સિલિન્ડર',
                    'ગિયરબોક્સ': '8 ફોરવર્ડ + 2 રિવર્સ',
                    'ક્લચ': 'ડ્યુઅલ ક્લચ',
                    'સ્ટીયરિંગ': 'પાવર સ્ટીયરિંગ'
                },
                description: 'સોનાલિકા DI 745 વાહનવ્યવહાર અને ખેતી માટે રચાયેલ શક્તિશાળી ટ્રેક્ટર છે. ઓછી જાળવણી અને ઉચ્ચ કાર્યક્ષમતા સાથે ભારતીય ખેતીની સ્થિતિ માટે યોગ્ય.'
            },
            {
                name: 'ટાટા એસ ગોલ્ડ',
                type: 'વાહનવ્યવહાર',
                price: '₹5.0 લાખ',
                purpose: 'માલ વાહનવ્યવહાર',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/f/f3/Tata_Ace_Mini_Truck_(1).JPG',
                official_link: 'https://smalltrucks.tatamotors.com/listing-page?field_product_category_target_id=1',
                specs: {
                    'એન્જિન': '700 સીસી, 2 સિલિન્ડર',
                    'પેલોડ': '710 કિગ્રા',
                    'માઈલેજ': '22 કિમી/લિટર',
                    'ઇંધણ': 'ડીઝલ / સીએનજી'
                },
                description: 'ટાટા એસ ગોલ્ડ માલ વાહનવ્યવહાર માટે રચાયેલ શક્તિશાળી વાહન છે. ઓછી જાળવણી અને ઉચ્ચ કાર્યક્ષમતા સાથે ભારતીય ખેતીની સ્થિતિ માટે યોગ્ય.'
            },
            {
                name: 'કુબોટા MU4501',
                type: 'ટ્રેક્ટર',
                price: '₹7.9 લાખ',
                purpose: 'ઇંધણ કાર્યક્ષમ',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Kubota_tractor_9.jpg',
                official_link: 'https://tractorguru.in/tractor/kubota-mu4501',
                specs: {
                    'એન્જિન': '45 HP, 4 સિલિન્ડર',
                    'ટ્રાન્સમિશન': 'સિંક્રોમેશ',
                    'PTO': 'ડ્યુઅલ PTO',
                    'બ્રેક્સ': 'ઓઇલ ઇમર્સ્ડ ડિસ્ક બ્રેક્સ'
                },
                description: 'કુબોટા MU4501 ઇંધણ કાર્યક્ષમતા માટે રચાયેલ શક્તિશાળી ટ્રેક્ટર છે. ઓછી જાળવણી અને ઉચ્ચ કાર્યક્ષમતા સાથે ભારતીય ખેતીની સ્થિતિ માટે યોગ્ય.'
            }
        ],
    };


    const vehicleLabels: { [key: string]: { specs: string, desc: string, visit: string, back: string } } = {
        en: { specs: 'Specifications', desc: 'Description', visit: 'Visit Official Page', back: 'Back' },
        ta: { specs: 'விவரக்குறிப்புகள்', desc: 'விளக்கம்', visit: 'அதிகாரப்பூர்வ பக்கத்தைப் பார்வையிடவும்', back: 'பின்னால்' },
        hi: { specs: 'विनिर्देश', desc: 'विवरण', visit: 'आधिकारिक पृष्ठ पर जाएं', back: 'वापस' },
        te: { specs: 'స్పెసిఫికేషన్లు', desc: 'వివరణ', visit: 'అధికారిక పేజీని సందర్శించండి', back: 'తిరిగి' },
        kn: { specs: 'ವಿಶೇಷಣಗಳು', desc: 'ವಿವರಣೆ', visit: 'ಅಧಿಕೃತ ಪುಟಕ್ಕೆ ಭೇಟಿ ನೀಡಿ', back: 'ಹಿಂದೆ' },
        ml: { specs: 'സവിശേഷതകൾ', desc: 'വിവരണം', visit: 'ഔദ്യോഗിക പേജ് സന്ദർശിക്കുക', back: 'തിരികെ' },
        bn: { specs: 'স্পেসিফিকেশন', desc: 'বিবরণ', visit: 'অফিসিয়াল পেজ দেখুন', back: 'ফিরে যান' },
        mr: { specs: 'तपशील', desc: 'वर्णन', visit: 'अधिकृत पृष्ठास भेट द्या', back: 'मागे' },
        gu: { specs: 'વિશિષ્ટતાઓ', desc: 'વર્ણન', visit: 'સત્તાવાર પૃષ્ઠની મુલાકાત લો', back: 'પાછા' }
    };

    
    // Levenshtein Distance — Fuzzy Search Algorithm (DSA: Dynamic Programming)
    // Allows farmers to find schemes even with typos in their search queries.
    // Time Complexity: O(m*n) where m,n are string lengths
    // Imported government schemes data and labels
    const levenshteinDistance = (a: string, b: string): number => {
        const matrix: number[][] = [];
        for (let i = 0; i <= b.length; i++) matrix[i] = [i];
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        return matrix[b.length][a.length];
    };

    const fuzzyMatch = (query: string, target: string): boolean => {
        const q = query.toLowerCase().trim();
        const t = target.toLowerCase();
        if (!q) return true;
        if (t.includes(q)) return true;
        // Only fuzzy match for queries >= 3 chars; adaptive threshold
        if (q.length < 3) return false;
        const threshold = Math.max(1, Math.floor(q.length / 3));
        const words = t.split(/\s+/);
        return words.some(w => w.length > 2 && levenshteinDistance(q, w) <= threshold);
    };


    // Central Government Schemes — O(1) Hash-Map keyed by scheme ID
    // Each scheme has multilingual translations for all 8 supported languages
    // @ts-ignore
    const _localCentralSchemes: { [id: string]: any } = {
        'pm-kisan': {
            id: 'pm-kisan',
            icon: '💰',
            color: 'from-emerald-500/20 to-emerald-600/10',
            borderColor: 'border-emerald-500/30',
            iconBg: 'bg-emerald-500/20',
            iconText: 'text-emerald-400',
            category: 'Income Support',
            benefit: { en: '₹6,000/year', ta: '₹6,000/ஆண்டு', hi: '₹6,000/वर्ष', te: '₹6,000/సంవత్సరం', kn: '₹6,000/ವರ್ಷ', ml: '₹6,000/വർഷം', bn: '₹6,000/বছর', mr: '₹6,000/वर्ष' },
            applyLink: 'https://pmkisan.gov.in',
            ytLink: 'https://youtu.be/vUkRxMt0X5A?si=SMZLlj8qmWoRAvl6',
            dateAdded: '2024-02-01',
            name: { en: 'PM-KISAN', ta: 'பிஎம்-கிசான்', hi: 'पीएम-किसान', te: 'PM-KISAN', kn: 'PM-KISAN', ml: 'PM-KISAN', bn: 'PM-KISAN', mr: 'PM-KISAN' },
            details: { en: '₹6,000/year direct income support in 3 installments to small & marginal landholding farmer families.', ta: 'சிறு மற்றும் குறு விவசாயிகளுக்கு ஆண்டுக்கு ₹6,000 — 3 தவணைகளில் நேரடி வருமான உதவி.', hi: 'छोटे और सीमांत किसानों को ₹6,000/वर्ष — 3 किश्तों में सीधे बैंक खाते में।', te: 'చిన్న రైతులకు ₹6,000/సంవత్సరం — 3 వాయిదాల్లో నేరుగా బ్యాంకు ఖాతాకు.', kn: 'ಸಣ್ಣ ರೈತರಿಗೆ ₹6,000/ವರ್ಷ — 3 ಕಂತುಗಳಲ್ಲಿ ನೇರವಾಗಿ ಬ್ಯಾಂಕ್ ಖಾತೆಗೆ.', ml: 'ചെറുകിട കർഷകർക്ക് ₹6,000/വർഷം — 3 ഗഡുക്കളായി ബാങ്ക് അക്കൗണ്ടിലേക്ക് നേരിട്ട്.', bn: 'ক্ষুদ্র কৃষকদের ₹6,000/বছর — 3 কিস্তিতে সরাসরি ব্যাংক একাউন্টে।', mr: 'लहान शेतकऱ्यांना ₹6,000/वर्ष — 3 हप्त्यांमध्ये थेट बँक खात्यात।' },
            eligibility: { en: 'Small & Marginal Farmers', ta: 'சிறு மற்றும் குறு விவசாயிகள்', hi: 'छोटे और सीमांत किसान', te: 'చిన్న & సన్నకారు రైతులు', kn: 'ಸಣ್ಣ ಮತ್ತು ಅತಿ ಸಣ್ಣ ರೈತರು', ml: 'ചെറുകിട കർഷകർ', bn: 'ক্ষুদ্র ও প্রান্তিক কৃষক', mr: 'अल्पभूधारक शेतकरी' }
        },
        'pmfby': {
            id: 'pmfby',
            icon: '🛡️',
            color: 'from-blue-500/20 to-blue-600/10',
            borderColor: 'border-blue-500/30',
            iconBg: 'bg-blue-500/20',
            iconText: 'text-blue-400',
            category: 'Insurance',
            benefit: { en: 'Full crop loss coverage', ta: 'முழு பயிர் இழப்பு காப்பீடு', hi: 'पूर्ण फसल हानि कवरेज', te: 'పూర్తి పంట నష్ట కవరేజ్', kn: 'ಪೂರ್ಣ ಬೆಳೆ ನಷ್ಟ ಕವರೇಜ್', ml: 'പൂർണ വിള നഷ്ട പരിരക്ഷ', bn: 'সম্পূর্ণ ফসল ক্ষতি কভারেজ', mr: 'पूर्ण पीक नुकसान संरक्षण' },
            applyLink: 'https://pmfby.gov.in',
            ytLink: 'https://www.youtube.com/watch?v=P_J6vS-6_C4',
            dateAdded: '2024-06-01',
            name: { en: 'Pradhan Mantri Fasal Bima Yojana', ta: 'பிரதான் மந்திரி பயிர் காப்பீட்டு திட்டம்', hi: 'प्रधानमंत्री फसल बीमा योजना', te: 'ప్రధాన మంత్రి ఫసల్ బీమా యోజన', kn: 'ಪ್ರಧಾನ ಮಂತ್ರಿ ಫಸಲ್ ಬಿಮಾ ಯೋಜನೆ', ml: 'പ്രധാൻ മന്ത്രി ഫസൽ ബിമ യോജന', bn: 'প্রধানমন্ত্রী ফসল বিমা যোজনা', mr: 'प्रधानमंत्री पीक विमा योजना' },
            details: { en: 'Crop insurance against natural calamities, pests & diseases. Premium as low as 2% for kharif, 1.5% for rabi.', ta: 'இயற்கை பேரிடர், பூச்சி மற்றும் நோய்களால் பயிர் இழப்பிற்கு காப்பீடு. கரீப் 2%, ரபி 1.5% பிரீமியம்.', hi: 'प्राकृतिक आपदा, कीट और बीमारी से फसल नुकसान पर बीमा। खरीफ 2%, रबी 1.5% प्रीमियम।', te: 'సహజ విపత్తులు, తెగుళ్ళు వల్ల పంట నష్టానికి బీమా. ఖరీఫ్ 2%, రబీ 1.5% ప్రీమియం.', kn: 'ನೈಸರ್ಗಿಕ ವಿಪತ್ತು, ಕೀಟ ಹಾನಿಗೆ ಬೆಳೆ ವಿಮೆ. ಖರೀಫ್ 2%, ರಬಿ 1.5% ಪ್ರೀಮಿಯಂ.', ml: 'പ്രകൃതി ദുരന്തം, കീടങ്ങൾ മൂലം വിള നഷ്ടത്തിന് ഇൻഷുറൻസ്. ഖരീഫ് 2%, റബി 1.5%.', bn: 'প্রাকৃতিক দুর্যোগ, পোকামাকড়ে ফসল ক্ষতির বিমা। খরিফ 2%, রবি 1.5% প্রিমিয়াম।', mr: 'नैसर्गिक आपत्ती, कीडरोगामुळे पीक नुकसानीस विमा. खरीफ 2%, रबी 1.5%.' },
            eligibility: { en: 'All farmers growing notified crops', ta: 'அனைத்து விவசாயிகள்', hi: 'सभी किसान', te: 'అందరూ రైతులు', kn: 'ಎಲ್ಲಾ ರೈತರು', ml: 'എല്ലാ കർഷകർക്കും', bn: 'সমস্ত কৃষক', mr: 'सर्व शेतकरी' }
        },
        'kcc': {
            id: 'kcc',
            icon: '💳',
            color: 'from-teal-500/20 to-teal-600/10',
            borderColor: 'border-teal-500/30',
            iconBg: 'bg-teal-500/20',
            iconText: 'text-teal-400',
            category: 'Credit',
            benefit: { en: 'Up to ₹3 lakh at 4-7% p.a.', ta: '₹3 லட்சம் வரை 4-7% வட்டி', hi: '₹3 लाख तक 4-7% ब्याज', te: '₹3 లక్షల వరకు 4-7% వడ్డీ', kn: '₹3 ಲಕ್ಷ ವರೆಗೆ 4-7% ಬಡ್ಡಿ', ml: '₹3 ലക്ഷം വരെ 4-7% പലിശ', bn: '₹3 লাখ পর্যন্ত 4-7% সুদ', mr: '₹3 लाखापर्यंत 4-7% व्याज' },
            applyLink: 'https://sbi.co.in',
            ytLink: 'https://youtu.be/Uld6joNKTms?si=l0kNicVxQZeUMuHg',
            dateAdded: '2024-01-15',
            name: { en: 'Kisan Credit Card (KCC)', ta: 'கிசான் கிரெடிட் கார்டு', hi: 'किसान क्रेडिट कार्ड', te: 'కిసాన్ క్రెడిట్ కార్డ్', kn: 'ಕಿಸಾನ್ ಕ್ರೆಡಿಟ್ ಕಾರ್ಡ್', ml: 'കിസാൻ ക്രെഡിറ്റ് കാർഡ്', bn: 'কিসান ক্রেডিট কার্ড', mr: 'किसान क्रेडिट कार्ड' },
            details: { en: 'Easy credit at 7% p.a. (4% with timely repayment) for seeds, fertilisers, pesticides up to ₹3 lakh.', ta: 'விதைகள், உரம், பூச்சிக்கொல்லிக்கு 7% வட்டியில் (சரியான திருப்பிச் செலுத்துதலில் 4%) ₹3 லட்சம் வரை கடன்.', hi: 'बीज, खाद, कीटनाशक के लिए 7% (समय पर चुकाने पर 4%) ब्याज पर ₹3 लाख तक।', te: 'విత్తనాలు, ఎరువులు, పురుగుమందులకు 7% (సకాలంలో చెల్లిస్తే 4%) వడ్డీపై ₹3 లక్షల వరకు.', kn: 'ಬೀಜ, ಗೊಬ್ಬರಕ್ಕೆ 7% (ಸಮಯಕ್ಕೆ ಮರುಪಾವತಿ 4%) ಬಡ್ಡಿಯಲ್ಲಿ ₹3 ಲಕ್ಷ ವರೆಗೆ.', ml: 'വിത്ത്, വളം, കീടനാശിനിക്ക് 7% (സമയബദ്ധ 4%) പലിശയ്ക്ക് ₹3 ലക്ഷം വരെ.', bn: 'বীজ, সার, কীটনাশকের জন্য 7% (সময়মতো 4%) সুদে ₹3 লাখ পর্যন্ত।', mr: 'बियाणे, खतासाठी 7% (वेळेवर 4%) व्याजाने ₹3 लाखापर्यंत.' },
            eligibility: { en: 'All farmers, sharecroppers, tenants', ta: 'விவசாயிகள்', hi: 'किसान, बटाईदार', te: 'రైతులు', kn: 'ರೈತರು', ml: 'കർഷകർ', bn: 'কৃষক', mr: 'शेतकरी' }
        },
        'enam': {
            id: 'enam',
            icon: '🏪',
            color: 'from-amber-500/20 to-amber-600/10',
            borderColor: 'border-amber-500/30',
            iconBg: 'bg-amber-500/20',
            iconText: 'text-amber-400',
            category: 'Market Access',
            benefit: { en: 'Better price, no middlemen', ta: 'சிறந்த விலை, இடைத்தரகர் இல்லை', hi: 'बेहतर कीमत, बिना बिचौलिए', te: 'మెరుగైన ధర, మధ్యవర్తులు లేకుండా', kn: 'ಉತ್ತಮ ಬೆಲೆ, ಮಧ್ಯವರ್ತಿ ಇಲ್ಲ', ml: 'മികച്ച വില, ഇടനിലക്കാർ ഇല്ല', bn: 'ভালো দাম, মধ্যস্থতাকারী ছাড়া', mr: 'चांगली किंमत, दलालाशिवाय' },
            applyLink: 'https://enam.gov.in',
            ytLink: 'https://www.youtube.com/watch?v=GV6TvgruDfr',
            dateAdded: '2024-03-10',
            name: { en: 'e-NAM (National Agriculture Market)', ta: 'இ-நாம் தேசிய விவசாய சந்தை', hi: 'ई-नाम राष्ट्रीय कृषि बाजार', te: 'ఇ-నామ్ జాతీయ వ్యవసాయ మార్కెట్', kn: 'ಇ-ನಾಮ್ ರಾಷ್ಟ್ರೀಯ ಕೃಷಿ ಮಾರುಕಟ್ಟೆ', ml: 'ഇ-നാം ദേശീയ കൃഷി കമ്പോളം', bn: 'ই-নাম জাতীয় কৃষি বাজার', mr: 'ई-नाम राष्ट्रीय कृषी बाजार' },
            details: { en: 'Online pan-India trading platform linking APMCs. Sell produce via mobile to buyers across India — no middlemen.', ta: 'இந்தியா முழுவதும் வாங்குபவர்களுக்கு மொபைல் வழி விளைபொருள் விற்பனை — இடைத்தரகர் இல்லாமல்.', hi: 'मोबाइल ऐप से पूरे भारत के खरीदारों को उपज बेचें — बिना बिचौलिए।', te: 'మొబైల్ ద్వారా భారతదేశమంతటా కొనుగోలుదారులకు ఉత్పత్తి అమ్మండి.', kn: 'ಮೊಬೈಲ್ ಮೂಲಕ ಭಾರತಾದ್ಯಂತ ಖರೀದಿದಾರರಿಗೆ ಉತ್ಪನ್ನ ಮಾರಾಟ.', ml: 'മൊബൈൽ വഴി ഇന്ത്യ മുഴുവൻ വാങ്ങുന്നവർക്ക് ഉൽപ്പന്നം വിൽക്കൂ.', bn: 'মোবাইল দিয়ে সারা ভারতে ক্রেতাদের কাছে পণ্য বিক্রি করুন।', mr: 'मोबाइलद्वारे संपूर्ण भारतातील खरेदीदारांना उत्पादन विका.' },
            eligibility: { en: 'Traders & Farmers', ta: 'வியாபாரிகள் மற்றும் விவசாயிகள்', hi: 'व्यापारी और किसान', te: 'వ్యాపారులు & రైతులు', kn: 'ವ್ಯಾಪಾರಿಗಳು ಮತ್ತು ರೈತರು', ml: 'കർഷകർ', bn: 'ব্যবসায়ী ও কৃষক', mr: 'व्यापारी आणि शेतकरी' }
        },
        'pmksy': {
            id: 'pmksy',
            icon: '💧',
            color: 'from-cyan-500/20 to-cyan-600/10',
            borderColor: 'border-cyan-500/30',
            iconBg: 'bg-cyan-500/20',
            iconText: 'text-cyan-400',
            category: 'Irrigation',
            benefit: { en: '55-75% subsidy on drip/sprinkler', ta: 'சொட்டு/தெளிப்புக்கு 55-75% மானியம்', hi: 'ड्रिप/स्प्रिंकलर पर 55-75% सब्सिडी', te: 'డ్రిప్/స్ప్రింక్లర్‌పై 55-75% సబ్సిడీ', kn: 'ಡ್ರಿಪ್/ಸ್ಪ್ರಿಂಕ್ಲರ್‌ಗೆ 55-75% ಸಹಾಯಧನ', ml: 'ഡ്രിപ്/സ്പ്രിങ്ക്ലറിന് 55-75% സബ്സിഡി', bn: 'ড্রিপ/স্প্রিংকলারে 55-75% ভর্তুকি', mr: 'ठिबक/तुषारवर 55-75% अनुदान' },
            applyLink: 'https://pmksy.gov.in',
            ytLink: 'https://www.youtube.com/results?search_query=PMKSY+drip+irrigation+apply',
            dateAdded: '2024-04-20',
            name: { en: 'PM Krishi Sinchayee Yojana', ta: 'PM கிருஷி சிஞ்சாயி யோஜனா', hi: 'प्रधानमंत्री कृषि सिंचाई योजना', te: 'పిఎమ్ కృషి సించాయి యోజన', kn: 'PM ಕೃಷಿ ಸಿಂಚಾಯಿ ಯೋಜನೆ', ml: 'PM കൃഷി സിഞ്ചായ് യോജന', bn: 'PM কৃষি সিঞ্চাই যোজনা', mr: 'PM कृषी सिंचाई योजना' },
            details: { en: 'Subsidy for drip/sprinkler irrigation — More Crop Per Drop. 55-75% subsidy for micro-irrigation systems.', ta: 'தொட்டி நீர்ப்பாசனம், தெளிப்பு நீர்ப்பாசனத்துக்கு 55-75% மானியம் — குறைவான தண்ணீரில் அதிக விளைச்சல்.', hi: 'ड्रिप/स्प्रिंकलर सिंचाई के लिए 55-75% सब्सिडी — कम पानी में ज्यादा फसल।', te: 'డ్రిప్/స్ప్రింక్లర్ నీటి పారుదల వ్యవస్థలకు 55-75% సబ్సిడీ.', kn: 'ಡ್ರಿಪ್/ಸ್ಪ್ರಿಂಕ್ಲರ್ ನೀರಾವರಿಗೆ 55-75% ಸಹಾಯಧನ.', ml: 'ഡ്രിപ്/സ്പ്രിങ്ക്ലർ ജലസേചനത്തിന് 55-75% സബ്സിഡി.', bn: 'ড্রিপ/স্প্রিংকলার সেচে 55-75% ভর্তুকি।', mr: 'ठिबक/तुषार सिंचनासाठी 55-75% अनुदान.' },
            eligibility: { en: 'All farmers with own or leased land', ta: 'சொந்த/குத்தகை நிலம் உள்ள விவசாயிகள்', hi: 'स्वयं/पट्टे की जमीन वाले किसान', te: 'సొంత/లీజు భూమి ఉన్న రైతులు', kn: 'ಸ್ವಂತ/ಗುತ್ತಿಗೆ ಭೂಮಿ ರೈತರು', ml: 'സ്വന്തം/പാട്ട ഭൂമി കർഷകർ', bn: 'নিজ/ইজারা জমির কৃষক', mr: 'स्वतःच्या/भाडेपट्ट्याच्या जमीन शेतकरी' }
        },
        'agriinfra': {
            id: 'agriinfra',
            icon: '🏗️',
            color: 'from-purple-500/20 to-purple-600/10',
            borderColor: 'border-purple-500/30',
            iconBg: 'bg-purple-500/20',
            iconText: 'text-purple-400',
            category: 'Infrastructure',
            benefit: { en: 'Loans up to ₹2 crore, 3% subvention', ta: '₹2 கோடி வரை கடன், 3% வட்டி மானியம்', hi: '₹2 करोड़ तक लोन, 3% ब्याज सबवेंशन', te: '₹2 కోట్ల వరకు లోన్, 3% వడ్డీ రాయితీ', kn: '₹2 ಕೋಟಿ ವರೆಗೆ ಸಾಲ, 3% ಬಡ್ಡಿ ಸಬ್ವೆನ್ಷನ್', ml: '₹2 കോടി വരെ ലോൺ, 3% പലിശ ആനുകൂല്യം', bn: '₹2 কোটি পর্যন্ত ঋণ, 3% সুদ ভর্তুকি', mr: '₹2 कोटींपर्यंत कर्ज, 3% व्याज सवलत' },
            applyLink: 'https://agriinfra.dac.gov.in',
            ytLink: 'https://www.youtube.com/results?search_query=Agriculture+Infrastructure+Fund+apply',
            dateAdded: '2026-06-01',
            name: { en: 'Agriculture Infrastructure Fund', ta: 'விவசாய உள்கட்டமைப்பு நிதி', hi: 'कृषि अवसंरचना कोष', te: 'వ్యవసాయ మౌలిక సదుపాయాల నిధి', kn: 'ಕೃಷಿ ಮೂಲಸೌಕರ್ಯ ನಿಧಿ', ml: 'കൃഷി ഇൻഫ്രാസ്ട്രക്ചർ ഫണ്ട്', bn: 'কৃষি পরিকাঠামো তহবিল', mr: 'कृषी पायाभूत सुविधा निधी' },
            details: { en: 'Fund for cold storage, warehouses, pack houses, sorting units with 3% interest subvention.', ta: 'குளிர்பதன கிடங்கு, கோடவ்ண்டகள் நிறுவ 3% வட்டி மானியத்துடன் நிதி.', hi: 'कोल्ड स्टोरेज, वेयरहाउस बनाने के लिए 3% ब्याज सब्वेंशन के साथ फंड।', te: 'కోల్డ్ స్టోరేజ్, వేర్‌హౌస్ నిర్మాణానికి 3% వడ్డీ రాయితీతో నిధి.', kn: 'ಶೀತಲ ಗೃಹ, ಗೋದಾಮು ನಿರ್ಮಾಣಕ್ಕೆ 3% ಬಡ್ಡಿ ಸಬ್ವೆನ್ಷನ್‌ ನಿಧಿ.', ml: 'ശീതകക്ഷ, ഗോഡൗൺ നിർമ്മാണത്തിന് 3% പലിശ ആനുകൂല്യം.', bn: 'কোল্ড স্টোরেজ, গুদাম নির্মাণে 3% সুদ ভর্তুকি তহবিল।', mr: 'शीतगृह, गोदाम उभारणीसाठी 3% व्याज सवलत निधी.' },
            eligibility: { en: 'FPOs, PACS, SHGs, farmers, startups', ta: 'FPO, PACS, SHG, விவசாயிகள்', hi: 'FPO, PACS, SHG, किसान, स्टार्टअप', te: 'FPO, PACS, SHG, రైతులు', kn: 'FPO, PACS, SHG, ರೈತರು', ml: 'FPO, PACS, SHG, കർഷകർ', bn: 'FPO, PACS, SHG, কৃষক', mr: 'FPO, PACS, SHG, शेतकरी' }
        },
        'pkvy': {
            id: 'pkvy',
            icon: '🌿',
            color: 'from-lime-500/20 to-lime-600/10',
            borderColor: 'border-lime-500/30',
            iconBg: 'bg-lime-500/20',
            iconText: 'text-lime-400',
            category: 'Organic Farming',
            benefit: { en: '₹50,000/ha over 3 years', ta: '3 ஆண்டுகளில் ₹50,000/ஹெக்டேர்', hi: '3 वर्षों में ₹50,000/हेक्टेयर', te: '3 సంవత్సరాలలో ₹50,000/హెక్టేర్', kn: '3 ವರ್ಷಗಳಲ್ಲಿ ₹50,000/ಹೆಕ್ಟೇರ್', ml: '3 വർഷത്തിൽ ₹50,000/ഹെക്ടർ', bn: '3 বছরে ₹50,000/হেক্টর', mr: '3 वर्षांत ₹50,000/हेक्टर' },
            applyLink: 'https://pgsindia-ncof.gov.in',
            ytLink: 'https://www.youtube.com/results?search_query=PKVY+organic+farming+apply',
            dateAdded: '2026-05-10',
            name: { en: 'Paramparagat Krishi Vikas Yojana', ta: 'பரம்பரகத் கிருஷி விகாஸ் யோஜனா', hi: 'परम्परागत कृषि विकास योजना', te: 'పరంపరగత్ కృషి వికాస్ యోజన', kn: 'ಪರಂಪರಾಗತ ಕೃಷಿ ವಿಕಾಸ ಯೋಜನೆ', ml: 'പരംപരഗത് കൃഷി വികാസ് യോജന', bn: 'পরম্পরাগত কৃষি বিকাশ যোজনা', mr: 'पारंपरिक कृषी विकास योजना' },
            details: { en: 'Promotes organic farming — clusters of 50 farmers get ₹50,000/ha over 3 years for certification & marketing.', ta: 'இயற்கை விவசாயத்திற்கு 50 விவசாயிகள் கொண்ட குழுக்களுக்கு 3 ஆண்டுகளில் ₹50,000/ஹெக்டேர் உதவி.', hi: '50 किसानों के समूह को 3 वर्षों में ₹50,000/हेक्टेयर — जैविक खेती प्रमाणीकरण।', te: '50 రైతుల సమూహానికి 3 సంవత్సరాలలో ₹50,000/హెక్టేర్ — సేంద్రీయ వ్యవసాయం.', kn: '50 ರೈತರ ಗುಂಪಿಗೆ 3 ವರ್ಷಗಳಲ್ಲಿ ₹50,000/ಹೆಕ್ಟೇರ್ — ಸಾವಯವ ಕೃಷಿ.', ml: '50 കർഷകരുടെ ഗ്രൂപ്പിന് 3 വർഷത്തിൽ ₹50,000/ഹെക്ടർ — ജൈവ കൃഷി.', bn: '50 কৃষকের দলকে 3 বছরে ₹50,000/হেক্টর — জৈব চাষ।', mr: '50 शेतकऱ्यांच्या गटाला 3 वर्षांत ₹50,000/हेक्टर — सेंद्रिय शेती.' },
            eligibility: { en: 'Groups of 50+ farmers (20 ha cluster)', ta: '50+ விவசாயிகள் குழு', hi: '50+ किसानों का समूह', te: '50+ రైతుల సమూహం', kn: '50+ ರೈತರ ಗುಂಪು', ml: '50+ കർഷകരുടെ ഗ്രൂപ്പ്', bn: '50+ কৃষকের দল', mr: '50+ शेतकऱ्यांचा गट' }
        },
        'smam': {
            id: 'smam',
            icon: '🚜',
            color: 'from-orange-500/20 to-orange-600/10',
            borderColor: 'border-orange-500/30',
            iconBg: 'bg-orange-500/20',
            iconText: 'text-orange-400',
            category: 'Mechanisation',
            benefit: { en: '40-50% subsidy on machinery', ta: 'இயந்திரங்களுக்கு 40-50% மானியம்', hi: 'मशीनरी पर 40-50% सब्सिडी', te: 'యంత్రాలపై 40-50% సబ్సిడీ', kn: 'ಯಂತ್ರಗಳಿಗೆ 40-50% ಸಹಾಯಧನ', ml: 'യന്ത്രങ്ങൾക്ക് 40-50% സബ്സിഡി', bn: 'যন্ত্রপাতিতে 40-50% ভর্তুকি', mr: 'यंत्रणांवर 40-50% अनुदान' },
            applyLink: 'https://agrimachinery.nic.in',
            ytLink: 'https://www.youtube.com/results?search_query=SMAM+tractor+subsidy+apply',
            dateAdded: '2026-05-15',
            name: { en: 'Sub-Mission on Agri Mechanisation', ta: 'வேளாண் இயந்திரமயமாக்கல் துணை திட்டம்', hi: 'कृषि यंत्रीकरण पर उप-मिशन', te: 'వ్యవసాయ యాంత్రీకరణ ఉప-మిషన్', kn: 'ಕೃಷಿ ಯಾಂತ್ರೀಕರಣ ಉಪ-ಮಿಷನ್', ml: 'കൃഷി യന്ത്രവൽക്കരണ ഉപ-മിഷൻ', bn: 'কৃষি যন্ত্রায়ন উপ-মিশন', mr: 'शेती यांत्रिकीकरण उप-अभियान' },
            details: { en: '40-50% subsidy on farm machinery — tractors, harvesters, seed drills. Higher subsidy for SC/ST farmers.', ta: 'ட்ராக்டர், அறுவடை இயந்திரங்களுக்கு 40-50% மானியம். SC/ST விவசாயிகளுக்கு அதிக மானியம்.', hi: 'ट्रैक्टर, हार्वेस्टर पर 40-50% सब्सिडी। SC/ST किसानों को अधिक।', te: 'ట్రాక్టర్లు, హార్వెస్టర్లకు 40-50% సబ్సిడీ. SC/ST రైతులకు అధికం.', kn: 'ಟ್ರ್ಯಾಕ್ಟರ್, ಹಾರ್ವೆಸ್ಟರ್‌ಗಳಿಗೆ 40-50% ಸಹಾಯಧನ. SC/ST ರೈತರಿಗೆ ಹೆಚ್ಚು.', ml: 'ട്രാക്ടർ, ഹാർവെസ്റ്ററുകൾക്ക് 40-50% സബ്സിഡി. SC/ST കർഷകർക്ക് കൂടുതൽ.', bn: 'ট্র্যাক্টর, হার্ভেস্টারে 40-50% ভর্তুকি। SC/ST কৃষকদের বেশি।', mr: 'ट्रॅक्टर, हार्वेस्टरवर 40-50% अनुदान. SC/ST शेतकऱ्यांना जास्त.' },
            eligibility: { en: 'Individual farmers; SC/ST, small & marginal preferred', ta: 'விவசாயிகள்; SC/ST முன்னுரிமை', hi: 'किसान; SC/ST प्राथमिकता', te: 'రైతులు; SC/ST ప్రాధాన్యత', kn: 'ರೈತರು; SC/ST ಆದ್ಯತೆ', ml: 'കർഷകർ; SC/ST മുൻഗണന', bn: 'কৃষক; SC/ST অগ্রাধিকার', mr: 'शेतकरी; SC/ST प्राधान्य' }
        }
    };


    // UI Labels for schemes section
    // @ts-ignore
    const _localSchemeLabels: { [key: string]: any } = {
        en: { newBanner: 'new schemes added this month', search: 'Search schemes...', askHorizon: 'Ask Horizon', eligible: 'Am I Eligible?', stateSchemes: 'State Schemes', benefit: 'Key Benefit', docs: 'Documents Needed', steps: 'How to Apply', timeline: 'Timeline', tip: 'Pro Tip', checkEligibility: 'Check', land: 'Land (acres)', income: 'Income (₹/yr)', category: 'Category', for: 'For' },
        ta: { newBanner: 'புதிய திட்டங்கள் இந்த மாதம் சேர்க்கப்பட்டன', search: 'திட்டங்களை தேடு...', askHorizon: 'ஹொரிசனிடம் கேள்', eligible: 'நான் தகுதியா?', stateSchemes: 'மாநில திட்டங்கள்', benefit: 'முக்கிய பலன்', docs: 'தேவையான ஆவணங்கள்', steps: 'எப்படி விண்ணப்பிக்கலாம்', timeline: 'காலக்கெடு', tip: 'ப்ரோ டிப்', checkEligibility: 'சரிபார்', land: 'நிலம் (ஏக்கர்)', income: 'வருமானம் (₹/ஆ)', category: 'பிரிவு', for: 'யாருக்கு' },
        hi: { newBanner: 'नई योजनाएं इस महीने जोड़ी गईं', search: 'योजना खोजें...', askHorizon: 'होराइज़न से पूछें', eligible: 'क्या मैं योग्य हूं?', stateSchemes: 'राज्य योजनाएं', benefit: 'मुख्य लाभ', docs: 'आवश्यक दस्तावेज', steps: 'आवेदन कैसे करें', timeline: 'समयसीमा', tip: 'प्रो टिप', checkEligibility: 'जांचें', land: 'जमीन (एकड़)', income: 'आय (₹/वर्ष)', category: 'श्रेणी', for: 'किसके लिए' },
        te: { newBanner: 'కొత్త పథకాలు ఈ నెల చేర్చబడ్డాయి', search: 'పథకాలు వెతకండి...', askHorizon: 'హొరైజన్‌ని అడగండి', eligible: 'నేను అర్హుడినా?', stateSchemes: 'రాష్ట్ర పథకాలు', benefit: 'ముఖ్య ప్రయోజనం', docs: 'అవసరమైన పత్రాలు', steps: 'ఎలా దరఖాస్తు చేయాలి', timeline: 'సమయం', tip: 'ప్రో టిప్', checkEligibility: 'తనిఖీ', land: 'భూమి (ఎకరాలు)', income: 'ఆదాయం (₹/సం)', category: 'వర్గం', for: 'ఎవరికి' },
        kn: { newBanner: 'ಹೊಸ ಯೋಜನೆಗಳು ಈ ತಿಂಗಳು ಸೇರಿಸಲಾಗಿದೆ', search: 'ಯೋಜನೆಗಳನ್ನು ಹುಡುಕಿ...', askHorizon: 'ಹೊರೈಜನ್ ಕೇಳಿ', eligible: 'ನಾನು ಅರ್ಹನೇ?', stateSchemes: 'ರಾಜ್ಯ ಯೋಜನೆಗಳು', benefit: 'ಮುಖ್ಯ ಲಾಭ', docs: 'ಅಗತ್ಯ ದಾಖಲೆಗಳು', steps: 'ಅರ್ಜಿ ಹೇಗೆ', timeline: 'ಸಮಯ', tip: 'ಪ್ರೊ ಟಿಪ್', checkEligibility: 'ಪರಿಶೀಲಿಸಿ', land: 'ಭೂಮಿ (ಎಕರೆ)', income: 'ಆದಾಯ (₹/ವ)', category: 'ವರ್ಗ', for: 'ಯಾರಿಗೆ' },
        ml: { newBanner: 'പുതിയ പദ്ധതികൾ ഈ മാസം ചേർത്തു', search: 'പദ്ധതികൾ തിരയൂ...', askHorizon: 'ഹൊറൈസണോട് ചോദിക്കൂ', eligible: 'ഞാൻ യോഗ്യനാണോ?', stateSchemes: 'സംസ്ഥാന പദ്ധതികൾ', benefit: 'പ്രധാന ആനുകൂല്യം', docs: 'ആവശ്യമായ രേഖകൾ', steps: 'എങ്ങനെ അപേക്ഷിക്കാം', timeline: 'സമയപരിധി', tip: 'പ്രോ ടിപ്', checkEligibility: 'പരിശോധിക്കൂ', land: 'ഭൂമി (ഏക്കർ)', income: 'വരുമാനം (₹/വ)', category: 'വിഭാഗം', for: 'ആർക്ക്' },
        bn: { newBanner: 'নতুন প্রকল্প এই মাসে যোগ হয়েছে', search: 'প্রকল্প খুঁজুন...', askHorizon: 'হরাইজনকে জিজ্ঞাসা করুন', eligible: 'আমি কি যোগ্য?', stateSchemes: 'রাজ্য প্রকল্প', benefit: 'মূল সুবিধা', docs: 'প্রয়োজনীয় নথি', steps: 'কীভাবে আবেদন করবেন', timeline: 'সময়সীমা', tip: 'প্রো টিপ', checkEligibility: 'যাচাই', land: 'জমি (একর)', income: 'আয় (₹/বছর)', category: 'শ্রেণী', for: 'কাদের জন্য' },
        mr: { newBanner: 'नवीन योजना या महिन्यात जोडल्या', search: 'योजना शोधा...', askHorizon: 'होरायझनला विचारा', eligible: 'मी पात्र आहे का?', stateSchemes: 'राज्य योजना', benefit: 'मुख्य लाभ', docs: 'आवश्यक कागदपत्रे', steps: 'अर्ज कसा करावा', timeline: 'कालावधी', tip: 'प्रो टिप', checkEligibility: 'तपासा', land: 'जमीन (एकर)', income: 'उत्पन्न (₹/वर्ष)', category: 'वर्ग', for: 'कोणासाठी' }
    };

const MobileMarketDashboard = memo(({ onBack, currentLanguage, labels, initialView }: MarketDashboardProps) => {
    const [view, setView] = useState<View>(initialView || 'menu');

    useEffect(() => {
        if (initialView) {
            setView(initialView);
        }
    }, [initialView]);
    const [searchInput, setSearchInput] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedVehicleIndex, setSelectedVehicleIndex] = useState<number | null>(null);

    // Data State

    // Marketing stories are dynamic
    const [stories, setStories] = useState<Story[]>([]);



    // Audio State
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [playingText, setPlayingText] = useState<string | null>(null);

    const stopAudio = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current = null;
        }
        setPlayingText(null);
    }, []);

    const playTTS = useCallback(async (text: string) => {
        if (playingText === text) {
            stopAudio();
            return;
        }
        stopAudio();
        setPlayingText(text);

        try {
            const response = await fetch('/api/assistant/voice/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, language: currentLanguage })
            });
            if (!response.ok) throw new Error('TTS failed');
            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            audioRef.current = audio;
            audio.onended = () => { setPlayingText(null); URL.revokeObjectURL(audioUrl); };
            audio.onerror = () => { setPlayingText(null); URL.revokeObjectURL(audioUrl); };
            audio.play();
        } catch (e) {
            console.error("TTS Error", e);
            setPlayingText(null);
        }
    }, [currentLanguage, playingText, stopAudio]);

    const fetchGeneric = useCallback(async (type: string, topic: string) => {
        setIsLoading(true);
        try {
            const prompt = `Generate 5 ${type} success stories for Indian agriculture in a JSON array. Each item must include name, location, content, and image_prompt. Topic: ${topic}. Return only valid JSON.`;
            const result = await assistantApi.chat(prompt, currentLanguage, [], 'marketing');
            const responseText = result?.response;
            if (!responseText) {
                return null;
            }

            try {
                const parsed = JSON.parse(responseText);
                if (Array.isArray(parsed)) {
                    return parsed;
                }
            } catch (parseError) {
                const match = responseText.match(/\[.*\]/s);
                if (match) {
                    try {
                        const parsed = JSON.parse(match[0]);
                        if (Array.isArray(parsed)) {
                            return parsed;
                        }
                    } catch {
                        // ignore parse failure
                    }
                }
            }

            return [{
                name: topic,
                location: 'India',
                content: responseText,
                image_prompt: topic
            }];
        } catch (e) {
            console.error(`Failed to fetch ${type}`, e);
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [currentLanguage]);

    // Load initial marketing stories
    useEffect(() => {
        if (view === 'marketing' && stories.length === 0) {
            fetchGeneric('marketing', 'Sustainable Farming').then(data => {
                if (data && Array.isArray(data)) setStories(data);
            });
        }
    }, [view]);


    const handleSearchMarketing = useCallback((term: string) => {
        if (!term.trim()) return;
        setStories([]);
        fetchGeneric('marketing', term).then(data => {
            if (data && Array.isArray(data)) setStories(data);
        });
    }, [fetchGeneric]);

    // Debounce search input for marketing lookup (400ms)
    useEffect(() => {
        const handler = setTimeout(() => {
            setSearchTerm(searchInput);
        }, 400);
        return () => clearTimeout(handler);
    }, [searchInput]);

    useEffect(() => {
        if (searchTerm.trim()) {
            handleSearchMarketing(searchTerm);
        }
    }, [searchTerm]);

    const renderMenu = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in pb-8">
            <div onClick={() => setView('rates')} className="glass-panel w-full p-6 rounded-3xl cursor-pointer hover:bg-white/10 transition-all border-emerald-500/20 group">
                <TrendingUp className="w-10 h-10 text-emerald-400 mb-4 group-hover:scale-110 transition-transform" />
                <h3 className="text-xl font-bold mb-2">{labels.rates}</h3>
                <p className="text-gray-400 text-sm">{labels.ratesDesc || "Check daily market prices for crops in your mandi."}</p>
            </div>



            <div onClick={() => setView('schemes')} className="glass-panel w-full p-6 rounded-3xl cursor-pointer hover:bg-white/10 transition-all border-amber-500/20 group">
                <Landmark className="w-10 h-10 text-amber-400 mb-4 group-hover:scale-110 transition-transform" />
                <h3 className="text-xl font-bold mb-2">{labels.schemes}</h3>
                <p className="text-gray-400 text-sm">{labels.schemesDesc || "Central and State schemes for subsidies and loans."}</p>
            </div>

            <div onClick={() => setView('marketing')} className="glass-panel w-full p-6 rounded-3xl cursor-pointer hover:bg-white/10 transition-all border-pink-500/20 group">
                <BarChart3 className="w-10 h-10 text-pink-400 mb-4 group-hover:scale-110 transition-transform" />
                <h3 className="text-xl font-bold mb-2">{labels.marketing}</h3>
                <p className="text-gray-400 text-sm">{labels.marketingDesc || "Success stories, bloggers, and selling strategies."}</p>
            </div>

            <div onClick={() => setView('forecasting')} className="glass-panel w-full p-6 rounded-3xl cursor-pointer hover:bg-white/10 transition-all border-purple-500/20 group">
                <BookOpen className="w-10 h-10 text-purple-400 mb-4 group-hover:scale-110 transition-transform" />
                <h3 className="text-xl font-bold mb-2">{labels.forecasting || "Forecasting"}</h3>
                <p className="text-gray-400 text-sm">{labels.forecastingDesc || "7-day AI predictions for crop market prices."}</p>
            </div>
        </div>
    );

    const renderSearchBar = (placeholder: string, onSearch: (val: string) => void) => (
        <div className="flex gap-4 mb-6">
            <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                    type="text"
                    placeholder={placeholder}
                    className="w-full bg-black/20 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                            setSearchTerm(searchInput);
                            onSearch(searchInput);
                        }
                    }}
                />
            </div>
            <button
                onClick={() => {
                    setSearchTerm(searchInput);
                    onSearch(searchInput);
                }}
                disabled={isLoading}
                className="px-8 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-2xl transition-colors flex items-center gap-2"
            >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Search"}
            </button>
        </div>
    );
    const staticVehicles = vehicleTranslations[currentLanguage] || vehicleTranslations['en'];
    const vLabels = vehicleLabels[currentLanguage] || vehicleLabels['en'];

    // ========== GOVERNMENT SCHEMES — AI-Powered Dynamic Engine ==========
    // DSA: O(1) Keyed Hash-Map for instant translation lookups by scheme id + language
    // Scheme Categories
    const schemeCategories = ['All', 'Income Support', 'Insurance', 'Credit', 'Market Access', 'Irrigation', 'Infrastructure', 'Organic Farming', 'Mechanisation'];
    const [activeCategory, setActiveCategory] = useState('All');
    const [expandedSchemeId, setExpandedSchemeId] = useState<string | null>(null);
    const [schemeSearchInput, setSchemeSearchInput] = useState('');
    const [schemeSearchTerm, setSchemeSearchTerm] = useState('');

    // Debounce schemes fuzzy filter (300ms) to avoid CPU-bound Levenshtein calculations on typing
    useEffect(() => {
        const handler = setTimeout(() => {
            setSchemeSearchTerm(schemeSearchInput);
        }, 300);
        return () => clearTimeout(handler);
    }, [schemeSearchInput]);

    // State Schemes (AI-generated)
    const [stateSchemes, setStateSchemes] = useState<any[]>([]);
    const [stateLoading, setStateLoading] = useState(false);

    // AI Explainer State
    const [explainerData, setExplainerData] = useState<{ [key: string]: any }>({});
    const [explainerLoading, setExplainerLoading] = useState<string | null>(null);

    // Eligibility Checker State
    const [eligibilitySchemeId, setEligibilitySchemeId] = useState<string | null>(null);
    const [eligibilityForm, setEligibilityForm] = useState({ landSize: '', category: 'General', income: '' });
    const [eligibilityResult, setEligibilityResult] = useState<{ [key: string]: any }>({});
    const [eligibilityLoading, setEligibilityLoading] = useState(false);
    const schemeIds = Object.keys(centralSchemes);

    // Count new schemes this month
    const newSchemesThisMonth = useMemo(() => {
        return schemeIds.filter(id => {
            const d = centralSchemes[id].dateAdded;
            if (!d) return false;
            const added = new Date(d);
            const now = new Date();
            return added.getMonth() === now.getMonth() && added.getFullYear() === now.getFullYear();
        }).length;
    }, []);

    // Fetch state-specific schemes when schemes tab opens
    useEffect(() => {
        if (view === 'schemes' && stateSchemes.length === 0 && !stateLoading) {
            // Try to get user state from localStorage or default to empty
            const savedProfile = localStorage.getItem('userProfile');
            let userState = '';
            if (savedProfile) {
                try { userState = JSON.parse(savedProfile).state || ''; } catch { }
            }
            if (userState) {
                setStateLoading(true);
                fetch('/api/schemes/state', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ state: userState, language: currentLanguage })
                })
                    .then(r => r.json())
                    .then(data => {
                        if (data.schemes && Array.isArray(data.schemes)) {
                            setStateSchemes(data.schemes);
                        }
                    })
                    .catch(e => console.error('[STATE SCHEMES]', e))
                    .finally(() => setStateLoading(false));
            }
        }
    }, [view]);

    // Update document title dynamically based on active sub-view in Market Intelligence
    useEffect(() => {
        if (view === 'menu') {
            document.title = `EventHorizon AI — Market Intelligence`;
        } else {
            const viewNames: { [key: string]: string } = {
                rates: labels.rates || 'Mandi Rates',
                vehicles: labels.vehicles || 'Agriculture Vehicles',
                vehicle_details: labels.vehicles || 'Vehicle Details',
                schemes: labels.schemes || 'Govt Schemes',
                forecasting: labels.forecasting || 'Forecasting',
                marketing: labels.marketing || 'Marketing & Success'
            };
            const activeView = viewNames[view] || view;
            document.title = `EventHorizon AI — ${activeView}`;
        }
        // Dispatch location change event so hooks update active title instantly
        window.dispatchEvent(new Event('popstate'));
    }, [view, labels]);

    // AI Explainer handler
    const handleExplain = async (schemeId: string, schemeName: string, schemeDetails: string) => {
        if (explainerData[schemeId]) {
            // Toggle off if already showing
            const updated = { ...explainerData };
            delete updated[schemeId];
            setExplainerData(updated);
            return;
        }
        setExplainerLoading(schemeId);
        try {
            const res = await fetch('/api/schemes/explain', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scheme_name: schemeName, scheme_details: schemeDetails, language: currentLanguage })
            });
            const data = await res.json();
            setExplainerData(prev => ({ ...prev, [schemeId]: data }));
        } catch (e) {
            console.error('[EXPLAIN ERROR]', e);
        } finally {
            setExplainerLoading(null);
        }
    };

    // Eligibility checker handler
    const handleEligibilityCheck = async (schemeName: string) => {
        if (!eligibilityForm.landSize || !eligibilityForm.income) return;
        setEligibilityLoading(true);
        try {
            const res = await fetch('/api/schemes/eligibility', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scheme_name: schemeName,
                    land_size_acres: parseFloat(eligibilityForm.landSize),
                    social_category: eligibilityForm.category,
                    annual_income: parseFloat(eligibilityForm.income),
                    language: currentLanguage
                })
            });
            const data = await res.json();
            setEligibilityResult(prev => ({ ...prev, [schemeName]: data }));
        } catch (e) {
            console.error('[ELIGIBILITY ERROR]', e);
        } finally {
            setEligibilityLoading(false);
        }
    };    const sLabels = schemeLabels[currentLanguage] || schemeLabels['en'];

    const renderSchemes = () => {
        // Filter schemes by category and search
        const filteredIds = schemeIds.filter(id => {
            const s = centralSchemes[id];
            const catOk = activeCategory === 'All' || s.category === activeCategory;
            const name = s.name[currentLanguage] || s.name['en'];
            const details = s.details[currentLanguage] || s.details['en'];
            const searchOk = !schemeSearchTerm || fuzzyMatch(schemeSearchTerm, name + ' ' + details + ' ' + s.category);
            return catOk && searchOk;
        });

        return (
            <div className="flex flex-col w-full h-full animate-fade-in">
                {/* AI Banner */}
                <div className="flex items-center gap-3 px-4 py-3 mb-4 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-2xl backdrop-blur-sm">
                    <span className="text-xl">✨</span>
                    <span className="text-sm text-emerald-300">AI-powered — schemes update dynamically. Ask Horizon about any scheme for detailed guidance.</span>
                </div>

                {/* New Schemes Notification Banner */}
                {newSchemesThisMonth > 0 && (
                    <div className="flex items-center gap-3 px-4 py-3 mb-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl animate-pulse">
                        <span className="text-lg">🔔</span>
                        <span className="text-sm text-amber-300 font-medium">{newSchemesThisMonth} {sLabels.newBanner}</span>
                    </div>
                )}

                {/* Search Bar with Fuzzy Search */}
                <div className="relative mb-4">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                        type="text"
                        placeholder={sLabels.search}
                        className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white text-sm focus:outline-none focus:border-emerald-500/50 transition-colors"
                        value={schemeSearchInput}
                        onChange={(e) => setSchemeSearchInput(e.target.value)}
                    />
                </div>

                {/* Category Filter Tags */}
                <div className="flex gap-2 flex-wrap mb-4">
                    {schemeCategories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${activeCategory === cat
                                ? 'bg-emerald-600 text-white border border-emerald-500'
                                : 'bg-white/5 text-gray-400 border border-white/10 hover:border-white/30 hover:text-white'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {/* Schemes Grid — full screen scroll */}
                <div className="w-full">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-8">
                    {filteredIds.map(id => {
                        const s = centralSchemes[id];
                        const name = s.name[currentLanguage] || s.name['en'];
                        const details = s.details[currentLanguage] || s.details['en'];
                        const elig = s.eligibility[currentLanguage] || s.eligibility['en'];
                        const benefit = s.benefit[currentLanguage] || s.benefit['en'];
                        const isExpanded = expandedSchemeId === id;
                        const isNew = (() => { const d = new Date(s.dateAdded); const n = new Date(); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear(); })();
                        const explainer = explainerData[id];
                        const isExplaining = explainerLoading === id;

                        return (
                            <div key={id} onClick={() => setExpandedSchemeId(isExpanded ? null : id)} className={`glass-panel p-5 rounded-2xl transition-all duration-300 cursor-pointer border ${isExpanded ? `${s.borderColor} bg-gradient-to-br ${s.color}` : 'border-white/5 hover:border-white/15 hover:bg-white/5'}`}>
                                {/* Card Header */}
                                <div className="flex items-start gap-3 mb-3">
                                    <div className={`w-10 h-10 rounded-xl ${s.iconBg} flex items-center justify-center text-lg flex-shrink-0`}>
                                        {s.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className={`font-bold text-sm ${s.iconText} truncate`}>{name}</h3>
                                            {isNew && <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] font-bold rounded-full whitespace-nowrap flex items-center gap-1">✨ New</span>}
                                        </div>
                                        <span className="text-xs text-gray-500">{s.category}</span>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); playTTS(`${name}. ${details}`); }} className="p-1.5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors flex-shrink-0">
                                        {playingText && playingText.startsWith(name) ? <StopCircle className="w-4 h-4 animate-pulse text-red-400" /> : <Volume2 className="w-4 h-4" />}
                                    </button>
                                </div>

                                {/* Eligibility Badge */}
                                <div className="mb-2">
                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/10 text-blue-400 text-[11px] rounded-full border border-blue-500/20">
                                        <User className="w-3 h-3" /> {elig.length > 40 ? elig.slice(0, 40) + '…' : elig}
                                    </span>
                                </div>

                                {/* Description */}
                                <p className="text-gray-400 text-xs leading-relaxed mb-3">{details}</p>

                                {/* Expanded Details */}
                                {isExpanded && (
                                    <div className="border-t border-white/10 pt-3 mt-1 space-y-3 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                                        {/* Key Benefit */}
                                        <div className="flex gap-2 text-xs">
                                            <span className="text-gray-500 min-w-[80px]">{sLabels.benefit}</span>
                                            <span className="text-emerald-400 font-medium">{benefit}</span>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex gap-2 flex-wrap">
                                            <a href={s.applyLink} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                                                className="flex-1 min-w-[100px] py-2 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/30 rounded-lg text-center text-xs font-medium transition-colors flex items-center justify-center gap-1.5">
                                                <ExternalLink className="w-3 h-3" /> {labels.apply}
                                            </a>
                                            <button onClick={(e) => { e.stopPropagation(); window.open(s.ytLink, '_blank'); }}
                                                className="flex-1 min-w-[100px] py-2 bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-500/30 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5">
                                                <Youtube className="w-3 h-3" /> {labels.watch}
                                            </button>
                                        </div>
                                        <div className="flex gap-2 flex-wrap">
                                            <button onClick={(e) => { e.stopPropagation(); handleExplain(id, name, details); }}
                                                className={`flex-1 min-w-[100px] py-2 ${isExplaining ? 'bg-purple-600/30' : 'bg-purple-600/20'} text-purple-400 hover:bg-purple-600/30 border border-purple-500/30 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5`}>
                                                {isExplaining ? <Loader2 className="w-3 h-3 animate-spin" /> : <BookOpen className="w-3 h-3" />} {sLabels.askHorizon}
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); setEligibilitySchemeId(eligibilitySchemeId === id ? null : id); }}
                                                className="flex-1 min-w-[100px] py-2 bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600/30 border border-cyan-500/30 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5">
                                                <User className="w-3 h-3" /> {sLabels.eligible}
                                            </button>
                                        </div>

                                        {/* AI Explainer Card */}
                                        {explainer && (
                                            <div className="bg-black/30 rounded-xl p-4 border border-purple-500/20 space-y-3 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center gap-2 text-purple-400 text-xs font-bold mb-2">
                                                    <BookOpen className="w-4 h-4" /> AI Explainer
                                                </div>
                                                <div><span className="text-gray-500 text-[11px]">{sLabels.for}:</span><p className="text-gray-300 text-xs">{explainer.target_audience}</p></div>
                                                <div><span className="text-gray-500 text-[11px]">{sLabels.docs}:</span>
                                                    <ul className="list-disc list-inside text-gray-300 text-xs mt-1 space-y-0.5">{(explainer.documents_needed || []).map((d: string, i: number) => <li key={i}>{d}</li>)}</ul>
                                                </div>
                                                <div><span className="text-gray-500 text-[11px]">{sLabels.steps}:</span>
                                                    <ol className="list-decimal list-inside text-gray-300 text-xs mt-1 space-y-0.5">{(explainer.steps_to_apply || []).map((st: string, i: number) => <li key={i}>{st}</li>)}</ol>
                                                </div>
                                                <div className="flex gap-4 text-xs">
                                                    <div><span className="text-gray-500">{sLabels.timeline}:</span> <span className="text-emerald-400">{explainer.expected_timeline}</span></div>
                                                </div>
                                                {explainer.pro_tip && (
                                                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 text-xs text-amber-300">💡 {sLabels.tip}: {explainer.pro_tip}</div>
                                                )}
                                            </div>
                                        )}

                                        {/* Eligibility Checker Form */}
                                        {eligibilitySchemeId === id && (
                                            <div className="bg-black/30 rounded-xl p-4 border border-cyan-500/20 space-y-3 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold mb-2"><User className="w-4 h-4" /> {sLabels.eligible}</div>
                                                <div className="grid grid-cols-3 gap-2">
                                                    <input type="number" placeholder={sLabels.land} value={eligibilityForm.landSize} onChange={(e) => setEligibilityForm(prev => ({ ...prev, landSize: e.target.value }))}
                                                        className="bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500/50" />
                                                    <select value={eligibilityForm.category} onChange={(e) => setEligibilityForm(prev => ({ ...prev, category: e.target.value }))}
                                                        className="bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500/50">
                                                        <option value="General">General</option><option value="OBC">OBC</option><option value="SC">SC</option><option value="ST">ST</option>
                                                    </select>
                                                    <input type="number" placeholder={sLabels.income} value={eligibilityForm.income} onChange={(e) => setEligibilityForm(prev => ({ ...prev, income: e.target.value }))}
                                                        className="bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500/50" />
                                                </div>
                                                <button onClick={() => handleEligibilityCheck(name)} disabled={eligibilityLoading}
                                                    className="w-full py-2 bg-cyan-600/30 text-cyan-400 hover:bg-cyan-600/40 border border-cyan-500/30 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2">
                                                    {eligibilityLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : sLabels.checkEligibility}
                                                </button>
                                                {eligibilityResult[name] && (() => {
                                                    const statusText = eligibilityResult[name].eligible 
                                                        ? (currentLanguage === 'ta' ? 'தகுதியானது' : currentLanguage === 'hi' ? 'योग्य' : 'Eligible') 
                                                        : (currentLanguage === 'ta' ? 'தகுதியற்றது' : currentLanguage === 'hi' ? 'योग्य नहीं' : 'Not Eligible');
                                                    const speechText = `${name}. ${statusText}. ${eligibilityResult[name].reason}. ${eligibilityResult[name].suggestion}`;
                                                    const isPlaying = playingText === speechText;
                                                    
                                                    return (
                                                        <div className={`p-3 rounded-lg text-xs border relative ${eligibilityResult[name].eligible ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-red-500/10 border-red-500/20 text-red-300'}`}>
                                                            <div className="flex justify-between items-start gap-2 mb-1">
                                                                <div className="font-bold">{eligibilityResult[name].eligible ? '✅ Eligible' : '❌ Not Eligible'} ({eligibilityResult[name].confidence})</div>
                                                                <button onClick={(e) => { e.stopPropagation(); playTTS(speechText); }} className="p-1 hover:bg-white/10 rounded-full text-gray-300 hover:text-white transition-colors">
                                                                    {isPlaying ? <StopCircle className="w-3.5 h-3.5 animate-pulse text-red-400" /> : <Volume2 className="w-3.5 h-3.5" />}
                                                                </button>
                                                            </div>
                                                            <p>{eligibilityResult[name].reason}</p>
                                                            <p className="mt-1 text-gray-400">{eligibilityResult[name].suggestion}</p>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Expand indicator */}
                                <div className="mt-2 text-center text-[10px] text-gray-600 flex items-center justify-center gap-1">
                                    {isExpanded ? '▲ Collapse' : '▼ Tap for details & apply'}
                                </div>
                            </div>
                        );
                    })}

                    {/* State-Specific Schemes */}
                    {stateLoading && (
                        <div className="md:col-span-2 flex items-center justify-center py-8 gap-3">
                            <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                            <span className="text-gray-500 text-sm">Loading {sLabels.stateSchemes}...</span>
                        </div>
                    )}
                    {stateSchemes.map((s: any, i: number) => (
                        <div key={`state-${i}`} className="glass-panel p-5 rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 hover:bg-white/5 transition-all">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-full">{sLabels.stateSchemes}</span>
                                {s.category && <span className="text-[10px] text-gray-500">{s.category}</span>}
                            </div>
                            <h3 className="font-bold text-sm text-emerald-400 mb-1">{s.name}</h3>
                            <p className="text-gray-400 text-xs leading-relaxed mb-2">{s.details}</p>
                            {s.eligibility && <div className="text-[11px] text-gray-500 mb-2"><span className="text-gray-600">{sLabels.for}:</span> {s.eligibility}</div>}
                            {s.benefit && <div className="text-[11px] text-emerald-400 mb-2">{sLabels.benefit}: {s.benefit}</div>}
                            {s.application_link && (
                                <a href={s.application_link} target="_blank" rel="noreferrer"
                                    className="inline-flex items-center gap-1 py-1.5 px-3 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/30 rounded-lg text-xs font-medium transition-colors">
                                    <ExternalLink className="w-3 h-3" /> {labels.apply}
                                </a>
                            )}
                        </div>
                    ))}
                </div>
                {filteredIds.length === 0 && stateSchemes.length === 0 && !stateLoading && (
                    <div className="text-center text-gray-500 py-10 text-sm">No schemes found. Try a different search or category.</div>
                )}
                </div>
            </div>
        );
    };



    const renderVehicles = () => (
        <div className="flex flex-col w-full h-full animate-fade-in">
            {/* No Search Bar for Vehicles - Static List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-8 overflow-y-auto custom-scrollbar">
                {staticVehicles.map((v, i) => (
                    <div
                        key={i}
                        onClick={() => {
                            setSelectedVehicleIndex(i);
                            setView('vehicle_details');
                        }}
                        className="glass-panel p-0 rounded-2xl flex flex-col gap-0 border-blue-500/10 hover:bg-white/5 transition-all cursor-pointer overflow-hidden group"
                    >
                        <div className="h-48 w-full overflow-hidden relative">
                            <div className="absolute inset-0 bg-blue-900/20 z-0"></div>
                            <img src={v.image_url} alt={v.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 z-10" />
                            <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-emerald-400 font-bold border border-white/10 z-20">
                                {v.price}
                            </div>
                        </div>
                        <div className="p-5 flex flex-col gap-2">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-lg text-blue-300">{v.name}</h3>
                                    <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-md">{v.type}</span>
                                </div>
                            </div>
                            <p className="text-sm text-gray-400">{v.purpose}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderVehicleDetails = () => {
        const selectedVehicle = selectedVehicleIndex !== null ? staticVehicles[selectedVehicleIndex] : null;
        return (
            <div className="flex flex-col w-full h-full animate-fade-in pb-8 overflow-y-auto custom-scrollbar">
                {selectedVehicle && (
                    <div className="max-w-4xl mx-auto w-full">
                        <div className="glass-panel p-0 rounded-3xl overflow-hidden border-blue-500/20">
                            <div className="h-64 md:h-80 w-full relative">
                                <img src={selectedVehicle.image_url} alt={selectedVehicle.name} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
                                <div className="absolute bottom-0 left-0 w-full p-8">
                                    <h2 className="text-3xl font-bold text-white mb-2">{selectedVehicle.name}</h2>
                                    <div className="flex items-center gap-4">
                                        <span className="bg-emerald-500 text-black font-bold px-4 py-1.5 rounded-full">{selectedVehicle.price}</span>
                                        <span className="bg-blue-500/30 text-blue-200 border border-blue-500/30 px-3 py-1.5 rounded-full text-sm">{selectedVehicle.type}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="p-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div>
                                        <h3 className="text-xl font-bold text-blue-300 mb-4 flex items-center gap-2">
                                            <Truck className="w-5 h-5" /> {vLabels.specs}
                                        </h3>
                                        <div className="space-y-4">
                                            {Object.entries(selectedVehicle.specs).map(([key, value]) => (
                                                <div key={key} className="flex flex-col sm:flex-row justify-between sm:items-start gap-1 sm:gap-4 border-b border-white/5 pb-2">
                                                    <span className="text-gray-400 capitalize shrink-0">{key}</span>
                                                    <span className="text-white font-medium sm:text-right break-words">{(value as string)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex flex-col justify-between">
                                        <div>
                                            <h3 className="text-xl font-bold text-blue-300 mb-4">{vLabels.desc}</h3>
                                            <p className="text-gray-300 leading-relaxed mb-6">
                                                {selectedVehicle.description}
                                            </p>
                                        </div>

                                        <a
                                            href={selectedVehicle.official_link}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="w-full py-4 px-4 h-auto min-h-[56px] bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all flex flex-wrap items-center justify-center gap-2 group text-center"
                                        >
                                            <span>{vLabels.visit}</span>
                                            <ExternalLink className="w-5 h-5 shrink-0 group-hover:translate-x-1 transition-transform" />
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };



    const renderMarketing = () => (
        <div className="flex flex-col w-full h-full animate-fade-in">
            {renderSearchBar("Search topics (e.g. Organic)...", handleSearchMarketing)}

            <div className="grid grid-cols-1 gap-6 pb-8 overflow-y-auto custom-scrollbar">
                {stories.length === 0 && !isLoading ? (
                    <div className="text-center text-gray-500 py-10">No stories found. Try searching.</div>
                ) : (
                    stories.map((s, i) => (
                        <div key={i} className="glass-panel p-6 rounded-2xl border-pink-500/10 hover:bg-white/5 transition-all flex flex-col md:flex-row gap-6">
                            <div className="w-full md:w-1/3 bg-black/20 rounded-xl h-48 flex items-center justify-center text-gray-600 border border-white/5 relative overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-4">
                                    <span className="text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity">{s.image_prompt}</span>
                                </div>
                                <User className="w-12 h-12 opacity-20" />
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h3 className="font-bold text-xl text-pink-400">{s.name}</h3>
                                        <div className="text-sm text-gray-400 flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                            {s.location}
                                        </div>
                                    </div>
                                    <button onClick={() => playTTS(s.content)} className="p-2 hover:bg-pink-500/20 rounded-full text-pink-400 transition-colors">
                                        {playingText === s.content ? <StopCircle className="w-5 h-5 animate-pulse" /> : <Volume2 className="w-5 h-5" />}
                                    </button>
                                </div>
                                <p className="text-gray-300 leading-relaxed text-sm md:text-base">{s.content}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );

    return (
        <div className="flex flex-col w-full w-full h-full px-6 md:px-10 pt-20 pb-8 animate-slide-up">
            {/* Header matching RiskDashboard premium layout */}
            <header className="flex items-center gap-4 mb-6 shrink-0 z-10">
                <button 
                    onClick={() => {
                        if (view === 'vehicle_details') {
                            setView('vehicles');
                        } else if (view === 'menu') {
                            onBack();
                        } else {
                            setView('menu');
                        }
                    }} 
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-gray-400 hover:text-white"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent">
                        {view === 'menu' ? (
                            <>{labels.marketHeader.split(' ')[0]} <span className="text-emerald-400">{labels.marketHeader.split(' ').slice(1).join(' ')}</span></>
                        ) : (
                            <span className="capitalize">{labels[view] || view.replace('-', ' ')}</span>
                        )}
                    </h2>
                </div>
            </header>

            <div className={`flex-1 w-full ${view === 'schemes' ? 'overflow-y-auto custom-scrollbar pr-1 pb-8' : 'overflow-hidden'}`}>
                {view === 'menu' && <div className="w-full h-full overflow-y-auto custom-scrollbar">{renderMenu()}</div>}
                {view === 'rates' && <MandiInterface currentLanguage={currentLanguage} />}


                {view === 'vehicles' && renderVehicles()}
                {view === 'vehicle_details' && renderVehicleDetails()}
                {view === 'schemes' && renderSchemes()}
                {view === 'forecasting' && (
                    <div className="flex flex-col w-full h-full animate-fade-in md:p-6 overflow-y-auto custom-scrollbar min-w-0">
                        <ForecastingInterface currentLanguage={currentLanguage} labels={labels} />
                    </div>
                )}
                {view === 'marketing' && renderMarketing()}
            </div>
        </div>
    );
});

export default MobileMarketDashboard;
