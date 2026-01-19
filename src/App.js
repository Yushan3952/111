import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import EXIF from "exif-js";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs } from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";
import "./App.css";

// 🔹 Firebase
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

// ------------------
// 清潔隊資料（可擴充）
// ------------------
const CLEANING_TEAMS_BY_TOWN = {
  "雲林縣_斗六市": { name: "斗六市清潔隊", phone: "05-532-2121" },
  "雲林縣_虎尾鎮": { name: "虎尾鎮清潔隊", phone: "05-632-4101" },
  // ... 其他鄉鎮
  "臺北市": { name: "台北市環保局", phone: "02-2720-8889" },
  "新北市": { name: "新北市環保局", phone: "02-2960-3456" },
  "桃園市": { name: "桃園市環保局", phone: "03-338-6021" },
  "臺中市": { name: "台中市環保局", phone: "04-2228-9111" },
  "臺南市": { name: "台南市環保局", phone: "06-268-6751" },
  "高雄市": { name: "高雄市環保局", phone: "07-735-1500" }
};

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

// ------------------
// 工具函式
// ------------------
const getLatLngFromPhoto = (file) =>
  new Promise((resolve) => {
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

export default function App() {
  const [markers, setMarkers] = useState([]);
  const [manualLocation, setManualLocation] = useState(null);
  const [trashLevel, setTrashLevel] = useState(3);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [step, setStep] = useState("start");

  // 新增清潔隊協助表單欄位
  const [needHelp, setNeedHelp] = useState("否");
  const [userEmail, setUserEmail] = useState("");
  const [userPhone, setUserPhone] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      const querySnapshot = await getDocs(collection(db, "images"));
      setMarkers(querySnapshot.docs.map(doc => doc.data()));
    };
    fetchData();
  }, []);

  const handleFileChange = async (event) => {
    const selectedFile = event.target.files[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    const photoLoc = await getLatLngFromPhoto(selectedFile);
    if (photoLoc) setManualLocation([photoLoc.lat, photoLoc.lng]);
    else { alert("⚠️ 這張照片沒有 GPS，請手動點選位置"); setManualLocation(null); }
  };

  const handleUpload = async () => {
    if (!file) { alert("請先選擇圖片"); return; }
    if (!manualLocation) { alert("請先在地圖上點選位置"); return; }
    if (needHelp === "是" && (!userEmail || !userPhone)) {
      alert("請填寫 Gmail 和電話"); return;
    }

    setUploading(true);

    try {
      const geo = await reverseGeocode(manualLocation[0], manualLocation[1]);
      const key = geo.county && geo.town ? `${geo.county}_${geo.town}` : null;
      const team = (key && CLEANING_TEAMS_BY_TOWN[key]) || CLEANING_TEAMS_BY_TOWN[geo.county] || { name: "當地清潔隊（尚未建檔）", phone: "1999" };

      // 上傳照片到 Cloudinary
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", "trashmap_unsigned");
      const res = await fetch("https://api.cloudinary.com/v1_1/dwhn02tn5/image/upload", { method: "POST", body: formData });
      const data = await res.json();
      const imageUrl = data.secure_url;

      // 存 Firestore
      await addDoc(collection(db, "images"), {
        id: uuidv4(),
        lat: manualLocation[0],
        lng: manualLocation[1],
        timestamp: new Date().toISOString(),
        imageUrl,
        level: trashLevel
      });
      setMarkers(prev => [...prev, { lat: manualLocation[0], lng: manualLocation[1], timestamp: new Date().toISOString(), imageUrl, level: trashLevel }]);

      // 如果需要協助，寄信給你
      if (needHelp === "是") {
        await fetch("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: userEmail,
            phone: userPhone,
            location: manualLocation,
            level: trashLevel,
            imageUrl
          })
        });
      }

      alert("✅ 上傳完成！");
      setFile(null); setManualLocation(null); setTrashLevel(3); setNeedHelp("否"); setUserEmail(""); setUserPhone("");

    } catch (err) {
      alert("上傳或定位失敗：" + err);
    } finally { setUploading(false); }
  };

  if (step === "start") return (
    <div className="start-screen">
      <h1>全民科學垃圾回報APP</h1>
      <div className="instructions" style={{ color: "#000" }}>
        <p>📌 操作說明：</p>
        <ul style={{ textAlign: "left" }}>
          <li>選擇或拍攝垃圾照片</li>
          <li>設定髒亂程度</li>
          <li>點擊地圖選擇位置</li>
          <li>點「上傳」完成回報</li>
        </ul>
      </div>
      <button style={{ fontSize:"20px", padding:"10px 20px" }} onClick={() => setStep("main")}>開始使用</button>
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
            <select value={trashLevel} onChange={e => setTrashLevel(Number(e.target.value))}>
              <option value={1}>1 - 非常乾淨</option>
              <option value={2}>2 - 輕微垃圾</option>
              <option value={3}>3 - 中等垃圾</option>
              <option value={4}>4 - 髒亂</option>
              <option value={5}>5 - 非常髒亂</option>
            </select>
          </div>

          <div>
            <label>是否需協助聯繫清潔隊：</label>
            <select value={needHelp} onChange={e => setNeedHelp(e.target.value)}>
              <option value="否">否</option>
              <option value="是">是</option>
            </select>
          </div>

          {needHelp === "是" && (
            <>
              <input type="email" placeholder="請輸入 Gmail" value={userEmail} onChange={e => setUserEmail(e.target.value)} />
              <input type="text" placeholder="請輸入電話" value={userPhone} onChange={e => setUserPhone(e.target.value)} />
            </>
          )}

          {uploading && <p>上傳中...</p>}
          <button onClick={handleUpload} disabled={uploading}>上傳</button>

          <a href="https://forms.gle/u9uHmAygxK5fRkmc7" target="_blank" rel="noopener noreferrer">
            <button style={{ marginTop: "10px" }}>意見回饋</button>
          </a>
        </div>
      </div>

      <MapContainer center={[23.7, 120.53]} zoom={10} className="map-container">
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <LocationSelector onSelect={pos => setManualLocation(pos)} />

        {markers.map((m, idx) => (
          <Marker key={idx} position={[m.lat, m.lng]} icon={getMarkerIcon(levelColors[m.level || 3])}>
            <Popup className="popup">
              <img src={m.imageUrl} alt="uploaded" className="popup-image" />
              <br />等級：{m.level || 3}<br />{m.timestamp}
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
