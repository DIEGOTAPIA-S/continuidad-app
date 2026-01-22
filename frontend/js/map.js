// --- 1. GESTIÓN DE SESIÓN (Al principio para que siempre cargue) ---
const btnLogout = document.getElementById('btnLogout');
if (btnLogout) {
    btnLogout.onclick = function() {
        console.log("Cerrando sesión...");
        localStorage.clear(); // Borra Token, Usuario y Rol
        window.location.href = 'login.html';
    };
}

const userName = localStorage.getItem('user_name');
if (userName && document.getElementById('displayUserName')) {
    document.getElementById('displayUserName').innerText = `👤 Hola, ${userName}`;
}

// Función para cabeceras con Token
const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
});

// --- 2. INICIALIZACIÓN DEL MAPA ---
const map = L.map('map').setView([4.60971, -74.08175], 11);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

let marcadores = {}, zonas = [], grafica = null, graficaVulnerabilidad = null, featureGroup = L.featureGroup().addTo(map);

// CARGAR SEDES
async function cargarSedes() {
    try {
        const res = await fetch('http://127.0.0.1:8000/sedes', { headers: getHeaders() });
        if (res.status === 403) { window.location.href = 'login.html'; return; }
        const sedes = await res.json();
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
    const svg = `<svg width="35" height="35" viewBox="0 0 24 24"><path fill="${colors[col]}" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z"/></svg>`;
    return L.divIcon({ html: svg, className: 'custom-marker', iconSize: [35, 35], iconAnchor: [17, 35] });
}

// DIBUJO Y CLASIFICACIÓN
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

// --- 3. GENERAR RESUMEN (PANTALLA) ---
document.getElementById('btnGenerarResumen').onclick = async function(e) {
    e.preventDefault();
    const { af, cer, nor } = clasificarSedes();
    const total = af.length + cer.length + nor.length;
    if (zonas.length === 0) return alert("⚠️ Dibuja una zona primero.");

    const pAf = total > 0 ? ((af.length / total) * 100).toFixed(1) : 0;
    const pCe = total > 0 ? ((cer.length / total) * 100).toFixed(1) : 0;
    const pNo = total > 0 ? ((nor.length / total) * 100).toFixed(1) : 0;

    const alerta = document.getElementById('nivelAlerta').value, tipo = document.getElementById('tipoEvento').value, desc = document.getElementById('descripcionEvento').value;
    
    fetch('http://127.0.0.1:8000/eventos', {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ tipo, descripcion: desc, fecha: new Date().toLocaleString(), nivel_alerta: alerta, geometria: JSON.stringify(zonas[0].toGeoJSON()), sedes_afectadas_ids: af.map(n => marcadores[n].id) })
    });

    document.getElementById('panel-resultados').style.display = 'block';
    document.getElementById('infoResumen').innerHTML = `<h2>📋 Informe de Impacto: ${tipo}</h2><p><strong>Alerta:</strong> ${alerta}</p><p style="white-space:pre-line"><strong>Descripción:</strong><br>${desc}</p>`;
    document.querySelector('.stats-container').innerHTML = `<div class="stat-box rojo"><h3>${af.length}</h3>Afectadas (${pAf}%)</div><div class="stat-box amarillo"><h3>${cer.length}</h3>Cercanas (${pCe}%)</div><div class="stat-box verde"><h3>${nor.length}</h3>Normales (${pNo}%)</div>`;
    
    const ctx = document.getElementById('graficaSedes').getContext('2d');
    if (grafica) grafica.destroy();
    grafica = new Chart(ctx, { type: 'doughnut', data: { labels: [`Afectadas (${pAf}%)`, `Cercanas (${pCe}%)`, `Normales (${pNo}%)`], datasets: [{ data: [af.length, cer.length, nor.length], backgroundColor: ['#ef4444', '#f59e0b', '#10b981'] }] }, options: { maintainAspectRatio: false } });

    let resHtml = '<h3>🏢 Detalle de Sedes Impactadas</h3>';
    af.forEach(s => {
        let best = ""; let minD = Infinity;
        nor.forEach(n => { let d = marcadores[s].marker.getLatLng().distanceTo(marcadores[n].marker.getLatLng()); if (d < minD) { minD = d; best = n; } });
        resHtml += `<div class="sede-card-afectada"><strong>🔴 ${s}</strong><br><small>Sede Alterna: ${best || 'Ninguna'}</small><table class="tabla-procesos"><tr><th>Proceso</th><th>Nivel</th></tr>${marcadores[s].procesos.map(p => `<tr><td>${p.nombre}</td><td>${p.criticidad}</td></tr>`).join('')}</table></div>`;
    });
    document.getElementById('listaSedesAfectadas').innerHTML = resHtml;
    document.getElementById('panel-resultados').scrollIntoView({ behavior: 'smooth' });
};

// --- 4. EXPORTACIONES ---
document.getElementById('btnExportarHistorial').onclick = async function() {
    try {
        const res = await fetch('http://127.0.0.1:8000/eventos', { headers: getHeaders() });
        const data = await res.json();
        let csv = "\ufeffFecha,Tipo,Alerta,Descripcion\n";
        data.forEach(ev => csv += `"${ev.fecha}","${ev.tipo}","${ev.nivel_alerta}","${ev.descripcion.replace(/"/g, '""')}"\n`);
        const link = document.createElement("a");
        link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        link.download = "Historial_Emergencias.csv";
        link.click();
    } catch (e) { alert("Error al exportar"); }
};

document.getElementById('btnExportarExcel').onclick = async function() {
    try {
        const res = await fetch('http://127.0.0.1:8000/sedes', { headers: getHeaders() });
        const sedes = await res.json();
        let csv = "\ufeffSede,Direccion,Total Impactos\n";
        sedes.forEach(s => csv += `"${s.nombre}","${s.direccion}",${s.eventos.length}\n`);
        const link = document.createElement("a");
        link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        link.download = "Vulnerabilidad_Sedes.csv";
        link.click();
    } catch (e) { alert("Error al exportar"); }
};

// --- 5. MODALES Y PDF ---
document.getElementById('btnVerDashboard').onclick = async function() {
    document.getElementById('modalDashboard').style.display = 'block';
    const res = await fetch('http://127.0.0.1:8000/sedes', { headers: getHeaders() });
    const sedes = await res.json();
    setTimeout(() => {
        const ctx = document.getElementById('graficaVulnerabilidad').getContext('2d');
        if (graficaVulnerabilidad) graficaVulnerabilidad.destroy();
        graficaVulnerabilidad = new Chart(ctx, { type: 'bar', data: { labels: sedes.map(s => s.nombre), datasets: [{ label: 'Impactos', data: sedes.map(s => s.eventos.length), backgroundColor: '#3b82f6' }] }, options: { indexAxis: 'y', maintainAspectRatio: false } });
    }, 100);
};

document.getElementById('btnVerHistorial').onclick = async function() {
    document.getElementById('modalHistorial').style.display = 'block';
    const res = await fetch('http://127.0.0.1:8000/eventos', { headers: getHeaders() });
    const data = await res.json();
    document.getElementById('listaHistorialItems').innerHTML = data.reverse().map(ev => `
        <div class="historial-item">
            <div class="historial-header">
                <div><strong>${ev.tipo}</strong><br><small>${ev.fecha} [Alerta: ${ev.nivel_alerta}]</small></div>
                <div class="btn-group-historial">
                    <button class="btn-recrear" onclick="cargarEv('${ev.geometria.replace(/"/g, '&quot;')}')">📍 Ver</button>
                    <button class="btn-pdf-hist" onclick="descargarPDFIndividual('${ev.id}')">📥 PDF</button>
                </div>
            </div>
            <div class="historial-desc">${ev.descripcion}</div>
        </div>`).join('');
};

async function generarPDF(titulo, alerta, tipo, descripcion, fecha) {
    const { jsPDF } = window.jspdf; const doc = new jsPDF('p', 'mm', 'a4');
    const { af, cer, nor } = clasificarSedes();
    const total = af.length + cer.length + nor.length;
    const pAf = total > 0 ? ((af.length / total) * 100).toFixed(1) : 0;

    doc.setFillColor(15, 23, 42); doc.rect(0, 0, 210, 35, 'F');
    doc.setTextColor(255); doc.setFontSize(18); doc.text(titulo, 105, 18, { align: 'center' });

    const canvasMapa = await html2canvas(document.getElementById('map'), { useCORS: true, scale: 2 });
    doc.addImage(canvasMapa.toDataURL('image/png'), 'PNG', 10, 40, 190, 85);

    doc.setTextColor(0); doc.setFontSize(11); doc.setFont(undefined, 'bold'); doc.text("DATOS DEL EVENTO:", 15, 135);
    doc.setFont(undefined, 'normal'); doc.text(`• ALERTA: ${alerta} | • TIPO: ${tipo} | • FECHA: ${fecha}`, 15, 142);
    const splitDesc = doc.splitTextToSize(descripcion, 180); doc.text(splitDesc, 15, 150);

    let yGraf = 175 + (splitDesc.length * 4);
    if (yGraf > 230) { doc.addPage(); yGraf = 20; }
    doc.setFont(undefined, 'bold'); doc.text("ANÁLISIS DE IMPACTO:", 15, yGraf);
    const canvasGraf = await html2canvas(document.getElementById('graficaSedes'));
    doc.addImage(canvasGraf.toDataURL('image/png'), 'PNG', 130, yGraf, 60, 60);
    doc.setFont(undefined, 'normal'); doc.text(`• Sedes Afectadas: ${af.length} (${pAf}%)`, 15, yGraf + 10);
    doc.text(`• Sedes Cercanas: ${cer.length}`, 15, yGraf + 17);

    doc.addPage(); doc.text("3. DETALLE DE PROCESOS AFECTADOS", 15, 20);
    const filas = []; af.forEach(s => marcadores[s].procesos.forEach(p => filas.push([s, p.nombre, p.criticidad, marcadores[s].direccion])));
    doc.autoTable({ startY: 25, head: [['Sede', 'Proceso', 'Criticidad', 'Dirección']], body: filas, headStyles: { fillColor: [239, 68, 68] } });
    doc.save(`Reporte_${fecha.replace(/[/, :]/g, '_')}.pdf`);
}

document.getElementById('btnDescargarPDF').onclick = () => {
    const alerta = document.getElementById('nivelAlerta').value, tipo = document.getElementById('tipoEvento').value, desc = document.getElementById('descripcionEvento').value;
    generarPDF("INFORME DE CONTINUIDAD", alerta, tipo, desc, new Date().toLocaleString());
};

window.descargarPDFIndividual = async function(id) {
    const res = await fetch('http://127.0.0.1:8000/eventos', { headers: getHeaders() });
    const data = await res.json();
    const ev = data.find(e => e.id == id);
    window.cargarEv(ev.geometria);
    setTimeout(() => generarPDF("INFORME HISTÓRICO", ev.nivel_alerta, ev.tipo, ev.descripcion, ev.fecha), 1500);
};

window.cargarEv = (geo) => { featureGroup.clearLayers(); zonas = []; const l = L.geoJSON(JSON.parse(geo), { style: { color: '#ef4444', fillOpacity: 0.3 } }).addTo(featureGroup); l.eachLayer(ly => zonas.push(ly)); actualizarColoresSedes(); document.getElementById('modalHistorial').style.display = 'none'; };
document.getElementById('cerrarDashboard').onclick = () => document.getElementById('modalDashboard').style.display = 'none';
document.getElementById('cerrarHistorial').onclick = () => document.getElementById('modalHistorial').style.display = 'none';
document.getElementById('btnBuscarDireccion').onclick = function() {
    const dir = document.getElementById('direccionBuscar').value;
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(dir)}, Bogotá`).then(r => r.json()).then(d => { if(d[0]) map.setView([d[0].lat, d[0].lon], 15); });
};