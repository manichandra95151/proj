import 'dotenv/config';
import { createYoga } from 'graphql-yoga';
import { createServer } from 'http';
import { resolvers } from './resolvers';
import { typeDefs } from '../lib/graphql';

const yoga = createYoga({
  typeDefs,
  resolvers,
  cors: {
    origin: ['http://localhost:5173', 'https://localhost:5173'],
    credentials: true,
  },
  context: ({ request }) => {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    return {
      token,
    };
  },
});

const server = createServer(yoga);

server.listen(4000, () => {
  console.log('GraphQL Server is running on http://localhost:4000/graphql');
});