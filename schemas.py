from pydantic import BaseModel
from typing import List, Optional

# --- USUARIOS ---
class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str

class UserUpdate(BaseModel):
    username: Optional[str] = None
    full_name: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None

class UserResponse(BaseModel):
    id: int
    username: str
    full_name: str
    role: str
    class Config: from_attributes = True

# --- LOGIN ---
class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    full_name: str

# --- PROCESOS ---
class ProcesoResponse(BaseModel):
    nombre: str
    criticidad: str
    class Config: from_attributes = True

# --- EVENTOS ---
class EventoCreate(BaseModel):
    tipo: str
    descripcion: str
    fecha: str
    nivel_alerta: str
    geometria: str
    sedes_afectadas_ids: List[int]

class EventoResponse(BaseModel):
    id: int
    tipo: str
    descripcion: str
    fecha: str
    nivel_alerta: str
    geometria: str
    class Config: from_attributes = True

# --- SEDES ---
class SedeCreate(BaseModel):
    nombre: str
    direccion: str
    latitud: float
    longitud: float

class SedeResponse(SedeCreate):
    id: int
    activa: bool
    procesos: List[ProcesoResponse] = []
    eventos: List[EventoResponse] = [] 
    class Config: from_attributes = True