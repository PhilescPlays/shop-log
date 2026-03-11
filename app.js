document.getElementById('logFile').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        const lines = text.split('\n');
        const sales = [];
        let total = 0;
        const regex = /Has vendido (\d+) de (.+?) por \$(\d{1,3}(?:\.\d{3})*,\d{2})/;
        lines.forEach(line => {
            const match = line.match(regex);
            if (match) {
                const cantidad = parseInt(match[1], 10);
                const item = match[2];
                // Convertir valor a número: "25.920,00" -> 25920.00
                const valorStr = match[3].replace(/\./g, '').replace(',', '.');
                const valor = parseFloat(valorStr);
                sales.push({ cantidad, item, valor });
                total += valor;
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
    const regex = /Has vendido (\d+) de (.+?) por \$(\d{1,3}(?:\.\d{3})*,\d{2})/;
    lines.forEach(line => {
        const match = line.match(regex);
        if (match) {
            const cantidad = parseInt(match[1], 10);
            const item = match[2];
            const valorStr = match[3].replace(/\./g, '').replace(',', '.');
            const valor = parseFloat(valorStr);
            sales.push({ cantidad, item, valor });
            total += valor;
        }
    });
    mostrarResultados(sales, total);
}

function mostrarResultados(sales, total) {
    if (sales.length === 0) {
        document.getElementById('results').innerHTML = '<p>No se encontraron ventas en el archivo.</p>';
        return;
    }
    let html = `<div id="total">Total: $${total.toLocaleString('es-ES', {minimumFractionDigits: 2})}</div>`;
    html += '<table><tr><th>Objeto</th><th>Cantidad</th><th>Valor</th></tr>';
    sales.forEach(sale => {
        html += `<tr><td>${sale.item}</td><td>${sale.cantidad}</td><td>$${sale.valor.toLocaleString('es-ES', {minimumFractionDigits: 2})}</td></tr>`;
    });
    html += `</table>`;
    document.getElementById('results').innerHTML = html;
}
