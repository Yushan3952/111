import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs } from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";

// Firebase 設定
const firebaseConfig = {
  apiKey: "AIzaSyAeX-tc-Rlr08KU8tPYZ4QcXDFdAx3LYHI",
  authDomain: "trashmap-d648e.firebaseapp.com",
  projectId: "trashmap-d648e",
  storageBucket: "trashmap-d648e.firebasestorage.app",
  messagingSenderId: "527164483024",
  appId: "1:527164483024:web:a40043feb0e05672c085d5",
  measurementId: "G-MFJDX8XJML"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Marker 顏色
const levelColors = { 1: "green", 2: "yellow", 3: "orange", 4: "red", 5: "violet" };
const getMarkerIcon = (color) =>
  new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${color}.png`,
    shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

// 選擇地圖位置
const LocationSelector = ({ onSelect }) => {
  useMapEvents({
    click(e) { onSelect([e.latlng.lat, e.latlng.lng]); }
  });
  return null;
};

// 自動切換地圖中心
function ChangeView({ center }) {
  const map = useMap();
  if(center) map.setView(center, 16);
  return null;
}

export default function App() {
  const [showStart, setShowStart] = useState(true);
  const [markers, setMarkers] = useState([]);
  const [manualLocation, setManualLocation] = useState([23.7, 120.53]);
  const [trashLevel, setTrashLevel] = useState(3);
  const [file, setFile] = useState(null);

  // 載入 Firebase 既有資料
  useEffect(() => {
    const fetchData = async () => {
      const querySnapshot = await getDocs(collection(db, "images"));
      const data = querySnapshot.docs.map(doc => doc.data());
      setMarkers(data);
    };
    fetchData();
  }, []);

  // 上傳
  const handleUpload = async () => {
    if(!file) return alert("請選擇圖片");
    if(!manualLocation) return alert("請選擇位置");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "trashmap_unsigned");

    const res = await fetch("https://api.cloudinary.com/v1_1/dwhn02tn5/image/upload", {
      method: "POST",
      body: formData
    });
    const data = await res.json();
    const imageUrl = data.secure_url;

    const newDoc = {
      id: uuidv4(),
      lat: manualLocation[0],
      lng: manualLocation[1],
      timestamp: new Date().toISOString(),
      imageUrl,
      level: trashLevel
    };
    await addDoc(collection(db, "images"), newDoc);

    setMarkers([...markers, newDoc]);
    setFile(null);
  };

  if(showStart) {
    return (
      <div className="start-screen">
        <h1>全民科學垃圾回報 APP</h1>
        <div className="guide-panel">
          <p>1. 點擊地圖選擇位置</p>
          <p>2. 上傳垃圾照片</p>
          <p>3. 選擇垃圾等級</p>
        </div>
        <div>
          <button onClick={() => setShowStart(false)}>開始</button>
        </div>
        <a href="https://forms.gle/u9uHmAygxK5fRkmc7" target="_blank" rel="noopener noreferrer">
          <button>回饋意見</button>
        </a>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>全民科學垃圾回報 APP</h1>

      <div className="controls">
        <div>
          <input type="file" accept="image/*" onChange={e => setFile(e.target.files[0])} />
          <select value={trashLevel} onChange={e => setTrashLevel(Number(e.target.value))}>
            <option value={1}>1 - 非常乾淨</option>
            <option value={2}>2 - 輕微垃圾</option>
            <option value={3}>3 - 中等垃圾</option>
            <option value={4}>4 - 髒亂</option>
            <option value={5}>5 - 非常髒亂</option>
          </select>
          <button onClick={handleUpload}>上傳</button>
        </div>
      </div>

      <div className="map-container">
        <MapContainer center={manualLocation} zoom={16} style={{height:'100%', width:'100%'}}>
          <ChangeView center={manualLocation} />
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <LocationSelector onSelect={setManualLocation} />
          {markers.map(m => (
            <Marker key={m.id} position={[m.lat, m.lng]} icon={getMarkerIcon(levelColors[m.level || 3])}>
              <Popup>
                <img src={m.imageUrl} alt="uploaded" width="150"/>
                <br/>
                等級：{m.level || 3}
                <br/>
                {m.timestamp}
              </Popup>
            </Marker>
          ))}
          <Marker position={manualLocation} icon={getMarkerIcon(levelColors[trashLevel])}>
            <Popup>已選擇位置（等級：{trashLevel}）</Popup>
          </Marker>
        </MapContainer>
        <div className="legend-panel">
          <img src="/legend.png" alt="Legend" />
        </div>
      </div>
    </div>
  );
}
