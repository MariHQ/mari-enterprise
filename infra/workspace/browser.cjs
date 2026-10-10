// Local, disposable Chrome profile for AX agents' Playwright checks.
// The unguessable connection endpoint is kept outside Git and never printed.
const {chromium} = require('../../apps/base/web/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const server = await chromium.launchServer({channel:'chrome',headless:true,host:'127.0.0.1',port:18083});
  const file = path.resolve(__dirname,'../../.artifacts/browser-endpoint.json');
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,JSON.stringify({endpoint:server.wsEndpoint().replace('127.0.0.1','host.docker.internal'),
    origin:'http://mari-container.stack.127.0.0.1.sslip.io:8084'}),{mode:0o600});
  console.log('AX browser ready on local port 18083');
  const close=async()=>{fs.rmSync(file,{force:true});await server.close();process.exit(0);};
  process.on('SIGTERM',close);process.on('SIGINT',close);
})().catch(error=>{console.error(error.message);process.exit(1);});
