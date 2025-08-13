import React, { useState, useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs
} from "firebase/firestore";
import exifr from "exifr";

// Firebase 設定
const firebaseConfig = {
  apiKey: "AIzaSyA5oLJfNqv0xy-7RuxRLq4YdSlkgA9Dq9c",
  authDomain: "trashmap-d648e.firebaseapp.com",
  projectId: "trashmap-d648e",
  storageBucket: "trashmap-d648e.appspot.com",
  messagingSenderId: "864321086816",
  appId: "1:864321086816:web:bf653b15df1a3d5c8d7034",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function App() {
  const [map, setMap] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [imageFile, setImageFile] = useState(null);

  useEffect(() => {
    const initMap = L.map("map").setView([23.7074, 120.4313], 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(initMap);
    setMap(initMap);
    fetchMarkers(initMap);
  }, []);

  const fetchMarkers = async (mapInstance) => {
    const querySnapshot = await getDocs(collection(db, "images"));
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.lat && data.lng) {
        const marker = L.marker([data.lat, data.lng]).addTo(mapInstance);
        marker.bindPopup(
          `<b>拍攝時間：</b>${data.timestamp || "未知"}<br/>
           <img src="${data.url}" alt="photo" style="width:150px"/>`
        );
      }
    });
  };

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      setImageFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!imageFile) return alert("請先選擇照片");

    let lat = null;
    let lng = null;
    let photoTime = null;

    try {
      const exifData = await exifr.parse(imageFile, ["latitude", "longitude", "DateTimeOriginal"]);
      if (exifData?.latitude && exifData?.longitude) {
        lat = exifData.latitude;
        lng = exifData.longitude;
      }
      if (exifData?.DateTimeOriginal) {
        photoTime = exifData.DateTimeOriginal.toISOString();
      }
    } catch (error) {
      console.warn("讀取 EXIF 失敗", error);
    }

    // 如果沒有 EXIF GPS，就用即時定位
    if (!lat || !lng) {
      try {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
        });
        lat = position.coords.latitude;
        lng = position.coords.longitude;
        if (!photoTime) {
          photoTime = new Date().toISOString();
        }
      } catch (error) {
        alert("無法取得 GPS 位置，請開啟定位功能");
        return;
      }
    }

    // 如果還是沒有時間，就用現在時間
    if (!photoTime) {
      photoTime = new Date().toISOString();
    }

    // 上傳到 Cloudinary
    const formData = new FormData();
    formData.append("file", imageFile);
    formData.append("upload_preset", "trashmap_unsigned");

    const cloudinaryRes = await fetch(`https://api.cloudinary.com/v1_1/dwhn02tn5/image/upload`, {
      method: "POST",
      body: formData
    });

    const cloudinaryData = await cloudinaryRes.json();

    // 儲存到 Firestore
    await addDoc(collection(db, "images"), {
      url: cloudinaryData.secure_url,
      lat,
      lng,
      timestamp: photoTime
    });

    alert("上傳成功！");
    window.location.reload();
  };

  return (
    <div>
      <h1>TrashMap 公眾版</h1>
      <input type="file" accept="image/*" capture="environment" onChange={handleFileChange} />
      <button onClick={handleUpload}>上傳</button>
      <div id="map" style={{ height: "500px", marginTop: "10px" }}></div>
    </div>
  );
}

export default App;
