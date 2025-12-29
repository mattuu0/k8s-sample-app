import { useState, useEffect, useCallback, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Stat = {
  total: number;
  success: number;
  error: number;
  totalLatency: number;
};

type Log = {
  id: string;
  timestamp: string;
  startTime: number;
  status: "success" | "error" | "pending";
  statusCode?: number;
  message: string;
  latency?: number;
};

type ChartData = {
  time: string;
  latency: number;
};

type ViewMode = "dashboard" | "network";

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>("dashboard");
  const [intervalMs, setIntervalMs] = useState<number>(1000);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [stats, setStats] = useState<Stat>({
    total: 0,
    success: 0,
    error: 0,
    totalLatency: 0,
  });
  const [logs, setLogs] = useState<Log[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const networkContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs (Dashboard)
  useEffect(() => {
    if (viewMode === "dashboard" && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs, viewMode]);

  // Auto-scroll logs (Network)
  useEffect(() => {
    if (viewMode === "network" && networkContainerRef.current) {
      // Only auto-scroll if user is already near bottom or if it's the first few logs
      // But for simplicity in this "devtools" style, we usually want auto-scroll unless user scrolled up.
      // For now, keep simple auto-scroll.
      networkContainerRef.current.scrollTop =
        networkContainerRef.current.scrollHeight;
    }
  }, [logs, viewMode]);

  const sendRequest = useCallback(async () => {
    const requestId = crypto.randomUUID();
    const startTime = performance.now();
    const startTimeDate = Date.now();
    const timestamp = new Date().toLocaleTimeString();

    // 1. Add Pending Log
    const pendingLog: Log = {
      id: requestId,
      timestamp: timestamp,
      startTime: startTimeDate,
      status: "pending",
      message: "Pending...",
    };

    setLogs((prev) => {
      const newLogs = [...prev, pendingLog];
      return newLogs.slice(-200); // Keep last 200 logs
    });

    let statusCode = 0;
    let status: "success" | "error" = "error";
    let latency = 0;

    try {
      const res = await fetch("/app/sample", {
        method: "GET",
      });
      statusCode = res.status;

      const endTime = performance.now();
      latency = Math.round(endTime - startTime);

      // Update Chart Data (Only for finished requests)
      setChartData((prev) => {
        const newData = [...prev, { time: timestamp, latency }];
        return newData.slice(-200);
      });

      if (res.ok) {
        status = "success";
        setStats((prev) => ({
          ...prev,
          total: prev.total + 1,
          success: prev.success + 1,
          totalLatency: prev.totalLatency + latency,
        }));
      } else {
        status = "error";
        setStats((prev) => ({
          ...prev,
          total: prev.total + 1,
          error: prev.error + 1,
          totalLatency: prev.totalLatency + latency,
        }));
      }

      // 2. Update Log with Result
      setLogs((prev) =>
        prev.map((log) =>
          log.id === requestId
            ? {
                ...log,
                status,
                statusCode,
                message: res.ok
                  ? "Success"
                  : `Status: ${res.status} ${res.statusText}`,
                latency,
              }
            : log
        )
      );
    } catch (error) {
      const endTime = performance.now();
      latency = Math.round(endTime - startTime);
      setStats((prev) => ({
        ...prev,
        total: prev.total + 1,
        error: prev.error + 1,
        totalLatency: prev.totalLatency + latency,
      }));

      // Update Log with Error
      setLogs((prev) =>
        prev.map((log) =>
          log.id === requestId
            ? {
                ...log,
                status: "error",
                statusCode: 0,
                message: error instanceof Error ? error.message : "Network Error",
                latency,
              }
            : log
        )
      );
    }
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isRunning) {
      timer = setInterval(() => {
        sendRequest();
      }, intervalMs);
    }
    return () => clearInterval(timer);
  }, [isRunning, intervalMs, sendRequest]);

  const toggleRunning = () => {
    setIsRunning(!isRunning);
  };

  const resetStats = () => {
    setStats({ total: 0, success: 0, error: 0, totalLatency: 0 });
    setLogs([]);
    setChartData([]);
  };

  const errorRate =
    stats.total > 0 ? ((stats.error / stats.total) * 100).toFixed(2) : "0.00";
  const avgLatency =
    stats.total > 0 ? (stats.totalLatency / stats.total).toFixed(2) : "0.00";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold text-gray-900">Load Generator</h1>
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode("dashboard")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                viewMode === "dashboard"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setViewMode("network")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                viewMode === "network"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Network
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-4 w-full md:w-auto">
          <div className="flex items-center space-x-2">
            <label className="text-gray-700 text-sm font-medium whitespace-nowrap">
              Interval (ms):
            </label>
            <input
              type="number"
              min="10"
              step="10"
              value={intervalMs}
              onChange={(e) => setIntervalMs(parseInt(e.target.value) || 100)}
              disabled={isRunning}
              className="w-24 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-1.5 border"
            />
          </div>
          <div className="flex space-x-2">
            <button
              onClick={toggleRunning}
              className={`w-20 py-1.5 px-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
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
              className="w-20 py-1.5 px-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
        {viewMode === "dashboard" ? (
          <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <StatCard
                title="Total Requests"
                value={stats.total}
                color="bg-blue-50 text-blue-700"
              />
              <StatCard
                title="Success"
                value={stats.success}
                color="bg-green-50 text-green-700"
              />
              <StatCard
                title="Errors"
                value={stats.error}
                color="bg-red-50 text-red-700"
              />
              <StatCard
                title="Error Rate"
                value={`${errorRate}%`}
                color="bg-yellow-50 text-yellow-700"
              />
              <StatCard
                title="Avg Latency"
                value={`${avgLatency}ms`}
                color="bg-indigo-50 text-indigo-700"
              />
            </div>

            {/* Charts & Logs Container */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Latency Chart */}
              <div className="bg-white rounded-xl shadow-md p-6 h-96 flex flex-col">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Response Time (Last 200 requests)
                </h3>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" hide />
                      <YAxis
                        label={{
                          value: "ms",
                          angle: -90,
                          position: "insideLeft",
                        }}
                      />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="latency"
                        stroke="#8884d8"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Logs */}
              <div className="bg-white rounded-xl shadow-md overflow-hidden flex flex-col h-96">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                  <h3 className="text-lg font-medium text-gray-900">
                    Request Log (Last 200)
                  </h3>
                </div>
                <div
                  ref={logsContainerRef}
                  className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-900 text-sm font-mono"
                >
                  {logs.length === 0 && (
                    <p className="text-gray-500 text-center italic mt-4">
                      No requests sent yet.
                    </p>
                  )}
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start space-x-3 border-b border-gray-800 pb-2 last:border-0"
                    >
                      <span className="text-gray-500 shrink-0">
                        [{log.timestamp}]
                      </span>
                      <span
                        className={`font-bold shrink-0 ${
                          log.status === "success"
                            ? "text-green-400"
                            : log.status === "pending"
                            ? "text-yellow-400"
                            : "text-red-400"
                        }`}
                      >
                        {log.status.toUpperCase()}
                      </span>
                      <span className="text-gray-300 truncate flex-1">
                        {log.message}
                      </span>
                      <span className="text-gray-500 shrink-0">
                        {log.latency !== undefined ? `${log.latency}ms` : "..."}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Network View */
          <div className="bg-white rounded-lg shadow border border-gray-200 flex flex-col h-[calc(100vh-140px)]">
            {/* Network Toolbar */}
            <div className="px-4 py-2 border-b border-gray-200 bg-gray-50 flex items-center space-x-2 text-xs text-gray-600 overflow-x-auto">
              <span className="font-semibold text-gray-700">
                {logs.length} requests
              </span>
              <span>|</span>
              <span>{stats.totalLatency.toFixed(0)} ms total latency</span>
              <span>|</span>
              <span className="text-red-600">{stats.error} errors</span>
              <span>|</span>
              <span className="text-yellow-600">
                {logs.filter((l) => l.status === "pending").length} pending
              </span>
            </div>

            {/* Table Header */}
            <div className="flex text-xs font-semibold text-gray-700 bg-gray-100 border-b border-gray-200">
              <div className="w-24 px-4 py-2 border-r border-gray-200">
                Status
              </div>
              <div className="w-20 px-4 py-2 border-r border-gray-200">
                Method
              </div>
              <div className="flex-1 px-4 py-2 border-r border-gray-200">
                Name
              </div>
              <div className="w-24 px-4 py-2 border-r border-gray-200">
                Type
              </div>
              <div className="w-24 px-4 py-2 border-r border-gray-200">
                Time
              </div>
              <div className="w-48 px-4 py-2">Waterfall</div>
            </div>

            {/* Table Body */}
            <div
              ref={networkContainerRef}
              className="flex-1 overflow-y-auto bg-white"
            >
              {logs.map((log, index) => (
                <div
                  key={log.id}
                  className={`flex text-xs border-b border-gray-100 hover:bg-blue-50 ${
                    index % 2 === 0 ? "bg-white" : "bg-gray-50"
                  } ${log.status === "pending" ? "text-gray-400 italic" : ""}`}
                >
                  <div
                    className={`w-24 px-4 py-1.5 border-r border-gray-100 flex items-center ${
                      log.status === "success"
                        ? "text-green-600"
                        : log.status === "pending"
                        ? "text-gray-500"
                        : "text-red-600 font-bold"
                    }`}
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full mr-2 ${
                        log.status === "success"
                          ? "bg-green-500"
                          : log.status === "pending"
                          ? "bg-gray-300 animate-pulse"
                          : "bg-red-500"
                      }`}
                    ></span>
                    {log.status === "pending"
                      ? "Pending"
                      : log.statusCode || (log.status === "error" ? "ERR" : "")}
                  </div>
                  <div className="w-20 px-4 py-1.5 border-r border-gray-100 text-gray-600 flex items-center">
                    GET
                  </div>
                  <div
                    className="flex-1 px-4 py-1.5 border-r border-gray-100 text-gray-900 truncate flex items-center"
                    title="/app/sample"
                  >
                    sample
                    <span className="text-gray-400 ml-2 font-light">
                      /app/sample
                    </span>
                  </div>
                  <div className="w-24 px-4 py-1.5 border-r border-gray-100 text-gray-500 flex items-center">
                    json
                  </div>
                  <div className="w-24 px-4 py-1.5 border-r border-gray-100 text-gray-700 flex items-center justify-end">
                    {log.latency !== undefined ? `${log.latency} ms` : "..."}
                  </div>
                  <div className="w-48 px-4 py-1.5 flex items-center">
                    <div className="h-full w-full relative flex items-center">
                      {log.status === "pending" ? (
                        <div className="h-2.5 w-full bg-gray-100 rounded-sm animate-pulse"></div>
                      ) : (
                        <div
                          className={`h-2.5 rounded-sm ${
                            log.status === "success"
                              ? "bg-green-400"
                              : "bg-red-400"
                          }`}
                          style={{
                            width: `${Math.min(
                              ((log.latency || 0) / 500) * 100,
                              100
                            )}%`,
                          }}
                        ></div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {logs.length === 0 && (
                <div className="p-8 text-center text-gray-400">
                  Recording network activity...
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const StatCard = ({
  title,
  value,
  color,
}: {
  title: string;
  value: string | number;
  color: string;
}) => (
  <div
    className={`rounded-xl shadow-sm p-5 flex flex-col items-center justify-center text-center ${color}`}
  >
    <dt className="text-sm font-medium truncate opacity-80">{title}</dt>
    <dd className="mt-1 text-3xl font-semibold tracking-tight">{value}</dd>
  </div>
);

export default App;