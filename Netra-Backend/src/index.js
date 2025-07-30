import Fastify from 'fastify';
import cors from '@fastify/cors';
import pkg from 'pg';
const { Client } = pkg;
import { v4 as uuidv4 } from 'uuid';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv'; dotenv.config();
import fs from 'fs';
import path from 'path';

async function runMigrations(db) {
  try {
    console.log('Running database migrations...');
    
    // Read migration files
    const migrationsDir = path.join(process.cwd(), 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    for (const file of migrationFiles) {
      console.log(`Running migration: ${file}`);
      const migrationPath = path.join(migrationsDir, file);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      
      // Split by semicolon and execute each statement
      const statements = migrationSQL.split(';').filter(stmt => stmt.trim());
      for (const statement of statements) {
        if (statement.trim()) {
          await db.query(statement);
        }
      }
    }
    
    console.log('Database migrations completed successfully');
  } catch (error) {
    console.error('Migration error:', error);
    // Don't throw error, continue with startup
  }
}

async function start() {
  const app = Fastify({ logger: true });
  await app.register(cors);

  let db;
  try {
    // Use Railway's DATABASE_URL or fallback to local
    const databaseUrl = process.env.DATABASE_URL || 'postgres://netra:netra@localhost:5432/netra';
    db = new Client({ connectionString: databaseUrl });
    await db.connect();
    console.log('Database connected successfully');
    
    // Run migrations
    await runMigrations(db);
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
    try {
      if (db) {
        await db.query('SELECT 1');
      }
      return { status: 'ok', database: db ? 'connected' : 'disconnected' };
    } catch (error) {
      return { status: 'error', database: 'error', message: error.message };
    }
  });

  app.get('/', async () => {
    console.log('Root endpoint called');
    return { msg: 'Netra backend' };
  });

  // Auth routes
  app.post('/auth/signup', async (request, reply) => {
    if (!db) {
      reply.code(500).send({ error: 'Database not available' });
      return;
    }
    
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
    if (!db) {
      reply.code(500).send({ error: 'Database not available' });
      return;
    }
    
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

  // Room routes
  app.post('/rooms', { preHandler: verifyJWT }, async (request, reply) => {
    const { name, description, maxParticipants = 5 } = request.body;
    
    if (!name || name.trim().length === 0) {
      reply.code(400).send({ error: 'Room name is required' });
      return;
    }

    if (maxParticipants < 2 || maxParticipants > 5) {
      reply.code(400).send({ error: 'Max participants must be between 2 and 5' });
      return;
    }

    try {
      const result = await db.query(
        'INSERT INTO rooms (name, description, created_by, max_participants) VALUES ($1, $2, $3, $4) RETURNING *',
        [name.trim(), description?.trim() || null, request.user.userId, maxParticipants]
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('Error creating room:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  app.get('/rooms', { preHandler: verifyJWT }, async (request) => {
    try {
      const result = await db.query(`
        SELECT 
          r.*,
          u.email as creator_email,
          COUNT(rp.id) as current_participants
        FROM rooms r
        LEFT JOIN users u ON r.created_by = u.id
        LEFT JOIN room_participants rp ON r.id = rp.room_id AND rp.is_active = true
        WHERE r.is_active = true
        GROUP BY r.id, u.email
        ORDER BY r.created_at DESC
      `);
      
      return result.rows;
    } catch (error) {
      console.error('Error fetching rooms:', error);
      throw error;
    }
  });

  app.get('/rooms/:roomId', { preHandler: verifyJWT }, async (request, reply) => {
    const { roomId } = request.params;
    
    try {
      const result = await db.query(`
        SELECT 
          r.*,
          u.email as creator_email,
          COUNT(rp.id) as current_participants
        FROM rooms r
        LEFT JOIN users u ON r.created_by = u.id
        LEFT JOIN room_participants rp ON r.id = rp.room_id AND rp.is_active = true
        WHERE r.id = $1 AND r.is_active = true
        GROUP BY r.id, u.email
      `, [roomId]);
      
      if (result.rows.length === 0) {
        reply.code(404).send({ error: 'Room not found' });
        return;
      }
      
      return result.rows[0];
    } catch (error) {
      console.error('Error fetching room:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  app.post('/rooms/:roomId/join', { preHandler: verifyJWT }, async (request, reply) => {
    const { roomId } = request.params;
    
    try {
      // Check if room exists and is active
      const roomResult = await db.query(
        'SELECT * FROM rooms WHERE id = $1 AND is_active = true',
        [roomId]
      );
      
      if (roomResult.rows.length === 0) {
        reply.code(404).send({ error: 'Room not found' });
        return;
      }
      
      const room = roomResult.rows[0];
      
      // Check if user is already in the room
      const existingParticipant = await db.query(
        'SELECT * FROM room_participants WHERE room_id = $1 AND user_id = $2 AND is_active = true',
        [roomId, request.user.userId]
      );
      
      if (existingParticipant.rows.length > 0) {
        return { message: 'Already in room', roomId };
      }
      
      // Check if room is full
      const participantCount = await db.query(
        'SELECT COUNT(*) FROM room_participants WHERE room_id = $1 AND is_active = true',
        [roomId]
      );
      
      if (parseInt(participantCount.rows[0].count) >= room.max_participants) {
        reply.code(400).send({ error: 'Room is full' });
        return;
      }
      
      // Add user to room
      await db.query(
        'INSERT INTO room_participants (room_id, user_id) VALUES ($1, $2)',
        [roomId, request.user.userId]
      );
      
      return { message: 'Joined room successfully', roomId };
    } catch (error) {
      console.error('Error joining room:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  app.post('/rooms/:roomId/leave', { preHandler: verifyJWT }, async (request, reply) => {
    const { roomId } = request.params;
    
    try {
      await db.query(
        'UPDATE room_participants SET is_active = false, left_at = NOW() WHERE room_id = $1 AND user_id = $2',
        [roomId, request.user.userId]
      );
      
      return { message: 'Left room successfully' };
    } catch (error) {
      console.error('Error leaving room:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  app.get('/rooms/:roomId/participants', { preHandler: verifyJWT }, async (request, reply) => {
    const { roomId } = request.params;
    
    try {
      const result = await db.query(`
        SELECT 
          rp.*,
          u.email
        FROM room_participants rp
        JOIN users u ON rp.user_id = u.id
        WHERE rp.room_id = $1 AND rp.is_active = true
        ORDER BY rp.joined_at
      `, [roomId]);
      
      return result.rows;
    } catch (error) {
      console.error('Error fetching participants:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  await app.listen({ port: 3000, host: '0.0.0.0' });
}

start().catch(console.error); 