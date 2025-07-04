import mysql from 'mysql2';

// Create a connection to the MySQL database
const connection = mysql.createConnection({
  host: 'localhost', // Update if your DB is hosted elsewhere
  user: 'u652554119_admissions', // Replace with your DB user
  password: 'Dg6iW4uYOCyzBFfG', // Replace with your DB password
  database: 'u652554119_admissions' // Replace with your DB name
});

// Connect to the database
connection.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err.stack);
    return;
  }
  console.log('Connected to MySQL as id', connection.threadId);
});

export default connection; 