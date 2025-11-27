import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import { Helmet } from "react-helmet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import EXIF from "exif-js";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs } from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";
import "./App.css";

// 🔹 Firebase 設定
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 髒亂程度對應 Leaflet marker 顏色名稱
const levelColors = { 1: "green", 2: "yellow", 3: "orange", 4: "red", 5: "violet" };

// 產生彩色 marker icon
const getMarkerIcon = (color) =>
  new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${color}.png`,
    shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });

// 手動選點元件
const LocationSelector = ({ onSelect }) => {
  useMapEvents({ click(e) { onSelect([e.latlng.lat, e.latlng.lng]); } });
  return null;
};

export default function App() {
  const [markers, setMarkers] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [manualLocation, setManualLocation] = useState(null);
  const [trashLevel, setTrashLevel] = useState(3);
  const [file, setFile] = useState(null);
  const [step, setStep] = useState("start");

  // 🔹 載入 Firestore
  useEffect(() => {
    const fetchData = async () => {
      const querySnapshot = await getDocs(collection(db, "images"));
      const data = querySnapshot.docs.map(doc => doc.data());
      setMarkers(data);
    };
    fetchData();
  }, []);

  // 🔹 處理圖片選擇
  const handleFileChange = async (event) => {
    const selectedFile = event.target.files[0];
    if (!selectedFile) return;
    setFile(selectedFile);

    let lat = null, lng = null;

    // 嘗試從 EXIF 取得 GPS
    await new Promise((resolve) => {
      EXIF.getData(selectedFile, function () {
        const latExif = EXIF.getTag(this, "GPSLatitude");
        const lngExif = EXIF.getTag(this, "GPSLongitude");
        const latRef = EXIF.getTag(this, "GPSLatitudeRef");
        const lngRef = EXIF.getTag(this, "GPSLongitudeRef");
        if (latExif && lngExif) {
          const convertDMSToDD = (dms, ref) => {
            let degrees = dms[0].numerator / dms[0].denominator;
            let minutes = dms[1].numerator / dms[1].denominator;
            let seconds = dms[2].numerator / dms[2].denominator;
            let dd = degrees + minutes / 60 + seconds / 3600;
            if (ref === "S" || ref === "W") dd = -dd;
            return dd;
          };
          lat = convertDMSToDD(latExif, latRef);
          lng = convertDMSToDD(lngExif, lngRef);
        }
        resolve();
      });
    });

    if (!lat || !lng) alert("圖片沒有 GPS 資訊，請在地圖上點選位置");
    setManualLocation(lat && lng ? [lat, lng] : null);
  };

  // 🔹 上傳
  const handleUpload = async () => {
    if (!file) return alert("請先選擇圖片");
    if (!manualLocation) return alert("請先在地圖上點選位置");

    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${process.env.REACT_APP_CLOUDINARY_CLOUD_NAME}/image/upload`,
      { method: "POST", body: formData }
    );
    const data = await res.json();
    const imageUrl = data.secure_url;

    const newMarker = {
      id: uuidv4(),
      lat: manualLocation[0],
      lng: manualLocation[1],
      timestamp: new Date().toISOString(),
      imageUrl,
      level: trashLevel,
    };

    await addDoc(collection(db, "images"), newMarker);
    setMarkers(prev => [...prev, newMarker]);

    setFile(null);
    setManualLocation(null);
    setTrashLevel(3);
    setUploading(false);
    alert("上傳完成！");
  };

  if (step === "start") {
    return (
      <div className="start-page">
        <Helmet>
          <title>全民科學垃圾回報系統</title>
          <meta name="description" content="全民科學垃圾回報系統，拍照上傳、標記垃圾位置與髒亂程度，守護環境" />
        </Helmet>
        <h1>全民科學垃圾回報APP</h1>
        <button onClick={() => setStep("main")}>開始使用</button>
        <div className="buttons-row">
          <a href="#instructions"><button>操作說明</button></a>
          <a href="https://forms.gle/u9uHmAygxK5fRkmc7" target="_blank" rel="noopener noreferrer"><button>回饋意見</button></a>
        </div>
        <div id="instructions" className="instructions">
          <h2>操作說明</h2>
          <ol>
            <li>選擇或拍攝垃圾照片</li>
            <li>設定髒亂程度（1~5）</li>
            <li>在地圖上點選垃圾位置</li>
            <li>點擊「上傳」完成回報</li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div className="app-page">
      <Helmet>
        <title>全民科學垃圾回報系統</title>
        <meta name="description" content="全民科學垃圾回報系統，拍照上傳、標記垃圾位置與髒亂程度，守護環境" />
      </Helmet>

      <h1>全民科學垃圾回報APP</h1>

      <div className="upload-section">
        <div>
          <input type="file" accept="image/*" onChange={handleFileChange} />
          <div>
            <label>髒亂程度：</label>
            <select value={trashLevel} onChange={(e) => setTrashLevel(Number(e.target.value))}>
              <option value={1}>1 - 非常乾淨</option>
              <option value={2}>2 - 輕微垃圾</option>
              <option value={3}>3 - 中等垃圾</option>
              <option value={4}>4 - 髒亂</option>
              <option value={5}>5 - 非常髒亂</option>
            </select>
          </div>
          {uploading && <p>上傳中...</p>}
          <button onClick={handleUpload} disabled={uploading}>上傳</button>
        </div>
        <div className="legend">
          <img src={`${process.env.PUBLIC_URL}/legend.png`} alt="垃圾等級對照表" />
        </div>
      </div>

      <MapContainer center={[23.7, 120.53]} zoom={10} style={{ height: "500px", width: "100%" }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <LocationSelector onSelect={(pos) => setManualLocation(pos)} />
        {markers.map((m, idx) => (
          <Marker key={idx} position={[m.lat, m.lng]} icon={getMarkerIcon(levelColors[m.level || 3])}>
            <Popup>
              <img src={m.imageUrl} alt="uploaded" width="150" />
              <br />等級：{m.level || 3}
              <br />{m.timestamp}
            </Popup>
          </Marker>
        ))}
        {manualLocation && (
          <Marker position={manualLocation} icon={getMarkerIcon(levelColors[trashLevel])}>
            <Popup>已選擇的位置（等級：{trashLevel}）</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
