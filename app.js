const express = require('express');
const cors = require('cors');

const app = express();


app.use(cors());
app.use(express.json());


app.get('/', (req, res) => {
    res.json({ message: ' Worklog API is running!' });
});


app.get('/test', (req, res) => {
    res.json({ message: 'Test route working!' });
});

module.exports = app;
