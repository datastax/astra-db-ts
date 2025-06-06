import './style.css';
import { DataAPIClient } from '@datastax/astra-db-ts';

const client = new DataAPIClient(import.meta.env.VITE_ASTRA_DB_TOKEN, {
  httpOptions: { client: 'fetch' },
});
const db = client.db(`https://cors-anywhere.herokuapp.com/${import.meta.env.VITE_ASTRA_DB_ENDPOINT}`);

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = '<p>Loading...</p>';

db.listCollections().then((collections) => {
  console.log(collections);
  app.innerHTML = `<code>${JSON.stringify(collections, null, 2)}</code>`;
}).catch((error) => {
  console.error(error);
  app.innerHTML = `<p>${error.message}</p>`;
});
