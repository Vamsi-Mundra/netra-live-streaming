import Fastify from 'fastify';
import cors from '@fastify/cors';
import pkg from 'pg';
const { Client } = pkg;
import { v4 as uuidv4 } from 'uuid';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv'; dotenv.config();

async function start() {
  const app = Fastify({ logger: true });
  await app.register(cors);

  let db;
  try {
    db = new Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Database connection failed:', error.message);
    // Continue without database for now
  }

  // JWT verification hook
  const verifyJWT = async (request, reply) => {
    try {
      const token = request.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        throw new Error('No token provided');
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecret');
      request.user = decoded;
    } catch (error) {
      reply.code(401).send({ error: 'Invalid token' });
    }
  };

  app.get('/healthz', async () => {
    console.log('Health check endpoint called');
    return { status: 'ok' };
  });

  app.get('/', async () => {
    console.log('Root endpoint called');
    return { msg: 'Netra backend' };
  });

  // Auth routes
  app.post('/auth/signup', async (request, reply) => {
    const { email, password } = request.body;
    
    try {
      const pwHash = await argon2.hash(password);
      const result = await db.query(
        'INSERT INTO users (email, pw_hash) VALUES ($1, $2) RETURNING id, email',
        [email, pwHash]
      );
      
      const token = jwt.sign(
        { userId: result.rows[0].id, email: result.rows[0].email },
        process.env.JWT_SECRET || 'supersecret',
        { expiresIn: '24h' }
      );
      
      return { token };
    } catch (error) {
      if (error.code === '23505') { // unique constraint violation
        reply.code(400).send({ error: 'Email already exists' });
      } else {
        reply.code(500).send({ error: 'Internal server error' });
      }
    }
  });

  app.post('/auth/login', async (request, reply) => {
    const { email, password } = request.body;
    
    try {
      const result = await db.query('SELECT id, email, pw_hash FROM users WHERE email = $1', [email]);
      
      if (result.rows.length === 0) {
        reply.code(401).send({ error: 'Invalid credentials' });
        return;
      }
      
      const user = result.rows[0];
      const isValid = await argon2.verify(user.pw_hash, password);
      
      if (!isValid) {
        reply.code(401).send({ error: 'Invalid credentials' });
        return;
      }
      
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET || 'supersecret',
        { expiresIn: '24h' }
      );
      
      return { token };
    } catch (error) {
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Protected routes
  app.get('/videos', { preHandler: verifyJWT }, async (request) => {
    const result = await db.query('SELECT * FROM videos WHERE owner_id = $1', [request.user.userId]);
    return result.rows;
  });

  app.post('/streams/start', { preHandler: verifyJWT }, async (request) => {
    const roomId = uuidv4();
    const result = await db.query(
      'INSERT INTO streams (owner_id, status, started_at, room_id) VALUES ($1, $2, NOW(), $3) RETURNING id',
      [request.user.userId, 'live', roomId]
    );
    return { roomId };
  });

  app.post('/streams/stop', { preHandler: verifyJWT }, async (request) => {
    await db.query(
      'UPDATE streams SET status = $1, ended_at = NOW() WHERE owner_id = $2 AND status = $3',
      ['ended', request.user.userId, 'live']
    );
    return { status: 'stopped' };
  });

  await app.listen({ port: 3000, host: '0.0.0.0' });
}

start().catch(console.error); 