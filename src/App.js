import React, { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, query, orderBy } from "firebase/firestore";
import exifr from "exifr";
import CameraCapture from "./CameraCapture";
import "./App.css";

// Firebase 設定
const firebaseConfig = {
  apiKey: "AIzaSyA7Oa-xxxxxx", // 你的 API Key
  authDomain: "trashmap-d648e.firebaseapp.com",
  projectId: "trashmap-d648e",
  storageBucket: "trashmap-d648e.appspot.com",
  messagingSenderId: "881885037751",
  appId: "1:881885037751:web:c2xxxxxx"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function App() {
  const [images, setImages] = useState([]);
  const [showCamera, setShowCamera] = useState(false);

  useEffect(() => {
    fetchImages();
  }, []);

  const fetchImages = async () => {
    const q = query(collection(db, "images"), orderBy("timestamp", "desc"));
    const querySnapshot = await getDocs(q);
    setImages(querySnapshot.docs.map(doc => doc.data()));
  };

  // 相簿選擇
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    let lat, lng, dateTaken;

    try {
      const exifData = await exifr.parse(file);
      lat = exifData?.latitude;
      lng = exifData?.longitude;
      dateTaken = exifData?.DateTimeOriginal?.toISOString?.() || new Date().toISOString();
    } catch (err) {
      console.warn("EXIF 讀取失敗:", err);
      dateTaken = new Date().toISOString();
    }

    const imageUrl = await uploadToCloudinary(file);

    await addDoc(collection(db, "images"), {
      url: imageUrl,
      lat,
      lng,
      dateTaken,
      timestamp: Date.now()
    });

    fetchImages();
  };

  // 即拍
  const handleCameraCapture = async (file, lat, lng) => {
    const imageUrl = await uploadToCloudinary(file);

    await addDoc(collection(db, "images"), {
      url: imageUrl,
      lat,
      lng,
      dateTaken: new Date().toISOString(),
      timestamp: Date.now()
    });

    fetchImages();
  };

  const uploadToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "trashmap_unsigned");

    const res = await fetch(`https://api.cloudinary.com/v1_1/dwhn02tn5/image/upload`, {
      method: "POST",
      body: formData
    });

    const data = await res.json();
    return data.secure_url;
  };

  return (
    <div className="App">
      <h1>TrashMap 民眾上傳</h1>

      <div className="upload-options">
        <label className="upload-button">
          從相簿選擇
          <input type="file" accept="image/*" onChange={handleFileUpload} />
        </label>
        <button className="camera-button" onClick={() => setShowCamera(true)}>
          即拍即傳
        </button>
      </div>

      {showCamera && (
        <CameraCapture
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
        />
      )}

      <div className="gallery">
        {images.map((img, i) => (
          <div key={i} className="image-card">
            <img src={img.url} alt="trash" />
            <p>時間：{new Date(img.dateTaken).toLocaleString()}</p>
            <p>位置：{img.lat && img.lng ? `${img.lat.toFixed(6)}, ${img.lng.toFixed(6)}` : "無位置資訊"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;

