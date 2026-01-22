import requests

URL_BASE = "http://127.0.0.1:8000"

sedes_data = [
    {"nombre": "Colmédica Belaire", "direccion": "Cl. 153 #6-65, Bogotá", "lat": 4.729454, "lng": -74.024442},
    {"nombre": "Colmédica Bulevar Niza", "direccion": "Av. Cl. 127 #58-59, Bogotá", "lat": 4.712693, "lng": -74.071400},
    {"nombre": "Colmédica Calle 185", "direccion": "Cl. 185 #45-03, Bogotá", "lat": 4.763543, "lng": -74.046126},
    {"nombre": "Colmédica Cedritos", "direccion": "Cl. 140 #11-45, Bogotá", "lat": 4.718879, "lng": -74.036092},
    {"nombre": "Colmédica Chapinero", "direccion": "Cr. 7 #52-53, Bogotá", "lat": 4.640908, "lng": -74.063738},
    {"nombre": "Colmédica Colina Campestre", "direccion": "Cl. 151 #54-15, Bogotá", "lat": 4.733979, "lng": -74.056138},
    {"nombre": "Colmédica Country Park", "direccion": "Autopista Norte #122-96, Bogotá", "lat": 4.670067, "lng": -74.057583},
    {"nombre": "Colmédica Metrópolis", "direccion": "Av. Cra. 68 #75A-50, Bogotá", "lat": 4.681225, "lng": -74.083156},
    {"nombre": "Colmédica Multiplaza", "direccion": "Cl. 19A #72-57, Bogotá", "lat": 4.652573, "lng": -74.126290},
    {"nombre": "Colmédica Calle 93", "direccion": "Cl. 93 #19-25, Bogotá", "lat": 4.678423, "lng": -74.055263},
    {"nombre": "Colmédica Plaza Central", "direccion": "Cra. 65 #11-50, Bogotá", "lat": 4.633464, "lng": -74.116219},
    {"nombre": "Colmédica Salitre Capital", "direccion": "Av. Cl. 26 #69C-03, Bogotá", "lat": 4.660602, "lng": -74.108643},
    {"nombre": "Colmédica Sede Administrativa", "direccion": "Cl 63 #28-75, Bogotá", "lat": 4.652762, "lng": -74.076465},
    {"nombre": "Colmédica Suba", "direccion": "Av. Cl. 145 #103B-69, Bogotá", "lat": 4.749960, "lng": -74.087376},
    {"nombre": "Colmédica Torre Santa Bárbara", "direccion": "Autopista Norte #122-96, Bogotá", "lat": 4.704044, "lng": -74.053790},
    {"nombre": "Colmédica Unicentro Occidente", "direccion": "Cra. 111C #86-05, Bogotá", "lat": 4.724354, "lng": -74.114300},
    {"nombre": "Colmédica Usaquén", "direccion": "Cra. 7 #120-20, Bogotá", "lat": 4.698510, "lng": -74.030761},
    {"nombre": "Colmédica Barranquilla", "direccion": "Calle 76 # 55-52, Barranquilla", "lat": 11.004448, "lng": -74.803674},
    {"nombre": "Colmédica Bucaramanga", "direccion": "Cl 52 A 31-68, Bucaramanga", "lat": 7.115442, "lng": -73.111918},
    {"nombre": "Colmédica Cali", "direccion": "Cr 40 5C–118, Cali", "lat": 3.422273, "lng": -76.543009},
    {"nombre": "Colmédica Las Ramblas", "direccion": "CC las Ramblas, Cartagena", "lat": 10.519058, "lng": -75.466197},
    {"nombre": "Colmédica Bocagrande", "direccion": "Cr 4 # 4-78, Cartagena", "lat": 10.398251, "lng": -75.558690},
    {"nombre": "Colmédica Chía", "direccion": "Belenus Chía, Chía", "lat": 4.883582, "lng": -74.037240},
    {"nombre": "Colmédica Ibagué", "direccion": "Cra. 5 # 30-05, Ibagué", "lat": 4.443406, "lng": -75.223330},
    {"nombre": "Colmédica Manizales", "direccion": "Cr 27 A 66-30, Manizales", "lat": 5.054334, "lng": -75.484384},
    {"nombre": "Colmédica Medellín", "direccion": "Cr 43B 14-44, Medellin", "lat": 6.217569, "lng": -75.559984},
    {"nombre": "Colmédica Neiva", "direccion": "Cl 19 # 5a-50, Neiva", "lat": 2.937238, "lng": -75.287148},
    {"nombre": "Colmédica Pereira", "direccion": "Cl 19 N 12–50, Pereira", "lat": 4.805020, "lng": -75.687787},
    {"nombre": "Colmédica Villavicencio", "direccion": "Cl 32 # 40A–31, Villavicencio", "lat": 4.142414, "lng": -73.638605},
    {"nombre": "Colmédica Yopal", "direccion": "Cr 21 35-68, Yopal", "lat": 5.327695, "lng": -72.386377}
]

def poblar():
    for s in sedes_data:
        body = {"nombre": s["nombre"], "direccion": s["direccion"], "latitud": s["lat"], "longitud": s["lng"]}
        res = requests.post(f"{URL_BASE}/sedes", json=body)
        if res.status_code == 200:
            s_id = res.json()["id"]
            # Agregamos procesos críticos para que las tablas funcionen
            requests.post(f"{URL_BASE}/procesos?nombre=Urgencias&criticidad=Alta&sede_id={s_id}")
            requests.post(f"{URL_BASE}/procesos?nombre=Farmacia&criticidad=Media&sede_id={s_id}")
            print(f"✅ {s['nombre']} cargada con procesos.")

if __name__ == "__main__":
    poblar()