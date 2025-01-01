import express from 'express';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import router from './routes/api';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { handleSocketConnection } from './agent';

dotenv.config();
const app = express();
const port = 3001;

// Create an HTTP server
const server = createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3002'], // Allow frontend ports
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(bodyParser.json({ limit: '50mb' })); // Increase limit to 50MB
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Set up Swagger options
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Date',
      version: '1.0.0',
      description: 'A simple API',
    },
  },
  apis: ['./src/routes/*.ts'], // Path to the API docs
};

const dbconnectionString: string = process.env.DB_CONNECTION_STRING as string;
mongoose
  .connect(dbconnectionString)
  .then(() => {
    console.log('Database connected');
  })
  .catch((err) => {
    console.log('Error from database connection', err);
  });

app.use(
  cors({
    origin: ['http://localhost:3000', 'http://localhost:3002'], // Allow frontend ports
  })
);

// Initialize swagger-jsdoc
const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Set up Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API Routes
app.use('/api/v1', router);

// Define a sample route
app.get('/', (req: express.Request, res: express.Response) => {
  res.send('Hello World!');
});

// Socket.IO event handling
handleSocketConnection(io);
// Start the server
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
