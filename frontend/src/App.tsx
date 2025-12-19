import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  Music, 
  Download, 
  Loader2, 
  Wifi, 
  Zap, 
  CheckCircle2, 
  AlertOctagon, 
  Youtube,
  Disc3
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function App() {
  const [url, setUrl] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [statusType, setStatusType] = useState<'neutral' | 'success' | 'error'>('neutral');
  
  const clientId = useRef(Math.random().toString(36).substring(7)).current;
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Ajusta la URL si despliegas en otro lado
    const ws = new WebSocket(`ws://127.0.0.1:8000/ws/${clientId}`);
    
    ws.onopen = () => console.log("🟢 Conectado al servidor de progreso");
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.status === 'downloading') {
        setStatusType('neutral');
        const p = parseFloat(data.percent);
        if (!isNaN(p)) {
            setProgress(p);
            setStatusText(data.text || `Descargando: ${p.toFixed(1)}%`);
        }
      } else if (data.status === 'converting') {
        setProgress(100);
        setStatusType('neutral');
        setStatusText(data.text || "Finalizando conversión...");
      } else if (data.status === 'error') {
        setStatusText("Error en el servidor");
        setStatusType('error');
        setIsDownloading(false);
      }
    };

    socketRef.current = ws;
    return () => ws.close();
  }, [clientId]);

  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setIsDownloading(true);
    setProgress(0);
    setStatusType('neutral');
    setStatusText('Iniciando motor de descarga...');

    try {
      const response = await axios.post(
        `http://127.0.0.1:8000/download`, 
        null, 
        {
          params: { url: url, client_id: clientId },
          responseType: 'blob' 
        }
      );

      const disposition = response.headers['content-disposition'];
      let fileName = `audio_${clientId}.mp3`;

      if (disposition) {
        const utf8Match = disposition.match(/filename\*=utf-8''(.+)/i);
        if (utf8Match && utf8Match[1]) {
          fileName = decodeURIComponent(utf8Match[1].replace(/['"]/g, ''));
        } else {
          const filenameMatch = disposition.match(/filename="?([^"]+)"?/i);
          if (filenameMatch && filenameMatch[1]) {
            fileName = filenameMatch[1];
          }
        }
      }

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
    
      setStatusType('success');
      setStatusText('¡Descarga completada con éxito!');
      
      setTimeout(() => {
        setIsDownloading(false);
        setProgress(0);
        setUrl('');
        setStatusText('');
        setStatusType('neutral');
      }, 4000);

    } catch (error) {
      console.error(error);
      setStatusText('Error al conectar con el servidor');
      setStatusType('error');
      setIsDownloading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-slate-950">
      
      {/* --- FONDO ANIMADO (Aurora Effect) --- */}
      <div className="absolute inset-0 w-full h-full pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] animate-pulse" style={{animationDelay: '1s'}} />
        <div className="absolute top-[20%] right-[20%] w-[300px] h-[300px] bg-blue-500/10 rounded-full blur-[100px]" />
      </div>

      {/* --- TARJETA PRINCIPAL (Glassmorphism) --- */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative z-10 w-full max-w-lg"
        >
        {/* Borde brillante sutil */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-3xl opacity-30 blur-sm pointer-events-none" />
        
        <div className="relative bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
          
          {/* Header */}
          <div className="p-8 pb-6 border-b border-white/5 flex flex-col items-center text-center">
            <div className="w-16 h-16 mb-4 relative">
              <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-40 animate-pulse" />
              <div className="relative w-full h-full bg-slate-800 rounded-2xl flex items-center justify-center border border-white/10 shadow-inner">
                <Music className="w-8 h-8 text-indigo-400" />
              </div>
            </div>
            
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 tracking-tight">
              Stream Downloader
            </h1>
            <p className="text-slate-400 text-sm mt-2 flex items-center gap-2">
              <Zap className="w-3 h-3 text-yellow-400" />
              Alta velocidad & Calidad Original
            </p>
            
            {/* Connection Status Badge */}
            <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/50 border border-white/5 text-[10px] font-mono text-slate-500">
              <Wifi className="w-3 h-3 text-emerald-500" />
              <span>WS: {clientId.substring(0,4)}</span>
            </div>
          </div>

          {/* Body */}
          <div className="p-8 space-y-6">
            <form onSubmit={handleDownload} className="space-y-6">
              
              {/* Input Group */}
              <div className="space-y-2 group">
                <label className="text-xs font-semibold text-slate-400 ml-1 uppercase tracking-wider">
                  Enlace de YouTube
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Youtube className={`w-5 h-5 transition-colors duration-300 ${url ? 'text-red-500' : 'text-slate-500'}`} />
                  </div>
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={isDownloading}
                    placeholder="https://youtu.be/..."
                    className="w-full pl-12 pr-4 py-4 bg-slate-950/50 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all duration-300 disabled:opacity-50"
                  />
                  {/* Glow effect on focus */}
                  <div className="absolute inset-0 rounded-xl pointer-events-none transition-opacity duration-300 opacity-0 group-focus-within:opacity-100 ring-1 ring-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.15)]" />
                </div>
              </div>

              {/* Status & Progress Area */}
              <AnimatePresence mode="wait">
                {isDownloading && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-slate-950/30 rounded-xl p-4 border border-white/5">
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-xs font-medium text-slate-300 flex items-center gap-2">
                          <Disc3 className="w-3 h-3 animate-spin" />
                          {statusText}
                        </span>
                        <span className="text-xs font-bold text-indigo-400 font-mono">
                          {Math.round(progress)}%
                        </span>
                      </div>
                      
                      {/* Custom Progress Bar */}
                      <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-gradient-to-r from-indigo-600 to-purple-600 relative"
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                        >
                          {/* Shine effect passing through */}
                          <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite]" 
                               style={{ backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)' }} 
                          />
                        </motion.div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Success/Error Messages */}
              <AnimatePresence>
                {statusType === 'success' && !isDownloading && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {statusText}
                  </motion.div>
                )}
                 {statusType === 'error' && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center justify-center gap-2"
                  >
                    <AlertOctagon className="w-4 h-4" />
                    {statusText}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Main Button */}
              <button
                type="submit"
                disabled={isDownloading || !url}
                className={`group relative w-full py-4 rounded-xl font-bold text-base transition-all duration-300 overflow-hidden 
                  ${isDownloading 
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5'
                  }`}
              >
                <div className="flex items-center justify-center gap-2 relative z-10">
                  {isDownloading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Download className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
                  )}
                  <span>{isDownloading ? 'Procesando...' : 'Descargar Ahora'}</span>
                </div>
                
                {/* Button Shine Effect */}
                {!isDownloading && (
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12" />
                )}
              </button>

            </form>
          </div>
          
          {/* Footer */}
          <div className="py-4 bg-slate-950/30 border-t border-white/5 text-center">
            <p className="text-[10px] text-slate-600 uppercase tracking-widest font-semibold">
              Desarrollado con Python FastAPI & React
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default App;