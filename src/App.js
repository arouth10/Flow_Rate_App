import React, { useState, useEffect, useRef } from "react";
import { Activity, Bluetooth, Wind, Power } from "lucide-react";

export default function FlowMonitor() {
  const [isConnected, setIsConnected] = useState(false);
  const [flowRate, setFlowRate] = useState(0);
  const [history, setHistory] = useState([]);
  const [status, setStatus] = useState("Disconnected");
  const [avgFlow, setAvgFlow] = useState(0);
  const [maxFlow, setMaxFlow] = useState(0);

  const deviceRef = useRef(null);
  const characteristicRef = useRef(null);
  const bufferRef = useRef("");

  const maxHistoryPoints = 50;

  // Calculate statistics when history updates
  useEffect(() => {
    if (history.length > 0) {
      const avg = history.reduce((sum, val) => sum + val, 0) / history.length;
      const max = Math.max(...history);
      setAvgFlow(avg);
      setMaxFlow(max);
    }
  }, [history]);

  const connectDevice = async () => {
    try {
      setStatus("Requesting device...");

      // Request Bluetooth device with Serial Port Profile
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ name: "ESP32-Flow" }],
        optionalServices: ["0000ffe0-0000-1000-8000-00805f9b34fb"], // Common BLE serial service UUID
      });

      setStatus("Connecting...");
      const server = await device.gatt.connect();

      setStatus("Getting service...");
      const service = await server.getPrimaryService(
        "0000ffe0-0000-1000-8000-00805f9b34fb"
      );

      setStatus("Getting characteristic...");
      const characteristic = await service.getCharacteristic(
        "0000ffe1-0000-1000-8000-00805f9b34fb"
      );

      deviceRef.current = device;
      characteristicRef.current = characteristic;

      // Start notifications
      await characteristic.startNotifications();
      characteristic.addEventListener("characteristicvaluechanged", handleData);

      // Handle disconnect
      device.addEventListener("gattserverdisconnected", handleDisconnect);

      setIsConnected(true);
      setStatus("Connected");
    } catch (error) {
      console.error("Connection error:", error);
      setStatus(`Error: ${error.message}`);
    }
  };

  const handleData = (event) => {
    const value = event.target.value;
    const decoder = new TextDecoder("utf-8");
    const text = decoder.decode(value);

    // Append to buffer
    bufferRef.current += text;

    // Process complete lines
    let lines = bufferRef.current.split("\n");
    bufferRef.current = lines.pop() || ""; // Keep incomplete line in buffer

    lines.forEach((line) => {
      // Look for "FR:<value>" format
      if (line.startsWith("FR:")) {
        const cfmValue = parseFloat(line.substring(3));
        if (!isNaN(cfmValue)) {
          setFlowRate(cfmValue);
          setHistory((prev) => {
            const newHistory = [...prev, cfmValue];
            return newHistory.slice(-maxHistoryPoints);
          });
        }
      }
    });
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setStatus("Disconnected");
    deviceRef.current = null;
    characteristicRef.current = null;
    bufferRef.current = "";
  };

  const disconnect = async () => {
    if (deviceRef.current && deviceRef.current.gatt.connected) {
      await deviceRef.current.gatt.disconnect();
    }
  };

  const resetStats = () => {
    setHistory([]);
    setAvgFlow(0);
    setMaxFlow(0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Wind className="w-8 h-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-800">
                Flow Rate Monitor
              </h1>
            </div>
            <div
              className={`px-4 py-2 rounded-full text-sm font-semibold ${
                isConnected
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {status}
            </div>
          </div>

          {/* Connection Button */}
          {!isConnected ? (
            <button
              onClick={connectDevice}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <Bluetooth className="w-5 h-5" />
              Connect to ESP32-Flow
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={disconnect}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <Power className="w-5 h-5" />
                Disconnect
              </button>
              <button
                onClick={resetStats}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Reset Stats
              </button>
            </div>
          )}
        </div>

        {/* Main Display */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Activity className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-700">
                Current Flow Rate
              </h2>
            </div>
            <div className="text-7xl font-bold text-blue-600 mb-2">
              {flowRate.toFixed(2)}
            </div>
            <div className="text-2xl text-gray-600 font-semibold">CFM</div>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              Average Flow
            </h3>
            <div className="text-4xl font-bold text-indigo-600">
              {avgFlow.toFixed(2)}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              CFM (last {history.length} readings)
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              Peak Flow
            </h3>
            <div className="text-4xl font-bold text-purple-600">
              {maxFlow.toFixed(2)}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              CFM (maximum recorded)
            </div>
          </div>
        </div>

        {/* Mini Chart */}
        {history.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">
              Flow History
            </h3>
            <div className="h-32 flex items-end gap-1">
              {history.map((value, index) => {
                const height = maxFlow > 0 ? (value / maxFlow) * 100 : 0;
                return (
                  <div
                    key={index}
                    className="flex-1 bg-blue-500 rounded-t transition-all duration-300"
                    style={{ height: `${height}%`, minHeight: "2px" }}
                    title={`${value.toFixed(2)} CFM`}
                  />
                );
              })}
            </div>
            <div className="text-xs text-gray-500 text-center mt-2">
              Showing last {history.length} readings
            </div>
          </div>
        )}

        {/* Info */}
        {!isConnected && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-6">
            <h4 className="font-semibold text-blue-900 mb-2">
              Getting Started:
            </h4>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>
                Make sure your ESP32 is powered on and running the flow
                monitoring code
              </li>
              <li>Use Chrome or Edge browser (Web Bluetooth required)</li>
              <li>Click "Connect to ESP32-Flow" above</li>
              <li>Select "ESP32-Flow" from the Bluetooth device list</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
