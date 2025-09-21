import './config/env.js';
import os from 'os';
import app from './app.js';

const port = process.env.PORT || 3000;
const host = '0.0.0.0';

function getLanIP() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const i of ifaces[name] || []) {
      if (i.family === 'IPv4' && !i.internal) return i.address;
    }
  }
  return '127.0.0.1';
}

app.set('trust proxy', true);

app.listen(port, host, () => {
  const lan = getLanIP();
  console.log('========================================');
  console.log(`RendiScan API escuchando:`);
  console.log(`• Local PC      -> http://localhost:${port}`);
  console.log(`• Emulador AVD  -> http://10.0.2.2:${port}`);
  console.log(`• Genymotion    -> http://10.0.3.2:${port}`);
  console.log(`• Dispositivo/LAN -> http://${lan}:${port}`);
  console.log('========================================');
});
