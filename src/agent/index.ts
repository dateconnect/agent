import { DefaultEventsMap, Server } from 'socket.io'
import authAgent from './auth/auth.agent';
import AuthAgent from './auth/auth.agent';

export const handleSocketConnection = (io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>)=>{
    io.on('connection', (socket) => {
      console.log('A user connected:', socket.id);

      // Example event
      socket.on('message', (data) => {
        console.log('Message received:', data);
        socket.emit('reply', 'Message received on the server');
      });

      //auth agent
      const authAgent = new AuthAgent(socket);
      authAgent.registerUser(); // register the user
      authAgent.login(); // login the user
      


      socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
      });
    });
}