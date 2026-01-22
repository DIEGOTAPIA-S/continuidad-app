from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from database import Base, engine, SessionLocal
from models import Sede, Evento, Proceso, User
from schemas import (SedeCreate, SedeResponse, EventoCreate, EventoResponse, 
                     UserCreate, UserResponse, UserLogin, Token)
from auth import hash_password, verify_password, create_access_token, SECRET_KEY, ALGORITHM
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from typing import List

app = FastAPI(title="Sistema de Continuidad Pro - Protegido")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

# --- SEGURIDAD ---
security = HTTPBearer()

def get_current_user(res: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(res.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sesión inválida o expirada. Por favor inicie sesión de nuevo."
        )

def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()

# --- LOGIN (Público) ---
@app.post("/login", response_model=Token)
def login(user_data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == user_data.username).first()
    if not user or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")
    
    access_token = create_access_token(data={"sub": user.username, "role": user.role})
    return {
        "access_token": access_token, 
        "token_type": "bearer", 
        "role": user.role, 
        "full_name": user.full_name
    }

# --- SEDES (Protegido) ---
@app.get("/sedes", response_model=List[SedeResponse])
def listar_sedes(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(Sede).options(joinedload(Sede.procesos), joinedload(Sede.eventos)).all()

@app.post("/sedes", response_model=SedeResponse)
def crear_sede(sede: SedeCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    nueva = Sede(**sede.model_dump())
    db.add(nueva)
    db.commit()
    db.refresh(nueva)
    return nueva

# --- PROCESOS (Protegido) ---
@app.post("/procesos")
def crear_proceso(nombre: str, criticidad: str, sede_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    db.add(Proceso(nombre=nombre, criticidad=criticidad, sede_id=sede_id))
    db.commit()
    return {"status": "ok"}

# --- EVENTOS (Protegido) ---
@app.post("/eventos", response_model=EventoResponse)
def guardar_evento(evento: EventoCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    nuevo = Evento(tipo=evento.tipo, descripcion=evento.descripcion, fecha=evento.fecha, 
                   nivel_alerta=evento.nivel_alerta, geometria=evento.geometria)
    sedes = db.query(Sede).filter(Sede.id.in_(evento.sedes_afectadas_ids)).all()
    nuevo.sedes_relacionadas = sedes
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo

@app.get("/eventos", response_model=List[EventoResponse])
def listar_eventos(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(Evento).all()