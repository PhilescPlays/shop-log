document.getElementById('logFile').addEventListener('change', async function(event) {
    const file = event.target.files[0];
    if (!file) return;
    let text;
    if (file.name.endsWith('.gz')) {
        // Decompress .gz file using DecompressionStream
        const ds = new DecompressionStream('gzip');
        const decompressedStream = file.stream().pipeThrough(ds);
        const decompressedBlob = await new Response(decompressedStream).blob();
        text = await decompressedBlob.text();
    } else {
        text = await file.text();
    }
    procesarTextoLog(text);
});

document.querySelector('.custom-file-upload').addEventListener('click', function(e) {
    e.preventDefault(); // Prevent default label click behavior
    document.getElementById('logFile').click();
});

document.addEventListener('paste', function(e) {
    if (e.clipboardData && e.clipboardData.getData) {
        const text = e.clipboardData.getData('text');
        if (text && text.length > 0) {
            procesarTextoLog(text);
        }
    }
});

function procesarTextoLog(text) {
    const lines = text.split('\n');
    const sales = [];
    let total = 0;
    const regexVenta = /Has vendido (\d+) de (.+?) por \$(\d{1,3}(?:\.\d{3})*,\d{2})/;
    const regexCompra = /Has comprado (\d+) de (.+?) por \$(\d{1,3}(?:\.\d{3})*,\d{2})/;
    lines.forEach(line => {
        let match = line.match(regexVenta);
        if (match) {
            const cantidad = parseInt(match[1], 10);
            const item = match[2];
            const valorStr = match[3].replace(/\./g, '').replace(',', '.');
            const valor = parseFloat(valorStr);
            sales.push({ tipo: 'Venta', cantidad, item, valor });
            total += valor;
            return;
        }
        match = line.match(regexCompra);
        if (match) {
            const cantidad = parseInt(match[1], 10);
            const item = match[2];
            const valorStr = match[3].replace(/\./g, '').replace(',', '.');
            const valor = parseFloat(valorStr);
            sales.push({ tipo: 'Compra', cantidad, item, valor });
            total -= valor;
        }
    });
    mostrarResultados(sales, total);
}

function mostrarResultados(sales, total) {
    if (sales.length === 0) {
        document.getElementById('results').innerHTML = '<p>No se encontraron ventas ni compras en el archivo.</p>';
        return;
    }
    // Calcular totales separados
    const totalVentas = sales.filter(s => s.tipo === 'Venta').reduce((acc, s) => acc + s.valor, 0);
    const totalCompras = sales.filter(s => s.tipo === 'Compra').reduce((acc, s) => acc + s.valor, 0);
    let html = '';
    html += `<div id="total">Total: $${total.toLocaleString('es-ES', {minimumFractionDigits: 2})}</div>`;
    if (totalVentas > 0 && totalCompras > 0) {
        html += `<div class="totals-breakdown"><div id="total-ventas"><b>Total ventas:</b> $${totalVentas.toLocaleString('es-ES', {minimumFractionDigits: 2})}</div>`;
        html += `<div id="total-compras"><b>Total compras:</b> -$${totalCompras.toLocaleString('es-ES', {minimumFractionDigits: 2})}</div></div>`;
    }
    // Combinar transacciones por tipo+item y guardar detalles
    const combined = {};
    sales.forEach((sale, idx) => {
        const key = sale.tipo + '|' + sale.item;
        if (!combined[key]) {
            combined[key] = { tipo: sale.tipo, item: sale.item, cantidad: 0, valor: 0, detalles: [] };
        }
        combined[key].cantidad += sale.cantidad;
        combined[key].valor += sale.valor;
        combined[key].detalles.push({ ...sale });
    });
    html += '<table id="results-table"><tr><th>Tipo</th><th>Objeto</th><th id="cantidad-header">Cantidad</th><th>Valor</th></tr>';
    let rowIdx = 0;
    Object.entries(combined).forEach(([key, sale]) => {
        const sign = sale.tipo === 'Compra' ? '-' : '';
        const rowId = `row-${rowIdx}`;
        html += `<tr class="expandable-row" data-row="${rowId}" style="cursor:pointer;">
            <td>${sale.tipo}</td><td>${sale.item}</td><td class="cantidad-cell" data-cantidad="${sale.cantidad}">${sale.cantidad}</td><td>${sign}$${sale.valor.toLocaleString('es-ES', {minimumFractionDigits: 2})}</td>
        </tr>`;
        html += `<tr class="details-row" id="${rowId}" style="display:none;background:rgba(60,60,80,0.18);">
            <td colspan="4">
                <ul style="margin:0 0 0 1em;padding:0;list-style:disc;">
                    ${sale.detalles.map(d => {
                        const dsign = d.tipo === 'Compra' ? '-' : '';
                        return `<li class="detalle-cantidad" data-cantidad="${d.cantidad}">${d.tipo} - <span class="detalle-cantidad-val">${d.cantidad}</span> x ${d.item} por ${dsign}$${d.valor.toLocaleString('es-ES', {minimumFractionDigits: 2})}</li>`;
                    }).join('')}
                </ul>
            </td>
        </tr>`;
        rowIdx++;
    });
    html += `</table>`;
    html += `<div style="text-align:center;margin:10px 0 0 0;">
        <label class="toggle-switch" style="vertical-align:middle;">
            <input type="checkbox" id="toggleChests">
            <span class="toggle-slider"></span>
        </label>
        <span style="vertical-align:middle;">Cantidades en Shulkers</span>
    </div>`;
    document.getElementById('results').innerHTML = html;
    // Add click handlers for expandable rows
    document.querySelectorAll('.expandable-row').forEach(row => {
        row.addEventListener('click', function() {
            const rowId = this.getAttribute('data-row');
            const detailsRow = document.getElementById(rowId);
            if (detailsRow.style.display === 'none') {
                detailsRow.style.display = '';
            } else {
                detailsRow.style.display = 'none';
            }
        });
    });
    // Add toggle handler for chests/amounts
    document.getElementById('toggleChests').addEventListener('change', function() {
        const checked = this.checked;
        // Main table
        document.querySelectorAll('.cantidad-cell').forEach(cell => {
            const cantidad = parseInt(cell.getAttribute('data-cantidad'), 10);
            if (checked) {
                cell.textContent = (cantidad / 1728).toFixed(2);
                document.getElementById('cantidad-header').textContent = 'Shulkers';
            } else {
                cell.textContent = cantidad;
                document.getElementById('cantidad-header').textContent = 'Cantidad';
            }
        });
        // Details
        document.querySelectorAll('.detalle-cantidad').forEach(li => {
            const span = li.querySelector('.detalle-cantidad-val');
            const cantidad = parseInt(li.getAttribute('data-cantidad'), 10);
            if (checked) {
                span.textContent = (cantidad / 1728).toFixed(2) + ' shulkers';
            } else {
                span.textContent = cantidad;
            }
        });
    });
}
