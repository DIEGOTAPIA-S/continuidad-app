from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from database import Base, engine, SessionLocal
from models import Sede, Evento, Proceso, User
from schemas import (SedeCreate, SedeResponse, EventoCreate, EventoResponse, 
                     UserCreate, UserResponse, UserLogin, Token, UserUpdate)
from auth import hash_password, verify_password, create_access_token, SECRET_KEY, ALGORITHM
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from typing import List

app = FastAPI(title="Sistema de Continuidad Pro")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
Base.metadata.create_all(bind=engine)

security = HTTPBearer()

def get_current_user(res: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(res.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(status_code=403, detail="Sesión expirada")

def get_admin_user(res: HTTPAuthorizationCredentials = Depends(security)):
    payload = get_current_user(res)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Acceso denegado: Se requiere rol de Administrador")
    return payload

def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()

# --- LOGIN ---
@app.post("/login", response_model=Token)
def login(user_data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == user_data.username).first()
    if not user or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    token = create_access_token(data={"sub": user.username, "role": user.role})
    return {"access_token": token, "token_type": "bearer", "role": user.role, "full_name": user.full_name}

# --- CRUD USUARIOS (SOLO ADMIN) ---
@app.get("/admin/users", response_model=List[UserResponse])
def listar_usuarios(db: Session = Depends(get_db), admin=Depends(get_admin_user)):
    return db.query(User).all()

@app.post("/admin/users", response_model=UserResponse)
def crear_usuario(user: UserCreate, db: Session = Depends(get_db), admin=Depends(get_admin_user)):
    new_user = User(username=user.username, full_name=user.full_name, hashed_password=hash_password(user.password), role="analista")
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.put("/admin/users/{user_id}")
def editar_usuario(user_id: int, data: UserUpdate, db: Session = Depends(get_db), admin=Depends(get_admin_user)):
    user = db.query(User).filter(User.id == user_id).first()
    if data.username: user.username = data.username
    if data.full_name: user.full_name = data.full_name
    if data.role: user.role = data.role
    if data.password: user.hashed_password = hash_password(data.password)
    db.commit()
    return {"status": "ok"}

@app.delete("/admin/users/{user_id}")
def borrar_usuario(user_id: int, db: Session = Depends(get_db), admin=Depends(get_admin_user)):
    db.query(User).filter(User.id == user_id).delete()
    db.commit()
    return {"status": "ok"}

# --- CRUD SEDES (SOLO ADMIN) ---
@app.get("/sedes", response_model=List[SedeResponse])
def listar_sedes(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(Sede).options(joinedload(Sede.procesos), joinedload(Sede.eventos)).all()

@app.post("/sedes", response_model=SedeResponse)
def crear_sede(sede: SedeCreate, db: Session = Depends(get_db), admin=Depends(get_admin_user)):
    nueva = Sede(**sede.model_dump())
    db.add(nueva)
    db.commit()
    db.refresh(nueva)
    return nueva

@app.put("/sedes/{sede_id}")
def editar_sede(sede_id: int, sede: SedeCreate, db: Session = Depends(get_db), admin=Depends(get_admin_user)):
    db_sede = db.query(Sede).filter(Sede.id == sede_id).first()
    db_sede.nombre, db_sede.direccion = sede.nombre, sede.direccion
    db_sede.latitud, db_sede.longitud = sede.latitud, sede.longitud
    db.commit()
    return {"status": "ok"}

@app.delete("/sedes/{sede_id}")
def borrar_sede(sede_id: int, db: Session = Depends(get_db), admin=Depends(get_admin_user)):
    db.query(Sede).filter(Sede.id == sede_id).delete()
    db.commit()
    return {"status": "ok"}

# --- PROCESOS Y EVENTOS ---
@app.post("/procesos")
def crear_proceso(nombre: str, criticidad: str, sede_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    db.add(Proceso(nombre=nombre, criticidad=criticidad, sede_id=sede_id))
    db.commit()
    return {"status": "ok"}

@app.post("/eventos", response_model=EventoResponse)
def guardar_evento(evento: EventoCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    nuevo = Evento(tipo=evento.tipo, descripcion=evento.descripcion, fecha=evento.fecha, nivel_alerta=evento.nivel_alerta, geometria=evento.geometria)
    sedes = db.query(Sede).filter(Sede.id.in_(evento.sedes_afectadas_ids)).all()
    nuevo.sedes_relacionadas = sedes
    db.add(nuevo)
    db.commit()
    return nuevo

@app.get("/eventos", response_model=List[EventoResponse])
def listar_eventos(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(Evento).all()