import { useState } from 'react';
import axios from 'axios';
import { Music, Download, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function App() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setIsLoading(true);
    setStatus('idle');
    setMessage('Procesando audio en el servidor... (Esto puede tardar unos segundos)');

    try {
      // 1. Petición al Backend (FastAPI)
      // IMPORTANTE: responseType: 'blob' es crucial para manejar archivos binarios
      const response = await axios.post(
        'http://127.0.0.1:8000/download', 
        null, 
        {
          params: { url: url },
          responseType: 'blob' 
        }
      );

      // 2. Truco del DOM para descargar el archivo recibido
      // Creamos una URL temporal en memoria que apunta al blob (el mp3)
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      
      // Intentamos extraer el nombre del archivo de los headers (si el backend lo envía)
      // O usamos un genérico
      const contentDisposition = response.headers['content-disposition'];
      let fileName = 'audio_descargado.mp3';
      if (contentDisposition) {
        const fileNameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (fileNameMatch && fileNameMatch.length === 2) fileName = fileNameMatch[1];
      }
      
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click(); // Click virtual
      
      // 3. Limpieza
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
      
      setStatus('success');
      setMessage('¡Descarga completada!');
      setUrl(''); // Limpiar input
    } catch (error: any) {
      console.error(error);
      setStatus('error');
      // Si el error viene del backend (blob), hay que leerlo diferente
      setMessage('Error al descargar. Verifica que el link sea válido o público.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-800 rounded-2xl shadow-xl overflow-hidden border border-slate-700">
        
        {/* Header */}
        <div className="bg-slate-900 p-6 text-center border-b border-slate-700">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-blue-500/30">
            <Music className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">PY Stream Downloader</h1>
          <p className="text-slate-400 text-sm mt-1">Ingeniería de descargas YT a MP3</p>
        </div>

        {/* Body */}
        <div className="p-8">
          <form onSubmit={handleDownload} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 ml-1">URL del Video / Canción</label>
              <input
                type="text"
                placeholder="https://youtube.com/watch?v=..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isLoading}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !url}
              className={`w-full py-3.5 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all transform active:scale-95 ${
                isLoading || !url
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Procesando & Convirtiendo...</span>
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  <span>Descargar MP3</span>
                </>
              )}
            </button>
          </form>

          {/* Status Messages */}
          <AnimatePresence mode='wait'>
            {status === 'success' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-3 text-green-400"
              >
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <p className="text-sm font-medium">{message}</p>
              </motion.div>
            )}

            {status === 'error' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400"
              >
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="text-sm font-medium">{message}</p>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Info Footer */}
          <div className="mt-8 text-center text-xs text-slate-500">
            <p>Powered by FastAPI & React</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;