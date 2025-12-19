import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Music, Download, Loader2, Wifi, WifiOff } from 'lucide-react';

function App() {
  const [url, setUrl] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0); // 0 a 100
  const [statusText, setStatusText] = useState('');
  
  // ID único para esta sesión de navegador
  const clientId = useRef(Math.random().toString(36).substring(7)).current;
  const socketRef = useRef<WebSocket | null>(null);

// 1. Conectar WebSocket al iniciar la app
  useEffect(() => {
    // Nota: Cambia la URL si no estás en localhost
    const ws = new WebSocket(`ws://127.0.0.1:8000/ws/${clientId}`);
    
    ws.onopen = () => console.log("🟢 Conectado al servidor de progreso");
    
    // --- ESTA ES LA ÚNICA PARTE QUE DEBES TENER ---
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.status === 'downloading') {
        const p = parseFloat(data.percent);
        if (!isNaN(p)) {
            setProgress(p);
            // 🔥 AHORA USAMOS EL TEXTO QUE VIENE DEL BACKEND
            // Si es playlist dirá: "Descargando (1/5): 40%"
            // Si es single dirá: "Descargando: 40%"
            setStatusText(data.text || `Descargando: ${p.toFixed(1)}%`);
        }
      } else if (data.status === 'converting') {
        setProgress(100);
        setStatusText(data.text || "Finalizando...");
      } else if (data.status === 'error') {
        setStatusText("Error en el servidor");
        setIsDownloading(false);
      }
    };
    // -----------------------------------------------

    socketRef.current = ws;

    return () => ws.close();
  }, [clientId]);

  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setIsDownloading(true);
    setProgress(0);
    setStatusText('Iniciando...');

try {
// ... (dentro del try)

      const response = await axios.post(
        `http://127.0.0.1:8000/download`, 
        null, 
        {
          params: { url: url, client_id: clientId },
          responseType: 'blob' 
        }
      );

      // --- BLOQUE DE EXTRACCIÓN ROBUSTO ---
      const disposition = response.headers['content-disposition'];
      let fileName = `cancion_${clientId}.mp3`; // Nombre por defecto

      if (disposition) {
        // Caso 1: Estándar moderno (RFC 5987) -> filename*=utf-8''Nombre%20Raro.mp3
        // Este es el que te está dando problemas ahora
        const utf8Match = disposition.match(/filename\*=utf-8''(.+)/i);
        
        if (utf8Match && utf8Match[1]) {
          // decodeURIComponent convierte los %20 en espacios y %C3%B3 en ó
          fileName = decodeURIComponent(utf8Match[1].replace(/['"]/g, ''));
        } 
        // Caso 2: Estándar antiguo -> filename="NombreNormal.mp3"
        else {
          const filenameMatch = disposition.match(/filename="?([^"]+)"?/i);
          if (filenameMatch && filenameMatch[1]) {
            fileName = filenameMatch[1];
          }
        }
      }

      // IMPORTANTE: Si por alguna razón el nombre sigue sin tener extensión, se la forzamos
      if (!fileName.endsWith('.zip') && !fileName.endsWith('.mp3')) {
          fileName += '.mp3';
      }

      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
    
      setStatusText('¡Listo! ✅');
      setTimeout(() => {
        setIsDownloading(false);
        setProgress(0);
        setUrl('');
      }, 3000);

    } catch (error) {
      console.error(error);
      setStatusText('Error al descargar');
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-slate-200 font-sans">
      <div className="w-full max-w-lg bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-8 pb-6 border-b border-slate-800 bg-gradient-to-r from-slate-900 to-slate-800">
            <div className="flex justify-between items-start">
                <div className="w-14 h-14 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-4">
                    <Music className="w-7 h-7 text-white" />
                </div>
                {/* Indicador de conexión WS */}
                <div className="flex items-center gap-2 text-xs font-mono text-slate-500 bg-slate-950 px-2 py-1 rounded-md border border-slate-800">
                   ID: {clientId} <Wifi className="w-3 h-3 text-green-500" />
                </div>
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Downloader Pro</h1>
            <p className="text-slate-400 mt-1">Alta fidelidad • Tiempo Real</p>
        </div>

        {/* Body */}
        <div className="p-8">
          <form onSubmit={handleDownload} className="flex flex-col gap-6">
            <div className="relative">
                <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={isDownloading}
                    placeholder="Pega el link de YouTube aquí..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-4 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder:text-slate-600"
                />
            </div>

            {/* Barra de Progreso - Solo visible si descarga */}
            {isDownloading && (
                <div className="bg-slate-950 rounded-xl p-4 border border-slate-800/50">
                    <div className="flex justify-between text-xs font-medium text-slate-400 mb-2">
                        <span>{statusText}</span>
                        <span>{Math.round(progress)}%</span>
                    </div>
                    {/* El contenedor gris */}
                    <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                        {/* La barra de color animada */}
                        <div 
                            className="bg-indigo-500 h-2.5 rounded-full transition-all duration-300 ease-out shadow-[0_0_10px_rgba(99,102,241,0.5)]" 
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                </div>
            )}

            <button
              type="submit"
              disabled={isDownloading || !url}
              className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all transform active:scale-[0.98] ${
                isDownloading 
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-600/20'
              }`}
            >
              {isDownloading ? <Loader2 className="animate-spin" /> : <Download />}
              {isDownloading ? 'Procesando...' : 'Descargar Audio'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default App;