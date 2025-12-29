import { useState, useEffect, useCallback, useRef } from "react";

type Stat = {
  total: number;
  success: number;
  error: number;
};

type Log = {
  id: string;
  timestamp: string;
  status: "success" | "error";
  message: string;
  latency: number;
};

function App() {
  const [intervalSec, setIntervalSec] = useState<number>(1);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [stats, setStats] = useState<Stat>({ total: 0, success: 0, error: 0 });
  const [logs, setLogs] = useState<Log[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const sendRequest = useCallback(async () => {
    const startTime = performance.now();
    try {
      const res = await fetch("/app/sample", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: `Request from frontend at ${new Date().toISOString()}` }),
      });

      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);

      if (res.ok) {
        const data = await res.json();
        setStats((prev) => ({
          ...prev,
          total: prev.total + 1,
          success: prev.success + 1,
        }));
        addLog({
          status: "success",
          message: `ID: ${data.id} - Created successfully`,
          latency,
        });
      } else {
        setStats((prev) => ({
          ...prev,
          total: prev.total + 1,
          error: prev.error + 1,
        }));
        addLog({
          status: "error",
          message: `Status: ${res.status} ${res.statusText}`,
          latency,
        });
      }
    } catch (error) {
      const endTime = performance.now();
      setStats((prev) => ({
        ...prev,
        total: prev.total + 1,
        error: prev.error + 1,
      }));
      addLog({
        status: "error",
        message: error instanceof Error ? error.message : "Network Error",
        latency: Math.round(endTime - startTime),
      });
    }
  }, []);

  const addLog = (logData: Omit<Log, "id" | "timestamp">) => {
    const newLog: Log = {
      id: crypto.randomUUID(),
      timestamp: new Date().toLocaleTimeString(),
      ...logData,
    };
    setLogs((prev) => {
      const newLogs = [...prev, newLog];
      return newLogs.slice(-50); // Keep last 50 logs
    });
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isRunning) {
      timer = setInterval(() => {
        sendRequest();
      }, intervalSec * 1000);
    }
    return () => clearInterval(timer);
  }, [isRunning, intervalSec, sendRequest]);

  const toggleRunning = () => {
    setIsRunning(!isRunning);
  };

  const resetStats = () => {
    setStats({ total: 0, success: 0, error: 0 });
    setLogs([]);
  };

  const errorRate = stats.total > 0 ? ((stats.error / stats.total) * 100).toFixed(2) : "0.00";

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
            Load Generator Dashboard
          </h1>
          <p className="mt-2 text-lg text-gray-600">
            Send periodic requests to <code className="bg-gray-200 px-1 rounded">/app/sample</code>
          </p>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-xl shadow-md p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-4 w-full md:w-auto">
            <label className="text-gray-700 font-medium whitespace-nowrap">
              Interval (sec):
            </label>
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={intervalSec}
              onChange={(e) => setIntervalSec(parseFloat(e.target.value) || 1)}
              disabled={isRunning}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
            />
          </div>
          <div className="flex space-x-3 w-full md:w-auto">
            <button
              onClick={toggleRunning}
              className={`flex-1 md:flex-none w-full md:w-32 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                isRunning
                  ? "bg-red-600 hover:bg-red-700 focus:ring-red-500"
                  : "bg-green-600 hover:bg-green-700 focus:ring-green-500"
              }`}
            >
              {isRunning ? "Stop" : "Start"}
            </button>
            <button
              onClick={resetStats}
              disabled={isRunning}
              className="flex-1 md:flex-none w-full md:w-32 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Total Requests" value={stats.total} color="bg-blue-50 text-blue-700" />
          <StatCard title="Success" value={stats.success} color="bg-green-50 text-green-700" />
          <StatCard title="Errors" value={stats.error} color="bg-red-50 text-red-700" />
          <StatCard title="Error Rate" value={`${errorRate}%`} color="bg-yellow-50 text-yellow-700" />
        </div>

        {/* Logs */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden flex flex-col h-96">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-medium text-gray-900">Request Log (Last 50)</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-900 text-sm font-mono">
            {logs.length === 0 && (
              <p className="text-gray-500 text-center italic mt-4">No requests sent yet.</p>
            )}
            {logs.map((log) => (
              <div key={log.id} className="flex items-start space-x-3 border-b border-gray-800 pb-2 last:border-0">
                <span className="text-gray-500 shrink-0">[{log.timestamp}]</span>
                <span
                  className={`font-bold shrink-0 ${
                    log.status === "success" ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {log.status.toUpperCase()}
                </span>
                <span className="text-gray-300 truncate flex-1">{log.message}</span>
                <span className="text-gray-500 shrink-0">{log.latency}ms</span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}

const StatCard = ({ title, value, color }: { title: string; value: string | number; color: string }) => (
  <div className={`rounded-xl shadow-sm p-5 flex flex-col items-center justify-center text-center ${color}`}>
    <dt className="text-sm font-medium truncate opacity-80">{title}</dt>
    <dd className="mt-1 text-3xl font-semibold tracking-tight">{value}</dd>
  </div>
);

export default App;