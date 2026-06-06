/**
 * AfterLink Demo: Microservice Client
 * 
 * Demonstrates calling microservice routes with validation,
 * error handling, and CRUD operations.
 * 
 * Run: node client.js
 */

const { Client } = require('@ajaymyth/client');

async function main() {
  const client = new Client('afterlink://localhost:4002');

  await client.connect();
  console.log('\n=== AfterLink Microservice Demo ===\n');

  // 1. List all users
  console.log('1. List all users:');
  const { users: allUsers, total } = await client.request('listUsers', {});
  console.log(`   Found ${total} users:`);
  for (const u of allUsers) {
    console.log(`   - [${u.id}] ${u.name} (${u.email}) - ${u.role}`);
  }

  // 2. Get a specific user
  console.log('\n2. Get user by ID (valid request):');
  const { user } = await client.request('getUser', { id: 1 });
  console.log(`   User: ${user.name} <${user.email}> [${user.role}]`);

  // 3. Try invalid request (validation error)
  console.log('\n3. Get user with INVALID ID (triggers validation error):');
  try {
    await client.request('getUser', { id: -1 });
  } catch (err) {
    console.log(`   Caught error: ${err.code} - ${err.message}`);
  }

  // 4. Create a new user
  console.log('\n4. Create a new user:');
  const { user: newUser, message } = await client.request('createUser', {
    name: 'Charlie',
    email: 'charlie@example.com',
    role: 'moderator',
  });
  console.log(`   ${message}: [${newUser.id}] ${newUser.name}`);

  // 5. Try creating user with invalid data
  console.log('\n5. Create user with INVALID email (triggers validation error):');
  try {
    await client.request('createUser', { name: 'X', email: 'not-an-email' });
  } catch (err) {
    console.log(`   Caught error: ${err.code} - ${err.message}`);
  }

  // 6. Delete a user
  console.log('\n6. Delete user:');
  const { message: deleteMsg } = await client.request('deleteUser', { id: 2 });
  console.log(`   ${deleteMsg}`);

  // 7. List users again to confirm changes
  console.log('\n7. List users after changes:');
  const { users: updatedUsers, total: updatedTotal } = await client.request('listUsers', {});
  console.log(`   Now ${updatedTotal} users:`);
  for (const u of updatedUsers) {
    console.log(`   - [${u.id}] ${u.name} (${u.email}) - ${u.role}`);
  }

  console.log('\n=== Demo Complete ===\n');

  await client.disconnect();
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
