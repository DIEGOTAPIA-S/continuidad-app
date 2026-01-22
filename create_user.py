from database import SessionLocal
from models import User
from auth import hash_password

def crear_usuario_inicial():
    db = SessionLocal()
    # Datos de tu primer usuario
    username = "admin"
    password = "123" # Cambia esto por lo que quieras
    full_name = "Diego Alfonso Tapia Salazar"

    # Verificar si ya existe
    user_exists = db.query(User).filter(User.username == username).first()
    if user_exists:
        print(f"⚠️ El usuario {username} ya existe.")
        return

    # Crear el nuevo usuario con la clave encriptada
    new_user = User(
        username=username,
        full_name=full_name,
        hashed_password=hash_password(password),
        role="admin"
    )

    db.add(new_user)
    db.commit()
    print(f"✅ Usuario '{username}' creado con éxito.")
    db.close()

if __name__ == "__main__":
    crear_usuario_inicial()