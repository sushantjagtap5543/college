const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const config = {
    user: process.env.POSTGRES_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: 'postgres', // Initial connection to 'postgres'
    password: process.env.POSTGRES_PASSWORD || 'postgres',
    port: process.env.DB_PORT || 5432,
};

async function init() {
    const client = new Client(config);
    try {
        console.log('Connecting to postgres database...');
        await client.connect();
        
        console.log('Creating gps_saas database if not exists...');
        await client.query('DROP DATABASE IF EXISTS gps_saas');
        await client.query('CREATE DATABASE gps_saas');
        await client.end();

        // Connect to new database
        const dbClient = new Client({ ...config, database: 'gps_saas' });
        await dbClient.connect();
        
        console.log('Executing schema.sql...');
        const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
        
        // Split by semicolon but be careful with functions/triggers
        // For simplicity, let's execute the whole block if possible, or use a better parser
        // schema.sql mostly contains standard CREATE TABLE/INSERT commands
        await dbClient.query(schema);
        
        console.log('Database initialized successfully!');
        await dbClient.end();
    } catch (err) {
        console.error('Initialization failed:', err.message);
        process.exit(1);
    }
}

init();
