require('dotenv').config();
const app = require('./app');
const { pool } = require('./config/db');

const PORT = process.env.PORT || 5000;

console.log(' Starting server...');
console.log(' Environment:', process.env.NODE_ENV || 'development');


pool.connect()
    .then(client => {
        client.release();
    })
    .catch(err => {
        console.error(' Failed to connect to database:', err.message);
    });

app.listen(PORT, () => {
    console.log(` Server is running on http://localhost:${PORT}`);
    console.log(' API is ready to accept requests');
    console.log('');
    console.log(' Press Ctrl+C to stop the server');
});
