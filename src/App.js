import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import EXIF from "exif-js";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs
} from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";

// 🔹 Firebase 設定（請換成你的）
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

const App = () => {
  const [markers, setMarkers] = useState([]);
  const [uploading, setUploading] = useState(false);

  // 🔹 載入 Firestore 資料
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
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);

    // 嘗試讀取 EXIF GPS
    let lat = null, lng = null, timestamp = new Date().toISOString();

    await new Promise((resolve) => {
      EXIF.getData(file, function () {
        const latExif = EXIF.getTag(this, "GPSLatitude");
        const lngExif = EXIF.getTag(this, "GPSLongitude");
        const latRef = EXIF.getTag(this, "GPSLatitudeRef");
        const lngRef = EXIF.getTag(this, "GPSLongitudeRef");
        const dateTime = EXIF.getTag(this, "DateTimeOriginal");

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

        if (dateTime) {
          timestamp = dateTime.replace(/:/g, "-").replace(" ", "T");
        }
        resolve();
      });
    });

    // 如果沒有 EXIF GPS，則用即時定位
    if (!lat || !lng) {
      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch (err) {
        alert("無法取得定位資訊");
        setUploading(false);
        return;
      }
    }

    // 🔹 這裡上傳到 Cloudinary（可換成你的 API）
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "trashmap_unsigned");

    const res = await fetch(`https://api.cloudinary.com/v1_1/dwhn02tn5/image/upload`, {
      method: "POST",
      body: formData
    });

    const data = await res.json();
    const imageUrl = data.secure_url;

    // 🔹 存到 Firestore
    await addDoc(collection(db, "images"), {
      id: uuidv4(),
      lat,
      lng,
      timestamp,
      imageUrl
    });

    setMarkers(prev => [...prev, { lat, lng, timestamp, imageUrl }]);
    setUploading(false);
    alert("上傳完成！");
  };

  const markerIcon = new L.Icon({
    iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34]
  });

  return (
    <div>
      <h2>TrashMap 上傳</h2>

      {/* 這裡不要加 capture="environment"，保留相簿與相機 */}
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
      />

      {uploading && <p>上傳中...</p>}

      <MapContainer
        center={[23.7, 120.53]}
        zoom={10}
        style={{ height: "500px", width: "100%" }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {markers.map((m, idx) => (
          <Marker key={idx} position={[m.lat, m.lng]} icon={markerIcon}>
            <Popup>
              <img src={m.imageUrl} alt="uploaded" width="150" />
              <br />
              {m.timestamp}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default App;
