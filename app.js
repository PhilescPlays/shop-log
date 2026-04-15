async function processFile(file) {
    if (!file) return;
    let text;
    if (file.name.endsWith('.gz')) {
        const ds = new DecompressionStream('gzip');
        const decompressedStream = file.stream().pipeThrough(ds);
        const decompressedBlob = await new Response(decompressedStream).blob();
        text = await decompressedBlob.text();
    } else {
        text = await file.text();
    }
    procesarTextoLog(text, file.name);
}

document.getElementById('logFile').addEventListener('change', function(event) {
    processFile(event.target.files[0]);
});

document.querySelector('.custom-file-upload').addEventListener('click', function(e) {
    e.preventDefault();
    document.getElementById('logFile').click();
});

// Drag and drop support (whole page)
document.addEventListener('dragover', function(e) {
    e.preventDefault();
    document.body.classList.add('drag-over');
});

document.addEventListener('dragleave', function(e) {
    // Only remove class when leaving the page entirely
    if (e.relatedTarget === null) {
        document.body.classList.remove('drag-over');
    }
});

document.addEventListener('drop', function(e) {
    e.preventDefault();
    document.body.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) {
        processFile(file);
    }
});

document.addEventListener('paste', function(e) {
    if (e.clipboardData && e.clipboardData.getData) {
        const text = e.clipboardData.getData('text');
        if (text && text.length > 0) {
            procesarTextoLog(text);
        }
    }
});

function procesarTextoLog(text, fileName) {
    const lines = text.split('\n');
    const sales = [];
    const payments = [];
    const auctions = [];
    let total = 0;
    const regexVenta = /Has vendido (\d+) de (.+?) por \$(\d{1,3}(?:\.\d{3})*,\d{2})/;
    const regexCompra = /Has comprado (\d+) de (.+?) por \$(\d{1,3}(?:\.\d{3})*,\d{2})/;
    const regexPago = /\(!\) Has enviado \$(\d{1,3}(?:\.\d{3})*(?:,\d{2})?) a (.+)\./;
    const regexSubasta = /SUBASTAS ▸ Compraste x(\d+) (?:▸ )?(.+) de (\S+) por (\d+(?:\.\d{3})*(?:,\d{2})?)\$/;
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
            return;
        }
        match = line.match(regexPago);
        if (match) {
            const valorStr = match[1].replace(/\./g, '').replace(',', '.');
            const valor = parseFloat(valorStr);
            const destinatario = match[2];
            payments.push({ destinatario, valor });
            return;
        }
        match = line.match(regexSubasta);
        if (match) {
            const cantidad = parseInt(match[1], 10);
            const item = match[2];
            const valorStr = match[4].replace(/\./g, '').replace(',', '.');
            const valor = parseFloat(valorStr);
            const vendedor = match[3];
            auctions.push({ cantidad, item, valor, vendedor });
        }
    });
    mostrarResultados(sales, total, fileName, payments, auctions);
}

function mostrarResultados(sales, total, fileName, payments, auctions) {
    payments = payments || [];
    auctions = auctions || [];
    if (sales.length === 0 && payments.length === 0 && auctions.length === 0) {
        document.getElementById('results').innerHTML = '<p>No se encontraron ventas, compras ni pagos en el archivo.</p>';
        return;
    }
    // Calcular totales separados
    const totalVentas = sales.filter(s => s.tipo === 'Venta').reduce((acc, s) => acc + s.valor, 0);
    const totalCompras = sales.filter(s => s.tipo === 'Compra').reduce((acc, s) => acc + s.valor, 0);
    const totalPagos = payments.reduce((acc, p) => acc + p.valor, 0);
    const totalSubastas = auctions.reduce((acc, a) => acc + a.valor, 0);
    // The base shop total before payments (ventas - compras)
    const shopTotal = total;
    // Subtract payments and auctions from total
    total -= totalPagos;
    total -= totalSubastas;
    // Check for split query parameter (percentage, comma-separated for multiple)
    const urlParams = new URLSearchParams(window.location.search);
    const splitRaw = urlParams.get('split');
    const splits = splitRaw
        ? splitRaw.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0 && n <= 100)
        : [];
    const hasSplit = splits.length > 0;
    // Commission is based on the shop total (ventas - compras), not affected by payments
    const totalSplitAmount = splits.reduce((acc, pct) => acc + (shopTotal * pct / 100), 0);
    const totalAfterSplit = hasSplit ? (total - totalSplitAmount) : total;
    const hasCustomSplit = urlParams.get('customSplit') === 'true';
    let html = '';
    
    html += `<div id="total" data-base-total="${totalAfterSplit}">Total: $${totalAfterSplit.toLocaleString('es-ES', {minimumFractionDigits: 2})}</div>`;
    if (totalVentas > 0 && totalCompras > 0) {
        html += `<div class="totals-breakdown"><div id="total-ventas"><b>Total ventas:</b> $${totalVentas.toLocaleString('es-ES', {minimumFractionDigits: 2})}</div>`;
        html += `<div id="total-compras"><b>Total compras:</b> -$${totalCompras.toLocaleString('es-ES', {minimumFractionDigits: 2})}</div>`;
    }
    if (hasSplit) {
        if (!(totalVentas > 0 && totalCompras > 0) && !(totalPagos > 0)) {
            html += `<div class="totals-breakdown">`;
        }
        splits.forEach(pct => {
            const amount = shopTotal * pct / 100;
            html += `<div class="total-split"><b>Comisión (${pct}%):</b> -$${amount.toLocaleString('es-ES', {minimumFractionDigits: 2})}</div>`;
        });
    }
    if (totalVentas > 0 && totalCompras > 0 || hasSplit || totalPagos > 0 || totalSubastas > 0) {
        html += `</div>`;
    }
    if (hasCustomSplit) {
        html += `<div class="custom-split-container">
            <label for="customSplitInput"><b>Comisión personalizada ($):</b></label>
            <div class="custom-split-input-wrap">
                <button type="button" id="customSplitDown" class="custom-split-btn">▲</button>
                <input type="number" id="customSplitInput" placeholder="0.00" step="10000" max="0" value="0">
                <button type="button" id="customSplitUp" class="custom-split-btn">▼</button>
            </div>
        </div>`;
    }
    if (totalPagos > 0) {
        if (!(totalVentas > 0 && totalCompras > 0) && !hasSplit) {
            html += `<div class="totals-breakdown">`;
        }
        html += `<div id="total-pagos"><b>Total pagos:</b> -$${totalPagos.toLocaleString('es-ES', {minimumFractionDigits: 2})}</div>`;
    }
    if (totalSubastas > 0) {
        if (!(totalVentas > 0 && totalCompras > 0) && !hasSplit && !(totalPagos > 0)) {
            html += `<div class="totals-breakdown">`;
        }
        html += `<div id="total-subastas"><b>Total subastas:</b> -$${totalSubastas.toLocaleString('es-ES', {minimumFractionDigits: 2})}</div>`;
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
    // Show file name below title
    const fileNameDisplay = document.getElementById('file-name-display');
    if (fileName) {
        fileNameDisplay.textContent = fileName;
        fileNameDisplay.style.display = '';
    } else {
        fileNameDisplay.style.display = 'none';
    }
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
    // Auctions table
    if (auctions.length > 0) {
        const combinedAuctions = {};
        auctions.forEach(a => {
            const key = a.item + '|' + a.vendedor;
            if (!combinedAuctions[key]) {
                combinedAuctions[key] = { item: a.item, vendedor: a.vendedor, cantidad: 0, valor: 0 };
            }
            combinedAuctions[key].cantidad += a.cantidad;
            combinedAuctions[key].valor += a.valor;
        });
        html += `<h3 class="payments-title">Subastas</h3>`;
        html += '<table id="auctions-table"><tr><th>Objeto</th><th id="auction-cantidad-header">Cantidad</th><th>Vendedor</th><th>Precio</th></tr>';
        Object.values(combinedAuctions).forEach(a => {
            html += `<tr><td>${a.item}</td><td class="cantidad-cell" data-cantidad="${a.cantidad}">${a.cantidad}</td><td>${a.vendedor}</td><td>-$${a.valor.toLocaleString('es-ES', {minimumFractionDigits: 2})}</td></tr>`;
        });
        // html += `<tr class="payments-total-row"><td colspan="3"><b>Total subastas</b></td><td><b>-$${totalSubastas.toLocaleString('es-ES', {minimumFractionDigits: 2})}</b></td></tr>`;
        html += `</table>`;
    }
    // Payments table
    if (payments.length > 0) {
        // Combine payments by recipient
        const combinedPayments = {};
        payments.forEach(p => {
            if (!combinedPayments[p.destinatario]) {
                combinedPayments[p.destinatario] = { destinatario: p.destinatario, valor: 0, count: 0 };
            }
            combinedPayments[p.destinatario].valor += p.valor;
            combinedPayments[p.destinatario].count += 1;
        });
        html += `<h3 class="payments-title">Pagos enviados</h3>`;
        html += '<table id="payments-table"><tr><th>Destinatario</th><th>Envíos</th><th>Monto</th></tr>';
        Object.values(combinedPayments).forEach(p => {
            html += `<tr><td>${p.destinatario}</td><td>${p.count}</td><td>-$${p.valor.toLocaleString('es-ES', {minimumFractionDigits: 2})}</td></tr>`;
        });
        // html += `<tr class="payments-total-row"><td colspan="2"><b>Total pagos</b></td><td><b>-$${totalPagos.toLocaleString('es-ES', {minimumFractionDigits: 2})}</b></td></tr>`;
        html += `</table>`;
    }
    html += `<div style="text-align:center;margin:10px 0 0 0;">
        <label class="toggle-switch" style="vertical-align:middle;">
            <input type="checkbox" id="toggleChests">
            <span class="toggle-slider"></span>
        </label>
        <span style="vertical-align:middle;">Cantidades en Shulkers</span>
    </div>`;
    document.getElementById('results').innerHTML = html;
    // Hide tutorial text and file upload, show copy-image button
    document.querySelector('.container > p').style.display = 'none';
    document.getElementById('fileUploadLabel').style.display = 'none';
    const copyBtn = document.getElementById('copyImageBtn');
    copyBtn.style.display = '';
    copyBtn.textContent = 'Copiar imagen';
    // Remove old listener by replacing node
    const newCopyBtn = copyBtn.cloneNode(true);
    copyBtn.parentNode.replaceChild(newCopyBtn, copyBtn);
    newCopyBtn.addEventListener('click', async function() {
        const container = document.querySelector('.container');
        // Hide elements that shouldn't appear in the image
        const tutorialText = container.querySelector('p');
        const btnSelf = document.getElementById('copyImageBtn');
        if (tutorialText) tutorialText.style.display = 'none';
        if (btnSelf) btnSelf.style.display = 'none';
        try {
            const canvas = await html2canvas(container, { backgroundColor: '#282c34', scale: 2 });
            canvas.toBlob(async (blob) => {
                try {
                    await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]);
                    newCopyBtn.textContent = '¡Copiado!';
                    setTimeout(() => { newCopyBtn.textContent = 'Copiar imagen'; }, 2000);
                } catch {
                    newCopyBtn.textContent = 'Error al copiar';
                    setTimeout(() => { newCopyBtn.textContent = 'Copiar imagen'; }, 2000);
                }
            }, 'image/png');
        } catch {
            newCopyBtn.textContent = 'Error al capturar';
            setTimeout(() => { newCopyBtn.textContent = 'Copiar imagen'; }, 2000);
        } finally {
            // Restore hidden elements (except tutorial text, already removed)
            if (btnSelf) btnSelf.style.display = '';
        }
    });
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
                const auctionHeader = document.getElementById('auction-cantidad-header');
                if (auctionHeader) auctionHeader.textContent = 'Shulkers';
            } else {
                cell.textContent = cantidad;
                document.getElementById('cantidad-header').textContent = 'Cantidad';
                const auctionHeader = document.getElementById('auction-cantidad-header');
                if (auctionHeader) auctionHeader.textContent = 'Cantidad';
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
    // Add custom split handler
    if (hasCustomSplit) {
        const customInput = document.getElementById('customSplitInput');
        function updateCustomTotal() {
            let customAmount = parseFloat(customInput.value) || 0;
            if (customAmount > 0) {
                customAmount = 0;
                customInput.value = 0;
            }
            const baseTotal = parseFloat(document.getElementById('total').getAttribute('data-base-total'));
            const newTotal = baseTotal + customAmount;
            document.getElementById('total').textContent = `Total: $${newTotal.toLocaleString('es-ES', {minimumFractionDigits: 2})}`;
        }
        customInput.addEventListener('input', updateCustomTotal);
        // ▲ button subtracts 10K (more negative)
        document.getElementById('customSplitDown').addEventListener('click', function() {
            customInput.value = (parseFloat(customInput.value) || 0) - 10000;
            updateCustomTotal();
        });
        // ▼ button adds 10K (less negative, capped at 0)
        document.getElementById('customSplitUp').addEventListener('click', function() {
            let newVal = (parseFloat(customInput.value) || 0) + 10000;
            if (newVal > 0) newVal = 0;
            customInput.value = newVal;
            updateCustomTotal();
        });
    }
}
