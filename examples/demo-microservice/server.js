/**
 * AfterLink Demo: Microservice RPC with Schema Validation
 * 
 * This demonstrates:
 * - Schema validation with Zod (automatic payload validation)
 * - Middleware chain (logging, timing)
 * - Error handling (validation errors, route errors)
 * - Request/Response pattern for microservice communication
 * 
 * Run: node server.js
 */

const { Server } = require('@ajaymyth/server');
const { z } = require('zod');

const server = new Server({ port: 4002 });

// In-memory user database
const users = new Map([
  [1, { id: 1, name: 'Ajju', email: 'ajju@afterlink.dev', role: 'admin' }],
  [2, { id: 2, name: 'Alice', email: 'alice@example.com', role: 'user' }],
  [3, { id: 3, name: 'Bob', email: 'bob@example.com', role: 'user' }],
]);

// Middleware: Request logging
server.use(async (req, next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  console.log(`  [LOG] ${req.route} - ${duration}ms`);
});

// Route: Get user by ID (with schema validation)
server.on(
  'getUser',
  async (req, res) => {
    const user = users.get(req.body.id);
    if (!user) {
      throw new Error('User not found');
    }
    res.send({ user });
  },
  z.object({
    id: z.number().int().positive().describe('User ID must be a positive integer'),
  })
);

// Route: Create user (with schema validation)
server.on(
  'createUser',
  async (req, res) => {
    const newUser = {
      id: users.size + 1,
      name: req.body.name,
      email: req.body.email,
      role: req.body.role || 'user',
    };
    users.set(newUser.id, newUser);
    res.send({ user: newUser, message: 'User created successfully' });
  },
  z.object({
    name: z.string().min(2).max(50),
    email: z.string().email(),
    role: z.enum(['user', 'admin', 'moderator']).optional(),
  })
);

// Route: List all users
server.on('listUsers', async (req, res) => {
  const allUsers = Array.from(users.values());
  res.send({ users: allUsers, total: allUsers.length });
});

// Route: Delete user
server.on(
  'deleteUser',
  async (req, res) => {
    if (!users.has(req.body.id)) {
      throw new Error('User not found');
    }
    users.delete(req.body.id);
    res.send({ message: `User ${req.body.id} deleted` });
  },
  z.object({
    id: z.number().int().positive(),
  })
);

server.listen().then(() => {
  console.log('Microservice server running on port 4002');
  console.log('Concepts demonstrated:');
  console.log('  - Schema validation (Zod schemas on routes)');
  console.log('  - Middleware (request logging with timing)');
  console.log('  - Error handling (validation errors auto-rejected)');
  console.log('  - CRUD operations over AfterLink');
});
