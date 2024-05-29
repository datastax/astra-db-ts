import './style.css'
import { DataAPIClient } from '@datastax/astra-db-ts';

const client = new DataAPIClient(import.meta.env.VITE_ASTRA_DB_TOKEN);
const db = client.db(`https://corsproxy.io/?${import.meta.env.VITE_ASTRA_DB_ENDPOINT}`);

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = '<p>Loading...</p>';

db.listCollections().then((collections) => {
  app.innerHTML = `<code>${JSON.stringify(collections, null, 2)}</code>`;
});
