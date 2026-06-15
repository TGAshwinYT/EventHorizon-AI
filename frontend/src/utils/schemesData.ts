// Shared Government Schemes Data Module for EventHorizon AI Dashboard

export interface SchemeInfo {
    id: string;
    icon: string;
    color: string;
    borderColor: string;
    iconBg: string;
    iconText: string;
    category: string;
    benefit: { [lang: string]: string };
    applyLink: string;
    ytLink: string;
    dateAdded: string;
    name: { [lang: string]: string };
    details: { [lang: string]: string };
    eligibility: { [lang: string]: string };
}

export const centralSchemes: { [id: string]: SchemeInfo } = {
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
        eligibility: { en: 'Small & Marginal Farmers', ta: 'சிறு மற்றும் குறு விவசாயிகள்', hi: 'छोटे और सीमांत किसान', te: 'చిన్న & సన్నకారు రైతులు', kn: 'ಸಣ್ಣ ಮತ್ತು ಅತಿ ಸಣ್ಣ ರೈತರು', ml: 'ചെറുകിട কർഷകർ', bn: 'ক্ষুদ্র ও প্রান্তিক কৃষক', mr: 'अल्पभूधारक शेतकरी' }
    },
    'pmfby': {
        id: 'pmfby',
        icon: '🛡️',
        color: 'from-blue-500/20 to-blue-600/10',
        borderColor: 'border-blue-500/30',
        iconBg: 'bg-blue-500/20',
        iconText: 'text-blue-400',
        category: 'Insurance',
        benefit: { en: 'Full crop loss coverage', ta: 'முழு பயிர் இழப்பு காப்பீடு', hi: 'पूर्ण फसल हानि कवरेज', te: 'పూర్తి పంట నష్ట కవరేజ్', kn: 'ಪ್ರಸಕ್ತ ಸಾಲಿನ ಬೆಳೆ ನಷ್ಟ ಕವರೇಜ್', ml: 'പൂർണ വിള നഷ്ട പരിരക്ഷ', bn: 'সম্পূর্ণ ফসল ক্ষতি কভারেজ', mr: 'पूर्ण पीक नुकसान संरक्षण' },
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
        name: { en: 'Kisan Credit Card (KCC)', ta: 'கிசான் கிரெடிட் கார்டு', hi: 'किसान क्रेडिट कार्ड', te: 'కిసాన్ క్రెడిట్ కార్డ్', kn: 'கಿಸான் கிரெடிட் கார்டு', ml: 'കിസാൻ ക്രെഡിറ്റ് കാർഡ്', bn: 'কিসান ক্রেডিট কার্ড', mr: 'किसान क्रेडिट कार्ड' },
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
        eligibility: { en: 'Traders & Farmers', ta: 'வியாபாரிகள் மற்றும் விவசாயிகள்', hi: 'व्यापारी और किसान', te: 'வ్యాపారులు & రైతులు', kn: 'ವ್ಯಾಪಾರಿಗಳು ಮತ್ತು ರೈತರು', ml: 'കർഷകർ', bn: 'ব্যবসায়ী ও কৃষক', mr: 'व्यापारी आणि शेतकरी' }
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
        details: { en: 'Fund for cold storage, warehouses, pack houses, sorting units with 3% interest subvention.', ta: 'குளிர்பதன கிடங்கு, கோடவ்ண்டகள் நிறுவ 3% வட்டி மானியத்துடன் நிதி.', hi: 'कोल्ड स्टोरेज, वेयरहाउस बनाने के लिए 3% ब्याज सब्वेंशन के साथ फंड।', te: 'కోల్ड స్టోరేజ్, వేర్‌హౌస్ నిర్మాణానికి 3% వడ్డీ రాయితీతో నిధి.', kn: 'ಶೀತಲ ಗೃಹ, ಗೋದಾಮು ನಿರ್ಮಾಣಕ್ಕೆ 3% ಬಡ್ಡಿ ಸಬ್ವೆನ್ಷನ್‌ ನಿಧಿ.', ml: 'ശീതകക്ഷ, ഗോഡൗൺ നിർമ്മാണത്തിന് 3% പലിശ ആനുകൂല്യം.', bn: 'কোল্ড স্টোরেজ, গুদাম নির্মাণে 3% সুদ ভর্তুকি তহবিল।', mr: 'शीतगृह, गोदाम उभारणीसाठी 3% व्याज सवलत निधी.' },
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
        name: { en: 'Sub-Mission on Agri Mechanisation', ta: 'வேளாண் இயந்திரமயமாக்கல் துணை திட்டம்', hi: 'कृषि यंत्रीकरण पर उप-मिशन', te: 'వ్యவసాయ యాంత्रीకరణ ఉప-మిషన్', kn: 'ಕೃಷಿ ಯಾಂತ್ರೀಕರಣ ಉಪ-ಮಿಷನ್', ml: 'കൃഷി യന്ത്രവൽക്കരണ ഉപ-മിഷൻ', bn: 'कृষি যন্ত্রায়ন উপ-মিশন', mr: 'शेती यांत्रिकीकरण उप-अभियान' },
        details: { en: '40-50% subsidy on farm machinery — tractors, harvesters, seed drills. Higher subsidy for SC/ST farmers.', ta: 'ட்ராக்டர், அறுவடை இயந்திரங்களுக்கு 40-50% மானியம். SC/ST விவசாயிகளுக்கு அதிக மானியம்.', hi: 'ट्रैक्टर, हार्वेस्टर पर 40-50% सब्सिडी। SC/ST किसानों को अधिक।', te: 'ట్రాక్టర్లు, హార్వెస్టర్లకు 40-50% సబ్సిడీ. SC/ST రైతులకు అధికం.', kn: 'ಟ್ರ್ಯಾಕ್ಟರ್, ಹಾರ್ವೆಸ್ಟರ್‌ಗಳಿಗೆ 40-50% ಸಹಾಯಧನ. SC/ST ರೈತರಿಗೆ ಹೆಚ್ಚು.', ml: 'ട്രാക്ടർ, ഹാർവെസ്റ്ററുകൾക്ക് 40-50% സബ്സിഡി. SC/ST കർഷകർക്ക് കൂടുതൽ.', bn: 'ট্যাক্টর, হার্ভেস্টারে 40-50% ভর্তুকি। SC/ST কৃষকদের বেশি।', mr: 'ट्रॅक्टर, हार्वेस्टरवर 40-50% अनुदान. SC/ST शेतकऱ्यांना जास्त.' },
        eligibility: { en: 'Individual farmers; SC/ST, small & marginal preferred', ta: 'விவசாயிகள்; SC/ST முன்னுரிமை', hi: 'किसान; SC/ST प्राथमिकता', te: 'రైతులు; SC/ST ప్రాధాన్యత', kn: 'ರೈತುಲು; SC/ST ಆದ್ಯತೆ', ml: 'കർഷകർ; SC/ST മുൻഗണന', bn: 'কৃষক; SC/ST অগ্রাধিকার', mr: 'शेतकरी; SC/ST प्राधान्य' }
    }
};

export const schemeLabels: { [key: string]: any } = {
    en: { newBanner: 'new schemes added this month', search: 'Search schemes...', askHorizon: 'Ask Horizon', eligible: 'Am I Eligible?', stateSchemes: 'State Schemes', benefit: 'Key Benefit', docs: 'Documents Needed', steps: 'How to Apply', timeline: 'Timeline', tip: 'Pro Tip', checkEligibility: 'Check', land: 'Land (acres)', income: 'Income (₹/yr)', category: 'Category', for: 'For' },
    ta: { newBanner: 'புதிய திட்டங்கள் இந்த மாதம் சேர்க்கப்பட்டன', search: 'திட்டங்களை தேடு...', askHorizon: 'ஹொரிசனிடம் கேள்', eligible: 'நான் தகுதியா?', stateSchemes: 'மாநில திட்டங்கள்', benefit: 'முக்கிய பலன்', docs: 'தேவையான ஆவணங்கள்', steps: 'எப்படி விண்ணப்பிக்கலாம்', timeline: 'காலக்கெடு', tip: 'ப்ரோ டிப்', checkEligibility: 'சரிபார்', land: 'நிலம் (ஏக்கர்)', income: 'வருமானம் (₹/ஆ)', category: 'பிரிவு', for: 'யாருக்கு' },
    hi: { newBanner: 'नई योजनाएं इस महीने जोड़ी गईं', search: 'योजना खोजें...', askHorizon: 'होराइज़न से पूछें', eligible: 'क्या मैं योग्य हूं?', stateSchemes: 'राज्य योजनाएं', benefit: 'मुख्य लाभ', docs: 'आवश्यक दस्तावेज', steps: 'आवेदन कैसे करें', timeline: 'समयसीमा', tip: 'प्रो टिप', checkEligibility: 'जांचें', land: 'जमीन (एकड़)', income: 'आय (₹/वर्ष)', category: 'श्रेणी', for: 'किसके लिए' },
    te: { newBanner: 'కొత్త పథకాలు ఈ నెల చేర్చబడ్డాయి', search: 'పథకాలు వెతకండి...', askHorizon: 'హొరైజన్‌ని అడగండి', eligible: 'నేను అర్హుడినా?', stateSchemes: 'రాష్ట్ర పథకాలు', benefit: 'ముఖ్య ప్రయోజనం', docs: 'అవసరమైన పత్రాలు', steps: 'エలా దరఖాస్తు చేయాలి', timeline: 'సమయం', tip: 'ప్రో టిప్', checkEligibility: 'తనిఖీ', land: 'భూమి (ఎకరాలు)', income: 'ఆదాయం (₹/సం)', category: 'వర్గం', for: 'ఎవరికి' },
    kn: { newBanner: 'ಹೊಸ ಯೋಜನೆಗಳು ಈ ತಿಂಗಳು ಸೇರಿಸಲಾಗಿದೆ', search: 'ಯೋಜನೆಗಳನ್ನು ಹುಡುಕಿ...', askHorizon: 'ಹೊರೈಜನ್ ಕೇಳಿ', eligible: 'ನಾನು ಅರ್ಹನೇ?', stateSchemes: 'ರಾಜ್ಯ ಯೋಜನೆಗಳು', benefit: 'ಮುಖ್ಯ ಲಾಭ', docs: 'ಅಗತ್ಯ ದಾಖಲೆಗಳು', steps: 'ಅರ್ಜಿ ಹೇಗೆ', timeline: 'ಸಮಯ', tip: 'ಪ್ರೊ ಟಿಪ್', checkEligibility: 'ಪರಿಶೀಲಿಸಿ', land: 'ಭೂಮಿ (ಎಕರೆ)', income: 'ಆದಾಯ (₹/ವ)', category: 'ವರ್ಗ', for: 'ಯಾರಿಗೆ' },
    ml: { newBanner: 'പുതിയ പദ്ധതികൾ ഈ മാസം ചേർത്തു', search: 'പദ്ധതികൾ തിരയൂ...', askHorizon: 'ഹൊറൈസണോട് ചോദിക്കൂ', eligible: 'ഞാൻ യോഗ്യനാണോ?', stateSchemes: 'സംസ്ഥാന പദ്ധതികൾ', benefit: 'പ്രധാന ആനുകൂല്യം', docs: 'ആവശ്യമായ രേഖകൾ', steps: 'എങ്ങനെ അപേക്ഷിക്കാം', timeline: 'സമയപരിധി', tip: 'പ്രോ ടിപ്', checkEligibility: 'പരിശോധിക്കൂ', land: 'ഭൂമി (ഏക്കർ)', income: 'വരുമാനം (₹/വ)', category: 'വിഭാഗം', for: 'ആർക്ക്' },
    bn: { newBanner: 'নতুন প্রকল্প এই মাসে যোগ হয়েছে', search: 'প্রকল্প খুঁজুন...', askHorizon: 'হরাইজনকে জিজ্ঞাসা করুন', eligible: 'আমি কি যোগ্য?', stateSchemes: 'রাজ্য প্রকল্প', benefit: 'মূল সুবিধা', docs: 'প্রয়োজনীয় নথি', steps: 'কীভাবে আবেদন করবেন', timeline: 'সময়সীমা', tip: 'প্রো টিপ', checkEligibility: 'যাচাই', land: 'জমি (একর)', income: 'আয় (₹/বছর)', category: 'শ্রেণী', for: 'কাদের জন্য' },
    mr: { newBanner: 'नवीन योजना या महिन्यात जोडल्या', search: 'योजना शोधा...', askHorizon: 'होरायझनला विचारा', eligible: 'मी पात्र आहे का?', stateSchemes: 'राज्य योजना', benefit: 'मुख्य लाभ', docs: 'आवश्यक कागदप्रे', steps: 'अर्ज कसा करावा', timeline: 'कालावधी', tip: 'प्रो टिप', checkEligibility: 'तपासा', land: 'जमीन (एकर)', income: 'उत्पन्न (₹/वर्ष)', category: 'वर्ग', for: 'कोणासाठी' }
};
