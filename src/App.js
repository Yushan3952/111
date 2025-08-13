import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import EXIF from "exif-js";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs } from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";

// 🔹 Firebase 設定
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

// 髒亂程度對應 Leaflet marker 顏色名稱
const levelColors = {
  1: "green",
  2: "yellow",
  3: "orange",
  4: "red",
  5: "violet"
};

// 產生彩色 marker icon
const getMarkerIcon = (color) =>
  new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${color}.png`,
    shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

// 手動選點元件
const LocationSelector = ({ onSelect }) => {
  useMapEvents({
    click(e) {
      onSelect([e.latlng.lat, e.latlng.lng]);
    }
  });
  return null;
};

const App = () => {
  const [markers, setMarkers] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [manualLocation, setManualLocation] = useState(null);
  const [trashLevel, setTrashLevel] = useState(3);
  const [file, setFile] = useState(null);
  const [step, setStep] = useState("start"); // start / main

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

    const now = Date.now();
    const isCameraShot = now - selectedFile.lastModified < 60 * 1000; // 1 分鐘內

    let lat = null, lng = null;

    if (isCameraShot) {
      // 即時拍照 → 用 GPS
      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch (err) {
        alert("即時拍照無法取得定位，請在地圖上點選位置");
      }
    } else {
      // 相簿 → 先讀 EXIF
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

      if (!lat || !lng) {
        alert("圖片沒有 GPS 資訊，請在地圖上點選位置");
      }
    }

    if (lat && lng) {
      setManualLocation([lat, lng]);
    } else {
      setManualLocation(null); // 等待手點
    }
  };

  // 🔹 上傳
  const handleUpload = async () => {
    if (!file) {
      alert("請先選擇圖片");
      return;
    }
    if (!manualLocation) {
      alert("請先在地圖上點選位置");
      return;
    }

    setUploading(true);

    // 上傳到 Cloudinary
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "trashmap_unsigned");

    const res = await fetch("https://api.cloudinary.com/v1_1/dwhn02tn5/image/upload", {
      method: "POST",
      body: formData
    });
    const data = await res.json();
    const imageUrl = data.secure_url;

    // 存到 Firestore
    await addDoc(collection(db, "images"), {
      id: uuidv4(),
      lat: manualLocation[0],
      lng: manualLocation[1],
      timestamp: new Date().toISOString(),
      imageUrl,
      level: trashLevel
    });

    setMarkers(prev => [
      ...prev,
      {
        lat: manualLocation[0],
        lng: manualLocation[1],
        timestamp: new Date().toISOString(),
        imageUrl,
        level: trashLevel
      }
    ]);

    // 🔹 自動重置
    setFile(null);
    setManualLocation(null);
    setTrashLevel(3);
    setUploading(false);
    alert("上傳完成！");
  };

  // 🔹 起始畫面
  if (step === "start") {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <h1>全民科學垃圾回報系統</h1>
        <button
          style={{ fontSize: "20px", padding: "10px 20px" }}
          onClick={() => setStep("main")}
        >
          開始使用
        </button>

        <div style={{ marginTop: "30px" }}>
          <a
            href="https://forms.gle/u9uHmAygxK5fRkmc7"
            target="_blank"
            rel="noopener noreferrer"
          >
            <button style={{ fontSize: "16px", padding: "8px 16px" }}>
              回饋意見
            </button>
          </a>
        </div>
      </div>
    );
  }

  // 🔹 操作頁面
  return (
    <div>
      <h2>TrashMap 上傳</h2>

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

      <div style={{ margin: "10px 0" }}>
        <a
          href="https://forms.gle/u9uHmAygxK5fRkmc7"
          target="_blank"
          rel="noopener noreferrer"
        >
          <button style={{ fontSize: "16px", padding: "6px 12px" }}>
            回饋意見
          </button>
        </a>
      </div>

      <MapContainer
        center={[23.7, 120.53]}
        zoom={10}
        style={{ height: "500px", width: "100%" }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <LocationSelector onSelect={(pos) => setManualLocation(pos)} />

        {markers.map((m, idx) => (
          <Marker
            key={idx}
            position={[m.lat, m.lng]}
            icon={getMarkerIcon(levelColors[m.level || 3])}
          >
            <Popup>
              <img src={m.imageUrl} alt="uploaded" width="150" />
              <br />
              等級：{m.level || 3}
              <br />
              {m.timestamp}
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
};

export default App;
