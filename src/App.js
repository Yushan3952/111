// src/App.js
import React, { useState, useEffect } from "react";
import { storage } from "./firebase";
import {
  getDownloadURL,
  listAll,
  ref,
  uploadBytes,
} from "firebase/storage";

function App() {
  const [markers, setMarkers] = useState([]);
  const [map, setMap] = useState(null);

  useEffect(() => {
    if (window.google) {
      const mapInstance = new window.google.maps.Map(
        document.getElementById("map"),
        {
          center: { lat: 23.709, lng: 120.38 }, // 雲林縣中心
          zoom: 10,
        }
      );

      mapInstance.addListener("click", (e) => {
        handleMapClick(e.latLng);
      });

      setMap(mapInstance);
    }
  }, []);

  const handleMapClick = async (latLng) => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.click();

    fileInput.onchange = async () => {
      const file = fileInput.files[0];
      if (file) {
        const filename = `${Date.now()}-${file.name}`;
        const storageRef = ref(storage, `images/${filename}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        addMarker(latLng, url);
      }
    };
  };

  const addMarker = (latLng, imageUrl) => {
    const marker = new window.google.maps.Marker({
      position: latLng,
      map: map,
    });

    const infoWindow = new window.google.maps.InfoWindow({
      content: `<img src="${imageUrl}" style="max-width: 200px;" />`,
    });

    marker.addListener("click", () => {
      infoWindow.open(map, marker);
    });

    setMarkers((prev) => [...prev, { position: latLng, imageUrl }]);
  };

  useEffect(() => {
    // 顯示所有圖片（這裡簡單示意，實際應該存一份 geo 資訊在 DB）
    const fetchImages = async () => {
      const folderRef = ref(storage, "images/");
      const result = await listAll(folderRef);
      result.items.forEach(async (itemRef) => {
        const url = await getDownloadURL(itemRef);
        // 模擬在雲林附近顯示（實際可連 Firebase Firestore 存緯經度）
        const lat = 23.7 + Math.random() * 0.2;
        const lng = 120.3 + Math.random() * 0.2;
        addMarker({ lat, lng }, url);
      });
    };

    if (map) {
      fetchImages();
    }
  }, [map]);

  return (
    <div style={{ height: "100vh", width: "100%" }}>
      <div id="map" style={{ height: "100%" }}></div>
    </div>
  );
}

export default App;
