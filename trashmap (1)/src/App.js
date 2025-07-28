import React, { useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

function LocationMarker({ onAddMarker }) {
  useMapEvents({
    click(e) {
      const file = window.prompt("上傳圖片描述 (模擬功能):");
      if (file !== null) {
        onAddMarker({ lat: e.latlng.lat, lng: e.latlng.lng, file });
      }
    }
  });
  return null;
}

function App() {
  const [markers, setMarkers] = useState([]);

  const addMarker = (marker) => {
    setMarkers((prev) => [...prev, marker]);
  };

  return (
    <div style={{ height: "100vh", width: "100%" }}>
      <MapContainer center={[23.5, 121]} zoom={7} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocationMarker onAddMarker={addMarker} />
        {markers.map((marker, idx) => (
          <Marker key={idx} position={[marker.lat, marker.lng]} />
        ))}
      </MapContainer>
    </div>
  );
}

export default App;
