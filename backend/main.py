import os
import asyncio
import shutil
from uuid import uuid4
from typing import Dict
from fastapi import FastAPI, BackgroundTasks, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import yt_dlp

app = FastAPI()

# --- CONFIGURACIÓN ---
origins = ["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:5173"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

DOWNLOADS_DIR = os.path.join(os.getcwd(), "downloads")
os.makedirs(DOWNLOADS_DIR, exist_ok=True)

# --- GESTOR WEBSOCKETS ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, client_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[client_id] = websocket

    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]

    async def send_progress(self, client_id: str, data: dict):
        if client_id in self.active_connections:
            await self.active_connections[client_id].send_json(data)

manager = ConnectionManager()

# --- LÓGICA DE DESCARGA AVANZADA ---
def download_logic(url: str, client_id: str):
    unique_id = str(uuid4())
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    # 1. Hook de progreso (Ahora soporta info de Playlist)
    def progress_hook(d):
        if d['status'] == 'downloading':
            try:
                # Calculamos % del archivo actual
                total = d.get('total_bytes') or d.get('total_bytes_estimate')
                downloaded = d.get('downloaded_bytes', 0)
                percent = (downloaded / total) * 100 if total else 0
                
                # 🔥 Extraemos info de la playlist (si existe)
                info = d.get('info_dict', {})
                playlist_index = info.get('playlist_index')
                n_entries = info.get('n_entries')
                
                status_msg = "downloading"
                extra_info = ""
                
                if playlist_index and n_entries:
                    # Mensaje tipo: "Canción 3 de 15"
                    extra_info = f" ({playlist_index}/{n_entries})"
                
                coro = manager.send_progress(client_id, {
                    "status": status_msg, 
                    "percent": f"{percent:.1f}",
                    "text": f"Descargando{extra_info}: {percent:.1f}%"
                })
                asyncio.run_coroutine_threadsafe(coro, main_loop)
            except Exception:
                pass
        
        elif d['status'] == 'finished':
            coro = manager.send_progress(client_id, {"status": "converting", "percent": "100", "text": "Procesando audio..."})
            asyncio.run_coroutine_threadsafe(coro, main_loop)

    # 2. Configuración base de yt-dlp
    ydl_opts = {
        'format': 'bestaudio/best',
        'postprocessors': [{'key': 'FFmpegExtractAudio','preferredcodec': 'mp3','preferredquality': '192'}],
        'noplaylist': False, # 🔥 Permitimos playlists explícitamente
        'quiet': True,
        'progress_hooks': [progress_hook],
    }

    try:
        # 🔥 Paso Crítico: Analizar antes de descargar
        with yt_dlp.YoutubeDL({'quiet': True}) as ydl_analyzer:
            info_dict = ydl_analyzer.extract_info(url, download=False)
            
        is_playlist = 'entries' in info_dict
        title = info_dict.get('title', 'audio')

        if is_playlist:
            # === MODO PLAYLIST (ZIP) ===
            
            # A. Crear carpeta temporal única para esta descarga
            playlist_folder = os.path.join(DOWNLOADS_DIR, f"{unique_id}_{title}")
            os.makedirs(playlist_folder, exist_ok=True)
            
            # B. Actualizar salida para guardar DENTRO de la carpeta
            ydl_opts['outtmpl'] = f'{playlist_folder}/%(title)s.%(ext)s'
            
            # C. Descargar todo
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])
                
            # D. Crear ZIP de la carpeta
            shutil.make_archive(playlist_folder, 'zip', playlist_folder)
            zip_path = playlist_folder + ".zip"
            
            # E. Borrar la carpeta con los mp3 sueltos (ya tenemos el zip)
            shutil.rmtree(playlist_folder)
            
            return zip_path
            
        else:
            # === MODO SINGLE (MP3) ===
            ydl_opts['outtmpl'] = f'{DOWNLOADS_DIR}/{unique_id}_%(title)s.%(ext)s'
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                filename = ydl.prepare_filename(info)
                final_filename = filename.rsplit('.', 1)[0] + '.mp3'
                return final_filename

    except Exception as e:
        raise e

def cleanup_file(path: str):
    if os.path.exists(path):
        os.remove(path)

# --- ENDPOINTS ---
@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(client_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(client_id)

main_loop = None

@app.on_event("startup")
async def startup_event():
    global main_loop
    main_loop = asyncio.get_running_loop()

@app.post("/download")
async def download_video(url: str, client_id: str, background_tasks: BackgroundTasks):
    try:
        # Ejecutar en hilo aparte
        file_path = await asyncio.to_thread(download_logic, url, client_id)
        
        filename = os.path.basename(file_path)
        
        # Determinar Content-Type correcto (Zip o Mp3)
        media_type = 'application/zip' if filename.endswith('.zip') else 'audio/mpeg'
        
        background_tasks.add_task(cleanup_file, file_path)
        
        return FileResponse(path=file_path, filename=filename, media_type=media_type)
    except Exception as e:
        await manager.send_progress(client_id, {"status": "error"})
        raise HTTPException(status_code=500, detail=str(e))