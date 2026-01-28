// --- 1. CONFIGURACIÓN INICIAL ---
const map = L.map('map').setView([4.60971, -74.08175], 11);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
let marcadores = {}, zonas = [], grafica = null, graficaVulnerabilidad = null, featureGroup = L.featureGroup().addTo(map), modoCaptura = false;

const getHeaders = () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` });

// SESIÓN
const userName = localStorage.getItem('user_name');
if (userName) document.getElementById('displayUserName').innerText = `👤 Hola, ${userName}`;
document.getElementById('btnLogout').onclick = () => { if(confirm("¿Cerrar sesión?")) { localStorage.clear(); window.location.href = 'login.html'; } };

// CARGAR SEDES
async function cargarSedes() {
    try {
        const res = await fetch('http://127.0.0.1:8000/sedes', { headers: getHeaders() });
        const sedes = await res.json();
        for (let n in marcadores) map.removeLayer(marcadores[n].marker);
        marcadores = {};
        sedes.forEach(s => {
            const marker = L.marker([s.latitud, s.longitud], { icon: crearIcono('blue') }).addTo(map);
            marker.bindPopup(`<b>${s.nombre}</b><br>📍 ${s.direccion}`);
            marcadores[s.nombre] = { id: s.id, marker, direccion: s.direccion, procesos: s.procesos || [], eventos: s.eventos || [] };
        });
    } catch (e) { console.warn("Offline"); }
}
cargarSedes();

function crearIcono(col) {
    const colors = { red: '#ef4444', yellow: '#f59e0b', blue: '#3b82f6', green: '#10b981' };
    return L.divIcon({ html: `<svg width="35" height="35" viewBox="0 0 24 24"><path fill="${colors[col]}" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z"/></svg>`, className: 'custom-marker', iconSize: [35, 35], iconAnchor: [17, 35] });
}

// DIBUJO
const drawControl = new L.Control.Draw({ draw: { circle:true, polygon:true, rectangle:true, marker:false, polyline:false }, edit: { featureGroup } });
map.addControl(drawControl);
map.on(L.Draw.Event.CREATED, (e) => { featureGroup.addLayer(e.layer); zonas.push(e.layer); actualizarColoresSedes(); });
map.on(L.Draw.Event.DELETED, () => { zonas = []; featureGroup.eachLayer(l => zonas.push(l)); actualizarColoresSedes(); });

function puntoEnPoligono(p, poly) {
    const vs = poly.getLatLngs()[0]; let x = p.lat, y = p.lng, inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        if (((vs[i].lng > y) != (vs[j].lng > y)) && (x < (vs[j].lat - vs[i].lat) * (y - vs[i].lng) / (vs[j].lng - vs[i].lng) + vs[i].lat)) inside = !inside;
    }
    return inside;
}

function clasificarSedes() {
    const af = [], cer = [], nor = [];
    for (let n in marcadores) {
        let pos = marcadores[n].marker.getLatLng(), inside = false, dMin = Infinity;
        zonas.forEach(z => {
            if (z instanceof L.Circle) {
                let d = z.getLatLng().distanceTo(pos);
                if (d <= z.getRadius()) inside = true;
                dMin = Math.min(dMin, d - z.getRadius());
            } else {
                if (puntoEnPoligono(pos, z)) inside = true;
                dMin = Math.min(dMin, z.getBounds().getCenter().distanceTo(pos));
            }
        });
        if (inside) af.push(n); else if (dMin <= 2000) cer.push(n); else nor.push(n);
    }
    return { af, cer, nor };
}

function actualizarColoresSedes() {
    const { af, cer } = clasificarSedes();
    for (let n in marcadores) marcadores[n].marker.setIcon(crearIcono(af.includes(n) ? 'red' : (cer.includes(n) ? 'yellow' : 'green')));
}

// GENERAR RESUMEN (CON PORCENTAJES Y TABLAS)
document.getElementById('btnGenerarResumen').onclick = async function(e) {
    e.preventDefault();
    const { af, cer, nor } = clasificarSedes();
    const total = af.length + cer.length + nor.length;
    if (zonas.length === 0) return alert("⚠️ Dibuja una zona primero.");
    const pAf = total > 0 ? ((af.length / total) * 100).toFixed(1) : 0;
    const pCe = total > 0 ? ((cer.length / total) * 100).toFixed(1) : 0;
    const pNo = total > 0 ? ((nor.length / total) * 100).toFixed(1) : 0;
    const alerta = document.getElementById('nivelAlerta').value, tipo = document.getElementById('tipoEvento').value, desc = document.getElementById('descripcionEvento').value;
    
    fetch('http://127.0.0.1:8000/eventos', { method: 'POST', headers: getHeaders(), body: JSON.stringify({ tipo, descripcion: desc, fecha: new Date().toLocaleString(), nivel_alerta: alerta, geometria: JSON.stringify(zonas[0].toGeoJSON()), sedes_afectadas_ids: af.map(n => marcadores[n].id) }) });

    document.getElementById('panel-resultados').style.display = 'block';
    document.getElementById('infoResumen').innerHTML = `<h2>📋 Informe de Impacto: ${tipo}</h2><p><strong>Alerta:</strong> ${alerta}</p><p style="white-space:pre-line"><strong>Descripción del Evento:</strong><br>${desc}</p>`;
    document.querySelector('.stats-container').innerHTML = `<div class="stat-box rojo"><h3>${af.length}</h3>Afectadas (${pAf}%)</div><div class="stat-box amarillo"><h3>${cer.length}</h3>Cercanas (${pCe}%)</div><div class="stat-box verde"><h3>${nor.length}</h3>Normales (${pNo}%)</div>`;
    
    const ctx = document.getElementById('graficaSedes').getContext('2d');
    if (grafica) grafica.destroy();
    grafica = new Chart(ctx, { type: 'doughnut', data: { labels: [`Afectadas (${pAf}%)`, `Cercanas (${pCe}%)`, `Normales (${pNo}%)`], datasets: [{ data: [af.length, cer.length, nor.length], backgroundColor: ['#ef4444', '#f59e0b', '#10b981'] }] }, options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } } });

    let resHtml = '<h3>🏢 Detalle de Sedes Impactadas y Procesos BIA</h3>';
    af.forEach(s => {
        let best = ""; let minD = Infinity;
        nor.forEach(n => { let d = marcadores[s].marker.getLatLng().distanceTo(marcadores[n].marker.getLatLng()); if (d < minD) { minD = d; best = n; } });
        resHtml += `<div class="sede-card-afectada"><strong>🔴 ${s}</strong><br><small>Sede Alterna Sugerida: ${best || 'Ninguna'}</small><table class="tabla-procesos"><tr><th>Proceso</th><th>Nivel</th><th>RTO</th><th>RPO</th></tr>${marcadores[s].procesos.map(p => `<tr><td>${p.nombre}</td><td>${p.criticidad}</td><td>${p.rto}h</td><td>${p.rpo}h</td></tr>`).join('')}</table></div>`;
    });
    document.getElementById('listaSedesAfectadas').innerHTML = resHtml;
    document.getElementById('panel-resultados').scrollIntoView({ behavior: 'smooth' });
};

// --- BUSCADOR DE DIRECCIÓN ---
document.getElementById('btnBuscarDireccion').onclick = function() {
    const dir = document.getElementById('direccionBuscar').value;
    if(!dir) return alert("Escribe una dirección");
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(dir)}, Bogotá`)
        .then(r => r.json()).then(data => {
            if(data[0]) {
                const latlng = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
                map.setView(latlng, 15);
                L.marker(latlng).addTo(map).bindPopup(`Ubicación buscada: ${dir}`).openPopup();
            } else { alert("No se encontró la dirección."); }
        });
};

// --- PDF PROFESIONAL ---
async function generarPDFMaster(tituloDoc, alerta, tipo, descripcion, fecha) {
    const { jsPDF } = window.jspdf; const doc = new jsPDF('p', 'mm', 'a4');
    const { af, cer, nor } = clasificarSedes();
    const total = af.length + cer.length + nor.length;
    const pAf = total > 0 ? ((af.length / total) * 100).toFixed(1) : 0;

    doc.setFillColor(15, 23, 42); doc.rect(0, 0, 210, 35, 'F');
    doc.setTextColor(255); doc.setFontSize(18); doc.text(tituloDoc, 105, 20, { align: 'center' });

    const canvasMapa = await html2canvas(document.getElementById('map'), { useCORS: true, scale: 2 });
    doc.addImage(canvasMapa.toDataURL('image/png'), 'PNG', 10, 40, 190, 85);

    doc.setTextColor(0); doc.setFontSize(11); doc.setFont(undefined, 'bold');
    doc.text("DATOS DEL EVENTO:", 15, 135);
    doc.setFont(undefined, 'normal'); doc.text(`• NIVEL DE ALERTA: ${alerta} | • TIPO: ${tipo} | • FECHA: ${fecha}`, 15, 142);
    const splitDesc = doc.splitTextToSize(descripcion || "Sin descripción.", 180); doc.text(splitDesc, 15, 150);

    let yGraf = 185 + (splitDesc.length * 4);
    if (yGraf > 230) { doc.addPage(); yGraf = 20; }
    doc.setFont(undefined, 'bold'); doc.text("ANÁLISIS DE IMPACTO:", 15, yGraf);
    const canvasGraf = await html2canvas(document.getElementById('graficaSedes'));
    doc.addImage(canvasGraf.toDataURL('image/png'), 'PNG', 130, yGraf, 60, 60);
    doc.setFont(undefined, 'normal'); doc.text(`• Sedes Afectadas: ${af.length} (${pAf}%)`, 15, yGraf + 10);
    doc.text(`• Sedes Cercanas: ${cer.length}`, 15, yGraf + 17);

    doc.addPage();
    doc.text("3. DETALLE DE PROCESOS CRÍTICOS IMPACTADOS (BIA)", 15, 20);
    const filas = []; af.forEach(s => marcadores[s].procesos.forEach(p => filas.push([s, p.nombre, p.criticidad, p.rto+'h', p.rpo+'h', marcadores[s].direccion])));
    doc.autoTable({ startY: 25, head: [['Sede', 'Proceso', 'Nivel', 'RTO', 'RPO', 'Dirección']], body: filas, headStyles: { fillColor: [239, 68, 68] } });
    doc.save(`Reporte_Continuidad_${fecha.replace(/[/, :]/g, '_')}.pdf`);
}

document.getElementById('btnDescargarPDF').onclick = () => { generarPDFMaster("INFORME DE CONTINUIDAD ACTUAL", document.getElementById('nivelAlerta').value, document.getElementById('tipoEvento').value, document.getElementById('descripcionEvento').value, new Date().toLocaleString()); };

window.descargarPDFHistorico = async function(id) {
    const res = await fetch('http://127.0.0.1:8000/eventos', { headers: getHeaders() });
    const data = await res.json();
    const ev = data.find(e => e.id == id);
    setTimeout(() => generarPDFMaster("INFORME HISTÓRICO DE EMERGENCIA", ev.nivel_alerta, ev.tipo, ev.descripcion, ev.fecha), 100);
};

// --- ADMIN CRUD ---
if (localStorage.getItem('role') === 'admin') document.getElementById('btnAdmin').style.display = 'block';
window.switchTab = (id) => { document.querySelectorAll('.admin-tab').forEach(t => t.style.display='none'); document.getElementById(id).style.display='block'; };
window.iniciarCapturaMapa = () => { modoCaptura = true; document.getElementById('modalAdmin').style.display = 'none'; alert("📍 Haz clic en el mapa."); };
map.on('click', function(e) { if (modoCaptura) { document.getElementById('adm_sede_lat').value = e.latlng.lat.toFixed(6); document.getElementById('adm_sede_lng').value = e.latlng.lng.toFixed(6); document.getElementById('modalAdmin').style.display = 'block'; modoCaptura = false; } });

async function cargarDatosAdmin() {
    const headers = getHeaders();
    const resU = await fetch('http://127.0.0.1:8000/admin/users', { headers });
    const users = await resU.json();
    document.getElementById('listaUsuariosAdmin').innerHTML = users.map(u => `<div class="historial-item"><span>${u.full_name}</span><div style="display:flex; gap:5px"><button onclick="prepararEdicionUser(${u.id},'${u.full_name}','${u.username}','${u.role}')" style="width:auto; background:orange;">Edit</button><button onclick="borrarUsuario(${u.id})">X</button></div></div>`).join('');
    const resS = await fetch('http://127.0.0.1:8000/sedes', { headers });
    const sedes = await resS.json();
    document.getElementById('listaSedesAdmin').innerHTML = sedes.map(s => `<div class="historial-item"><span>${s.nombre}</span><div style="display:flex; gap:5px"><button onclick="prepararEdicionSede(${s.id},'${s.nombre}','${s.direccion}',${s.latitud},${s.longitud})" style="width:auto; background:orange;">Edit</button><button onclick="borrarSede(${s.id})">X</button></div></div>`).join('');
    document.getElementById('sel_sede_proceso').innerHTML = sedes.map(s => `<option value="${s.id}">${s.nombre}</option>`).join('');
}

window.guardarSede = async () => {
    const id = document.getElementById('adm_sede_id').value;
    const body = { nombre: document.getElementById('adm_sede_nom').value, direccion: document.getElementById('adm_sede_dir').value, latitud: parseFloat(document.getElementById('adm_sede_lat').value), longitud: parseFloat(document.getElementById('adm_sede_lng').value) };
    const method = id ? 'PUT' : 'POST';
    const url = id ? `http://127.0.0.1:8000/sedes/${id}` : `http://127.0.0.1:8000/sedes`;
    if(confirm("¿Guardar?")) { await fetch(url, { method, headers: getHeaders(), body: JSON.stringify(body) }); alert("✅ Éxito"); cargarDatosAdmin(); cargarSedes(); }
};

window.guardarProceso = async () => {
    const body = { nombre: document.getElementById('proc_nombre').value, criticidad: document.getElementById('proc_crit').value, rto: parseInt(document.getElementById('proc_rto').value), rpo: parseInt(document.getElementById('proc_rpo').value), sede_id: parseInt(document.getElementById('sel_sede_proceso').value) };
    await fetch('http://127.0.0.1:8000/procesos', { method: 'POST', headers: getHeaders(), body: JSON.stringify(body) });
    alert("✅ Proceso añadido"); cargarSedes(); cargarDatosAdmin();
};

document.getElementById('btnAdmin').onclick = () => { document.getElementById('modalAdmin').style.display = 'block'; cargarDatosAdmin(); };
document.getElementById('cerrarAdmin').onclick = () => document.getElementById('modalAdmin').style.display = 'none';
document.getElementById('btnVerDashboard').onclick = async function() {
    const modal = document.getElementById('modalDashboard');
    modal.style.display = 'block'; // Mostramos el modal primero
    
    try {
        const res = await fetch('http://127.0.0.1:8000/sedes', { headers: getHeaders() });
        const sedes = await res.json();

        // Esperamos 200ms para que el navegador dibuje el modal antes de crear la gráfica
        setTimeout(() => {
            const ctx = document.getElementById('graficaVulnerabilidad').getContext('2d');
            
            // Si ya existía una gráfica, la borramos para crear la nueva
            if (graficaVulnerabilidad) graficaVulnerabilidad.destroy();

            graficaVulnerabilidad = new Chart(ctx, { 
                type: 'bar', 
                data: { 
                    labels: sedes.map(s => s.nombre), 
                    datasets: [{ 
                        label: 'Número de Impactos Históricos', 
                        data: sedes.map(s => s.eventos ? s.eventos.length : 0), 
                        backgroundColor: '#3b82f6',
                        borderRadius: 5
                    }] 
                }, 
                options: { 
                    indexAxis: 'y', 
                    maintainAspectRatio: false, // Obliga a la gráfica a llenar el contenedor
                    responsive: true,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { beginAtZero: true, ticks: { stepSize: 1 } }
                    }
                } 
            });
        }, 200);
    } catch (e) { console.error("Error al cargar Dashboard:", e); }
};
document.getElementById('btnVerHistorial').onclick = async function() {
    document.getElementById('modalHistorial').style.display = 'block';
    const res = await fetch('http://127.0.0.1:8000/eventos', { headers: getHeaders() });
    const data = await res.json();
    document.getElementById('listaHistorialItems').innerHTML = data.reverse().map(ev => `<div class="historial-item"><div><strong>${ev.tipo}</strong><br><small>${ev.fecha}</small></div><button class="btn-success" style="width:auto; padding:5px 10px; margin:0" onclick="descargarPDFHistorico('${ev.id}')">📥 PDF</button></div>`).join('');
};
document.getElementById('cerrarDashboard').onclick = () => document.getElementById('modalDashboard').style.display = 'none';
document.getElementById('cerrarHistorial').onclick = () => document.getElementById('modalHistorial').style.display = 'none';