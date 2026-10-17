// A worker thread for surveyAll (golden-case.js): surveys one golden case per message.
import { parentPort } from 'node:worker_threads';
import { survey } from './golden-case.js';

parentPort.on('message', async cs => {
  try { parentPort.postMessage({ result: await survey(cs) }); }
  catch (e) { parentPort.postMessage({ error: String((e && e.stack) || e) }); }
});
