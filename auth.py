import bcrypt
from datetime import datetime, timedelta
from jose import jwt, JWTError
from typing import Optional

# CONFIGURACIÓN DE SEGURIDAD
SECRET_KEY = "una_clave_secreta_muy_larga_y_dificil_de_adivinar_12345"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 

# 1. Encriptar contraseña (Nueva versión sin errores)
def hash_password(password: str):
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode('utf-8')

# 2. Verificar contraseña
def verify_password(plain_password: str, hashed_password: str):
    password_byte_enc = plain_password.encode('utf-8')
    hashed_byte_enc = hashed_password.encode('utf-8')
    return bcrypt.checkpw(password_byte_enc, hashed_byte_enc)

# 3. Crear Token JWT (Se mantiene igual)
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)