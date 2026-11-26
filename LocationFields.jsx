// LocationFields.jsx : State -> District -> College dropdowns for CampusKart registration.
// Put this file in src/ and import it in App.jsx.
import React from "react";

const L = (s) => s.split(", ");

export const STATES = {
  "Andhra Pradesh": L("Alluri Sitharama Raju, Anakapalli, Anantapur, Annamayya, Bapatla, Chittoor, Dr. B.R. Ambedkar Konaseema, East Godavari, Eluru, Guntur, Kakinada, Krishna, Kurnool, Nandyal, NTR, Palnadu, Parvathipuram Manyam, Prakasam, Sri Sathya Sai, Srikakulam, Tirupati, Visakhapatnam, Vizianagaram, West Godavari, YSR Kadapa"),
  "Arunachal Pradesh": L("Anjaw, Changlang, Dibang Valley, East Kameng, East Siang, Kamle, Kra Daadi, Kurung Kumey, Lepa Rada, Lohit, Longding, Lower Dibang Valley, Lower Siang, Lower Subansiri, Namsai, Pakke-Kessang, Papum Pare, Shi Yomi, Siang, Tawang, Tirap, Upper Siang, Upper Subansiri, West Kameng, West Siang"),
  "Assam": L("Bajali, Baksa, Barpeta, Biswanath, Bongaigaon, Cachar, Charaideo, Chirang, Darrang, Dhemaji, Dhubri, Dibrugarh, Dima Hasao, Goalpara, Golaghat, Hailakandi, Hojai, Jorhat, Kamrup, Kamrup Metropolitan, Karbi Anglong, Karimganj, Kokrajhar, Lakhimpur, Majuli, Morigaon, Nagaon, Nalbari, Sivasagar, Sonitpur, South Salmara-Mankachar, Tamulpur, Tinsukia, Udalguri, West Karbi Anglong"),
  "Bihar": L("Araria, Arwal, Aurangabad, Banka, Begusarai, Bhagalpur, Bhojpur, Buxar, Darbhanga, East Champaran, Gaya, Gopalganj, Jamui, Jehanabad, Kaimur, Katihar, Khagaria, Kishanganj, Lakhisarai, Madhepura, Madhubani, Munger, Muzaffarpur, Nalanda, Nawada, Patna, Purnia, Rohtas, Saharsa, Samastipur, Saran, Sheikhpura, Sheohar, Sitamarhi, Siwan, Supaul, Vaishali, West Champaran"),
  "Chhattisgarh": L("Balod, Baloda Bazar, Balrampur, Bastar, Bemetara, Bijapur, Bilaspur, Dantewada, Dhamtari, Durg, Gariaband, Gaurela-Pendra-Marwahi, Janjgir-Champa, Jashpur, Kabirdham, Kanker, Khairagarh-Chhuikhadan-Gandai, Kondagaon, Korba, Koriya, Mahasamund, Manendragarh-Chirmiri-Bharatpur, Mohla-Manpur-Ambagarh Chowki, Mungeli, Narayanpur, Raigarh, Raipur, Rajnandgaon, Sakti, Sarangarh-Bilaigarh, Sukma, Surajpur, Surguja"),
  "Goa": L("North Goa, South Goa"),
  "Gujarat": L("Ahmedabad, Amreli, Anand, Aravalli, Banaskantha, Bharuch, Bhavnagar, Botad, Chhota Udaipur, Dahod, Dang, Devbhoomi Dwarka, Gandhinagar, Gir Somnath, Jamnagar, Junagadh, Kheda, Kutch, Mahisagar, Mehsana, Morbi, Narmada, Navsari, Panchmahal, Patan, Porbandar, Rajkot, Sabarkantha, Surat, Surendranagar, Tapi, Vadodara, Valsad, Vav-Tharad"),
  "Haryana": L("Ambala, Bhiwani, Charkhi Dadri, Faridabad, Fatehabad, Gurugram, Hisar, Jhajjar, Jind, Kaithal, Karnal, Kurukshetra, Mahendragarh, Nuh, Palwal, Panchkula, Panipat, Rewari, Rohtak, Sirsa, Sonipat, Yamunanagar"),
  "Himachal Pradesh": L("Bilaspur, Chamba, Hamirpur, Kangra, Kinnaur, Kullu, Lahaul and Spiti, Mandi, Shimla, Sirmaur, Solan, Una"),
  "Jharkhand": L("Bokaro, Chatra, Deoghar, Dhanbad, Dumka, East Singhbhum, Garhwa, Giridih, Godda, Gumla, Hazaribagh, Jamtara, Khunti, Koderma, Latehar, Lohardaga, Pakur, Palamu, Ramgarh, Ranchi, Sahibganj, Seraikela-Kharsawan, Simdega, West Singhbhum"),
  "Karnataka": L("Bagalkot, Ballari, Belagavi, Bengaluru Rural, Bengaluru Urban, Bidar, Chamarajanagar, Chikkaballapur, Chikkamagaluru, Chitradurga, Dakshina Kannada, Davanagere, Dharwad, Gadag, Hassan, Haveri, Kalaburagi, Kodagu, Kolar, Koppal, Mandya, Mysuru, Raichur, Ramanagara, Shivamogga, Tumakuru, Udupi, Uttara Kannada, Vijayanagara, Vijayapura, Yadgir"),
  "Kerala": L("Alappuzha, Ernakulam, Idukki, Kannur, Kasaragod, Kollam, Kottayam, Kozhikode, Malappuram, Palakkad, Pathanamthitta, Thiruvananthapuram, Thrissur, Wayanad"),
  "Madhya Pradesh": L("Agar Malwa, Alirajpur, Anuppur, Ashoknagar, Balaghat, Barwani, Betul, Bhind, Bhopal, Burhanpur, Chhatarpur, Chhindwara, Damoh, Datia, Dewas, Dhar, Dindori, Guna, Gwalior, Harda, Indore, Jabalpur, Jhabua, Katni, Khandwa, Khargone, Maihar, Mandla, Mandsaur, Mauganj, Morena, Narmadapuram, Narsinghpur, Neemuch, Niwari, Pandhurna, Panna, Raisen, Rajgarh, Ratlam, Rewa, Sagar, Satna, Sehore, Seoni, Shahdol, Shajapur, Sheopur, Shivpuri, Sidhi, Singrauli, Tikamgarh, Ujjain, Umaria, Vidisha"),
  "Maharashtra": L("Ahmednagar, Akola, Amravati, Beed, Bhandara, Buldhana, Chandrapur, Chhatrapati Sambhajinagar, Dharashiv, Dhule, Gadchiroli, Gondia, Hingoli, Jalgaon, Jalna, Kolhapur, Latur, Mumbai City, Mumbai Suburban, Nagpur, Nanded, Nandurbar, Nashik, Palghar, Parbhani, Pune, Raigad, Ratnagiri, Sangli, Satara, Sindhudurg, Solapur, Thane, Wardha, Washim, Yavatmal"),
  "Manipur": L("Bishnupur, Chandel, Churachandpur, Imphal East, Imphal West, Jiribam, Kakching, Kamjong, Kangpokpi, Noney, Pherzawl, Senapati, Tamenglong, Tengnoupal, Thoubal, Ukhrul"),
  "Meghalaya": L("East Garo Hills, East Jaintia Hills, East Khasi Hills, Eastern West Khasi Hills, North Garo Hills, Ri Bhoi, South Garo Hills, South West Garo Hills, South West Khasi Hills, West Garo Hills, West Jaintia Hills, West Khasi Hills"),
  "Mizoram": L("Aizawl, Champhai, Hnahthial, Khawzawl, Kolasib, Lawngtlai, Lunglei, Mamit, Saiha, Saitual, Serchhip"),
  "Nagaland": L("Chumoukedima, Dimapur, Kiphire, Kohima, Longleng, Mokokchung, Mon, Niuland, Noklak, Peren, Phek, Shamator, Tseminyu, Tuensang, Wokha, Zunheboto"),
  "Odisha": L("Angul, Balangir, Balasore, Bargarh, Bhadrak, Boudh, Cuttack, Deogarh, Dhenkanal, Gajapati, Ganjam, Jagatsinghpur, Jajpur, Jharsuguda, Kalahandi, Kandhamal, Kendrapara, Kendujhar, Khordha, Koraput, Malkangiri, Mayurbhanj, Nabarangpur, Nayagarh, Nuapada, Puri, Rayagada, Sambalpur, Subarnapur, Sundargarh"),
  "Punjab": L("Amritsar, Barnala, Bathinda, Faridkot, Fatehgarh Sahib, Fazilka, Ferozepur, Gurdaspur, Hoshiarpur, Jalandhar, Kapurthala, Ludhiana, Malerkotla, Mansa, Moga, Pathankot, Patiala, Rupnagar, Sahibzada Ajit Singh Nagar, Sangrur, Shaheed Bhagat Singh Nagar, Sri Muktsar Sahib, Tarn Taran"),
  // Rajasthan: classic 33 districts. Newer districts created/changed since 2023 can be added here if needed.
  "Rajasthan": L("Ajmer, Alwar, Banswara, Baran, Barmer, Bharatpur, Bhilwara, Bikaner, Bundi, Chittorgarh, Churu, Dausa, Dholpur, Dungarpur, Hanumangarh, Jaipur, Jaisalmer, Jalore, Jhalawar, Jhunjhunu, Jodhpur, Karauli, Kota, Nagaur, Pali, Pratapgarh, Rajsamand, Sawai Madhopur, Sikar, Sirohi, Sri Ganganagar, Tonk, Udaipur"),
  "Sikkim": L("Gangtok, Gyalshing, Mangan, Namchi, Pakyong, Soreng"),
  "Tamil Nadu": L("Ariyalur, Chengalpattu, Chennai, Coimbatore, Cuddalore, Dharmapuri, Dindigul, Erode, Kallakurichi, Kancheepuram, Kanniyakumari, Karur, Krishnagiri, Madurai, Mayiladuthurai, Nagapattinam, Namakkal, Nilgiris, Perambalur, Pudukkottai, Ramanathapuram, Ranipet, Salem, Sivaganga, Tenkasi, Thanjavur, Theni, Thoothukudi, Tiruchirappalli, Tirunelveli, Tirupathur, Tiruppur, Tiruvallur, Tiruvannamalai, Tiruvarur, Vellore, Viluppuram, Virudhunagar"),
  "Telangana": L("Adilabad, Bhadradri Kothagudem, Hanumakonda, Hyderabad, Jagtial, Jangaon, Jayashankar Bhupalpally, Jogulamba Gadwal, Kamareddy, Karimnagar, Khammam, Kumuram Bheem Asifabad, Mahabubabad, Mahabubnagar, Mancherial, Medak, Medchal-Malkajgiri, Mulugu, Nagarkurnool, Nalgonda, Narayanpet, Nirmal, Nizamabad, Peddapalli, Rajanna Sircilla, Rangareddy, Sangareddy, Siddipet, Suryapet, Vikarabad, Wanaparthy, Warangal, Yadadri Bhuvanagiri"),
  "Tripura": L("Dhalai, Gomati, Khowai, North Tripura, Sepahijala, South Tripura, Unakoti, West Tripura"),
  "Uttar Pradesh": L("Agra, Aligarh, Ambedkar Nagar, Amethi, Amroha, Auraiya, Ayodhya, Azamgarh, Baghpat, Bahraich, Ballia, Balrampur, Banda, Barabanki, Bareilly, Basti, Bhadohi, Bijnor, Budaun, Bulandshahr, Chandauli, Chitrakoot, Deoria, Etah, Etawah, Farrukhabad, Fatehpur, Firozabad, Gautam Buddha Nagar, Ghaziabad, Ghazipur, Gonda, Gorakhpur, Hamirpur, Hapur, Hardoi, Hathras, Jalaun, Jaunpur, Jhansi, Kannauj, Kanpur Dehat, Kanpur Nagar, Kasganj, Kaushambi, Kushinagar, Lakhimpur Kheri, Lalitpur, Lucknow, Maharajganj, Mahoba, Mainpuri, Mathura, Mau, Meerut, Mirzapur, Moradabad, Muzaffarnagar, Pilibhit, Pratapgarh, Prayagraj, Raebareli, Rampur, Saharanpur, Sambhal, Sant Kabir Nagar, Shahjahanpur, Shamli, Shrawasti, Siddharthnagar, Sitapur, Sonbhadra, Sultanpur, Unnao, Varanasi"),
  "Uttarakhand": L("Almora, Bageshwar, Chamoli, Champawat, Dehradun, Haridwar, Nainital, Pauri Garhwal, Pithoragarh, Rudraprayag, Tehri Garhwal, Udham Singh Nagar, Uttarkashi"),
  "West Bengal": L("Alipurduar, Bankura, Birbhum, Cooch Behar, Dakshin Dinajpur, Darjeeling, Hooghly, Howrah, Jalpaiguri, Jhargram, Kalimpong, Kolkata, Malda, Murshidabad, Nadia, North 24 Parganas, Paschim Bardhaman, Paschim Medinipur, Purba Bardhaman, Purba Medinipur, Purulia, South 24 Parganas, Uttar Dinajpur"),
};

export const UNION_TERRITORIES = {
  "Andaman and Nicobar Islands": L("Nicobars, North and Middle Andaman, South Andaman"),
  "Chandigarh": L("Chandigarh"),
  "Dadra and Nagar Haveli and Daman and Diu": L("Dadra and Nagar Haveli, Daman, Diu"),
  "Delhi": L("Central Delhi, East Delhi, New Delhi, North Delhi, North East Delhi, North West Delhi, Shahdara, South Delhi, South East Delhi, South West Delhi, West Delhi"),
  "Jammu and Kashmir": L("Anantnag, Bandipora, Baramulla, Budgam, Doda, Ganderbal, Jammu, Kathua, Kishtwar, Kulgam, Kupwara, Poonch, Pulwama, Rajouri, Ramban, Reasi, Samba, Shopian, Srinagar, Udhampur"),
  "Ladakh": L("Kargil, Leh"),
  "Lakshadweep": L("Lakshadweep"),
  "Puducherry": L("Karaikal, Mahe, Puducherry, Yanam"),
};

const ALL = { ...STATES, ...UNION_TERRITORIES };
export const NONE = "__none__";

// value = { state, district, college, customCollege }
export const emptyLocation = { state: "", district: "", college: "", customCollege: "" };

// The college name to save in users.college
export const resolveCollege = (v) =>
  v.college === NONE ? v.customCollege.trim() : v.college;

// Use this to enable / disable the Continue button
export const isLocationComplete = (v) =>
  !!v.state && !!v.district && !!v.college && (v.college !== NONE || v.customCollege.trim().length > 0);

// colleges: array of college name strings (your existing list, WITHOUT "None of the above")
// inputStyle / labelStyle: pass the same style objects your other registration inputs use
export default function LocationFields({ value, onChange, colleges, inputStyle = {}, labelStyle = {} }) {
  const districts = value.state ? ALL[value.state] || [] : [];
  const set = (patch) => onChange({ ...value, ...patch });

  return (
    <>
      <label style={labelStyle}>State / UT *</label>
      <select
        style={inputStyle}
        value={value.state}
        onChange={(e) => set({ state: e.target.value, district: "" })}
      >
        <option value="">Select your state / UT</option>
        <optgroup label="States">
          {Object.keys(STATES).map((s) => <option key={s} value={s}>{s}</option>)}
        </optgroup>
        <optgroup label="Union Territories">
          {Object.keys(UNION_TERRITORIES).map((s) => <option key={s} value={s}>{s}</option>)}
        </optgroup>
      </select>

      <label style={labelStyle}>District *</label>
      <select
        style={{ ...inputStyle, opacity: value.state ? 1 : 0.5 }}
        value={value.district}
        disabled={!value.state}
        onChange={(e) => set({ district: e.target.value })}
      >
        <option value="">{value.state ? "Select your district" : "Select a state first"}</option>
        {districts.map((d) => <option key={d} value={d}>{d}</option>)}
      </select>

      <label style={labelStyle}>College *</label>
      <select
        style={inputStyle}
        value={value.college}
        onChange={(e) => set({ college: e.target.value, customCollege: "" })}
      >
        <option value="">Select your college</option>
        <option value={NONE}>None of the above</option>
        {colleges.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>

      {value.college === NONE && (
        <>
          <label style={labelStyle}>Name of your college *</label>
          <input
            style={inputStyle}
            type="text"
            maxLength={100}
            placeholder="Type your college name"
            value={value.customCollege}
            onChange={(e) => set({ customCollege: e.target.value })}
          />
        </>
      )}
    </>
  );
}
