document.getElementById('logFile').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
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
    };
    reader.readAsText(file);
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
    html += '<table><tr><th>Tipo</th><th>Objeto</th><th>Cantidad</th><th>Valor</th></tr>';
    sales.forEach(sale => {
        const sign = sale.tipo === 'Compra' ? '-' : '';
        html += `<tr><td>${sale.tipo}</td><td>${sale.item}</td><td>${sale.cantidad}</td><td>${sign}$${sale.valor.toLocaleString('es-ES', {minimumFractionDigits: 2})}</td></tr>`;
    });
    html += `</table>`;
    document.getElementById('results').innerHTML = html;
}
