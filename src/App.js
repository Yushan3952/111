// App.js
import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import EXIF from "exif-js";
import { getFirestore, collection, addDoc, getDocs } from "firebase/firestore";
import { initializeApp } from "firebase/app";

// --- Firebase 設定 ---
const firebaseConfig = {
  apiKey: "AIzaSyDeSg8cHTcHT8v7c2M-Tn6r6ArT7ymcRo",
  authDomain: "trashmap-d648e.firebaseapp.com",
  projectId: "trashmap-d648e",
  storageBucket: "trashmap-d648e.appspot.com",
  messagingSenderId: "485882660751",
  appId: "1:485882660751:web:3a05b7a44c1aab19a893e0"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- Cloudinary 設定 ---
const CLOUD_NAME = "dwhn02tn5";
const UPLOAD_PRESET = "trashmap_unsigned";

const App = () => {
  const [images, setImages] = useState([]);
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [location, setLocation] = useState(null);
  const [datetime, setDatetime] = useState(null);

  // 讀取 Firestore 資料
  const fetchImages = async () => {
    const snapshot = await getDocs(collection(db, "images"));
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setImages(data);
  };

  useEffect(() => {
    fetchImages();
  }, []);

  // 將度分秒轉換為十進位
  const convertDMSToDD = (dms, ref) => {
    const degrees = dms[0].numerator / dms[0].denominator;
    const minutes = dms[1].numerator / dms[1].denominator;
    const seconds = dms[2].numerator / dms[2].denominator;
    let dd = degrees + minutes / 60 + seconds / 3600;
    if (ref === "S" || ref === "W") dd *= -1;
    return dd;
  };

  // 選擇檔案
  const handleFileChange = e => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));

    // 讀取 EXIF
    EXIF.getData(selectedFile, function () {
      const lat = EXIF.getTag(this, "GPSLatitude");
      const latRef = EXIF.getTag(this, "GPSLatitudeRef");
      const lon = EXIF.getTag(this, "GPSLongitude");
      const lonRef = EXIF.getTag(this, "GPSLongitudeRef");
      const dateTimeOriginal = EXIF.getTag(this, "DateTimeOriginal");

      if (lat && lon) {
        const latitude = convertDMSToDD(lat, latRef);
        const longitude = convertDMSToDD(lon, lonRef);
        setLocation({ lat: latitude, lng: longitude });
      } else {
        // 沒有 GPS → 直接用定位
        navigator.geolocation.getCurrentPosition(
          pos => {
            setLocation({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude
            });
          },
          err => {
            console.error("定位失敗", err);
            alert("無法取得定位");
          }
        );
      }

      // 設定時間
      if (dateTimeOriginal) {
        setDatetime(dateTimeOriginal.replace(/:/g, "-").replace(" ", "T"));
      } else {
        setDatetime(new Date().toISOString());
      }
    });
  };

  // 上傳圖片
  const handleUpload = async () => {
    if (!file || !location) {
      alert("缺少圖片或定位資訊");
      return;
    }

    // 上傳到 Cloudinary
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`,
      { method: "POST", body: formData }
    );
    const data = await res.json();

    // 儲存到 Firestore
    await addDoc(collection(db, "images"), {
      url: data.secure_url,
      lat: location.lat,
      lng: location.lng,
      datetime: datetime
    });

    alert("上傳成功！");
    setFile(null);
    setPreview(null);
    fetchImages();
  };

  // Leaflet marker icon 修正
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
    iconUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
    shadowUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png"
  });

  return (
    <div style={{ padding: 20 }}>
      <h2>TrashMap 上傳</h2>
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
      />
      {preview && (
        <div>
          <img
            src={preview}
            alt="preview"
            style={{ width: 200, marginTop: 10 }}
          />
          <br />
          <button onClick={handleUpload}>上傳</button>
        </div>
      )}
      <MapContainer
        center={[23.7, 120.43]}
        zoom={11}
        style={{ height: "500px", marginTop: 20 }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {images.map(img => (
          <Marker key={img.id} position={[img.lat, img.lng]}>
            <Popup>
              <img src={img.url} alt="" style={{ width: "100%" }} />
              <br />
              拍攝時間: {img.datetime}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default App;
