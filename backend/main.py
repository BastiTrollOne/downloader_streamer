import os
from uuid import uuid4
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import yt_dlp

app = FastAPI()

# --- CONFIGURACIÓN ---

# 1. CORS: Permite que tu futuro Frontend (React) se comunique con este servidor
origins = [
    "http://localhost:3000", # React default
    "http://localhost:5173", # Vite default
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Directorio de descargas
# Creamos una carpeta 'downloads' dentro de 'backend' si no existe
DOWNLOADS_DIR = os.path.join(os.getcwd(), "downloads")
os.makedirs(DOWNLOADS_DIR, exist_ok=True)

# --- LÓGICA DEL NEGOCIO ---

def download_logic(url: str):
    """
    Función síncrona que maneja yt-dlp.
    Descarga el video, extrae audio y lo convierte a MP3.
    """
    file_id = str(uuid4())
    
    # Configuración técnica de yt-dlp
    ydl_opts = {
        'format': 'bestaudio/best',
        # Plantilla de nombre: ID_Titulo.extensión (ej: a1b2_Cancion.mp3)
        'outtmpl': f'{DOWNLOADS_DIR}/{file_id}_%(title)s.%(ext)s',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'noplaylist': False, # Permitimos playlists (descargará la primera o iterará si ampliamos)
        'quiet': True,       # Menos logs basura en consola
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # 1. Extraer información antes de descargar
            info = ydl.extract_info(url, download=True)
            
            # 2. Obtener el nombre del archivo final
            # yt-dlp a veces devuelve la extensión original, así que forzamos la búsqueda del mp3
            filename = ydl.prepare_filename(info)
            final_filename = filename.rsplit('.', 1)[0] + '.mp3'
            
            return final_filename
    except Exception as e:
        print(f"Error crítico en descarga: {e}")
        raise e

def cleanup_file(path: str):
    """Tarea de fondo: Elimina el archivo del servidor después de enviarlo al usuario"""
    if os.path.exists(path):
        try:
            os.remove(path)
            print(f"✅ Limpieza: Archivo eliminado -> {path}")
        except Exception as e:
            print(f"⚠️ Error borrando archivo: {e}")

# --- ENDPOINTS ---

@app.get("/")
def read_root():
    return {"status": "online", "version": "1.0.0"}

@app.post("/download")
async def download_video(url: str, background_tasks: BackgroundTasks):
    try:
        print(f"📥 Iniciando descarga de: {url}")
        
        # Paso 1: Descargar (Esto tomará unos segundos/minutos)
        file_path = download_logic(url)
        
        # Paso 2: Verificar que el archivo existe
        if not os.path.exists(file_path):
            raise HTTPException(status_code=500, detail="Error: El archivo no se generó correctamente.")

        # Paso 3: Preparar el nombre para el navegador
        filename = os.path.basename(file_path)
        
        # Paso 4: Programar la autodestrucción del archivo (Background Task)
        background_tasks.add_task(cleanup_file, file_path)
        
        # Paso 5: Enviar el archivo al usuario
        return FileResponse(
            path=file_path, 
            filename=filename, 
            media_type='audio/mpeg'
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))