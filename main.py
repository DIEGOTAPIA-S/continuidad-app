from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from database import Base, engine, SessionLocal
from models import Sede, Evento, Proceso, User
from schemas import (SedeCreate, SedeResponse, EventoCreate, EventoResponse, 
                     UserCreate, UserResponse, UserLogin, Token, UserUpdate, ProcesoCreate)
from auth import hash_password, verify_password, create_access_token, SECRET_KEY, ALGORITHM
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from typing import List

app = FastAPI(title="Continuidad Pro BIA")
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
        raise HTTPException(status_code=403, detail="Acceso denegado: Se requiere Administrador")
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
        raise HTTPException(status_code=401, detail="Error de credenciales")
    token = create_access_token(data={"sub": user.username, "role": user.role})
    return {"access_token": token, "token_type": "bearer", "role": user.role, "full_name": user.full_name}

# --- SEDES ---
@app.get("/sedes", response_model=List[SedeResponse])
def listar_sedes(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(Sede).options(joinedload(Sede.procesos), joinedload(Sede.eventos)).all()

@app.post("/sedes", response_model=SedeResponse)
def crear_sede(sede: SedeCreate, db: Session = Depends(get_db), admin=Depends(get_admin_user)):
    nueva = Sede(**sede.model_dump()); db.add(nueva); db.commit(); db.refresh(nueva); return nueva

@app.put("/sedes/{id}")
def editar_sede(id: int, s: SedeCreate, db: Session = Depends(get_db), admin=Depends(get_admin_user)):
    db_s = db.query(Sede).filter(Sede.id == id).first()
    if not db_s: raise HTTPException(status_code=404)
    db_s.nombre, db_s.direccion, db_s.latitud, db_s.longitud = s.nombre, s.direccion, s.latitud, s.longitud
    db.commit(); return {"ok":True}

@app.delete("/sedes/{id}")
def borrar_sede(id: int, db: Session = Depends(get_db), admin=Depends(get_admin_user)):
    db.query(Sede).filter(Sede.id == id).delete(); db.commit(); return {"ok":True}

# --- PROCESOS ---
@app.post("/procesos")
def crear_proceso(p: ProcesoCreate, db: Session = Depends(get_db), admin=Depends(get_admin_user)):
    db.add(Proceso(**p.model_dump())); db.commit(); return {"ok":True}

@app.delete("/procesos/{p_id}")
def borrar_proceso(p_id: int, db: Session = Depends(get_db), admin=Depends(get_admin_user)):
    db.query(Proceso).filter(Proceso.id == p_id).delete(); db.commit(); return {"ok":True}

# --- USUARIOS ---
@app.get("/admin/users", response_model=List[UserResponse])
def list_u(db: Session = Depends(get_db), admin=Depends(get_admin_user)): return db.query(User).all()

@app.post("/admin/users", response_model=UserResponse)
def admin_create_user(user: UserCreate, db: Session = Depends(get_db), admin=Depends(get_admin_user)):
    new = User(username=user.username, full_name=user.full_name, hashed_password=hash_password(user.password), role="analista")
    db.add(new); db.commit(); db.refresh(new); return new

@app.put("/admin/users/{id}")
def edit_u(id: int, data: UserUpdate, db: Session = Depends(get_db), admin=Depends(get_admin_user)):
    u = db.query(User).filter(User.id == id).first()
    if not u: raise HTTPException(status_code=404)
    if data.username: u.username = data.username
    if data.full_name: u.full_name = data.full_name
    if data.role: u.role = data.role
    if data.password: u.hashed_password = hash_password(data.password)
    db.commit(); return {"ok":True}

@app.delete("/admin/users/{id}")
def del_u(id: int, db: Session = Depends(get_db), admin=Depends(get_admin_user)):
    db.query(User).filter(User.id == id).delete(); db.commit(); return {"ok":True}

# --- EVENTOS ---
@app.post("/eventos", response_model=EventoResponse)
def save_ev(ev: EventoCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    new = Evento(tipo=ev.tipo, descripcion=ev.descripcion, fecha=ev.fecha, nivel_alerta=ev.nivel_alerta, geometria=ev.geometria)
    new.sedes_relacionadas = db.query(Sede).filter(Sede.id.in_(ev.sedes_afectadas_ids)).all()
    db.add(new); db.commit(); return new

@app.get("/eventos", response_model=List[EventoResponse])
def list_ev(db: Session = Depends(get_db), user=Depends(get_current_user)): return db.query(Evento).all()