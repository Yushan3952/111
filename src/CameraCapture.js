import React, { useRef, useState } from "react";

export default function CameraCapture({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);

  React.useEffect(() => {
    (async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.error("相機開啟失敗:", err);
      }
    })();

    return () => {
      stream?.getTracks().forEach(track => track.stop());
    };
  }, []);

  const takePhoto = async () => {
    if (!videoRef.current) return;

    const context = canvasRef.current.getContext("2d");
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    context.drawImage(videoRef.current, 0, 0);

    canvasRef.current.toBlob(async (blob) => {
      let lat = null;
      let lng = null;

      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch (err) {
        console.warn("GPS 取得失敗:", err);
      }

      onCapture(new File([blob], "photo.jpg", { type: "image/jpeg" }), lat, lng);
      onClose();
    }, "image/jpeg");
  };

  return (
    <div className="camera-container">
      <video ref={videoRef} autoPlay playsInline></video>
      <canvas ref={canvasRef} style={{ display: "none" }}></canvas>
      <div className="camera-controls">
        <button onClick={takePhoto}>拍照並上傳</button>
        <button onClick={onClose}>取消</button>
      </div>
    </div>
  );
}
