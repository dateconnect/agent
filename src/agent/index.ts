import { DefaultEventsMap, Server } from 'socket.io'
import authAgent from './auth.agent';

export const handleSocketConnection = (io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>)=>{
    io.on('connection', (socket) => {
      console.log('A user connected:', socket.id);

      // Example event
      socket.on('message', (data) => {
        console.log('Message received:', data);
        socket.emit('reply', 'Message received on the server');
      });

      //onbording event
      authAgent.registerUser(socket);

      socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
      });
    });
}