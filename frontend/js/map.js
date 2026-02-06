// --- 1. CONFIGURACIÓN INICIAL ---
const map = L.map('map').setView([4.60971, -74.08175], 11);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
let marcadores = {}, zonas = [], grafica = null, graficaVulnerabilidad = null, featureGroup = L.featureGroup().addTo(map), modoCaptura = false;

const getHeaders = () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` });

// SESIÓN
const userName = localStorage.getItem('user_name');
if (userName && document.getElementById('displayUserName')) document.getElementById('displayUserName').innerText = `👤 Hola, ${userName}`;
document.getElementById('btnLogout').onclick = () => { if (confirm("¿Cerrar sesión?")) { localStorage.clear(); window.location.href = 'login.html'; } };

// CARGAR SEDES
async function cargarSedes() {
    try {
        const res = await fetch('http://127.0.0.1:8000/sedes', { headers: getHeaders() });
        const sedes = await res.json();
        for (let n in marcadores) map.removeLayer(marcadores[n].marker);
        marcadores = {};
        sedes.forEach(s => {
            const marker = L.marker([s.latitud, s.longitud], { icon: crearIcono('blue') }).addTo(map);
            marker.bindPopup(`<b>${s.nombre}</b><br>🏙️ ${s.ciudad || 'Bogotá'}<br>📍 ${s.direccion}`);
            marcadores[s.nombre] = { id: s.id, marker, direccion: s.direccion, ciudad: s.ciudad || 'Bogotá', procesos: s.procesos || [], eventos: s.eventos || [] };
        });
    } catch (e) { console.warn("Offline"); }
}
cargarSedes();

function crearIcono(col) {
    const colors = { red: '#dc2626', yellow: '#d97706', blue: '#2563eb', green: '#059669' };
    return L.divIcon({ html: `<svg width="35" height="35" viewBox="0 0 24 24"><path fill="${colors[col]}" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z"/></svg>`, className: 'custom-marker', iconSize: [35, 35], iconAnchor: [17, 35] });
}

// --- 2. FILTROS Y BÚSQUEDA ---
window.ejecutarFiltroAvanzado = function () {
    const busqueda = document.getElementById('buscadorProcesos').value.toLowerCase().trim();
    const rtoMax = parseInt(document.getElementById('filtroRTO').value);
    const visibles = [];

    for (let n in marcadores) {
        const s = marcadores[n];
        const coincideT = s.nombre.toLowerCase().includes(busqueda) || s.procesos.some(p => p.nombre.toLowerCase().includes(busqueda));
        const cumpleR = (rtoMax === 999) || s.procesos.some(p => p.rto <= rtoMax);

        if (coincideT && cumpleR) {
            map.addLayer(s.marker);
            visibles.push(s.marker);
        } else {
            map.removeLayer(s.marker);
        }
    }

    if (visibles.length > 0) {
        // Si hay resultados, ajustar el mapa para verlos todos
        const group = L.featureGroup(visibles);
        map.fitBounds(group.getBounds().pad(0.1));
        if (visibles.length === 1) visibles[0].openPopup();
    }
};
window.resetearFiltros = () => {
    document.getElementById('buscadorProcesos').value = "";
    document.getElementById('filtroRTO').value = "999";
    ejecutarFiltroAvanzado();
    // Restaurar vista original si es necesario, o dejar que fitBounds lo maneje al mostrar todo
    map.setView([4.60971, -74.08175], 11);
};

// Event Listeners para Búsqueda Explícita
document.addEventListener("DOMContentLoaded", () => {
    const btnSearch = document.getElementById('btnProcesosSearch');
    const inputSearch = document.getElementById('buscadorProcesos');
    if (btnSearch) btnSearch.addEventListener('click', ejecutarFiltroAvanzado);
    if (inputSearch) inputSearch.addEventListener('keypress', (e) => { if (e.key === 'Enter') ejecutarFiltroAvanzado(); });
});

document.getElementById('btnBuscarDireccion').onclick = function () {
    const dir = document.getElementById('direccionBuscar').value;
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(dir)}, Bogotá`)
        .then(r => r.json()).then(data => { if (data[0]) { map.setView([data[0].lat, data[0].lon], 15); L.marker([data[0].lat, data[0].lon]).addTo(map).bindPopup(dir).openPopup(); } });
};

// --- 3. DIBUJO Y CLASIFICACIÓN ---
const drawControl = new L.Control.Draw({ draw: { circle: true, polygon: { allowIntersection: false, shapeOptions: { color: '#ef4444', fillOpacity: 0.3 } }, rectangle: true, marker: false, polyline: false }, edit: { featureGroup } });
map.addControl(drawControl);
map.on(L.Draw.Event.CREATED, (e) => { featureGroup.addLayer(e.layer); zonas.push(e.layer); actualizarColoresSedes(); });
map.on(L.Draw.Event.DELETED, () => { zonas = []; featureGroup.eachLayer(l => zonas.push(l)); actualizarColoresSedes(); });

function clasificarSedes() {
    const af = [], cer = [], nor = [];
    for (let n in marcadores) {
        let pos = marcadores[n].marker.getLatLng(), inside = false, dMin = Infinity;
        zonas.forEach(z => {
            if (z instanceof L.Circle) { let d = z.getLatLng().distanceTo(pos); if (d <= z.getRadius()) inside = true; dMin = Math.min(dMin, d - z.getRadius()); }
            else { if (puntoEnPoligono(marcadores[n].marker.getLatLng(), z)) inside = true; dMin = Math.min(dMin, z.getBounds().getCenter().distanceTo(pos)); }
        });
        if (inside) af.push(n); else if (dMin <= 2000) cer.push(n); else nor.push(n);
    } return { af, cer, nor };
}
function puntoEnPoligono(p, poly) { try { const vs = poly.getLatLngs()[0]; let x = p.lat, y = p.lng, inside = false; for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) { if (((vs[i].lng > y) != (vs[j].lng > y)) && (x < (vs[j].lat - vs[i].lat) * (y - vs[i].lng) / (vs[j].lng - vs[i].lng) + vs[i].lat)) inside = !inside; } return inside; } catch (e) { return false; } }
function actualizarColoresSedes() { const { af, cer } = clasificarSedes(); for (let n in marcadores) marcadores[n].marker.setIcon(crearIcono(af.includes(n) ? 'red' : (cer.includes(n) ? 'yellow' : 'green'))); }

// --- 4. GENERAR IMPACTO ---
document.getElementById('btnGenerarResumen').onclick = async function (e) {
    e.preventDefault();
    const { af, cer, nor } = clasificarSedes();
    const total = af.length + cer.length + nor.length;
    if (zonas.length === 0) return alert("⚠️ Dibuja una zona.");

    // Recuperar valores del DOM (Agregado de nuevo)
    const alerta = document.getElementById('nivelAlerta').value;
    const tipo = document.getElementById('tipoEvento').value;
    const desc = document.getElementById('descripcionEvento').value;

    // --- LÓGICA DE CIUDAD VS NACIONAL ---
    // 1. Determinar Ciudad del Evento (basado en la primera afectada, o fallback a Bogotá)
    const ciudadEvento = af.length > 0 ? marcadores[af[0]].ciudad : (cer.length > 0 ? marcadores[cer[0]].ciudad : "Bogotá");

    // 2. Filtrar universos
    const sedesCiudad = Object.values(marcadores).filter(m => m.ciudad === ciudadEvento);
    const totalCiudad = sedesCiudad.length;
    const totalNacional = Object.keys(marcadores).length;

    // 3. Contar estados en la ciudad específica
    const afC = af.filter(n => marcadores[n].ciudad === ciudadEvento).length;
    const cerC = cer.filter(n => marcadores[n].ciudad === ciudadEvento).length;
    const norC = totalCiudad - afC - cerC; // El resto en la ciudad son normales

    // PORCENTAJES CIUDAD
    const pAf = ((afC / totalCiudad) * 100).toFixed(1);
    const pCer = ((cerC / totalCiudad) * 100).toFixed(1);
    const pNor = ((norC / totalCiudad) * 100).toFixed(1);

    // DIBUJAR RESULTADOS
    // DIBUJAR RESULTADOS
    document.getElementById('panel-resultados').style.display = 'block';

    // a. Resumen Texto
    document.getElementById('infoResumen').innerHTML = `<h2>📋 Impacto en ${ciudadEvento}: ${tipo}</h2><p>Alerta: ${alerta}</p><p style="white-space:pre-line">${desc}</p>`;

    // b. Tarjetas de Estadísticas
    const statsHTML = `
        <div class="stat-box rojo"><h3>${afC}</h3>Afectadas (${pAf}%)</div>
        <div class="stat-box amarillo"><h3>${cerC}</h3>Cercanas (${pCer}%)</div>
        <div class="stat-box verde"><h3>${norC}</h3>Normales (${pNor}%)</div>
    `;
    document.querySelector('.stats-container').innerHTML = statsHTML;

    // GUARDAR EVENTO EN BASE DE DATOS
    try {
        await fetch('http://127.0.0.1:8000/eventos', {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                tipo,
                descripcion: desc,
                fecha: new Date().toLocaleString(),
                nivel_alerta: alerta,
                geometria: JSON.stringify(zonas[0].toGeoJSON()), // Asumimos zona 0 por ahora para historial simple
                sedes_afectadas_ids: af.map(n => marcadores[n].id)
            })
        });
        console.log("✅ Evento guardado en historial.");
    } catch (e) { console.error("❌ Error guardando evento:", e); }

    try {
        // GRÁFICA 1: LOCAL (Doughnut)
        const ctx = document.getElementById('graficaSedes').getContext('2d');
        if (typeof grafica !== 'undefined' && grafica) grafica.destroy();
        grafica = new Chart(ctx, {
            type: 'doughnut',
            data: { labels: ['Afectadas', 'Cercanas', 'Normales'], datasets: [{ data: [afC, cerC, norC], backgroundColor: ['#ef4444', '#f59e0b', '#10b981'] }] },
            options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, responsive: true }
        });

        // GRÁFICA 2: NACIONAL (Barra Comparativa)
        const ctxN = document.getElementById('graficaNacional').getContext('2d');
        if (typeof window.graficaNacionalChart !== 'undefined' && window.graficaNacionalChart) window.graficaNacionalChart.destroy();
        window.graficaNacionalChart = new Chart(ctxN, {
            type: 'bar',
            data: {
                labels: ['Total Nacional', 'Total Afectadas'],
                datasets: [{
                    label: 'Sedes',
                    data: [totalNacional, af.length],
                    backgroundColor: ['#3b82f6', '#ef4444']
                }]
            },
            options: { maintainAspectRatio: false, responsive: true, scales: { y: { beginAtZero: true } } }
        });
    } catch (err) { console.error("Error graficando:", err); }

    let resHtml = '<h3>🏢 Detalle BIA</h3>';
    if (af.length === 0) resHtml += "<p>No hay sedes afectadas.</p>";
    else {
        af.forEach(s => {
            let best = "Ninguna"; let minD = Infinity; nor.forEach(n => { let d = marcadores[s].marker.getLatLng().distanceTo(marcadores[n].marker.getLatLng()); if (d < minD) { minD = d; best = n; } });
            resHtml += `<div class="sede-card-afectada"><strong>🔴 ${s}</strong><br><small>Alterna Sugerida: ${best}</small><table class="tabla-procesos"><tr><th>Proceso</th><th>Nivel</th><th>RTO</th><th>RPO</th></tr>${marcadores[s].procesos.map(p => `<tr><td>${p.nombre}</td><td>${p.criticidad}</td><td>${p.rto}h</td><td>${p.rpo}h</td></tr>`).join('')}</table></div>`;
        });
    }
    document.getElementById('listaSedesAfectadas').innerHTML = resHtml;
    setTimeout(() => document.getElementById('panel-resultados').scrollIntoView({ behavior: 'smooth' }), 100);
};

// --- 5. ADMINISTRACIÓN (CRUD COMPLETO) ---
if (localStorage.getItem('role') === 'admin') document.getElementById('btnAdmin').style.display = 'block';

window.switchTab = (id) => { document.querySelectorAll('.admin-tab').forEach(t => t.style.display = 'none'); document.getElementById(id).style.display = 'block'; };
window.iniciarCapturaMapa = () => { modoCaptura = true; document.getElementById('modalAdmin').style.display = 'none'; alert("📍 Clic en mapa."); };
map.on('click', function (e) { if (modoCaptura) { document.getElementById('adm_sede_lat').value = e.latlng.lat.toFixed(6); document.getElementById('adm_sede_lng').value = e.latlng.lng.toFixed(6); document.getElementById('modalAdmin').style.display = 'block'; modoCaptura = false; } });

async function cargarDatosAdmin() {
    const h = getHeaders();
    const resU = await fetch('http://127.0.0.1:8000/admin/users', { headers: h });
    const users = await resU.json();
    document.getElementById('listaUsuariosAdmin').innerHTML = users.map(u => `<div class="historial-item"><span>${u.full_name}</span><div style="display:flex; gap:5px"><button onclick="prepararEdicionUser(${u.id},'${u.full_name}','${u.username}','${u.role}')" style="width:auto; background:orange;">Edit</button><button onclick="borrarUsuario(${u.id})" style="width:auto; background:red;">X</button></div></div>`).join('');
    const resS = await fetch('http://127.0.0.1:8000/sedes', { headers: h });
    const sedes = await resS.json();
    document.getElementById('listaSedesAdmin').innerHTML = sedes.map(s => `<div class="historial-item"><span>${s.nombre}</span><div style="display:flex; gap:5px"><button onclick="prepararEdicionSede(${s.id},'${s.nombre}','${s.direccion}',${s.latitud},${s.longitud})">Edit</button><button onclick="borrarSede(${s.id})">X</button></div></div>`).join('');
    document.getElementById('sel_sede_proceso').innerHTML = sedes.map(s => `<option value="${s.id}">${s.nombre}</option>`).join('');
    cargarProcesosSede();
}

window.cargarProcesosSede = async () => {
    const sedeId = document.getElementById('sel_sede_proceso').value;
    const res = await fetch('http://127.0.0.1:8000/sedes', { headers: getHeaders() });
    const sedes = await res.json();
    const sede = sedes.find(s => s.id == sedeId);
    document.getElementById('listaProcesosAdmin').innerHTML = sede.procesos.map(p => `<div style="display:flex; justify-content:space-between; font-size:12px; padding:5px; border-bottom:1px solid #eee;"><span>${p.nombre} (${p.rto}h)</span><button onclick="borrarProceso(${p.id})" style="width:auto; background:red; margin:0">X</button></div>`).join('') || "Sin procesos.";
};

window.guardarSede = async () => {
    const id = document.getElementById('adm_sede_id').value;
    const body = { nombre: document.getElementById('adm_sede_nom').value, direccion: document.getElementById('adm_sede_dir').value, latitud: parseFloat(document.getElementById('adm_sede_lat').value), longitud: parseFloat(document.getElementById('adm_sede_lng').value) };
    const method = id ? 'PUT' : 'POST';
    const url = id ? `http://127.0.0.1:8000/sedes/${id}` : `http://127.0.0.1:8000/sedes`;
    await fetch(url, { method, headers: getHeaders(), body: JSON.stringify(body) });
    alert("✅ Éxito"); cargarDatosAdmin(); cargarSedes();
};

window.guardarUsuario = async () => {
    const id = document.getElementById('adm_user_id').value;
    const body = { full_name: document.getElementById('adm_user_full').value, username: document.getElementById('adm_user_name').value, role: document.getElementById('adm_user_role').value };
    const pass = document.getElementById('adm_user_pass').value; if (pass) body.password = pass;
    const method = id ? 'PUT' : 'POST';
    const url = id ? `http://127.0.0.1:8000/admin/users/${id}` : `http://127.0.0.1:8000/admin/users`;
    await fetch(url, { method, headers: getHeaders(), body: JSON.stringify(body) });
    alert("✅ Éxito"); cargarDatosAdmin();
};

window.guardarProceso = async () => {
    const body = { nombre: document.getElementById('proc_nombre').value, criticidad: document.getElementById('proc_crit').value, rto: parseInt(document.getElementById('proc_rto').value), rpo: parseInt(document.getElementById('proc_rpo').value), sede_id: parseInt(document.getElementById('sel_sede_proceso').value) };
    await fetch('http://127.0.0.1:8000/procesos', { method: 'POST', headers: getHeaders(), body: JSON.stringify(body) });
    alert("✅ Éxito"); cargarSedes(); cargarProcesosSede();
};

window.borrarSede = async (id) => { if (confirm("¿Borrar?")) { await fetch(`http://127.0.0.1:8000/sedes/${id}`, { method: 'DELETE', headers: getHeaders() }); cargarDatosAdmin(); cargarSedes(); } };
window.borrarUsuario = async (id) => { if (confirm("¿Borrar?")) { await fetch(`http://127.0.0.1:8000/admin/users/${id}`, { method: 'DELETE', headers: getHeaders() }); cargarDatosAdmin(); } };
window.borrarProceso = async (id) => { if (confirm("¿Borrar?")) { await fetch(`http://127.0.0.1:8000/procesos/${id}`, { method: 'DELETE', headers: getHeaders() }); cargarSedes(); cargarProcesosSede(); } };

window.prepararEdicionSede = (id, nom, dir, lat, lng) => { document.getElementById('adm_sede_id').value = id; document.getElementById('adm_sede_nom').value = nom; document.getElementById('adm_sede_dir').value = dir; document.getElementById('adm_sede_lat').value = lat; document.getElementById('adm_sede_lng').value = lng; };
window.prepararEdicionUser = (id, full, user, role) => { document.getElementById('adm_user_id').value = id; document.getElementById('adm_user_full').value = full; document.getElementById('adm_user_name').value = user; document.getElementById('adm_user_role').value = role; };
function limpiarFormSede() { document.getElementById('adm_sede_id').value = ""; document.getElementById('adm_sede_nom').value = ""; document.getElementById('adm_sede_dir').value = ""; document.getElementById('adm_sede_lat').value = ""; document.getElementById('adm_sede_lng').value = ""; }
function limpiarFormUser() { document.getElementById('adm_user_id').value = ""; document.getElementById('adm_user_full').value = ""; document.getElementById('adm_user_name').value = ""; document.getElementById('adm_user_pass').value = ""; }

// --- 6. MODALES Y PDF ---
document.getElementById('btnAdmin').onclick = () => { document.getElementById('modalAdmin').style.display = 'block'; cargarDatosAdmin(); };
document.getElementById('cerrarAdmin').onclick = () => document.getElementById('modalAdmin').style.display = 'none';

async function generarPDFMaster(tituloDoc, alerta, tipo, descripcion, fecha, stats) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const { af } = clasificarSedes(); // Re-calculamos para tener la lista exacta en ese momento

    // 1. Cabecera Corporativa
    doc.setFillColor(30, 41, 59); // Slate 800
    doc.rect(0, 0, 210, 35, 'F');
    doc.setTextColor(255);
    doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.text(tituloDoc, 105, 18, { align: 'center' });
    doc.setFontSize(10); doc.text("SISTEMA DE GESTIÓN DE CONTINUIDAD DE NEGOCIO", 105, 26, { align: 'center' });

    // 2. Información del Evento
    doc.setTextColor(33);
    doc.setFontSize(12); doc.setFont("helvetica", "bold");
    doc.text("DETALLES DEL EVENTO", 15, 45);

    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    doc.setDrawColor(200); doc.line(15, 47, 195, 47);

    doc.text(`• FECHA DE REPORTE: ${fecha}`, 15, 55);
    doc.text(`• TIPO DE INCIDENTE: ${tipo}`, 15, 60);
    doc.text(`• NIVEL DE ALERTA: ${alerta}`, 15, 65);

    const splitDesc = doc.splitTextToSize(`DESCRIPCIÓN: ${descripcion}`, 180);
    doc.text(splitDesc, 15, 75);

    let currentY = 75 + (splitDesc.length * 5) + 10;

    // 3. Resumen Estadístico (Tabla simple)
    doc.setFont("helvetica", "bold"); doc.text("RESUMEN DE IMPACTO", 15, currentY);
    doc.line(15, currentY + 2, 195, currentY + 2);

    // Dibujamos cajas de estadisticas
    if (stats) {
        currentY += 10;
        const boxes = [
            { label: "AFECTADAS", val: stats.afC, pct: stats.pAf, col: [220, 38, 38] },
            { label: "CERCANAS", val: stats.cerC, pct: stats.pCer, col: [217, 119, 6] },
            { label: "NORMALES", val: stats.norC, pct: stats.pNor, col: [5, 150, 105] }
        ];

        boxes.forEach((b, i) => {
            const x = 15 + (i * 63);
            doc.setFillColor(...b.col);
            doc.rect(x, currentY, 55, 20, 'F');
            doc.setTextColor(255); doc.setFontSize(14); doc.text(`${b.val}`, x + 27, currentY + 8, { align: 'center' });
            doc.setFontSize(9); doc.text(`${b.label} (${b.pct}%)`, x + 27, currentY + 16, { align: 'center' });
        });
        currentY += 30;
    }

    // 4. Captura del Mapa (Zoom automático antes de capturar)
    // Hacemos focus en las zonas primero
    if (zonas.length > 0) {
        const group = L.featureGroup(zonas);
        map.fitBounds(group.getBounds().pad(0.2));
        await new Promise(r => setTimeout(r, 500)); // Esperar zoom
    }

    const canvasMapa = await html2canvas(document.getElementById('map'), { useCORS: true, scale: 2 });
    // Ajustar imagen para que quepa
    if (currentY + 80 > 280) { doc.addPage(); currentY = 20; }
    doc.setTextColor(33); doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text("MAPA DE SITUACIÓN", 15, currentY);
    doc.addImage(canvasMapa.toDataURL('image/png'), 'PNG', 15, currentY + 5, 180, 80);
    currentY += 95;

    // 5. Gráficas (Si existen)
    const can1 = document.getElementById('graficaSedes');
    const can2 = document.getElementById('graficaNacional');

    if (currentY + 60 > 280) { doc.addPage(); currentY = 20; }

    doc.text("ANÁLISIS GRÁFICO", 15, currentY);
    if (can1 && can2) {
        doc.addImage(can1.toDataURL('image/png'), 'PNG', 15, currentY + 5, 85, 50);
        doc.addImage(can2.toDataURL('image/png'), 'PNG', 110, currentY + 5, 85, 50);
        currentY += 65;
    }

    // 6. Tabla Detallada
    doc.addPage();
    const filas = [];
    af.forEach(s => marcadores[s].procesos.forEach(p => filas.push([s, p.nombre, p.criticidad, p.rto + 'h', p.rpo + 'h', marcadores[s].direccion])));

    doc.autoTable({
        startY: 20,
        head: [['Sede', 'Proceso', 'Nivel', 'RTO', 'RPO', 'Dirección']],
        body: filas,
        theme: 'grid',
        headStyles: { fillColor: [220, 38, 38], fontSize: 10 },
        styles: { fontSize: 9 }
    });

    doc.save(`Informe_BIA_${fecha.replace(/[/, :]/g, '_')}.pdf`);
}

document.getElementById('btnDescargarPDF').onclick = () => {
    // Capturar estadisticas actuales del DOM
    const afC = document.querySelector('.rojo h3').innerText;
    const cerC = document.querySelector('.amarillo h3').innerText;
    const norC = document.querySelector('.verde h3').innerText;

    // Extraer porcentajes del texto "(X%)"
    const txtRojo = document.querySelector('.rojo').innerText;
    const txtAm = document.querySelector('.amarillo').innerText;
    const txtVer = document.querySelector('.verde').innerText;

    const pAf = txtRojo.match(/\((.*)%/)?.[1] || 0;
    const pCer = txtAm.match(/\((.*)%/)?.[1] || 0;
    const pNor = txtVer.match(/\((.*)%/)?.[1] || 0;

    const stats = { afC, cerC, norC, pAf, pCer, pNor };

    generarPDFMaster(
        "INFORME DE CONTINUIDAD",
        document.getElementById('nivelAlerta').value,
        document.getElementById('tipoEvento').value,
        document.getElementById('descripcionEvento').value,
        new Date().toLocaleString(),
        stats
    );
};

window.descargarPDFHistorico = async function (id) {
    const res = await fetch('http://127.0.0.1:8000/eventos', { headers: getHeaders() });
    const data = await res.json();
    const ev = data.find(e => e.id == id);

    if (!ev) return alert("Evento no encontrado");

    // --- REPLAY DEL EVENTO ---
    if (confirm("Para generar el PDF histórico, el sistema debe visualizar el evento en el mapa momentáneamente. ¿Desea continuar?")) {
        document.getElementById('modalHistorial').style.display = 'none';

        // 1. Restaurar datos del formulario
        document.getElementById('nivelAlerta').value = ev.nivel_alerta;
        document.getElementById('tipoEvento').value = ev.tipo;
        document.getElementById('descripcionEvento').value = ev.descripcion;

        // 2. Limpiar mapa y zonas actuales
        featureGroup.clearLayers();
        zonas = [];

        // 3. Reconstruir geometría
        const geojsonLayer = L.geoJSON(JSON.parse(ev.geometria));
        geojsonLayer.eachLayer(l => {
            featureGroup.addLayer(l);
            zonas.push(l);
            // Si era circulo, restaurar radio (aproximado si es geojson puro, o usar propiedades si guardamos feature completa)
            // Nota: Al guardar GeoJSON los circulos se vuelven poligonos en leaflet por defecto salvo que usemos logic customs.
            // Asumiremos poligonos para simplificar la demo o reconstruccion basica.
        });

        // 4. Centrar
        const group = L.featureGroup(zonas);
        map.fitBounds(group.getBounds().pad(0.2));

        // 5. Ejecutar lógica de impacto (esto actualiza graficas y stats)
        document.getElementById('btnGenerarResumen').click();

        // 6. Esperar a que todo se renderice y lanzar PDF
        setTimeout(() => {
            document.getElementById('btnDescargarPDF').click();
        }, 1500); // Dar tiempo a las animaciones de mapas y charts
    }
};

document.getElementById('btnVerDashboard').onclick = async function () {
    document.getElementById('modalDashboard').style.display = 'block';
    // Esperar a que el modal sea visible para renderizar Chart.js correctamente
    requestAnimationFrame(async () => {
        try {
            const res = await fetch('http://127.0.0.1:8000/sedes', { headers: getHeaders() });
            const sedes = await res.json();
            const ctx = document.getElementById('graficaVulnerabilidad').getContext('2d');
            if (graficaVulnerabilidad) graficaVulnerabilidad.destroy();

            graficaVulnerabilidad = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: sedes.map(s => s.nombre),
                    datasets: [{
                        label: 'Histórico de Impactos',
                        data: sedes.map(s => s.eventos.length),
                        backgroundColor: '#3b82f6'
                    }]
                },
                options: {
                    indexAxis: 'y',
                    maintainAspectRatio: false,
                    responsive: true,
                    plugins: { legend: { display: false }, title: { display: true, text: 'Vulnerabilidad por Sede' } }
                }
            });
        } catch (e) {
            console.error("Error dashboard:", e);
            alert("No se pudo cargar la data del dashboard.");
        }
    });
};

document.getElementById('btnVerHistorial').onclick = async function () {
    document.getElementById('modalHistorial').style.display = 'block';
    try {
        const res = await fetch('http://127.0.0.1:8000/eventos', { headers: getHeaders() });
        const data = await res.json();

        if (data.length === 0) {
            document.getElementById('listaHistorialItems').innerHTML = "<p style='text-align:center'>No hay eventos registrados aún.</p>";
            return;
        }

        document.getElementById('listaHistorialItems').innerHTML = data.reverse().map(ev => `
            <div class="historial-item" style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong style="font-size:16px; color:#0f172a;">${ev.tipo}</strong>
                    <br><small style="color:#64748b;">📅 ${ev.fecha} | 🚨 ${ev.nivel_alerta}</small>
                    <p style="margin:5px 0 0 0; font-size:13px; color:#334155;">${ev.descripcion.substring(0, 100)}...</p>
                </div>
                <button class="btn-success" style="width:auto; padding:8px 15px; margin:0;" onclick="descargarPDFHistorico('${ev.id}')">
                    📥 PDF
                </button>
            </div>
        `).join('');
    } catch (e) {
        console.error("Error historial:", e);
        document.getElementById('listaHistorialItems').innerHTML = "<p>Error cargando historial.</p>";
    }
};
document.getElementById('cerrarDashboard').onclick = () => document.getElementById('modalDashboard').style.display = 'none';
document.getElementById('cerrarHistorial').onclick = () => document.getElementById('modalHistorial').style.display = 'none';
document.getElementById('btnConsultarBIA').onclick = async function () {
    document.getElementById('modalBIA').style.display = 'block';
    const res = await fetch('http://127.0.0.1:8000/sedes', { headers: getHeaders() });
    const sedes = await res.json();
    let h = '<table class="tabla-procesos"><tr><th>Sede</th><th>Proceso</th><th>RTO</th><th>RPO</th><th>Criticidad</th></tr>';
    sedes.forEach(s => {
        if (s.procesos.length === 0) {
            h += `<tr><td><strong>${s.nombre}</strong></td><td colspan="4">Sin procesos registrados</td></tr>`;
        } else {
            s.procesos.forEach(p => {
                const critico = p.rto <= 4;
                h += `<tr>
                    <td><strong>${s.nombre}</strong></td>
                    <td>${p.nombre}</td>
                    <td>${p.rto}h</td>
                    <td>${p.rpo}h</td>
                    <td style="color:${critico ? 'red' : 'green'}"><b>${p.criticidad}</b></td>
                </tr>`;
            });
        }
    });
    document.getElementById('tablaBIACompleta').innerHTML = h + '</table>';
};
document.getElementById('cerrarBIA').onclick = () => document.getElementById('modalBIA').style.display = 'none';