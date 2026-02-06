from sqlalchemy import Column, Integer, String, Boolean, Float, Text, ForeignKey, Table
from sqlalchemy.orm import relationship
from database import Base

evento_sedes = Table(
    "evento_sedes",
    Base.metadata,
    Column("evento_id", Integer, ForeignKey("eventos.id")),
    Column("sede_id", Integer, ForeignKey("sedes.id"))
)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="analista")

class Sede(Base):
    __tablename__ = "sedes"
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False)
    ciudad = Column(String, default="Bogotá")
    direccion = Column(String, nullable=False)
    latitud = Column(Float, nullable=False)
    longitud = Column(Float, nullable=False)
    activa = Column(Boolean, default=True)
    procesos = relationship("Proceso", back_populates="sede", cascade="all, delete-orphan")
    eventos = relationship("Evento", secondary=evento_sedes, back_populates="sedes_relacionadas")

class Proceso(Base):
    __tablename__ = "procesos"
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False)
    criticidad = Column(String)
    rto = Column(Integer, default=4)
    rpo = Column(Integer, default=2)
    sede_id = Column(Integer, ForeignKey("sedes.id"))
    sede = relationship("Sede", back_populates="procesos")

class Evento(Base):
    __tablename__ = "eventos"
    id = Column(Integer, primary_key=True, index=True)
    tipo = Column(String)
    descripcion = Column(Text)
    fecha = Column(String)
    nivel_alerta = Column(String)
    geometria = Column(Text)
    creado_por = Column(String) # Auditoría
    sedes_relacionadas = relationship("Sede", secondary=evento_sedes, back_populates="eventos")