import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import EXIF from "exif-js";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs } from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";
import "./App.css";

// ---------------- Firebase 設定 ----------------
const firebaseConfig = {
  apiKey: "AIzaSyBqOaY9c3Uo6KkG8fD7Vx5L3X2P2x1H0q8",
  authDomain: "trashmap-d648e.firebaseapp.com",
  projectId: "trashmap-d648e",
  storageBucket: "trashmap-d648e.appspot.com",
  messagingSenderId: "1059384934230",
  appId: "1:1059384934230:web:abcdef1234567890"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ---------------- 清潔隊資料 ----------------
const CLEANING_TEAMS_BY_TOWN = {
  "雲林縣_斗六市": { name: "斗六市清潔隊", phone: "05-532-2121" },
  "雲林縣_虎尾鎮": { name: "虎尾鎮清潔隊", phone: "05-632-4101" },
  "雲林縣_西螺鎮": { name: "西螺鎮清潔隊", phone: "05-586-3201" },
  "雲林縣_土庫鎮": { name: "土庫鎮清潔隊", phone: "05-662-3211" },
  "雲林縣_北港鎮": { name: "北港鎮清潔隊", phone: "05-783-2757" },
  "雲林縣_二崙鄉": { name: "二崙鄉公所清潔隊", phone: "05-598-2001" },
  "雲林縣_崙背鄉": { name: "崙背鄉清潔隊", phone: "05-696-2101" },
  "雲林縣_麥寮鄉": { name: "麥寮鄉清潔隊", phone: "05-693-2001" },
  "雲林縣_古坑鄉": { name: "古坑鄉清潔隊", phone: "05-582-3201" },
  "雲林縣_大埤鄉": { name: "大埤鄉清潔隊", phone: "05-591-2101" },
  "雲林縣_莿桐鄉": { name: "莿桐鄉清潔隊", phone: "05-584-2101" },
  "雲林縣_林內鄉": { name: "林內鄉清潔隊", phone: "05-589-2001" },
  "雲林縣_水林鄉": { name: "水林鄉清潔隊", phone: "05-785-2001" },
  "雲林縣_口湖鄉": { name: "口湖鄉清潔隊", phone: "05-797-2001" },
  "雲林縣_四湖鄉": { name: "四湖鄉清潔隊", phone: "05-772-2101" },
  "雲林縣_元長鄉": { name: "元長鄉清潔隊", phone: "05-788-2001" },
};

// ---------------- 地圖 Marker ----------------
const levelColors = { 1:"green", 2:"yellow", 3:"orange", 4:"red", 5:"violet" };
const getMarkerIcon = (color) => new L.Icon({
  iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${color}.png`,
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  iconSize: [25,41],
  iconAnchor: [12,41],
  popupAnchor: [1,-34],
  shadowSize: [41,41]
});

const LocationSelector = ({ onSelect }) => {
  useMapEvents({
    click(e) { onSelect([e.latlng.lat, e.latlng.lng]); }
  });
  return null;
};

// ---------------- 工具函式 ----------------
const getLatLngFromPhoto = (file) =>
  new Promise(resolve => {
    if (!file) return resolve(null);
    EXIF.getData(file, function () {
      const latExif = EXIF.getTag(this, "GPSLatitude");
      const lngExif = EXIF.getTag(this, "GPSLongitude");
      const latRef = EXIF.getTag(this, "GPSLatitudeRef");
      const lngRef = EXIF.getTag(this, "GPSLongitudeRef");
      if (!latExif || !lngExif) return resolve(null);
      const dmsToDd = (dms, ref) => {
        const deg = dms[0].numerator / dms[0].denominator;
        const min = dms[1].numerator / dms[1].denominator;
        const sec = dms[2].numerator / dms[2].denominator;
        let dd = deg + min / 60 + sec / 3600;
        if (ref === "S" || ref === "W") dd = -dd;
        return dd;
      };
      resolve({ lat: dmsToDd(latExif, latRef), lng: dmsToDd(lngExif, lngRef) });
    });
  });

const reverseGeocode = async (lat, lng) => {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=zh-TW`
  );
  const data = await res.json();
  const addr = data.address || {};
  const county = addr.county || addr.city || addr.state;
  const town = addr.town || addr.city_district || addr.suburb;
  return { county, town };
};

// ---------------- App ----------------
export default function App() {
  const [markers, setMarkers] = useState([]);
  const [manualLocation, setManualLocation] = useState(null);
  const [trashLevel, setTrashLevel] = useState(3);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [step, setStep] = useState("start");

  // 新增欄位 state
  const [needHelp, setNeedHelp] = useState("否");
  const [helpEmail, setHelpEmail] = useState("");
  const [helpPhone, setHelpPhone] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      const querySnapshot = await getDocs(collection(db, "images"));
      const data = querySnapshot.docs.map(doc => doc.data());
      setMarkers(data);
    };
    fetchData();
  }, []);

  const handleFileChange = async (event) => {
    const selectedFile = event.target.files[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    const photoLoc = await getLatLngFromPhoto(selectedFile);
    if (photoLoc) setManualLocation([photoLoc.lat, photoLoc.lng]);
    else { alert("⚠️ 這張照片沒有 GPS 資訊，請手動在地圖點選位置"); setManualLocation(null); }
  };

  const handleUpload = async () => {
    if (!file) { alert("請先選擇圖片"); return; }
    if (!manualLocation) { alert("請先在地圖上點選位置"); return; }

    setUploading(true);

    try {
      const geo = await reverseGeocode(manualLocation[0], manualLocation[1]);
      const key = geo.county && geo.town ? `${geo.county}_${geo.town}` : null;
      const team =
        (key && CLEANING_TEAMS_BY_TOWN[key]) ||
        CLEANING_TEAMS_BY_TOWN[geo.county] || { name: "當地清潔隊", phone: "1999" };

      // 上傳 Cloudinary
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", "trashmap_unsigned");
      const res = await fetch("https://api.cloudinary.com/v1_1/dwhn02tn5/image/upload", { method:"POST", body: formData });
      const data = await res.json();
      const imageUrl = data.secure_url;

      // 存 Firebase
      await addDoc(collection(db, "images"), {
        id: uuidv4(),
        lat: manualLocation[0],
        lng: manualLocation[1],
        timestamp: new Date().toISOString(),
        imageUrl,
        level: trashLevel
      });

      setMarkers(prev => [...prev, {
        lat: manualLocation[0],
        lng: manualLocation[1],
        timestamp: new Date().toISOString(),
        imageUrl,
        level: trashLevel
      }]);

// 4️⃣ 若使用者選需要協助 → 呼叫 /api/send-email 
      if (needHelp === "是") { const emailRes = await fetch("/api/send-email",
      { method: "POST", headers: { "Content-Type": "application/json" }, 
       body: JSON.stringify({ 
         email: helpEmail, 
         phone: helpPhone, 
         location: manualLocation, 
         level: trashLevel, 
         imageUrl,
         county: geo.county,
         town: geo.town,
         teamname: team.name,
         teamphone: team.phone
       }) });
      const emailData = await emailRes.json();
      if (!emailRes.ok) throw new Error(emailData.message || "寄信失敗");

      alert(
        "✅ 上傳完成！\n" +
        "我們會協助聯絡清潔隊的\n" +
        "📍 " + geo.county + " " + geo.town + "\n" +
        "☎ " + team.name + "\n" +
        "📞 " + team.phone
      );
    } else {
      alert(
        "✅ 上傳完成！\n" +
        "如需自行聯絡清潔隊，請洽：\n" +
        "📍 " + geo.county + " " + geo.town + "\n" +
        "☎ " + team.name + "\n" +
        "📞 " + team.phone
      );
    }

    // 5️⃣ 清空欄位
    setFile(null);
    setManualLocation(null);
    setTrashLevel(3);
    setNeedHelp("否");
    setHelpEmail("");
    setHelpPhone("");

  } catch (err) {
    alert("上傳或寄信失敗：" + err.message);
  } finally {
    setUploading(false);
  }
};

  if (step === "start") return (
    <div className="start-screen">
      <h1>全民科學垃圾回報APP</h1>
      <div className="instructions" style={{ color:"#000000" , backgroundColor:  "rgba(255, 255, 255, 0.7)" }}>
        <p>📌 操作說明：</p>
        <ul style={{ textAlign:"left" }}>
          <li> 點選「📷 拍照上傳」或「選擇照片」，
              拍下你看到的垃圾或污染畫面。</li>
                
               <li> 系統會自動抓取拍照地點，
請確認地點是否正確。</li>
          <li>設定髒亂程度</li>
        <li>填寫是否需協助聯絡清潔隊，
  如需的話，請留下聯絡資訊，
    在完成聯絡之後，會依此進行聯絡</li>
      <li>如選擇自行聯絡，
      上傳之後會顯現相關單位聯絡方式</li>
          <li>最後請點擊「上傳」完成回報</li>
        </ul>
      </div>
      <button style={{ fontSize:"20px", padding:"10px 20px" }} onClick={()=>setStep("main")}>開始使用</button>
      <div style={{ marginTop:"20px" }}>
        <a href="https://forms.gle/u9uHmAygxK5fRkmc7" target="_blank" rel="noopener noreferrer">
          <button style={{ fontSize:"16px", padding:"8px 16px" }}>回饋意見</button>
        </a>
      </div>
    </div>
  );

  return (
    <div className="container">
      <h1>全民科學垃圾回報APP</h1>

      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"10px" }}>
        <div style={{ flex:1, paddingRight:"20px" }}>
          <input type="file" accept="image/*" onChange={handleFileChange} />

          <div>
            <label>髒亂程度：</label>
            <select value={trashLevel} onChange={e=>setTrashLevel(Number(e.target.value))}>
              <option value={1}>1 - 非常乾淨</option>
              <option value={2}>2 - 輕微垃圾</option>
              <option value={3}>3 - 中等垃圾</option>
              <option value={4}>4 - 髒亂</option>
              <option value={5}>5 - 非常髒亂</option>
            </select>
          </div>

          {/* 新增協助聯繫選單 */}
          <div>
            <label>是否需協助聯繫清潔隊：</label>
            <select value={needHelp} onChange={e=>setNeedHelp(e.target.value)}>
              <option value="否">否</option>
              <option value="是">是</option>
            </select>
          </div>

          {needHelp === "是" && (
            <>
              <div>
                <label>您的 Gmail：</label>
                <input type="email" value={helpEmail} onChange={e=>setHelpEmail(e.target.value)} />
              </div>
              <div>
                <label>您的聯絡電話：</label>
                <input type="tel" value={helpPhone} onChange={e=>setHelpPhone(e.target.value)} />
              </div>
            </>
          )}

          {uploading && <p>上傳中...</p>}
          <button onClick={handleUpload} disabled={uploading}>上傳</button>

          <a href="https://forms.gle/u9uHmAygxK5fRkmc7" target="_blank" rel="noopener noreferrer">
            <button style={{ marginTop:"10px" }}>意見回饋</button>
          </a>
        </div>
      </div>

      <MapContainer center={[23.7,120.53]} zoom={10} className="map-container">
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <LocationSelector onSelect={pos=>setManualLocation(pos)} />

        {markers.map((m, idx)=>(
          <Marker key={idx} position={[m.lat, m.lng]} icon={getMarkerIcon(levelColors[m.level || 3])}>
            <Popup>
              <img src={m.imageUrl} alt="uploaded" className="popup-image" />
              <br/>等級：{m.level || 3}<br/>{m.timestamp}
            </Popup>
          </Marker>
        ))}

        {manualLocation && (
          <Marker position={manualLocation} icon={getMarkerIcon(levelColors[trashLevel])}>
            <Popup>已選擇位置（等級：{trashLevel}）</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
