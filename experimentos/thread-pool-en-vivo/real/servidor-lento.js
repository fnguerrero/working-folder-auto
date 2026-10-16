// Servidor HTTP que tarda `ms` en responder (la «base de datos lenta» de los escenarios http-*).
const http = require("node:http");
const ms = Number(process.argv[2] || 100), puerto = Number(process.argv[3] || 18081);
let pedidos = 0;
http.createServer((req, res) => { pedidos++; setTimeout(() => { res.setHeader("Content-Type", "text/plain"); res.end("ok"); }, ms); })
  .listen(puerto, "127.0.0.1", () => console.log(`servidor lento: ${ms} ms en 127.0.0.1:${puerto}`));
setInterval(() => {}, 1 << 30);
